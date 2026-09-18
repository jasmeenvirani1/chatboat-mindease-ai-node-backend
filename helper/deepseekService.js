const OpenAI = require("openai");

// Sibling to geminiService.js: same exports, same message shape in/out,
// same retry/backoff/error-wrapping behavior — talks to DeepSeek's native
// OpenAI-compatible Chat Completions API instead of OpenRouter. Used for
// every module, India included.

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-flash";
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS) || 60000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryConfig() {
  const maxAttempts = 4;
  const baseDelayMs = 500;
  const maxDelayMs = 8000;

  return {
    maxAttempts:
      Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3,
    baseDelayMs:
      Number.isFinite(baseDelayMs) && baseDelayMs >= 0 ? baseDelayMs : 500,
    maxDelayMs:
      Number.isFinite(maxDelayMs) && maxDelayMs > 0 ? maxDelayMs : 8000,
  };
}

function getErrorStatusCode(err) {
  return (
    err?.status ??
    err?.statusCode ??
    err?.response?.status ??
    err?.cause?.status ??
    err?.cause?.statusCode ??
    err?.cause?.response?.status ??
    null
  );
}

function isRetryableDeepseekError(err) {
  const status = getErrorStatusCode(err);
  if ([429, 500, 502, 503, 504].includes(Number(status))) return true;

  const message = String(err?.message || err?.toString?.() || "").toLowerCase();
  if (
    message.includes("503") ||
    message.includes("service unavailable") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("high demand") ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("socket hang up")
  ) {
    return true;
  }

  return false;
}

function computeBackoffDelayMs({ retryCount, baseDelayMs, maxDelayMs }) {
  const unclamped = baseDelayMs * Math.pow(2, Math.max(0, retryCount - 1));
  const delay = Math.min(maxDelayMs, unclamped);
  const jitter = Math.floor(Math.random() * Math.max(1, delay * 0.25));
  return delay + jitter;
}

// Shared by both the non-streaming retry loop and the streaming
// early-retry loop: decides whether to retry and, if so, waits out the
// backoff. Returns false when the caller should stop and rethrow.
async function waitForRetry({ err, attempt, maxAttempts, operationName }) {
  const shouldRetry = attempt < maxAttempts && isRetryableDeepseekError(err);
  if (!shouldRetry) return false;

  const { baseDelayMs, maxDelayMs } = getRetryConfig();
  const delayMs = computeBackoffDelayMs({
    retryCount: attempt,
    baseDelayMs,
    maxDelayMs,
  });
  const status = getErrorStatusCode(err);
  console.warn(
    `DeepSeek ${operationName} failed (attempt ${attempt}/${maxAttempts}, status ${status || "n/a"}). Retrying in ${delayMs}ms...`,
  );
  await sleep(delayMs);
  return true;
}

async function withRetry(operationName, fn, options = {}) {
  const config = getRetryConfig();
  const maxAttempts = Number.isFinite(options.maxAttempts)
    ? Math.max(1, Number(options.maxAttempts))
    : config.maxAttempts;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retrying = await waitForRetry({
        err,
        attempt,
        maxAttempts,
        operationName,
      });
      if (!retrying) throw err;
    }
  }

  throw lastErr;
}

function throwingAsyncIterable(err) {
  return (async function* () {
    throw err;
  })();
}

function formatCacheHitRate(usage) {
  const hit = usage?.prompt_cache_hit_tokens ?? 0;
  const miss = usage?.prompt_cache_miss_tokens ?? 0;
  const prompt = hit + miss;
  if (prompt <= 0) return "n/a";
  return `${((hit / prompt) * 100).toFixed(1)}%`;
}

function loadDeepseekSettings() {
  const deepseek_api_key = process.env.DEEPSEEK_API_KEY || "";
  const deepseek_model = process.env.DEEPSEEK_MODEL || DEEPSEEK_MODEL;

  if (!deepseek_api_key) {
    throw new Error("DeepSeek API key not found (DEEPSEEK_API_KEY env var)");
  }

  return { deepseek_api_key, deepseek_model };
}

// The OpenAI SDK client holds no per-request state (api key/baseURL/timeout
// are fixed at construction), so it's built once and reused across calls
// instead of re-constructing it on every request.
let cachedClient = null;
function getDeepseekClient() {
  const { deepseek_api_key, deepseek_model } = loadDeepseekSettings();

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: deepseek_api_key,
      baseURL: DEEPSEEK_BASE_URL,
      timeout: DEEPSEEK_TIMEOUT_MS,
    });
  }

  return { client: cachedClient, deepseek_model };
}

function extractSystemInstruction(messages) {
  const systemMessages = (messages || []).filter((m) => m.role === "system");

  return systemMessages
    .map((m) => {
      let content = m.content;

      if (Array.isArray(m.emotion_knowledge_sentences)) {
        const sentences = m.emotion_knowledge_sentences
          .map((s) => `- ${s.sentence}`)
          .join("\n");
        content = `
${content}

REFERENCE VIBE (DATASET SYNERGY):
${sentences}
`.trim();
      }

      return content;
    })
    .join("\n");
}

