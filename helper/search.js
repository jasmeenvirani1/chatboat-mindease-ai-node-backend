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

let embedder = null;
let index = null;
let meta = null;
let indexDisabledReason = null;

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
  if (!embedder || !index || !meta) return [];

  const output = await embedder([userMessage], {
    pooling: "mean",
    normalize: true,
  });

  // ← Quantize+dequantize the query vector to match the precision of stored vectors
  const queryVec = Array.from(quantizeVec(Array.from(output[0].data)));

  const k = Math.min(topK, meta.length);
  const result = index.searchKnn(queryVec, k);

  return result.neighbors
    .map((idx, i) => ({
      sentence: meta[idx].text,
      score: parseFloat((1 - result.distances[i]).toFixed(4)),
      index: idx,
    }))
    .sort((a, b) => b.score - a.score);
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
