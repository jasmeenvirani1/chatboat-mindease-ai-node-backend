import { pipeline } from "@xenova/transformers";
import hnswlib from "hnswlib-node";
const { HierarchicalNSW } = hnswlib;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_FILE = path.join(__dirname, "index.hnsw");
const META_FILE = path.join(__dirname, "meta.json");
const QUANT_FILE = path.join(__dirname, "vectors_int8.bin");
const DIM = 384;
// Must match the M value used in build_index_quantized.js
const HNSW_M = 8;
const REPLY_BANK_FILE = path.join(__dirname, "..", "healjai_checkpoint.jsonl");

let embedder = null;
let index = null;
let meta = null;
let indexDisabledReason = null;

let replyBank = null; // string[]
let replyBankVecs = null; // Float32Array[]
let replyBankReady = false;

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width
    .replace(/[^\p{L}\p{N}\s]+/gu, " ") // drop punctuation/symbols (unicode-safe)
    .replace(/\s+/g, " ")
    .trim();
}

function isQuestion(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return false;
  if (/[?？]\s*$/.test(t)) return true;
  // crude cross-language cues (kept intentionally small; acts as a hint only)
  if (/(^|\s)(who|what|when|where|why|how|howre|how're|hows|how's|can|could|would|should|do|did|does|is|are|am|was|were)\b/.test(t)) {
    return true;
  }
  // Common Thai question patterns that don't end with explicit particles.
  // Note: avoid using `\b` with Thai (it doesn't behave as expected).
  if (/(เป็นยังไง|เป็นไง|เป็นอย่างไร|สบายดีไหม|โอเคไหม|เป็นอะไร|ทำไม|ยังไง|อย่างไร)/.test(t)) {
    return true;
  }
  if (/(ไหม|มั้ย|เหรอ|หรอ|หรือเปล่า)\s*$/.test(t)) return true;
  return false;
}

function cannedRepliesFor(userMessage) {
  const t = normalizeText(userMessage);
  const out = [];

  // Greeting / "how are you" style openers → respond, don't mirror.
  if (/\b(how are you|how r u|howre you|how you doing|how do you feel)\b/.test(t)) {
    out.push("I'm doing okay. How are you feeling right now?");
    out.push("I'm here with you. How are you today?");
    out.push("I'm doing alright—thanks for asking. How about you?");
  } else if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(t)) {
    out.push("Hey. I'm here—what's on your mind?");
    out.push("Hi. How are you feeling today?");
  } else if (/\b(thank you|thanks|thx)\b/.test(t)) {
    out.push("Of course. I'm here with you.");
    out.push("Anytime. Do you want to tell me a bit more?");
  } else if (/\b(bye|goodbye|see you|later)\b/.test(t)) {
    out.push("Okay. Take care of yourself, yeah?");
    out.push("Bye for now. I'm here whenever you want to talk.");
  }

  return out;
}

