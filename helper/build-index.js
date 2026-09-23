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

// Crash-safe checkpoint files: let a killed run resume from the last
// checkpointed sentence. Separate from the final INDEX/META/QUANT outputs,
// which are written once on success.
const CHECKPOINT_VECTORS_FILE = path.join(__dirname, "vectors_int8.checkpoint.bin");
const CHECKPOINT_META_FILE = path.join(__dirname, "meta.checkpoint.jsonl"); // append-only, one JSON object per line
const PROGRESS_FILE = path.join(__dirname, "progress.json"); // tiny cursor file, rewritten every batch (cheap: a few bytes)

// Quantize a float32 vector to int8
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
    return { reusableCount: 0, existingCount: 0 };
  }

  try {
    const existingMeta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
    if (!Array.isArray(existingMeta)) {
      return { reusableCount: 0, existingCount: 0 };
    }

    const existingTexts = existingMeta.map((item) =>
      typeof item === "string" ? item : item?.text,
    );
    // Only need the byte length here, not the file contents — avoids pulling
    // a multi-hundred-MB vector table into memory just to size-check it.
    const quantSize = fs.statSync(QUANT_FILE).size;
    const maxReusableByVectors = Math.floor(quantSize / DIM);
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

    return { reusableCount, existingCount: existingTexts.length };
  } catch (err) {
    console.warn(`⚠️  Could not reuse previous vectors: ${err.message}`);
    return { reusableCount: 0, existingCount: 0 };
  }
}

// Atomic write helper (write to temp file, then rename)
// Prevents a crash mid-write from leaving a corrupt progress/meta file behind.
function writeFileAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, data);
  fs.renameSync(tmpPath, filePath);
}

// Streams the final meta.json out entry-by-entry instead of building one
// giant array and JSON.stringify-ing it in one shot, which briefly doubles
// up the ~1.8M-string array in memory right when RAM is already tightest.
function writeMetaStreamed(filePath, sentences) {
  const tmpPath = `${filePath}.tmp`;
  const fd = fs.openSync(tmpPath, "w");
  fs.writeSync(fd, "[");
  for (let idx = 0; idx < sentences.length; idx++) {
    const entry = JSON.stringify({ idx, text: sentences[idx] });
    fs.writeSync(fd, idx === 0 ? entry : `,${entry}`);
  }
  fs.writeSync(fd, "]");
  fs.closeSync(fd);
  fs.renameSync(tmpPath, filePath);
}

function readProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return null;
  try {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    if (typeof progress?.lastIndexed !== "number") return null;
    return progress;
  } catch {
    return null;
  }
}

function writeProgress(lastIndexed, totalSentences) {
  writeFileAtomic(
    PROGRESS_FILE,
    JSON.stringify({ lastIndexed, totalSentences, updatedAt: new Date().toISOString() }),
  );
}

