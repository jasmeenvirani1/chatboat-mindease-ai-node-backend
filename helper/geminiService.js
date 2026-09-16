const OpenAI = require("openai");

// Drop-in replacement for geminiService.js: same exports, same message
// shape in/out, same retry/backoff/error-wrapping behavior, same cache{}
// option contract — only the provider underneath changes (OpenRouter
// instead of the Google AI Studio SDK), talking to
// `google/gemini-3-flash-preview` (or whatever OPENROUTER_MODEL says)
// through OpenRouter's OpenAI-compatible Chat Completions API.

const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemini-3-flash-preview";
const OPENROUTER_TIMEOUT_MS =
  Number(process.env.OPENROUTER_TIMEOUT_MS) || 60000;

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

function isRetryableOpenRouterError(err) {
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
  const shouldRetry = attempt < maxAttempts && isRetryableOpenRouterError(err);
  if (!shouldRetry) return false;

  const { baseDelayMs, maxDelayMs } = getRetryConfig();
  const delayMs = computeBackoffDelayMs({
    retryCount: attempt,
    baseDelayMs,
    maxDelayMs,
  });
  const status = getErrorStatusCode(err);
  console.warn(
    `OpenRouter ${operationName} failed (attempt ${attempt}/${maxAttempts}, status ${status || "n/a"}). Retrying in ${delayMs}ms...`,
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

function loadOpenRouterSettings() {
  const openrouter_api_key = process.env.OPENROUTER_API_KEY || "";
  const openrouter_model = process.env.OPENROUTER_MODEL || OPENROUTER_MODEL;

  if (!openrouter_api_key) {
    throw new Error(
      "OpenRouter API key not found (OPENROUTER_API_KEY env var)",
    );
  }

  return { openrouter_api_key, openrouter_model };
}

// The OpenAI SDK client holds no per-request state (api key/baseURL/timeout
// are fixed at construction), so it's built once and reused across calls
// instead of re-constructing it on every request.
let cachedClient = null;
function getOpenRouterClient() {
  const { openrouter_api_key, openrouter_model } = loadOpenRouterSettings();

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: openrouter_api_key,
      baseURL: OPENROUTER_BASE_URL,
      timeout: OPENROUTER_TIMEOUT_MS,
    });
  }

  return { client: cachedClient, openrouter_model };
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

// Gemini (and most providers) reject/ignore cache breakpoints below a
// ~1024-token floor. Same margin geminiService used for its explicit
// cache-create call, reused here as the bar for marking a cache breakpoint.
const MIN_CACHEABLE_SYSTEM_INSTRUCTION_CHARS = 5900; // ~1135 tokens at the measured ratio

// OpenRouter has no separate "create a cache resource, get back a handle"
// endpoint the way Google AI Studio's `genAI.caches.create` does. For
// providers/models that support prompt caching (Gemini included), OpenRouter
// caches automatically based on stable, reused prefixes, and — for models
// that support explicit breakpoints — via `cache_control: { type: "ephemeral" }`
// markers on message content. We add that marker when it's safe to (long,
// stable system instruction) and simply omit it otherwise; the request
// itself is unaffected either way, so caching being unsupported for a given
// model never breaks the call.
function toOpenRouterMessages(messages, { cacheEligible }) {
  const systemInstruction = extractSystemInstruction(messages);
  const result = [];

  if (systemInstruction) {
    if (cacheEligible) {
      result.push({
        role: "system",
        content: [
          {
            type: "text",
            text: systemInstruction,
            cache_control: { type: "ephemeral" },
          },
        ],
      });
    } else {
      result.push({ role: "system", content: systemInstruction });
    }
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
  // Mirrors geminiService's cache contract: an explicit options.cache, or
  // any system message flagged with `.cache = true` (chatController.js sets
  // the latter on messages[0]).
  const cacheOption =
    options?.cache ||
    (messages || []).some((m) => m.role === "system" && m.cache) ||
    null;

  const systemInstruction = extractSystemInstruction(messages);
  const cacheEligible =
    Boolean(cacheOption) &&
    systemInstruction.length >= MIN_CACHEABLE_SYSTEM_INSTRUCTION_CHARS;

  const orMessages = toOpenRouterMessages(messages, { cacheEligible });

  // geminiService's onCacheCreated signaled a newly-created explicit cache
  // handle so the caller could persist it for reuse. OpenRouter's Gemini
  // caching is transparent/automatic (no handle to persist), so there is
  // nothing to hand back — call onCacheCreated once, defensively, with a
  // sentinel so callers relying on it to flip on cache bookkeeping still do,
  // without a real cache name to store.
  if (cacheEligible && typeof cacheOption?.onCacheCreated === "function") {
    cacheOption.onCacheCreated(null, null);
  }

  return { messages: orMessages, cacheEligible };
}

const generateGeminiResponse = async (messages, options = {}) => {
  try {
    const { client, openrouter_model } = getOpenRouterClient();
    const { messages: orMessages } = resolveCacheMessages({
      messages,
      options,
    });

    const modelToUse = openrouter_model || OPENROUTER_MODEL;

    const response = await withRetry("generateContent", () =>
      client.chat.completions.create({
        model: modelToUse,
        messages: orMessages,
        reasoning: { enabled: false },
        provider: {
          order: ["google-ai-studio"],
          allow_fallbacks: false,
        },
      }),
    );

    const usage = response.usage;
    // console.log(
    //   `[OpenRouter model] requested=${modelToUse} actual=${response.model || "n/a"}`,
    // );
    // console.log(
    //   `[OpenRouter tokens] input=${usage?.prompt_tokens ?? 0} output=${usage?.completion_tokens ?? 0} cached=${usage?.prompt_tokens_details?.cached_tokens ?? 0} total=${usage?.total_tokens ?? 0} thinking=${usage?.completion_tokens_details?.reasoning_tokens ?? 0}`,
    // );

    return response.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error("Gemini error:", error);
    if (error?.message && !error.message.startsWith("Gemini error:")) {
      throw new Error(`Gemini error: ${error.message}`);
    }
    throw error;
  }
};

const generateGeminiResponseStream = async (messages, options = {}) => {
  try {
    const { client, openrouter_model } = getOpenRouterClient();
    const { messages: orMessages } = resolveCacheMessages({
      messages,
      options,
    });

    const modelToUse = openrouter_model || OPENROUTER_MODEL;

    const createStream = () =>
      client.chat.completions.create({
        model: modelToUse,
        messages: orMessages,
        stream: true,
        stream_options: { include_usage: true },
        provider: {
          order: ["google-ai-studio"],
          allow_fallbacks: true,
        },
        reasoning: { enabled: false },
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
          //     `[OpenRouter model] requested=${modelToUse} actual=${actualModel}`,
          //   );
          // }
          // if (lastUsage) {
          //   console.log(
          //     `[OpenRouter tokens] input=${lastUsage.prompt_tokens ?? 0} output=${lastUsage.completion_tokens ?? 0} cached=${lastUsage.prompt_tokens_details?.cached_tokens ?? 0} total=${lastUsage.total_tokens ?? 0} thinking=${lastUsage.completion_tokens_details?.reasoning_tokens ?? 0}`,
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
    console.error("Gemini stream error:", error);
    if (error?.message && !error.message.startsWith("Gemini stream error:")) {
      throw new Error(`Gemini stream error: ${error.message}`);
    }
    throw error;
  }
};

module.exports = {
  generateGeminiResponse,
  generateGeminiResponseStream,
};