async function ensureReplyBankReady() {
  if (replyBankReady) return;
  replyBankReady = true;

  try {
    if (!fs.existsSync(REPLY_BANK_FILE)) return;
    const raw = fs.readFileSync(REPLY_BANK_FILE, "utf-8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const texts = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const t = typeof obj?.text === "string" ? obj.text.trim() : "";
        if (t) texts.push(t);
      } catch {
        // ignore bad lines
      }
    }
    if (!texts.length) return;

    // If embedder isn't ready yet, we can still use the bank as a random fallback.
    replyBank = texts;
    replyBankVecs = null;

    if (!embedder) return;

    // Pre-embed once (6507 lines) so we can do fast similarity for "reply-like" picks.
    const BATCH = 128;
    const vecs = new Array(texts.length);
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const output = await embedder(batch, { pooling: "mean", normalize: true });
      for (let j = 0; j < batch.length; j++) {
        vecs[i + j] = output[j].data; // Float32Array
      }
    }
    replyBankVecs = vecs;
  } catch {
    // keep bank unavailable on failure
    replyBank = null;
    replyBankVecs = null;
  }
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function pickReplyFromBank(userMessage, queryVecFloat32, topK) {
  if (!replyBank?.length) return [];

  // If we don't have embeddings, return a few diverse-ish random options.
  if (!replyBankVecs?.length || !queryVecFloat32) {
    const out = [];
    for (let i = 0; i < replyBank.length && out.length < topK; i++) {
      const s = replyBank[(i * 997) % replyBank.length];
      if (looksLikeReply(userMessage, s)) out.push(s);
    }
    return out.slice(0, topK);
  }

  // Cosine similarity (vectors are already normalized by embedder).
  const scored = [];
  for (let i = 0; i < replyBank.length; i++) {
    const s = replyBank[i];
    if (!looksLikeReply(userMessage, s)) continue;
    const v = replyBankVecs[i];
    if (!v) continue;
    scored.push([dot(queryVecFloat32, v), s]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, topK).map((x) => x[1]);
}

function looksLikeReply(userMessage, candidateSentence) {
  const userIsQuestion = isQuestion(userMessage);
  const candIsQuestion = isQuestion(candidateSentence);

  // If user asked a question, prefer non-question replies.
  if (userIsQuestion && candIsQuestion) return false;
  // If user shared a statement, avoid returning another "prompt question" as the top match.
  // (The LLM can ask its own follow-up; the retrieved line should read like a response.)
  if (!userIsQuestion && candIsQuestion) return false;

  // Avoid parroting the user back.
  const u = normalizeText(userMessage);
  const c = normalizeText(candidateSentence);
  if (!u || !c) return false;
  if (u === c) return false;
  if (u.length > 6 && (c.includes(u) || u.includes(c))) return false;

  // Prefer response-like lines: either empathic markers or addressing the user.
  // This helps avoid returning "another user statement" from the corpus.
  const responsey =
    /\b(you|your|u)\b/.test(candidateSentence.toLowerCase()) ||
    /(คุณ|เธอ|นาย|หนู|เรา)/.test(candidateSentence) ||
    /(i get that|i understand|i'm here|im here|that sounds|sounds like|i hear you|เข้าใจ|ฟังดู|ไม่เป็นไร|อยู่ตรงนี้|ขอโทษที่|กอด|เหนื่อย)/i.test(
      candidateSentence,
    );
  if (!responsey) return false;

  return true;
}

function replyRerankBoost(sentence) {
  const t = String(sentence || "").trim().toLowerCase();
  let boost = 0;
  if (!isQuestion(t)) boost += 0.05;
  // Prefer empathetic "response-like" lines.
  if (/(i get that|i understand|it['’]s ok|it's ok|it is ok|i'm here|im here|i am here|that sounds|sounds like|i hear you|เข้าใจ|ฟังดู|ไม่เป็นไร|ไม่ต้อง|ขอโทษที่|อยู่ตรงนี้)/i.test(t)) {
    boost += 0.05;
  }
  // Prefer addressing the user (you/your) over narrating unrelated "my ..." stories.
  if (/\b(you|your|u)\b/.test(t) || /(คุณ|เธอ|นาย|หนู|เรา)/.test(t)) boost += 0.03;
  // Slight boost for first-person only when it's supportive (not "my problem...").
  if (/^(i\b|i['’]m\b|im\b|i am\b|we\b|ฉัน|ผม|หนู|เรา)/i.test(t)) boost += 0.01;
  // Penalty for "my ..." anecdote-style lines (often user-like, not reply-like).
  if (/^my\b/.test(t) || /^my\s+\w+/.test(t)) boost -= 0.03;
  return boost;
}

// ── Quantize query vector the same way build script did ──────────────────────
function quantizeVec(floatArr) {
  const out = new Float32Array(floatArr.length);
  for (let i = 0; i < floatArr.length; i++) {
    const clamped = Math.max(-1, Math.min(1, floatArr[i]));
    // quantize to int8 range then dequantize — matches stored vectors exactly
    out[i] = Math.round(clamped * 127) / 127;
  }
  return out;
}

function requiredFilesExist() {
  return (
    fs.existsSync(INDEX_FILE) &&
    fs.existsSync(META_FILE) &&
    fs.existsSync(QUANT_FILE)
  );
}

export async function loadIndex() {
  try {
    if (!requiredFilesExist()) {
      indexDisabledReason =
        "Vector index files missing (meta.json / index.hnsw / vectors_int8.bin)";
      embedder = null;
      index = null;
      meta = null;
      console.warn(
        `⚠️  search index disabled: ${indexDisabledReason}. Run helper/build-index.js to generate files.`,
      );
      return { ready: false, reason: indexDisabledReason };
    }

    console.log("Loading model and index...");

    embedder = await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    );

    meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    const totalSentences = meta.length;

    index = new HierarchicalNSW("cosine", DIM);
    // ← Pass the same M=8 used at build time, otherwise readIndexSync loads wrong graph structure
    index.initIndex(totalSentences, HNSW_M);
    index.readIndexSync(INDEX_FILE);

    indexDisabledReason = null;
    console.log(`✅ Ready. ${totalSentences} sentences indexed.`);
    return { ready: true, totalSentences };
  } catch (err) {
    indexDisabledReason = err?.message || String(err);
    embedder = null;
    index = null;
    meta = null;
    console.warn(`⚠️  search index disabled: ${indexDisabledReason}`);
    return { ready: false, reason: indexDisabledReason };
  }
}

export async function search(userMessage, topK = 10) {
  if (!embedder || !index || !meta) {
    const canned = cannedRepliesFor(userMessage);
    return canned.slice(0, topK).map((sentence, i) => ({
      sentence,
      score: 1,
      index: -1 - i,
    }));
  }

  // For common greetings/openers, prefer direct replies over mirrored corpus matches.
  // (This doesn't apply to "any other chat message".)
  const earlyCanned = cannedRepliesFor(userMessage);
  const forceCanned = earlyCanned.length && /\b(how are you|how r u|howre you|how you doing|hi|hello|hey|good morning|good afternoon|good evening)\b/.test(normalizeText(userMessage));
  if (forceCanned) {
    return earlyCanned.slice(0, topK).map((sentence, i) => ({
      sentence,
      score: 1,
      index: -1 - i,
    }));
  }

  const output = await embedder([userMessage], {
    pooling: "mean",
    normalize: true,
  });

  // ← Quantize+dequantize the query vector to match the precision of stored vectors
  const queryVecFloat32 = output[0].data; // normalized Float32Array
  const queryVec = Array.from(quantizeVec(Array.from(queryVecFloat32)));

  // Pull a larger set then rerank to look more like a *reply* (not an echo).
  const rawK = Math.min(Math.max(topK * 10, 50), meta.length);
  const result = index.searchKnn(queryVec, rawK);

  const candidates = result.neighbors.map((idx, i) => {
    const baseScore = 1 - result.distances[i];
    const sentence = meta[idx]?.text || "";
    const boosted = baseScore + replyRerankBoost(sentence);
    return {
      sentence,
      score: parseFloat(boosted.toFixed(4)),
      baseScore: parseFloat(baseScore.toFixed(4)),
      index: idx,
    };
  });

  const filtered = candidates
    .filter((c) => looksLikeReply(userMessage, c.sentence))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(topK, candidates.length));

  // If filtering was too strict for a question, prefer safe canned replies over mirroring.
  if (filtered.length > 0) return filtered;

  // If we couldn't find any "reply-like" lines in the main corpus, try the reply bank (checkpoint).
  await ensureReplyBankReady();
  const fromBank = pickReplyFromBank(userMessage, queryVecFloat32, topK);
  if (fromBank.length) {
    return fromBank.map((sentence, i) => ({
      sentence,
      score: 1,
      index: -10_000 - i,
    }));
  }

  return candidates
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, Math.min(topK, candidates.length))
    .map((c) => ({ sentence: c.sentence, score: c.baseScore, index: c.index }));
}

export async function buildPrompt(userMessage, topK = 10) {
  const matches = await search(userMessage, topK);
  const context = matches.map((m) => m.sentence).join("\n");

  return {
    prompt: matches.length
      ? `You are Healjai — a warm, empathetic Thai AI assistant.
Use ONLY the knowledge below to respond. Do not make things up.

[Relevant knowledge]
${context}

[User said]
${userMessage}

[Response]`
      : `You are Healjai — a warm, empathetic AI assistant.

[User said]
${userMessage}

[Response]`,
    matches,
    indexReady: matches.length > 0,
    indexDisabledReason: matches.length === 0 ? indexDisabledReason : null,
  };
}
