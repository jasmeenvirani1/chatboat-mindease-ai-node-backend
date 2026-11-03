"use strict";

// Run: node test/freeTalkUpsell.test.js
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.MONETIZATION_MODE = "on";

const assert = require("assert");
const rules = require("../helper/monetization/monetizationRules");
const {
  isDeepPatternQuestion,
  isFreePlanUser,
  isCompanionTalkRequest,
} = require("../helper/monetization/freeTalkLimit");
const {
  getUserLocalDay,
  countTalkQuestion,
  giveBackTalkQuestion,
  getTalkQuestionsUsedToday,
  recordPopupShown,
  recordPopupDismissed,
} = require("../helper/monetization/monetizationDatabase");

console.log("Starting Astria Pro upsell flow test suite...");

// ─────────────────────────────────────────────────────────────────────────────
// 1. 12-CONVERSATION LIMIT DECISION LOGIC
// ─────────────────────────────────────────────────────────────────────────────
const { dailyQuestionLimit, softWarningAt } = rules.config.companionTalk.free;
assert.strictEqual(dailyQuestionLimit, 12, "Daily question limit must be 12");
assert.strictEqual(softWarningAt, 10, "Soft warning threshold must be 10");

// Questions 1 to 9: normal flow
for (let used = 1; used <= 9; used++) {
  const check = rules.checkTalkQuestionNumber(used);
  assert.strictEqual(check.used, used);
  assert.strictEqual(check.limit, 12);
  assert.strictEqual(check.remaining, 12 - used);
  assert.strictEqual(check.blocked, false, `Question ${used} should not be blocked`);
  assert.strictEqual(check.limitReached, false, `Question ${used} should not have limitReached`);
  assert.strictEqual(check.softWarning, false, `Question ${used} should not have softWarning`);
}

// Conversation 10: soft warning shown, not blocked
const q10 = rules.checkTalkQuestionNumber(10);
assert.strictEqual(q10.remaining, 2, "Conversation 10 must have exactly 2 remaining");
assert.strictEqual(q10.softWarning, true, "Conversation 10 must trigger soft warning");
assert.strictEqual(q10.blocked, false, "Conversation 10 must not be blocked");
assert.strictEqual(q10.limitReached, false, "Conversation 10 must not be limitReached");

// Conversation 11: remaining 1, not blocked
const q11 = rules.checkTalkQuestionNumber(11);
assert.strictEqual(q11.remaining, 1, "Conversation 11 must have exactly 1 remaining");
assert.strictEqual(q11.softWarning, false);
assert.strictEqual(q11.blocked, false);
assert.strictEqual(q11.limitReached, false);

// Conversation 12: final allowed free question delivered, then limitReached=true
const q12 = rules.checkTalkQuestionNumber(12);
assert.strictEqual(q12.remaining, 0, "Conversation 12 must have 0 remaining");
assert.strictEqual(q12.blocked, false, "Conversation 12 must be answered/delivered");
assert.strictEqual(q12.limitReached, true, "Conversation 12 must trigger limit reached");

// Conversation 13+: blocked
const q13 = rules.checkTalkQuestionNumber(13);
assert.strictEqual(q13.blocked, true, "Conversation 13 must be blocked");
assert.strictEqual(q13.limitReached, true);
assert.strictEqual(q13.remaining, 0);

console.log("✓ 12-conversation limit and warning thresholds verified");

// ─────────────────────────────────────────────────────────────────────────────
// 2. DAILY RESET AND USAGE TRACKING
// ─────────────────────────────────────────────────────────────────────────────
const userDayBangkok = getUserLocalDay({ region: "healjai" }, Date.parse("2026-11-03T18:00:00Z"));
const userDayNY = getUserLocalDay({ region: "us" }, Date.parse("2026-11-03T18:00:00Z"));
assert.ok(userDayBangkok, "Bangkok dayKey must be computed");
assert.ok(userDayNY, "NY dayKey must be computed");

// Mocking User model for database counter tests
const User = require("../models/UserModel");
const realFindOneAndUpdate = User.findOneAndUpdate;
const realUpdateOne = User.updateOne;

