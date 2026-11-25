"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// tarotCompanionController — Tarot → Companion → Journey → Life GPS (AST-TAROT-V3)
//
//   Free: full reading (already free) + 1 follow-up for the whole account,
//         then a "Continue This Reading" paywall.
//   Pro : 3 follow-ups per local day (shared by all readings), Save to
//         Journey, Apply to Life GPS and recurring-card pattern awareness.
//   Every follow-up draws ONE new card; quota lives in helper/tarotFollowUpQuota.js.
//
// Mounted at /api/backend/tarot-companion (all routes need a signed-in user).
// The reading itself is created by POST /api/backend/tarotChat/create.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require("crypto");
const mongoose = require("mongoose");
const TarotHistory = require("../models/TarotCategoryModel.js");
const AstriaPersonal = require("../models/AstriaPersonalModel.js");
const UserModel = require("../models/UserModel.js");
const { generateGeminiResponse } = require("../helper/geminiService.js");
const { langInstruction, resolvePreferredLanguage } = require("../helper/languageDetect.js");
const { getPlan } = require("../helper/planAccess.js");
const { TAROT_COMPANION_FLOW } = require("../helper/tarotCompanionFlow.js");
const { analyseReading, cardKey } = require("../helper/tarotThemes.js");
const lifeGps = require("./lifeGpsController.js");
const quota = require("../helper/tarotFollowUpQuota.js");

const TESTER_ROLE_ID = 3;
const PATTERN_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const FALLBACK = "The cards are quiet for a moment. Please try again. 🔮";

const isPro = (user) => user?.roleId === TESTER_ROLE_ID || getPlan(user) !== "free";
const paywall = () => ({ ...TAROT_COMPANION_FLOW.free.afterLimit });

const loadOwned = async (req, res) => {
  const { readingId } = req.params;
  if (!mongoose.isValidObjectId(readingId)) {
    res.status(400).json({ success: false, message: "Invalid reading id" });
    return null;
  }
  const reading = await TarotHistory.findOne({ _id: readingId, userId: req.user._id }).lean();
  if (!reading) {
    res.status(404).json({ success: false, message: "Reading not found" });
    return null;
  }
  return reading;
};

const proRequired = (res) =>
  res.status(403).json({
    success: false,
    code: "PRO_REQUIRED",
    message: "This is part of Astria Pro.",
    paywall: paywall(),
  });

// How often each card of `reading` appeared in the user's earlier readings.
async function cardRecurrence(userId, reading) {
  const since = new Date(Date.now() - PATTERN_WINDOW_MS);
  const past = await TarotHistory.find({
    userId,
    _id: { $ne: reading._id },
    createdAt: { $gte: since },
    "cards.0": { $exists: true },
  })
    .select("cards createdAt tarotCategoryName theme")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const out = [];
  for (const c of reading.cards || []) {
    const key = cardKey(c.cardName);
    const hits = past.filter((r) => r.cards.some((x) => cardKey(x.cardName) === key));
    if (!hits.length) continue;
    out.push({
      cardName: c.cardName,
      timesBefore: hits.length,
      total: hits.length + 1,
      firstSeen: hits[hits.length - 1].createdAt,
      categories: [...new Set(hits.map((h) => h.tarotCategoryName).filter(Boolean))].slice(0, 3),
    });
  }
  return out;
}

const readingView = (r, pro, q) => ({
  readingId: r._id,
  question: r.question,
  cards: r.cards,
  theme: r.theme,
  summary: r.summary,
  category: r.tarotCategoryName,
  createdAt: r.createdAt,
  followUps: (r.followUps || []).map((f) => ({
    userMessage: f.userMessage,
    aiResponse: f.aiResponse,
    messageTime: f.messageTime,
    card: f.card ? { card_id: Number(f.card.cardId), card_name: f.card.cardName } : undefined,
  })),
  followUpsUsed: r.followUpsUsed || 0,
  followUpsLimit: q.limit,
  followUpsRemaining: q.remaining,
  nextEligibleAt: q.nextEligibleAt,
  journeySaved: !!r.journeySavedAt,
  lifeGpsApplied: !!r.lifeGpsAppliedAt,
  lifeGpsPreview: analyseReading(r.cards, r.tarotCategoryName).dimensions,
  isPro: pro,
});

// GET /config
const getConfig = (_req, res) => res.json({ success: true, tarotCompanionFlow: TAROT_COMPANION_FLOW });

// GET /:readingId
const getReading = async (req, res) => {
  try {
    const r = await loadOwned(req, res);
    if (!r) return;
    const pro = isPro(req.user);
    const q = await quota.getStatus(req.user, pro);
    return res.json({ success: true, data: readingView(r, pro, q) });
  } catch (err) {
    console.error("[tarotCompanion] getReading:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to load reading" });
  }
};