// DeepSeek's context caching (disk-based prefix caching) is fully automatic
// server-side based on stable, reused prefixes — there is no explicit
// breakpoint marker to set (unlike Gemini via OpenRouter's cache_control).
// We still honor the same messages/options contract as geminiService so
// call sites are interchangeable; the cache option is accepted but has no
// on-the-wire effect here beyond being a no-op signal.
function toDeepseekMessages(messages) {
  const systemInstruction = extractSystemInstruction(messages);
  const result = [];

  if (systemInstruction) {
    result.push({ role: "system", content: systemInstruction });
  }

  (messages || [])
    .filter((m) => m.role !== "system")
    .forEach((m) => {
      result.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    });

  return result;
}

function resolveCacheMessages({ messages, options }) {
  // Mirrors geminiService's cache contract for interchangeability, even
  // though DeepSeek's caching is fully automatic and needs no breakpoint.
  const cacheOption =
    options?.cache ||
    (messages || []).some((m) => m.role === "system" && m.cache) ||
    null;

  const dsMessages = toDeepseekMessages(messages);

  if (cacheOption && typeof cacheOption?.onCacheCreated === "function") {
    cacheOption.onCacheCreated(null, null);
  }

  return { messages: dsMessages };
}

const generateDeepseekResponse = async (messages, options = {}) => {
  try {
    const { client, deepseek_model } = getDeepseekClient();
    const { messages: dsMessages } = resolveCacheMessages({
      messages,
      options,
    });

    const modelToUse = deepseek_model || DEEPSEEK_MODEL;

    const response = await withRetry("generateContent", () =>
      client.chat.completions.create({
        model: modelToUse,
        messages: dsMessages,
        // The JS `openai` SDK has no `extra_body` wrapper (that's a
        // Python-SDK-only convention) — non-standard fields like DeepSeek's
        // `thinking` must be passed directly at the top level of the body,
        // otherwise they're silently dropped and thinking stays enabled.
        thinking: {
          type: "disabled",
        },
      }),
    );

    const usage = response.usage;
    // console.log(
    //   `[DeepSeek model] requested=${modelToUse} actual=${response.model || "n/a"}`,
    // );
    // console.log(
    //   `[DeepSeek tokens] input=${usage?.prompt_tokens ?? 0} output=${usage?.completion_tokens ?? 0} cacheHit=${usage?.prompt_cache_hit_tokens ?? 0} cacheMiss=${usage?.prompt_cache_miss_tokens ?? 0} hitRate=${formatCacheHitRate(usage)} total=${usage?.total_tokens ?? 0} thinking=${usage?.completion_tokens_details?.reasoning_tokens ?? 0}`,
    // );

    return response.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error("DeepSeek error:", error);
    if (error?.message && !error.message.startsWith("DeepSeek error:")) {
      throw new Error(`DeepSeek error: ${error.message}`);
    }
    throw error;
  }
};

const generateDeepseekResponseStream = async (messages, options = {}) => {
  try {
    const { client, deepseek_model } = getDeepseekClient();
    const { messages: dsMessages } = resolveCacheMessages({
      messages,
      options,
    });

    const modelToUse = deepseek_model || DEEPSEEK_MODEL;

    const createStream = () =>
      client.chat.completions.create({
        model: modelToUse,
        messages: dsMessages,
        stream: true,
        stream_options: { include_usage: true },
        // See the non-streaming call above: `extra_body` is a Python-SDK-only
        // wrapper and is silently ignored by the JS SDK — `thinking` must be
        // a top-level field.
        thinking: {
          type: "disabled",
        },
      });

    const initialStream = await withRetry(
      "generateContentStream",
      createStream,
    );

    // If the stream fails before yielding any chunk, retry by recreating it.
    const { maxAttempts } = getRetryConfig();
    async function* streamWithEarlyRetry() {
      let stream = initialStream;
      let yieldedAny = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          let lastUsage;
          let actualModel;
          for await (const chunk of stream) {
            const text = chunk?.choices?.[0]?.delta?.content;
            if (chunk.usage) lastUsage = chunk.usage;
            if (chunk.model && !actualModel) actualModel = chunk.model;
            if (!text) continue;
            yieldedAny = true;
            yield { text };
          }
          // if (actualModel) {
          //   console.log(
          //     `[DeepSeek model] requested=${modelToUse} actual=${actualModel}`,
          //   );
          // }
          // if (lastUsage) {
          //   console.log(
          //     `[DeepSeek tokens] input=${lastUsage.prompt_tokens ?? 0} output=${lastUsage.completion_tokens ?? 0} cacheHit=${lastUsage.prompt_cache_hit_tokens ?? 0} cacheMiss=${lastUsage.prompt_cache_miss_tokens ?? 0} hitRate=${formatCacheHitRate(lastUsage)} total=${lastUsage.total_tokens ?? 0} thinking=${lastUsage.completion_tokens_details?.reasoning_tokens ?? 0}`,
          //   );
          // }
          return;
        } catch (err) {
          if (yieldedAny) throw err;

          const retrying = await waitForRetry({
            err,
            attempt,
            maxAttempts,
            operationName: "generateContentStream",
          });
          if (!retrying) throw err;

          try {
            stream = await withRetry("generateContentStream", createStream, {
              maxAttempts: 1,
            });
          } catch (createErr) {
            stream = throwingAsyncIterable(createErr);
          }
        }
      }
    }

    return streamWithEarlyRetry();
  } catch (error) {
    console.error("DeepSeek stream error:", error);
    if (error?.message && !error.message.startsWith("DeepSeek stream error:")) {
      throw new Error(`DeepSeek stream error: ${error.message}`);
    }
    throw error;
  }
};

module.exports = {
  generateDeepseekResponse,
  generateDeepseekResponseStream,
};
