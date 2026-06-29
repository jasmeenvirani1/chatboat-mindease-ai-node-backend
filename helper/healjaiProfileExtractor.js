const mongoose = require("mongoose");
const ChatHistory = require("../models/ChatModel");
const { generateGeminiResponse } = require("./geminiService");

const EXTRACTION_PROMPT = `You are a silent profile extractor. Analyze the user messages below and extract factual profile information only.

Return ONLY valid JSON. No explanation, no extra text.

Messages: {MESSAGES}

Return exactly this structure:
{
  "interests": [],
  "lifeEvents": [],
  "emotionalPattern": []
}

Rules:
- interests: hobbies, likes, food preferences, activities (e.g. "Thai cooking", "reading", "travel")
- lifeEvents: current situations, relationships, work, family (e.g. "building an app", "has a daughter", "going through divorce")
- emotionalPattern: recurring feelings or triggers (e.g. "month-end anxiety", "work stress", "sleep issues")
- Only extract what is clearly stated. Never guess.
- Return empty arrays if nothing relevant found.
- Each item must be a short phrase, max 5 words.`;

async function extractProfileFromMessages(messages) {
  if (!messages || messages.length === 0) return null;

  const joined = messages.map((m, i) => `[${i + 1}] ${m}`).join("\n");
  const prompt = EXTRACTION_PROMPT.replace("{MESSAGES}", joined);

  try {
    const raw = await generateGeminiResponse([
      { role: "system", content: "You are a JSON-only extraction engine. Return only valid JSON." },
      { role: "user", content: prompt },
    ]);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[healjaiProfileExtractor] No JSON found in Gemini response:", raw?.slice(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      interests: Array.isArray(parsed.interests) ? parsed.interests.filter(Boolean) : [],
      lifeEvents: Array.isArray(parsed.lifeEvents) ? parsed.lifeEvents.filter(Boolean) : [],
      emotionalPattern: Array.isArray(parsed.emotionalPattern) ? parsed.emotionalPattern.filter(Boolean) : [],
    };
  } catch (err) {
    console.error("[healjaiProfileExtractor] extractProfileFromMessages error:", err?.message || err);
    return null;
  }
}

/**
 * @param {string} userId
 * @param {string} categoryId
 * @param {string} chatId     - exact ChatHistory doc _id to update
 * @param {string[]} messages - recent user messages to extract from
 */
async function appendUserProfile(userId, categoryId, chatId, messages) {
  if (!userId || !chatId) {
    console.warn("[healjaiProfileExtractor] Missing userId or chatId — skipping.");
    return;
  }

  const extracted = await extractProfileFromMessages(messages);
  if (!extracted) {
    console.warn("[healjaiProfileExtractor] Extraction returned null.");
    return;
  }

  const hasData =
    extracted.interests.length > 0 ||
    extracted.lifeEvents.length > 0 ||
    extracted.emotionalPattern.length > 0;

  if (!hasData) {
    console.log("[healjaiProfileExtractor] Nothing to extract from these messages.");
    return;
  }

  // Fetch the exact doc by _id to get current profile state
  const existing = await ChatHistory.findById(chatId)
    .select("userProfileMetadata")
    .lean();

  if (!existing) {
    console.warn("[healjaiProfileExtractor] ChatHistory doc not found for chatId:", chatId);
    return;
  }

  // existing.userProfileMetadata may be null, undefined, or a valid object
  // Handle all cases safely
  const current = existing.userProfileMetadata || {};

  const merged = {
    interests: [...new Set([...(current.interests || []), ...extracted.interests])],
    lifeEvents: [...new Set([...(current.lifeEvents || []), ...extracted.lifeEvents])],
    emotionalPattern: [...new Set([...(current.emotionalPattern || []), ...extracted.emotionalPattern])],
    lastExtractedAt: new Date(),
  };

  await ChatHistory.findByIdAndUpdate(
    chatId,
    { $set: { userProfileMetadata: merged } },
  );

  console.log("[healjaiProfileExtractor] Profile saved to chatId:", chatId?.toString(), merged);
}

module.exports = { appendUserProfile };