function clearCheckpointFiles() {
  for (const f of [CHECKPOINT_VECTORS_FILE, CHECKPOINT_META_FILE, PROGRESS_FILE]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
}

// Resume support: if a previous run left a valid checkpoint whose recorded
// sentence count/text lines up with the current sentence list, we can pick
// up embedding from where it left off instead of starting over.
function loadCheckpoint(sentences) {
  const progress = readProgress();
  if (!progress) return { resumeFrom: 0 };

  if (
    !fs.existsSync(CHECKPOINT_VECTORS_FILE) ||
    !fs.existsSync(CHECKPOINT_META_FILE)
  ) {
    return { resumeFrom: 0 };
  }

  try {
    const metaLines = fs
      .readFileSync(CHECKPOINT_META_FILE, "utf-8")
      .split("\n")
      .filter((line) => line.trim() !== "");

    if (!metaLines.length) return { resumeFrom: 0 };

    // Checkpoint lines carry their own absolute `idx` (they may start
    // mid-file, e.g. a run that resumed from reused vectors at idx 49219 —
    // metaLines[0] is NOT sentences[0], it's sentences[<its own idx>]).
    const firstEntry = JSON.parse(metaLines[0]);
    const checkpointStart = firstEntry.idx;
    const lastIndexed = Math.min(
      progress.lastIndexed,
      checkpointStart + metaLines.length,
      sentences.length,
    );

    // Sanity-check a handful of sample points rather than diffing every
    // sentence (cheap even at millions of rows, and catches source-file
    // edits/reordering that would otherwise silently corrupt the resume).
    const sampleAbsIdxs = new Set([
      checkpointStart,
      Math.floor((checkpointStart + lastIndexed) / 2),
      lastIndexed - 1,
    ]);
    for (const absIdx of sampleAbsIdxs) {
      if (absIdx < checkpointStart || absIdx >= lastIndexed) continue;
      const line = JSON.parse(metaLines[absIdx - checkpointStart]);
      if (line.idx !== absIdx || line.text !== sentences[absIdx]) {
        console.warn(
          "⚠️  Checkpoint no longer matches source sentences (mismatch at index " +
            `${absIdx}). Discarding checkpoint and rebuilding from scratch.`,
        );
        return { resumeFrom: 0 };
      }
    }

    // Only need the byte length here — the caller streams the checkpoint
    // vectors file straight into the target file rather than through memory.
    // The checkpoint vectors file is also written starting at `checkpointStart`,
    // so its byte length maps to (lastIndexed - checkpointStart) vectors.
    const quantSize = fs.statSync(CHECKPOINT_VECTORS_FILE).size;
    const maxVectorsInCheckpoint = Math.floor(quantSize / DIM);
    const resumeFrom = Math.min(
      lastIndexed,
      checkpointStart + maxVectorsInCheckpoint,
    );

    return { resumeFrom: Math.max(resumeFrom, 0), checkpointStart };
  } catch (err) {
    console.warn(`⚠️  Could not read checkpoint, rebuilding from scratch: ${err.message}`);
    return { resumeFrom: 0 };
  }
}

function addStoredVectorsToIndex(index, quantFd, start, end, total) {
  // Read a chunk of BATCH vectors at a time instead of holding the whole
  // multi-hundred-MB vector table in memory — keeps RSS flat regardless of
  // how many sentences are indexed.
  const chunkBuf = Buffer.alloc(BATCH * DIM);
  for (let chunkStart = start; chunkStart < end; chunkStart += BATCH) {
    const chunkEnd = Math.min(chunkStart + BATCH, end);
    const bytesToRead = (chunkEnd - chunkStart) * DIM;
    fs.readSync(quantFd, chunkBuf, 0, bytesToRead, chunkStart * DIM);

    for (let idx = chunkStart; idx < chunkEnd; idx++) {
      const offset = (idx - chunkStart) * DIM;
      const int8Vec = getSignedInt8View(chunkBuf, offset, DIM);
      index.addPoint(Array.from(dequantizeVec(int8Vec)), idx);
    }

    process.stdout.write(`\rIndexing: ${chunkEnd} / ${total}`);
  }
}

async function buildIndex() {
  // 1. Load sentences
  const { sentences, fileStats } = loadAllSentences();
  console.log(`✅ Loaded ${sentences.length} sentences`);
  console.log(
    `📚 Sources: ${fileStats.map(({ file, count }) => `${file} (${count})`).join(", ")}`,
  );

  const { reusableCount, existingCount } = loadReusableArtifacts(sentences);
  const unchangedAll =
    reusableCount === sentences.length &&
    fs.existsSync(INDEX_FILE) &&
    fs.existsSync(META_FILE) &&
    fs.existsSync(QUANT_FILE);

  if (unchangedAll) {
    console.log("✅ Index already up to date. No new sentences to embed.");
    clearCheckpointFiles(); // final outputs are valid; drop any stale leftover checkpoint
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

  // 1b. Check for a checkpoint from an interrupted run. A completed build
  // (handled above) always wins; a checkpoint only saves redoing partway work.
  // A checkpoint whose tail starts past what we can seed from QUANT_FILE
  // (e.g. QUANT_FILE is missing/stale) can't be safely overlaid — the gap
  // in between would be left as zero bytes — so treat it as unusable.
  const checkpoint = loadCheckpoint(sentences);
  const checkpointUsable =
    checkpoint.resumeFrom > reusableCount &&
    (checkpoint.checkpointStart ?? 0) <= reusableCount;
  const resumeFromCheckpoint = checkpointUsable;
  const startFrom = resumeFromCheckpoint ? checkpoint.resumeFrom : reusableCount;

  if (resumeFromCheckpoint) {
    console.log(
      `🔁 Resuming from checkpoint: ${checkpoint.resumeFrom} / ${sentences.length} sentences already embedded in a previous run.`,
    );
  }

  // 2. Prepare the vector table as a file on disk instead of one giant
  // in-memory buffer — at ~1.8M sentences that buffer alone is ~680MB, which
  // was blowing past available RAM and getting the process OOM-killed.
  // Working file lives next to the final QUANT_FILE and becomes it at the end.
  const WORKING_QUANT_FILE = `${QUANT_FILE}.building`;
  const totalBytes = sentences.length * DIM;

  // Seed the working file from whichever source has the most progress:
  // a mid-run checkpoint (further along) beats the last full build's output.
  // Always start from a clean file in the fresh-build case — a stale
  // `.building` file left over from an earlier aborted run must not leak
  // its old bytes into slots this run never writes.
  //
  // The checkpoint vectors file only holds the TAIL (starting at
  // checkpoint.checkpointStart), not vectors [0, checkpointStart) — those
  // live in the last full build's QUANT_FILE, so both are needed together.
  if (reusableCount > 0 && fs.existsSync(QUANT_FILE)) {
    fs.copyFileSync(QUANT_FILE, WORKING_QUANT_FILE);
  } else {
    fs.writeFileSync(WORKING_QUANT_FILE, Buffer.alloc(0));
  }
  // Pre-size the file to its final length (sparse on most filesystems, so
  // this doesn't actually use `totalBytes` of disk until pages are written).
  fs.truncateSync(WORKING_QUANT_FILE, totalBytes);

  const quantFd = fs.openSync(WORKING_QUANT_FILE, "r+");

  if (resumeFromCheckpoint) {
    // Overlay the checkpoint's tail onto the working file at its real offset,
    // copied in chunks so a large checkpoint never sits fully in memory.
    const checkpointStart = checkpoint.checkpointStart ?? 0;
    const checkpointFd = fs.openSync(CHECKPOINT_VECTORS_FILE, "r");
    const copyChunk = Buffer.alloc(BATCH * DIM);
    let readOffset = 0;
    let bytesRead;
    while ((bytesRead = fs.readSync(checkpointFd, copyChunk, 0, copyChunk.length, readOffset)) > 0) {
      fs.writeSync(quantFd, copyChunk, 0, bytesRead, checkpointStart * DIM + readOffset);
      readOffset += bytesRead;
    }
    fs.closeSync(checkpointFd);
  }

  const index = new HierarchicalNSW("cosine", DIM);
  // ef_construction & M trade off build speed vs query accuracy.
  // Lower M (default 16 → 8) cuts index size further with slight recall drop.
  index.initIndex(sentences.length, 8 /* M */, 200 /* ef_construction */);

  if (startFrom > 0) {
    console.log("Rebuilding HNSW graph from stored vectors...");
    addStoredVectorsToIndex(index, quantFd, 0, startFrom, sentences.length);
    console.log(`✅ Restored ${startFrom} existing vectors into the index`);
  }

  let embedder = null;
  if (startFrom < sentences.length) {
    console.log("Loading embedding model...");
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    );
    console.log("✅ Model ready\n");
  }

  // 3. Embed only the missing tail. Checkpoint files are append-only, so only
  // the tail written this run is appended; earlier data on disk stays put.
  if (startFrom < sentences.length) {
    // Fresh checkpoint files start clean at `startFrom`; if we're resuming,
    // the existing checkpoint files already hold everything up to startFrom,
    // so we only ever append from here on, never rewrite what's there.
    if (!resumeFromCheckpoint) {
      clearCheckpointFiles();
    }

    for (let i = startFrom; i < sentences.length; i += BATCH) {
      const batch = sentences.slice(i, i + BATCH);
      const output = await embedder(batch, { pooling: "mean", normalize: true });

      // Only ever hold one batch's worth of bytes in memory, not the whole table.
      const batchBuf = Buffer.alloc(batch.length * DIM);
      const metaLines = [];
      for (let j = 0; j < batch.length; j++) {
        const floatVec = Array.from(output[j].data);
        const int8Vec = quantizeVec(floatVec);

        batchBuf.set(int8Vec, j * DIM);

        // HNSW still gets dequantized floats (it doesn't support int8 natively)
        index.addPoint(Array.from(dequantizeVec(int8Vec)), i + j);

        metaLines.push(JSON.stringify({ idx: i + j, text: batch[j] }));
      }

      // Write this batch straight into the on-disk working file at its slot,
      // and append to the checkpoint, advancing the cursor immediately so a
      // crash (including an OOM kill) loses at most the batch in flight.
      fs.writeSync(quantFd, batchBuf, 0, batchBuf.length, i * DIM);
      fs.appendFileSync(CHECKPOINT_VECTORS_FILE, batchBuf);
      fs.appendFileSync(CHECKPOINT_META_FILE, metaLines.join("\n") + "\n");
      writeProgress(i + batch.length, sentences.length);

      process.stdout.write(
        `\rIndexing: ${Math.min(i + BATCH, sentences.length)} / ${sentences.length}`,
      );
    }
    console.log("\n✅ Embedding complete");
  } else {
    console.log("✅ No new embeddings were needed");
  }

  // 4. Save files
  index.writeIndexSync(INDEX_FILE);
  console.log(`✅ HNSW index  → ${path.resolve(INDEX_FILE)}`);

  fs.closeSync(quantFd);
  fs.renameSync(WORKING_QUANT_FILE, QUANT_FILE);
  console.log(
    `✅ Int8 vectors → ${path.resolve(QUANT_FILE)}  (${(totalBytes / 1e6).toFixed(1)} MB)`,
  );

  // Meta is written incrementally too — 1.8M small text strings is a much
  // smaller footprint than the vector table, but stringify-ing them all in
  // one JSON.stringify call still spikes memory, so stream it out instead.
  writeMetaStreamed(META_FILE, sentences);
  console.log(`✅ Meta        → ${path.resolve(META_FILE)}`);

  // Final outputs are complete and saved — the crash-safe checkpoint is no
  // longer needed and would only cause confusion (stale resume) on the next run.
  clearCheckpointFiles();

  console.log("\n🎉 Build complete!");
  console.log(
    `   Approx index size: ${((sentences.length * DIM * 1) / 1e6).toFixed(1)} MB (int8 vectors)`,
  );
}

buildIndex().catch((err) => {
  console.error("\n❌ Build failed:", err.message);
  process.exit(1);
});