(async () => {
  try {
    // Test countTalkQuestion with limit=12
    let fakeDoc = {
      _id: "test-user-1",
      freeTalkUsage: { day: userDayBangkok, used: 11 },
    };

    User.findOneAndUpdate = (filter, update) => ({
      lean: async () => {
        const limit = 12;
        const currentUsed = fakeDoc.freeTalkUsage.used;
        if (currentUsed >= limit) return null; // limit reached
        fakeDoc.freeTalkUsage.used += 1;
        return fakeDoc;
      },
    });

    // 12th question: accepted
    const res12 = await countTalkQuestion(
      { _id: "test-user-1", region: "healjai" },
      { limit: 12, now: Date.parse("2026-11-03T18:00:00Z") }
    );
    assert.strictEqual(res12.taken, true, "Question 12 should be taken successfully");
    assert.strictEqual(res12.used, 12, "Usage count should be 12");

    // 13th question: refused
    const res13 = await countTalkQuestion(
      { _id: "test-user-1", region: "healjai" },
      { limit: 12, now: Date.parse("2026-11-03T18:00:00Z") }
    );
    assert.strictEqual(res13.taken, false, "Question 13 should be refused");
    assert.strictEqual(res13.used, 12, "Usage count should remain 12");

    console.log("✓ Database atomic count and limit refusal verified");

    // Test giveBackTalkQuestion on failure
    let updateCalled = false;
    User.updateOne = async (filter, update) => {
      updateCalled = true;
      assert.strictEqual(filter["freeTalkUsage.used"].$gt, 0);
      assert.deepStrictEqual(update.$inc, { "freeTalkUsage.used": -1 });
      return { modifiedCount: 1 };
    };
    await giveBackTalkQuestion({ _id: "test-user-1", region: "healjai" });
    assert.ok(updateCalled, "giveBackTalkQuestion should decrement usage");

    console.log("✓ giveBackTalkQuestion verified");
  } finally {
    User.findOneAndUpdate = realFindOneAndUpdate;
    User.updateOne = realUpdateOne;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. POPUP FREQUENCY: MAX 1 PER SESSION, MAX 3 PER DAY, COOLDOWN
  // ─────────────────────────────────────────────────────────────────────────────
  const day = "2026-11-03";
  const now = Date.parse("2026-11-03T12:00:00Z");
  const MIN = 60 * 1000;

  // Max 1 per session
  const stateSession1 = {
    day,
    shown: 1,
    dismissed: 0,
    lastShownAt: new Date(now - 10 * MIN),
    lastSessionId: "session-abc",
  };
  const sameSession = rules.canShowUpgradePopup(stateSession1, {
    trigger: "companion_limit_reached",
    sessionId: "session-abc",
    day,
    now,
    tier: "free",
  });
  assert.strictEqual(sameSession.show, false);
  assert.strictEqual(sameSession.reason, "session_cap", "Must cap at 1 per session");

  // New session after cooldown (30 min cooldown)
  const stateNewSession = {
    day,
    shown: 1,
    dismissed: 0,
    lastShownAt: new Date(now - 35 * MIN), // 35 min ago
    lastSessionId: "session-abc",
  };
  const diffSession = rules.canShowUpgradePopup(stateNewSession, {
    trigger: "companion_limit_reached",
    sessionId: "session-xyz",
    day,
    now,
    tier: "free",
  });
  assert.strictEqual(diffSession.show, true, "Should allow in new session after cooldown");

  // Max 3 per day
  const stateMaxDay = {
    day,
    shown: 3,
    dismissed: 0,
    lastShownAt: new Date(now - 40 * MIN),
    lastSessionId: "session-old",
  };
  const dayCapCheck = rules.canShowUpgradePopup(stateMaxDay, {
    trigger: "companion_limit_reached",
    sessionId: "session-new",
    day,
    now,
    tier: "free",
  });
  assert.strictEqual(dayCapCheck.show, false);
  assert.strictEqual(dayCapCheck.reason, "daily_cap", "Must cap at 3 per day");

  console.log("✓ Popup frequency (max 1 per session, max 3 per day, cooldown) verified");

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. ACCESS CONTROL: PRO USERS NEVER SEE UPGRADE POPUP
  // ─────────────────────────────────────────────────────────────────────────────
  const proCheck = rules.canShowUpgradePopup(
    { day, shown: 0, dismissed: 0 },
    {
      trigger: "companion_limit_reached",
      sessionId: "pro-session",
      day,
      now,
      tier: "pro", // Pro user
    }
  );
  assert.strictEqual(proCheck.show, false, "Pro user must never see upgrade popup");
  assert.strictEqual(proCheck.reason, "already_pro");

  // isFreePlanUser logic
  const freeUser = { plan: "free", region: "uk" };
  const proUser = {
    plan: "pro",
    region: "uk",
    subscriptionId: "sub_123",
    subscriptionStatus: "active",
    subscriptionEndDate: new Date(now + 86400000),
  };
  assert.strictEqual(isFreePlanUser(freeUser), true, "Unpaid user must be free");
  assert.strictEqual(isFreePlanUser(proUser), false, "Paid user must NOT be free");

  console.log("✓ Access control (Pro user exemption) verified");

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. DEEP PATTERN DETECTION (SUBTLE INLINE CTA TRIGGER)
  // ─────────────────────────────────────────────────────────────────────────────
  const deepQuestions = [
    "Why am I like this?",
    "Why do I keep doing this to myself?",
    "Where does this come from?",
    "Why does this keep happening?",
    "Is there a repeating pattern here?",
    "I keep repeating the same mistake.",
    "This is a recurring theme in my life.",
    "Why do I always end up feeling exhausted?",
    "Who am I without my achievements?",
    "I struggle with my personal identity.",
    "Am I enough as a person?",
    "Do I deserve happiness?",
    "I always seek validation from others.",
    "I feel like I constantly need validation.",
    "What is the underlying cause of this feeling?",
    "What is the root cause of my anxiety?",
    "What is my life script?",
    "This touches on my core belief.",
  ];

  for (const q of deepQuestions) {
    assert.strictEqual(
      isDeepPatternQuestion(q),
      true,
      `Should detect deep pattern in: "${q}"`
    );
  }

  const normalQuestions = [
    "Hello there",
    "What is the weather like today?",
    "Can you recommend a dinner recipe?",
    "Thank you so much!",
    "Good morning Astria",
    "Tell me a story about the stars",
  ];

  for (const q of normalQuestions) {
    assert.strictEqual(
      isDeepPatternQuestion(q),
      false,
      `Should NOT detect deep pattern in: "${q}"`
    );
  }

  console.log("✓ Deep-pattern detection verified for recurring patterns, identity, validation, and root causes");

  console.log("\nALL TESTS PASSED SUCCESSFULLY! ✓");
})().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
