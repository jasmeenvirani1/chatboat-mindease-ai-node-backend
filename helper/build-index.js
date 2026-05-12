import { pipeline } from "@xenova/transformers";
import hnswlib from "hnswlib-node";
const { HierarchicalNSW } = hnswlib;
import fs from "fs";
import path from "path";

const SENTENCES_FILE = "./sentences.json";
const INDEX_FILE = "./index.hnsw";
const META_FILE = "./meta.json";
const QUANT_FILE = "./vectors_int8.bin"; // quantized raw vectors for re-use
const DIM = 384;
const BATCH = 64;

// ── Quantize a float32 vector to int8 ──────────────────────────────────────
// Each float is in [-1, 1] after normalization.
// We map that range to [-127, 127] and store as Int8.
function quantizeVec(floatArr) {
  const out = new Int8Array(floatArr.length);
  for (let i = 0; i < floatArr.length; i++) {
    // clamp then scale
    const clamped = Math.max(-1, Math.min(1, floatArr[i]));
    out[i] = Math.round(clamped * 127);
  }
  return out;
}

// Dequantize back to float32 for HNSW insertion
function dequantizeVec(int8Arr) {
  const out = new Float32Array(int8Arr.length);
  for (let i = 0; i < int8Arr.length; i++) {
    out[i] = int8Arr[i] / 127;
  }
  return out;
}

async function buildIndex() {
  // ── 1. Load sentences ────────────────────────────────────────────────────
  if (!fs.existsSync(SENTENCES_FILE)) {
    throw new Error(
      `sentences.json not found at: ${path.resolve(SENTENCES_FILE)}`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(SENTENCES_FILE, "utf-8"));
  const sentences = (raw.sentences ?? raw).filter(
    (s) => typeof s === "string" && s.trim() !== "",
  );
  console.log(`✅ Loaded ${sentences.length} sentences`);

  // ── 2. Embed + quantize ──────────────────────────────────────────────────
  console.log("Loading embedding model...");
  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  );
  console.log("✅ Model ready\n");

  // We'll write all int8 vectors into one big binary buffer:
  // layout: [sentences.length × DIM bytes]  (Int8, 1 byte per dimension)
  const quantBuf = Buffer.alloc(sentences.length * DIM); // 200k × 384 = ~77 MB

  const index = new HierarchicalNSW("cosine", DIM);
  // ef_construction & M trade off build speed vs query accuracy.
  // Lower M (default 16 → 8) cuts index size further with slight recall drop.
  index.initIndex(sentences.length, 8 /* M */, 200 /* ef_construction */);

  for (let i = 0; i < sentences.length; i += BATCH) {
    const batch = sentences.slice(i, i + BATCH);
    const output = await embedder(batch, { pooling: "mean", normalize: true });

    for (let j = 0; j < batch.length; j++) {
      const floatVec = Array.from(output[j].data);
      const int8Vec = quantizeVec(floatVec);

      // Store quantized bytes in buffer
      const offset = (i + j) * DIM;
      for (let k = 0; k < DIM; k++) quantBuf[offset + k] = int8Vec[k];

      // HNSW still gets dequantized floats (it doesn't support int8 natively)
      index.addPoint(Array.from(dequantizeVec(int8Vec)), i + j);
    }

    process.stdout.write(
      `\rIndexing: ${Math.min(i + BATCH, sentences.length)} / ${sentences.length}`,
    );
  }
  console.log("\n✅ Embedding complete");

  // ── 3. Save files ────────────────────────────────────────────────────────
  index.writeIndexSync(INDEX_FILE);
  console.log(`✅ HNSW index  → ${path.resolve(INDEX_FILE)}`);

  fs.writeFileSync(QUANT_FILE, quantBuf);
  console.log(
    `✅ Int8 vectors → ${path.resolve(QUANT_FILE)}  (${(quantBuf.length / 1e6).toFixed(1)} MB)`,
  );

  const meta = sentences.map((text, idx) => ({ idx, text }));
  fs.writeFileSync(META_FILE, JSON.stringify(meta));
  console.log(`✅ Meta        → ${path.resolve(META_FILE)}`);

  console.log("\n🎉 Build complete!");
  console.log(
    `   Approx index size: ${((sentences.length * DIM * 1) / 1e6).toFixed(1)} MB (int8 vectors)`,
  );
}

buildIndex().catch((err) => {
  console.error("\n❌ Build failed:", err.message);
  process.exit(1);
});
