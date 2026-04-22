const Anthropic = require("@anthropic-ai/sdk");
const Setting = require("../models/SettingModel.js");

/* -------------------- UTIL -------------------- */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryConfig() {
  const maxAttempts = 4;
  const baseDelayMs = 300;
  const maxDelayMs = 5000;

  return {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
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

function isRetryableError(err) {
  const status = getErrorStatusCode(err);

  if ([429, 500, 502, 503, 504].includes(Number(status))) return true;

  const message = String(err?.message || "").toLowerCase();

  return (
    message.includes("rate limit") ||
    message.includes("overloaded") ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("socket") ||
    message.includes("503")
  );
}

function computeBackoffDelayMs({ retryCount, baseDelayMs, maxDelayMs }) {
  const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, retryCount - 1));

  const jitter = Math.floor(Math.random() * delay * 0.25);
  return delay + jitter;
}

async function withRetry(operationName, fn, options = {}) {
  const config = getRetryConfig();

  const maxAttempts = options.maxAttempts || config.maxAttempts;
  const baseDelayMs = options.baseDelayMs || config.baseDelayMs;
  const maxDelayMs = options.maxDelayMs || config.maxDelayMs;

  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      const shouldRetry = attempt < maxAttempts && isRetryableError(err);

      if (!shouldRetry) throw err;

      const delayMs = computeBackoffDelayMs({
        retryCount: attempt,
        baseDelayMs,
        maxDelayMs,
      });

      console.warn(
        `Claude ${operationName} failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`,
      );

      await sleep(delayMs);
    }
  }

  throw lastErr;
}

/* -------------------- SETTINGS -------------------- */

async function loadClaudeSettings() {
  const settings = await Setting.find();

  const claude_api_key = settings[0]?.gemini_api_key || "";
  const claude_model = settings[0]?.gemini_model || "";

  if (!claude_api_key) {
    throw new Error("Claude API key not found in database");
  }

  if (!claude_model) {
    throw new Error("Claude model not found in database");
  }

  return { claude_api_key, claude_model };
}

async function createClaudeClient() {
  const { claude_api_key, claude_model } = await loadClaudeSettings();

  const anthropic = new Anthropic({
    apiKey: claude_api_key,
  });

  return { anthropic, claude_model };
}

/* -------------------- MESSAGE FORMAT -------------------- */

function formatClaudeMessages(messages) {
  return (messages || []).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
}

/* -------------------- NON-STREAM -------------------- */

const generateClaudeResponse = async (messages) => {
  try {
    const { anthropic, claude_model } = await createClaudeClient();

    const response = await withRetry("message", () =>
      anthropic.messages.create({
        model: claude_model,
        max_tokens: 1000,
        messages: formatClaudeMessages(messages),
      }),
    );

    return response.content?.[0]?.text || "";
  } catch (error) {
    console.error("Claude error:", error);
    throw new Error(`Claude error: ${error.message}`);
  }
};

/* -------------------- STREAM -------------------- */

const generateClaudeResponseStream = async (messages) => {
  try {
    const { anthropic, claude_model } = await createClaudeClient();

    const createStream = () =>
      anthropic.messages.stream({
        model: claude_model,
        max_tokens: 7500,
        messages: formatClaudeMessages(messages),
      });

    const stream = await withRetry("stream", createStream);

    async function* streamGenerator() {
      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          yield {
            text: event.delta.text,
          };
        }
      }
    }

    return streamGenerator();
  } catch (error) {
    console.error("Claude stream error:", error);
    throw new Error(`Claude stream error: ${error.message}`);
  }
};

/* -------------------- EXPORT -------------------- */

module.exports = {
  generateClaudeResponse,
  generateClaudeResponseStream,
};
