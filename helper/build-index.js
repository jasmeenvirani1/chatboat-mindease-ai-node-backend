import { pipeline } from "@xenova/transformers";
import hnswlib from "hnswlib-node";
const { HierarchicalNSW } = hnswlib;
import fs from "fs";
import path from "path";

const SENTENCES_FILE = "./sentences.json";
const INDEX_FILE = "./index.hnsw";
const META_FILE = "./meta.json";
const DIM = 384;

async function buildIndex() {
  // Step 1 — check file exists
  if (!fs.existsSync(SENTENCES_FILE)) {
    throw new Error(
      `sentences.json not found at: ${path.resolve(SENTENCES_FILE)}`,
    );
  }
  console.log("✅ sentences.json found");

  // Step 2 — parse and validate structure
  const raw = JSON.parse(fs.readFileSync(SENTENCES_FILE, "utf-8"));

  if (!raw.sentences || !Array.isArray(raw.sentences)) {
    throw new Error(
      'sentences.json must have structure: { "sentences": [...] }',
    );
  }

  const sentences = raw.sentences.filter(
    (s) => typeof s === "string" && s.trim() !== "",
  );
  console.log(`✅ Loaded ${sentences.length} valid sentences`);

  if (sentences.length === 0) {
    throw new Error("No valid sentences found in file");
  }

  // Step 3 — load model
  console.log("Loading embedding model (first run downloads ~120MB)...");
  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  );
  console.log("✅ Model loaded");

  // Step 4 — build index
  const index = new HierarchicalNSW("cosine", DIM);
  index.initIndex(sentences.length);
  console.log(`✅ Index initialized for ${sentences.length} sentences`);

  const BATCH = 64;
  for (let i = 0; i < sentences.length; i += BATCH) {
    const batch = sentences.slice(i, i + BATCH);

    const output = await embedder(batch, {
      pooling: "mean",
      normalize: true,
    });

    for (let j = 0; j < batch.length; j++) {
      const vec = Array.from(output[j].data);
      index.addPoint(vec, i + j);
    }

    process.stdout.write(
      `\rIndexing: ${Math.min(i + BATCH, sentences.length)} / ${sentences.length}`,
    );
  }

  console.log("\n✅ All sentences embedded");

  // Step 5 — save files
  index.writeIndexSync(INDEX_FILE);
  console.log(`✅ Index saved → ${path.resolve(INDEX_FILE)}`);

  const meta = sentences.map((text, idx) => ({ idx, text }));
  fs.writeFileSync(META_FILE, JSON.stringify(meta));
  console.log(`✅ Meta saved  → ${path.resolve(META_FILE)}`);

  console.log("\n🎉 Build complete!");
}

buildIndex().catch((err) => {
  console.error("\n❌ Build failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
