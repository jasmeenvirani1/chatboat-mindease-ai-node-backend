/**
 * Reply cleanup shared by every chat category.
 *
 * LLMs sometimes emit "\n\n\n" or whitespace-only lines between paragraphs;
 * the UI renders that as a big gap. These helpers collapse any run of blank
 * lines to a single blank line while keeping indentation, lists and code
 * blocks intact.
 */

/** Non-streaming: "I'm here—what" / "here — what" -> "here, what". */
function softenEmDashes(text = "") {
  return String(text)
    .replace(/^[ \t]*—[ \t]*/gm, "") // dialogue-style dash at line start
    .replace(/[ \t]*—[ \t]*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/([.!?।])\s*,\s*/g, "$1 ");
}

/**
 * Streaming version of softenEmDashes. Spaces are held until the next real
 * character so "here" + " " + "—" + " what" never becomes "here , what".
 */
function createEmDashSoftener() {
  let pending = ""; // spaces not yet emitted
  let last = "\n"; // last emitted char (start counts as line start)
  let afterDash = false; // swallow the spaces that followed the dash
  return {
    push(chunk = "") {
      let out = "";
      const emit = (t) => { out += t; last = t[t.length - 1]; };
      for (const ch of String(chunk)) {
        if (ch === " " || ch === "\t") { if (!afterDash) pending += ch; continue; }
        if (ch === "\n") { pending = ""; afterDash = false; emit(ch); continue; }
        if (ch === "—") {
          pending = "";
          afterDash = true;
          // nothing to join at line start; avoid ",," and "., "
          if (!/[\n,.!?।]/.test(last)) { emit(","); pending = " "; }
          else if (!/[\n]/.test(last)) pending = " ";
          continue;
        }
        afterDash = false;
        if (pending) { emit(pending); pending = ""; }
        emit(ch);
      }
      return out;
    },
  };
}

/** Non-streaming: clean a complete reply. */
function collapseBlankLines(text = "", { softenEmDash = false, softenEllipsis = false } = {}) {
  let src = softenEmDash ? softenEmDashes(text) : String(text);
  if (softenEllipsis) src = softenEllipses(src);
  return src
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]+(?=\n)/g, "\n") // whitespace-only lines become empty
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "");
}

/**
 * Streaming: LLM chunks split anywhere, so the newline run is tracked across
 * chunks. push(chunk) returns the cleaned text to emit.
 */
function createBlankLineCollapser() {
  let newlines = 0; // consecutive newlines at the end of what was emitted
  let ws = ""; // spaces held back right after a newline
  let started = false;
  return {
    push(chunk = "") {
      let out = "";
      for (const ch of String(chunk)) {
        if (ch === "\r") continue;
        if (ch === "\n") {
          if (!started) continue;
          ws = ""; // whitespace-only line
          if (newlines < 2) { out += "\n"; newlines++; }
          continue;
        }
        if (ch === " " || ch === "\t") {
          if (!started) continue;
          if (newlines > 0) ws += ch; else out += ch;
          continue;
        }
        if (ws) { out += ws; ws = ""; } // real indentation, keep it
        started = true;
        newlines = 0;
        out += ch;
      }
      return out;
    },
  };
}

const SSE_TEXT_FRAME = /^data: (\{[\s\S]*\})\n\n$/;

/**
 * Wrap res.write so every `data: {"text": "..."}` SSE frame is cleaned
 * before it reaches the client. Other frames pass through untouched.
 * Install once, right after the SSE headers are sent.
 */
function guardSseBlankLines(res, { softenEmDash = false, softenEllipsis = false } = {}) {
  const collapser = createBlankLineCollapser();
  const dash = softenEmDash ? createEmDashSoftener() : null;
  const ellipsis = softenEllipsis ? createEllipsisSoftener() : null;
  const clean = (text) => collapser.push(dash ? dash.push(text) : text);
  const rawWrite = res.write.bind(res);
  const rawEnd = res.end.bind(res);

  res.write = (chunk, ...rest) => {
    if (typeof chunk === "string") {
      const m = SSE_TEXT_FRAME.exec(chunk);
      if (m) {
        try {
          const obj = JSON.parse(m[1]);
          if (typeof obj.text === "string") {
            const cleaned = clean(ellipsis ? ellipsis.push(obj.text) : obj.text);
            if (cleaned === "" && obj.text !== "") return true; // fully dropped
            obj.text = cleaned;
            return rawWrite(`data: ${JSON.stringify(obj)}\n\n`, ...rest);
          }
        } catch {
          /* not our frame shape — fall through */
        }
      }
    }
    return rawWrite(chunk, ...rest);
  };

  // A full stop held back while waiting for the next character must not be lost.
  res.end = (...args) => {
    const tail = ellipsis ? clean(ellipsis.flush()) : "";
    if (tail) rawWrite(`data: ${JSON.stringify({ text: tail })}\n\n`);
    return rawEnd(...args);
  };
}

// An ellipsis is "…" or two or more dots. Models over-use it mid-sentence
// ("been...sitting heavy"), which reads as a glitch. Rules:
//   followed by whitespace or the end  -> a plain full stop   ("wait... ok" -> "wait. ok")
//   followed directly by a character   -> a space             ("with...you"  -> "with you")
const ELLIPSIS = "(?:\\.{2,}|\\u2026+)";
const ELLIPSIS_END = new RegExp(`[ \\t]*${ELLIPSIS}(?=\\s|$)`, "g");
const ELLIPSIS_MID = new RegExp(`[ \\t]*${ELLIPSIS}`, "g");

/** Non-streaming. Also used on old replies before they go back to the model as history. */
function softenEllipses(text = "") {
  return String(text).replace(ELLIPSIS_END, ".").replace(ELLIPSIS_MID, " ");
}

/**
 * Streaming version of softenEllipses. A run of dots is held back until the
 * character after it arrives, because chunks can split "..." anywhere.
 * flush() returns whatever is still held when the stream ends.
 */
function createEllipsisSoftener() {
  let run = ""; // dots / … held back
  let last = "\n"; // last character emitted
  const isDot = (ch) => ch === "." || ch === "\u2026";
  const isEllipsis = () => run.length > 1 || run === "\u2026";
  return {
    push(chunk = "") {
      let out = "";
      const emit = (t) => { out += t; last = t[t.length - 1]; };
      const resolve = (next) => {
        if (!run) return;
        if (!isEllipsis()) emit(run); // an ordinary full stop
        else if (next === undefined || /\s/.test(next)) { if (!/[.!?]/.test(last)) emit("."); }
        else if (!/\s/.test(last)) emit(" ");
        run = "";
      };
      for (const ch of String(chunk)) {
        if (isDot(ch)) { run += ch; continue; }
        resolve(ch);
        emit(ch);
      }
      return out;
    },
    flush() {
      const pending = run;
      if (!pending) return "";
      run = "";
      return pending.length > 1 || pending === "\u2026" ? "." : pending;
    },
  };
}

module.exports = {
  softenEllipses,
  createEllipsisSoftener,
  collapseBlankLines,
  createBlankLineCollapser,
  softenEmDashes,
  createEmDashSoftener,
  guardSseBlankLines,
};
