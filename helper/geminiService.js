const { GoogleGenAI } = require("@google/genai");
const Setting = require("../models/SettingModel.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryConfig() {
  const maxAttempts = 4;
  const baseDelayMs = 10;
  const maxDelayMs = 10;

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

function isRetryableGeminiError(err) {
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

async function withRetry(operationName, fn, options = {}) {
  const config = getRetryConfig();
  const maxAttempts = Number.isFinite(options.maxAttempts)
    ? Math.max(1, Number(options.maxAttempts))
    : config.maxAttempts;
  const baseDelayMs = Number.isFinite(options.baseDelayMs)
    ? Math.max(0, Number(options.baseDelayMs))
    : config.baseDelayMs;
  const maxDelayMs = Number.isFinite(options.maxDelayMs)
    ? Math.max(1, Number(options.maxDelayMs))
    : config.maxDelayMs;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const shouldRetry = attempt < maxAttempts && isRetryableGeminiError(err);
      if (!shouldRetry) throw err;

      const delayMs = computeBackoffDelayMs({
        retryCount: attempt,
        baseDelayMs,
        maxDelayMs,
      });
      const status = getErrorStatusCode(err);
      console.warn(
        `Gemini ${operationName} failed (attempt ${attempt}/${maxAttempts}, status ${status || "n/a"}). Retrying in ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }

  throw lastErr;
}

function throwingAsyncIterable(err) {
  return (async function* () {
    throw err;
  })();
}

async function loadGeminiSettings() {
  const settings = await Setting.find();
  const gemini_api_key = settings[0]?.gemini_api_key2 || "";
  const gemini_model = settings[0]?.gemini_model2 || "";

  if (!gemini_api_key) {
    throw new Error("Gemini API key not found in database");
  }

  if (!gemini_model) {
    throw new Error("Gemini model not found in database");
  }

  return { gemini_api_key, gemini_model };
}

async function createGeminiClient() {
  const { gemini_api_key, gemini_model } = await loadGeminiSettings();
  const genAI = new GoogleGenAI({ apiKey: gemini_api_key });
  return { genAI, gemini_model };
}

function messagesToPrompt(messages) {
  return (messages || [])
    .map((m) => `${String(m.role || "").toUpperCase()}: ${m.content}`)
    .join("\n");
}

const generateGeminiResponse = async (messages) => {
  try {
    const { genAI, gemini_model } = await createGeminiClient();
    const prompt = messagesToPrompt(messages);

    const response = await withRetry("generateContent", () =>
      genAI.models.generateContent({
        model: gemini_model,
        contents: prompt,
      }),
    );

    return response.text;
  } catch (error) {
    console.error("Gemini error:", error);
    if (error?.message && !error.message.startsWith("Gemini error:")) {
      throw new Error(`Gemini error: ${error.message}`);
    }
    throw error;
  }
};

const generateGeminiResponseStream = async (messages) => {
  try {
    const { genAI, gemini_model } = await createGeminiClient();
    const prompt = messagesToPrompt(messages);

    const createStream = () =>
      genAI.models.generateContentStream({
        model: gemini_model,
        contents: prompt,
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
          for await (const chunk of stream) {
            yieldedAny = true;
            yield chunk;
          }
          return;
        } catch (err) {
          if (
            yieldedAny ||
            attempt >= maxAttempts ||
            !isRetryableGeminiError(err)
          ) {
            throw err;
          }
          const { baseDelayMs, maxDelayMs } = getRetryConfig();
          const delayMs = computeBackoffDelayMs({
            retryCount: attempt,
            baseDelayMs,
            maxDelayMs,
          });
          const status = getErrorStatusCode(err);
          console.warn(
            `Gemini stream failed before first chunk (attempt ${attempt}/${maxAttempts}, status ${status || "n/a"}). Retrying in ${delayMs}ms...`,
          );
          await sleep(delayMs);
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

// export const generateGeminiResponseStreamForFreeUsers = async (messages) => {
//   try {
//     const settings = await Setting.find();
//     const gemini_api_key = settings[0]?.gemini_api_key || "";
//     const gemini_model = settings[0]?.gemini_model || "";

//     if (!gemini_api_key) {
//       throw new Error("Gemini API key not found in database");
//     }

//     if (!gemini_model) {
//       throw new Error("Gemini model not found in database");
//     }
//     const genAI = new GoogleGenAI({
//       apiKey: gemini_api_key,
//     });

//     const prompt = messages
//       .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
//       .join("\n");

//     const generation_config = {
//       temperature: 0.5,
//       top_p: 0.9,
//       max_output_tokens: 600,
//       response_mime_type: "text/plain",
//     };

//     const stream = await genAI.models.generateContentStream({
//       model: gemini_model,
//       generationConfig: generation_config,
//       contents: prompt,
//     });

//     return stream;
//   } catch (error) {
//     console.error("Gemini stream error:", error);
//     if (error?.message && !error.message.startsWith("Gemini stream error:")) {
//       throw new Error(`Gemini stream error: ${error.message}`);
//     }
//     throw error;
//   }
// };

// export const generateGeminiResponseStreamForFreeUsersThaiAstro = async (
//   messages,
// ) => {
//   try {
//     const settings = await Setting.find();
//     const gemini_api_key = settings[0]?.gemini_api_key || "";
//     const gemini_model = settings[0]?.gemini_model || "";

//     if (!gemini_api_key) {
//       throw new Error("Gemini API key not found in database");
//     }

//     if (!gemini_model) {
//       throw new Error("Gemini model not found in database");
//     }
//     const genAI = new GoogleGenAI({
//       apiKey: gemini_api_key,
//     });

//     const prompt = messages
//       .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
//       .join("\n");

//     const generation_config = {
//       temperature: 0.5,
//       top_p: 0.9,
//       max_output_tokens: 900,
//       response_mime_type: "text/plain",
//     };

//     const stream = await genAI.models.generateContentStream({
//       model: gemini_model,
//       generationConfig: generation_config,
//       contents: prompt,
//     });

//     return stream;
//   } catch (error) {
//     console.error("Gemini stream error:", error);
//     if (error?.message && !error.message.startsWith("Gemini stream error:")) {
//       throw new Error(`Gemini stream error: ${error.message}`);
//     }
//     throw error;
//   }
// };
