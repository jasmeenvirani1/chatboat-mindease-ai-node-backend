import { pipeline } from "@xenova/transformers";
import hnswlib from "hnswlib-node";
const { HierarchicalNSW } = hnswlib;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_FILE = path.join(__dirname, "index.hnsw");
const META_FILE = path.join(__dirname, "meta.json");
const DIM = 384;

let embedder = null;
let index = null;
let meta = null;

export async function loadIndex() {
  console.log("Loading model and index...");

  embedder = await pipeline(
    "feature-extraction",
    "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  );

  // Load meta first — we need the count to init the index correctly
  meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
  const totalSentences = meta.length;

  // ✅ Must init with max elements BEFORE reading the saved index
  index = new HierarchicalNSW("cosine", DIM);
  index.initIndex(totalSentences); // ← this was missing
  index.readIndexSync(INDEX_FILE); // ← now loads all points correctly

  console.log(`Ready. ${totalSentences} sentences indexed.`);
}

export async function search(userMessage, topK = 10) {
  if (!embedder || !index || !meta) {
    throw new Error("Index not loaded. Call loadIndex() first.");
  }

  const output = await embedder([userMessage], {
    pooling: "mean",
    normalize: true,
  });

  const queryVec = Array.from(output[0].data);

  // topK cannot exceed total indexed sentences
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
    prompt: `You are Healjai — a warm, empathetic Thai AI assistant.
Use ONLY the knowledge below to respond. Do not make things up.

[Relevant knowledge]
${context}

[User said]
${userMessage}

[Response]`,
    matches,
  };
}