// GET /patterns/cards  (Pro) — most recurring cards across the user's readings
const getCardPatterns = async (req, res) => {
  try {
    if (!isPro(req.user)) return proRequired(res);
    const since = new Date(Date.now() - PATTERN_WINDOW_MS);
    const rows = await TarotHistory.find({
      userId: req.user._id,
      createdAt: { $gte: since },
      "cards.0": { $exists: true },
    })
      .select("cards createdAt")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const map = new Map();
    for (const r of rows) {
      for (const c of new Set(r.cards.map((x) => cardKey(x.cardName)))) {
        const name = r.cards.find((x) => cardKey(x.cardName) === c).cardName;
        const e = map.get(c) || { cardName: name, count: 0, lastSeen: r.createdAt };
        e.count += 1;
        map.set(c, e);
      }
    }
    const cards = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 20);
    return res.json({ success: true, readings: rows.length, cards });
  } catch (err) {
    console.error("[tarotCompanion] getCardPatterns:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to load card patterns" });
  }
};

// Accepts one card that is not already part of this reading or its follow-ups.
// 4-card readings use the 22-card Major Arcana deck, so ids stay 0-21 there.
function validateDraw(card, reading) {
  const id = Number(card?.card_id);
  const name = String(card?.card_name || "").trim().slice(0, 60);
  const deckMax = (reading.cards || []).length === 4 ? 21 : 77;
  if (!Number.isInteger(id) || id < 0 || id > deckMax || !name) return null;
  const used = new Set([
    ...(reading.cards || []).map((c) => String(c.cardId)),
    ...(reading.followUps || []).map((f) => String(f.card?.cardId ?? "")),
  ]);
  if (used.has(String(id))) return null;
  return { cardId: String(id), cardName: name };
}

