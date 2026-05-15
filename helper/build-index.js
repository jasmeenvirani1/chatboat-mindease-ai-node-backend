import { pipeline } from "@xenova/transformers";
import hnswlib from "hnswlib-node";
const { HierarchicalNSW } = hnswlib;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SENTENCES_FILE = path.join(__dirname, "sentences.json");
const SENTENCES_DIR = path.join(__dirname, "sentences");
const INDEX_FILE = path.join(__dirname, "index.hnsw");
const META_FILE = path.join(__dirname, "meta.json");
const QUANT_FILE = path.join(__dirname, "vectors_int8.bin"); // quantized raw vectors for re-use
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

function getSignedInt8View(buf, offset, length) {
  return new Int8Array(buf.buffer, buf.byteOffset + offset, length);
}

function extractSentencesFromRaw(raw, sourceLabel) {
  if (Array.isArray(raw)) {
    return raw.filter((s) => typeof s === "string" && s.trim() !== "");
  }

  if (Array.isArray(raw?.sentences)) {
    return raw.sentences.filter(
      (s) => typeof s === "string" && s.trim() !== "",
    );
  }

  throw new Error(
    `Unsupported sentence file format in ${sourceLabel}. Expected an array or { "sentences": [] }.`,
  );
}

function listSentenceSources() {
  const sources = [];

  if (fs.existsSync(SENTENCES_FILE)) {
    sources.push(SENTENCES_FILE);
  }

  if (fs.existsSync(SENTENCES_DIR)) {
    const nestedFiles = fs
      .readdirSync(SENTENCES_DIR)
      .filter((name) => name.toLowerCase().endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => path.join(SENTENCES_DIR, name));

    sources.push(...nestedFiles);
  }

  return sources;
}

function loadAllSentences() {
  const sources = listSentenceSources();
  if (!sources.length) {
    throw new Error(
      `No sentence files found. Add ${path.resolve(SENTENCES_FILE)} or JSON files in ${path.resolve(SENTENCES_DIR)}`,
    );
  }

  const sentences = [];
  const fileStats = [];

  for (const filePath of sources) {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const fileSentences = extractSentencesFromRaw(raw, path.basename(filePath));
    for (const sentence of fileSentences) {
      sentences.push(sentence);
    }
    fileStats.push({
      file: path.basename(filePath),
      count: fileSentences.length,
    });
  }

  return { sentences, fileStats };
}

function loadReusableArtifacts(sentences) {
  if (!fs.existsSync(META_FILE) || !fs.existsSync(QUANT_FILE)) {
    return { reusableCount: 0, quantData: null, existingCount: 0 };
  }

  try {
    const existingMeta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    if (!Array.isArray(existingMeta)) {
      return { reusableCount: 0, quantData: null, existingCount: 0 };
    }

    const existingTexts = existingMeta.map((item) =>
      typeof item === "string" ? item : item?.text,
    );
    const quantData = fs.readFileSync(QUANT_FILE);
    const maxReusableByVectors = Math.floor(quantData.length / DIM);
    const compareLimit = Math.min(
      sentences.length,
      existingTexts.length,
      maxReusableByVectors,
    );

    let reusableCount = 0;
    while (reusableCount < compareLimit) {
      if (existingTexts[reusableCount] !== sentences[reusableCount]) break;
      reusableCount++;
    }

    return { reusableCount, quantData, existingCount: existingTexts.length };
  } catch (err) {
    console.warn(`⚠️  Could not reuse previous vectors: ${err.message}`);
    return { reusableCount: 0, quantData: null, existingCount: 0 };
  }
}

function addStoredVectorsToIndex(index, quantBuf, start, end, total) {
  for (let idx = start; idx < end; idx++) {
    const offset = idx * DIM;
    const int8Vec = getSignedInt8View(quantBuf, offset, DIM);
    index.addPoint(Array.from(dequantizeVec(int8Vec)), idx);

    if ((idx + 1) % BATCH === 0 || idx + 1 === end) {
      process.stdout.write(`\rIndexing: ${idx + 1} / ${total}`);
    }
  }
}

async function buildIndex() {
  // ── 1. Load sentences ────────────────────────────────────────────────────
  const { sentences, fileStats } = loadAllSentences();
  console.log(`✅ Loaded ${sentences.length} sentences`);
  console.log(
    `📚 Sources: ${fileStats.map(({ file, count }) => `${file} (${count})`).join(", ")}`,
  );

  const { reusableCount, quantData, existingCount } =
    loadReusableArtifacts(sentences);
  const unchangedAll =
    reusableCount === sentences.length &&
    fs.existsSync(INDEX_FILE) &&
    fs.existsSync(META_FILE) &&
    fs.existsSync(QUANT_FILE);

  if (unchangedAll) {
    console.log("✅ Index already up to date. No new sentences to embed.");
    return;
  }

  if (reusableCount > 0) {
    const changeType =
      reusableCount === Math.min(sentences.length, existingCount)
        ? "appended"
        : "changed earlier";
    console.log(
      `♻️  Reusing ${reusableCount} existing sentence vectors (${changeType}).`,
    );
  } else {
    console.log("ℹ️  No reusable vectors found. Building from scratch.");
  }

  // ── 2. Prepare vector buffer + index ─────────────────────────────────────
  // We'll write all int8 vectors into one big binary buffer:
  // layout: [sentences.length × DIM bytes]  (Int8, 1 byte per dimension)
  const quantBuf = Buffer.alloc(sentences.length * DIM); // 200k × 384 = ~77 MB
  if (reusableCount > 0 && quantData) {
    quantData.copy(quantBuf, 0, 0, reusableCount * DIM);
  }

  const index = new HierarchicalNSW("cosine", DIM);
  // ef_construction & M trade off build speed vs query accuracy.
  // Lower M (default 16 → 8) cuts index size further with slight recall drop.
  index.initIndex(sentences.length, 8 /* M */, 200 /* ef_construction */);

  if (reusableCount > 0) {
    console.log("Rebuilding HNSW graph from stored vectors...");
    addStoredVectorsToIndex(index, quantBuf, 0, reusableCount, sentences.length);
    console.log(`✅ Restored ${reusableCount} existing vectors into the index`);
  }

  let embedder = null;
  if (reusableCount < sentences.length) {
    console.log("Loading embedding model...");
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    );
    console.log("✅ Model ready\n");
  }

  // ── 3. Embed only the missing tail ───────────────────────────────────────
  for (let i = reusableCount; i < sentences.length; i += BATCH) {
    const batch = sentences.slice(i, i + BATCH);
    const output = await embedder(batch, { pooling: "mean", normalize: true });

    for (let j = 0; j < batch.length; j++) {
      const floatVec = Array.from(output[j].data);
      const int8Vec = quantizeVec(floatVec);

      // Store quantized bytes in buffer
      const offset = (i + j) * DIM;
      quantBuf.set(int8Vec, offset);

      // HNSW still gets dequantized floats (it doesn't support int8 natively)
      index.addPoint(Array.from(dequantizeVec(int8Vec)), i + j);
    }

    process.stdout.write(
      `\rIndexing: ${Math.min(i + BATCH, sentences.length)} / ${sentences.length}`,
    );
  }
  if (reusableCount < sentences.length) {
    console.log("\n✅ Embedding complete");
  } else {
    console.log("✅ No new embeddings were needed");
  }

  // ── 4. Save files ────────────────────────────────────────────────────────
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
