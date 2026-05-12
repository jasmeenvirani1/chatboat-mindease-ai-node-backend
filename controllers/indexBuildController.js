const path = require("path");
const { spawn } = require("child_process");

let buildProcess = null;
let buildState = {
  status: "idle", // idle | building | success | failed
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  error: null,
  lastOutput: "",
};

function appendOutput(chunk) {
  const text = String(chunk ?? "");
  if (!text) return;
  const next = (buildState.lastOutput + text).slice(-50_000); // keep last 50KB
  buildState.lastOutput = next;
}

exports.getIndexBuildStatus = (req, res) => {
  res.json({ success: true, ...buildState, running: Boolean(buildProcess) });
};

exports.startIndexBuild = async (req, res) => {
  if (buildProcess) {
    return res.status(202).json({
      success: true,
      message: "Index build already running",
      ...buildState,
      running: true,
    });
  }

  const helperDir = path.join(__dirname, "..", "helper");
  const scriptPath = path.join(helperDir, "build-index.js");

  buildState = {
    status: "building",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    error: null,
    lastOutput: "",
  };

  buildProcess = spawn(process.execPath, [scriptPath], {
    cwd: helperDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  buildProcess.stdout.on("data", appendOutput);
  buildProcess.stderr.on("data", appendOutput);

  buildProcess.on("error", (err) => {
    buildState.status = "failed";
    buildState.finishedAt = new Date().toISOString();
    buildState.exitCode = null;
    buildState.error = err?.message || String(err);
    buildProcess = null;
  });

  buildProcess.on("close", async (code) => {
    buildState.exitCode = code;
    buildState.finishedAt = new Date().toISOString();
    if (code === 0) {
      buildState.status = "success";
      buildState.error = null;
    } else {
      buildState.status = "failed";
      buildState.error = buildState.error || `Exited with code ${code}`;
    }
    buildProcess = null;

    // Best-effort: reload the in-memory search index after a successful build.
    if (code === 0) {
      try {
        const { loadIndex } = require("../helper/search.js");
        await loadIndex();
      } catch (err) {
        // Keep build successful; just surface reload failure in output/error.
        const msg = err?.message || String(err);
        buildState.error = buildState.error || `Index reload failed: ${msg}`;
        appendOutput(`\n⚠️  Index reload failed: ${msg}\n`);
      }
    }
  });

  return res.status(202).json({
    success: true,
    message: "Index build started",
    ...buildState,
    running: true,
  });
};