// POST /:readingId/follow-up   body: { message, card: {card_id, card_name}, idempotencyKey }
const followUp = async (req, res) => {
  let scope = null;
  let reading = null;
  try {
    reading = await loadOwned(req, res);
    if (!reading) return;
    const message = String(req.body?.message || "").trim().slice(0, 280);
    if (!message) return res.status(400).json({ success: false, message: "message is required" });

    // Each follow-up draws exactly one NEW card from the same deck.
    const drawn = validateDraw(req.body?.card, reading);
    if (!drawn) return res.status(400).json({ success: false, code: "INVALID_CARD", message: "A new, unused card is required" });

    // A retry with the same key returns the stored answer and consumes nothing.
    const key = String(req.body?.idempotencyKey || "").slice(0, 64);
    const prior = key && (reading.followUps || []).find((f) => f.idempotencyKey === key);
    if (prior) {
      const q = await quota.getStatus(req.user, isPro(req.user));
      return res.status(200).json({
        success: true,
        aiResponse: prior.aiResponse,
        followUpsRemaining: q.remaining,
        nextEligibleAt: q.nextEligibleAt,
        showPaywall: false,
      });
    }

    const pro = isPro(req.user);

    // Atomic account-wide reservation: parallel tabs/routes can never exceed the limit.
    scope = await quota.reserve(req.user, pro);
    if (!scope) {
      const q = await quota.getStatus(req.user, pro);
      return res.status(402).json({
        success: false,
        code: "FOLLOWUP_LIMIT_REACHED",
        message: pro ? "You've used today's follow-ups. Come back tomorrow." : "Continue this reading with Astria Pro.",
        followUpsRemaining: 0,
        nextEligibleAt: q.nextEligibleAt,
        // No upsell once a Pro account reaches its daily cap.
        paywall: pro ? null : paywall(),
      });
    }

    // Pro-only: connect this reading to the user's history.
    let patternBlock = "";
    let recurrence = [];
    if (pro) {
      recurrence = await cardRecurrence(req.user._id, reading);
      const personal = await AstriaPersonal.findOne({ userId: req.user._id })
        .select("events memoryPaused")
        .lean();
      const events = personal && !personal.memoryPaused ? (personal.events || []).slice(-5) : [];
      if (recurrence.length) {
        patternBlock += `\nRECURRING CARDS (from the user's earlier readings, last 12 months):\n${recurrence
          .map(
            (r) =>
              `- ${r.cardName}: appeared ${r.total} times in total (${r.timesBefore} before), first seen ${new Date(r.firstSeen).toISOString().slice(0, 10)}${r.categories.length ? `, topics: ${r.categories.join(", ")}` : ""}`,
          )
          .join("\n")}\n`;
      }
      if (events.length) {
        patternBlock += `\nRECENT JOURNEY ENTRIES:\n${events.map((e) => `- ${e.date}: ${e.title}`).join("\n")}\n`;
      }
    }

    const lang = resolvePreferredLanguage({
      text: message,
      preferredLanguage: req.body?.language || req.user.preferredLanguage,
      region: req.user.region,
    });
    const cardsLine = reading.cards
      .map((c, i) => `${i + 1}. ${c.cardName}${c.isReversed ? " (Reversed)" : ""}`)
      .join("\n");
    const system = `
You are Astria, a warm, perceptive companion continuing a conversation about a tarot reading the user just received.

THE READING
Topic: ${reading.tarotCategoryName || "general"}
Question: ${reading.question || "(none given)"}
Cards:
${cardsLine}
Theme: ${reading.theme || "reflection"}
NEW CARD DRAWN FOR THIS FOLLOW-UP QUESTION: ${drawn.cardName}
Reading text: ${String(reading.chats?.[0]?.aiResponse || reading.summary || "").slice(0, 2500)}
${patternBlock}
HOW TO REPLY
- Answer the follow-up question mainly from the NEW CARD, linking it to the original cards. Never say a card guarantees an event, and never read minds or diagnose.
- Sound like a person who is paying attention, not a report. 90-170 words, no headings or bullet lists.
- Never use fear-based or fatalistic language. Cards are a mirror for reflection, not a prediction.
- Where it fits, end with ONE gentle question that invites them to connect the cards to their real life.
- ${patternBlock.includes("RECURRING CARDS") ? "Use the recurring-card facts above only if they are relevant, quoting the counts exactly. Never invent history that is not listed." : "Do not claim to remember past readings or past conversations."}
- ${langInstruction(lang)}
`.trim();

    const messages = [{ role: "system", content: system }];
    for (const f of reading.followUps || []) {
      messages.push({ role: "user", content: f.userMessage }, { role: "assistant", content: f.aiResponse });
    }
    messages.push({ role: "user", content: message });

    const aiText = (await generateGeminiResponse(messages))?.trim();
    if (!aiText) throw new Error("empty AI response");

    const entry = {
      userMessage: message,
      aiResponse: aiText,
      messageTime: new Date(),
      card: { cardId: drawn.cardId, cardName: drawn.cardName },
      ...(key ? { idempotencyKey: key } : {}),
    };
    await TarotHistory.updateOne(
      { _id: reading._id, userId: req.user._id },
      { $push: { followUps: entry }, $inc: { followUpsUsed: 1 } },
    );
    scope = null; // committed: the slot stays used

    const q = await quota.getStatus(req.user, pro);
    return res.status(201).json({
      success: true,
      aiResponse: aiText,
      messageTime: entry.messageTime,
      followUpsLimit: q.limit,
      followUpsRemaining: q.remaining,
      nextEligibleAt: q.nextEligibleAt,
      // Shown AFTER the reply, only to Free users who just used their one question.
      showPaywall: !pro && q.remaining === 0,
      paywall: !pro && q.remaining === 0 ? paywall() : null,
      patterns: pro ? recurrence : undefined,
    });
  } catch (err) {
    console.error("[tarotCompanion] followUp:", err?.message || err);
    // Give the slot back: the reply failed on our side.
    if (scope) await quota.release(req.user, scope);
    return res.status(500).json({ success: false, message: "Failed to continue the reading", fallbackResponse: FALLBACK });
  }
};

// POST /:readingId/save-journey  (Pro)
const saveToJourney = async (req, res) => {
  let claimed = false;
  let reading = null;
  try {
    if (!isPro(req.user)) return proRequired(res);
    reading = await loadOwned(req, res);
    if (!reading) return;

    const claim = await TarotHistory.findOneAndUpdate(
      { _id: reading._id, userId: req.user._id, journeySavedAt: null },
      { $set: { journeySavedAt: new Date() } },
      { projection: { _id: 1 } },
    ).lean();
    if (!claim) {
      return res.status(200).json({ success: true, alreadySaved: true, eventId: reading.journeyEventId || null });
    }
    claimed = true;

    const id = crypto.randomUUID();
    const cardNames = reading.cards.map((c) => c.cardName).join(", ");
    const event = {
      id,
      date: new Date(reading.createdAt || Date.now()).toISOString().slice(0, 10),
      kind: "reflection",
      title: `Tarot: ${reading.theme || "reading"} (${cardNames})`.slice(0, 200),
      note: [reading.question && `Q: ${reading.question}`, `Cards: ${cardNames}`, reading.summary && `Summary: ${reading.summary}`]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000),
      personal: true,
    };
    await AstriaPersonal.updateOne(
      { userId: req.user._id },
      { $push: { events: { $each: [event], $slice: -500 } }, $setOnInsert: { userId: req.user._id } },
      { upsert: true },
    );
    await TarotHistory.updateOne({ _id: reading._id }, { $set: { journeyEventId: id } });
    claimed = false;
    return res.status(201).json({ success: true, eventId: id, event });
  } catch (err) {
    console.error("[tarotCompanion] saveToJourney:", err?.message || err);
    if (claimed && reading) {
      await TarotHistory.updateOne({ _id: reading._id }, { $set: { journeySavedAt: null } }).catch(() => {});
    }
    return res.status(500).json({ success: false, message: "Failed to save to Journey" });
  }
};

