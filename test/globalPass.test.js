const assert = require("assert");
const G = require("../helper/globalPass");

const DAY = G.PASS_DURATION_MS;
const t0 = Date.UTC(2026, 9, 15, 10); // 15 Oct 2026
const user = (extra = {}) => ({ _id: "u1", region: "us", plan: "free", ...extra });
const pass = (used, expiresAt, extra = {}) => ({
  month: "2026-10", used, region: "japan", startedAt: new Date(expiresAt - DAY), expiresAt: new Date(expiresAt), ...extra,
});

// tiers and limits
assert.strictEqual(G.tierOf(user()), "free");
assert.strictEqual(G.tierOf(user({ plan: "pro" })), "pro");
assert.strictEqual(G.tierOf(user({ subscriptionId: "s", subscriptionStatus: "trialing" })), "pro");
assert.strictEqual(G.tierOf(user({ plan: "global" })), "global");
assert.strictEqual(G.passState(user(), t0).limit, 1);
assert.strictEqual(G.passState(user({ plan: "pro" }), t0).limit, 2);
assert.strictEqual(G.passState(user({ plan: "global" }), t0).eligible, false);

// Free: ready → active → ended → used
assert.strictEqual(G.passState(user(), t0).status, "ready");
const f = user({ globalPass: pass(1, t0 + DAY) });
assert.strictEqual(G.passState(f, t0).status, "active");
assert.strictEqual(G.passState(f, t0 + DAY).status, "ended");
f.globalPass.endedSeen = true;
assert.strictEqual(G.passState(f, t0 + DAY).status, "used");

// Pro: after the first pass ends it is ready again, after the second it is used
const p = user({ plan: "pro", globalPass: pass(1, t0 + DAY, { endedSeen: true }) });
assert.strictEqual(G.passState(p, t0 + DAY).status, "ready");
assert.strictEqual(G.passState(p, t0 + DAY).remaining, 1);
p.globalPass.used = 2;
assert.strictEqual(G.passState(p, t0 + DAY).status, "used");

// new month: count resets; a pass started on the 31st keeps running into the 1st
assert.strictEqual(G.passState(f, Date.UTC(2026, 10, 2)).status, "ready");
const late = user({ globalPass: pass(1, Date.UTC(2026, 10, 1, 5)) });
assert.strictEqual(G.passState(late, Date.UTC(2026, 10, 1, 1)).status, "active");

// "Maybe Later" only counts for its own month
assert.strictEqual(G.passState(user({ globalPass: { month: "2026-10", dismissed: true } }), t0).status, "dismissed");
assert.strictEqual(G.passState(user({ globalPass: { month: "2026-09", dismissed: true } }), t0).status, "ready");

// region access
const a = user({ globalPass: pass(1, t0 + DAY) });
assert.ok(G.canAccessRegion(a, "us", t0)); // home
assert.ok(G.canAccessRegion(a, "japan", t0)); // running pass
assert.ok(!G.canAccessRegion(a, "korea", t0));
assert.ok(!G.canAccessRegion(a, "japan", t0 + DAY)); // pass over
assert.ok(G.canAccessRegion(user({ unlockedRegions: ["korea"] }), "korea", t0)); // bought
assert.ok(!G.canAccessRegion(user({ plan: "pro" }), "korea", t0)); // Pro = own country only
assert.ok(G.canAccessRegion(user({ plan: "global" }), "korea", t0));
assert.ok(!G.canAccessRegion(user(), "", t0));

// bad requests are refused before touching the database
(async () => {
  await assert.rejects(G.activatePass(user(), "narnia", t0), { code: "BAD_REGION" });
  await assert.rejects(G.activatePass(user(), "all", t0), { code: "BAD_REGION" });
  await assert.rejects(G.activatePass(user(), "us", t0), { code: "ALREADY_OWNED" });
  await assert.rejects(G.activatePass(user({ unlockedRegions: ["korea"] }), "korea", t0), { code: "ALREADY_OWNED" });
  await assert.rejects(G.activatePass(user({ plan: "global" }), "japan", t0), { code: "NOT_NEEDED" });
  console.log("globalPass tests passed");
})();