// GET /journey — the readings this user saved to their Journey (newest first).
// Reads the reading itself, so the Journey page always matches the cards.
const getJourney = async (req, res) => {
  try {
    const rows = await TarotHistory.find({ userId: req.user._id, journeySavedAt: { $ne: null } })
      .select("cards theme summary question tarotCategoryName createdAt journeySavedAt")
      .sort({ journeySavedAt: -1 })
      .limit(100)
      .lean();
    const entries = rows.map((r) => ({
      readingId: r._id,
      kind: "tarot",
      date: r.createdAt,
      savedAt: r.journeySavedAt,
      category: r.tarotCategoryName || "",
      theme: r.theme || "",
      question: r.question || "",
      summary: r.summary || "",
      cards: (r.cards || []).map((c) => ({ cardName: c.cardName, isReversed: !!c.isReversed })),
    }));
    return res.json({ success: true, entries });
  } catch (err) {
    console.error("[tarotCompanion] getJourney:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to load Journey" });
  }
};

// POST /:readingId/apply-life-gps  (Pro)
const applyToLifeGps = async (req, res) => {
  let claimed = false;
  let reading = null;
  try {
    if (!isPro(req.user)) return proRequired(res);
    reading = await loadOwned(req, res);
    if (!reading) return;

    const { dimensions } = analyseReading(reading.cards, reading.tarotCategoryName);
    if (!Object.keys(dimensions).length) {
      return res.status(422).json({ success: false, message: "This reading has no theme to apply" });
    }

    const claim = await TarotHistory.findOneAndUpdate(
      { _id: reading._id, userId: req.user._id, lifeGpsAppliedAt: null },
      { $set: { lifeGpsAppliedAt: new Date() } },
      { projection: { _id: 1 } },
    ).lean();
    if (!claim) {
      return res.status(409).json({ success: false, code: "ALREADY_APPLIED", message: "Already applied to Life GPS" });
    }
    claimed = true;

    const [prev] = await lifeGps.latestSnapshots(req.user._id, 1);
    const base = lifeGps.plainDims(prev);
    const entries = [];
    const applied = [];
    for (const [key, delta] of Object.entries(dimensions)) {
      const cur = base.find((d) => d.key === key)?.score;
      const from = cur == null ? 5 : cur;
      const to = Math.min(10, Math.round((from + delta) * 2) / 2);
      if (to === from) continue;
      entries.push({ key, score: to, reflection: "From a Tarot reading", mood: "", at: null });
      applied.push({ dimensionKey: key, from, to, delta: to - from });
    }
    if (!entries.length) {
      await TarotHistory.updateOne({ _id: reading._id }, { $set: { lifeGpsAppliedAt: null } });
      return res.status(200).json({ success: true, applied: [], skipped: [], message: "Life GPS is already at its maximum here" });
    }

    const { snapshot, skipped } = await lifeGps.applyCheckIn(req.user._id, entries);
    if (!snapshot) {
      await TarotHistory.updateOne({ _id: reading._id }, { $set: { lifeGpsAppliedAt: null } });
      claimed = false;
      const limited = skipped.some((s) => s.reason === "rate_limited");
      return res.status(limited ? 429 : 400).json({
        success: false,
        message: limited ? "You can update each dimension once every 4 hours" : "No dimensions could be updated",
        skipped,
      });
    }
    const skippedKeys = new Set(skipped.map((s) => s.dimensionKey));
    const done = applied.filter((a) => !skippedKeys.has(a.dimensionKey));
    await TarotHistory.updateOne({ _id: reading._id }, { $set: { lifeGpsApplied: done } });
    claimed = false;
    return res.status(201).json({ success: true, applied: done, skipped });
  } catch (err) {
    console.error("[tarotCompanion] applyToLifeGps:", err?.message || err);
    if (claimed && reading) {
      await TarotHistory.updateOne({ _id: reading._id }, { $set: { lifeGpsAppliedAt: null } }).catch(() => {});
    }
    return res.status(500).json({ success: false, message: "Failed to apply to Life GPS" });
  }
};

module.exports = { getConfig, getReading, getCardPatterns, getJourney, followUp, saveToJourney, applyToLifeGps };
