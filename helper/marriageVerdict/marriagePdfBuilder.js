"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriagePdfBuilder
// Turns a saved MarriageVerdict record into a polished, print-ready A4 PDF.
//
// Text is drawn as real vector text (not a screenshot), so it stays sharp at
// any zoom and can be selected / searched. Fonts are bundled in assets/fonts
// (Noto Sans / Noto Serif, plus Noto Sans Devanagari for Hindi reports) so the
// output never depends on what is installed on the server.
//
// Layout: a dark branded cover (couple, Cosmic Match ring, Guna / Manglik
// badges) followed by light, ink-friendly pages for the readable sections.
// Every figure comes from the saved record — nothing is recomputed here.
// ─────────────────────────────────────────────────────────────────────────────

const path = require("path");
const PDFDocument = require("pdfkit");

const FONT_DIR = path.join(__dirname, "..", "..", "assets", "fonts");

const PAGE = { w: 595.28, h: 841.89 };
const M = 44; // side margin
const CW = PAGE.w - M * 2; // content width
const TOP = 54; // first y on a continuation page
const BOTTOM = PAGE.h - 58; // last usable y (footer lives below)

const C = {
  coverTop: "#241338",
  coverBottom: "#120b1b",
  coverText: "#F5EFFB",
  coverMuted: "#B7A8CC",
  lilac: "#C084FC",
  gold: "#D4AF6A",
  ink: "#2A2233",
  muted: "#6F6679",
  faint: "#A39BAE",
  accent: "#7A4BC4",
  panel: "#F7F3FC",
  border: "#E4D9F3",
  white: "#FFFFFF",
  green: "#1F9D6B",
  rose: "#C2415D",
  amber: "#B7791F",
};

// Wedding colour names → swatch hex (case-insensitive; unknown → neutral grey).
const COLOR_HEX = {
  red: "#DC2626", gold: "#D4AF37", cream: "#FFF4D6", pink: "#EC6FA6", orange: "#F97316",
  white: "#F9FAFB", green: "#22A55B", blue: "#3B82F6", purple: "#9333EA", yellow: "#EAB308",
  black: "#1F2937", grey: "#9CA3AF", gray: "#9CA3AF", saffron: "#F59E0B", safron: "#F59E0B", maroon: "#8B1A1A",
  ivory: "#FFFFF0", amber: "#F59E0B", champagne: "#F3DFB5", rust: "#B7410E", coral: "#FF7F6B",
  sand: "#D9C3A0", emerald: "#10A56B", burgundy: "#800020", charcoal: "#374151",
  terracotta: "#C8553D", rose: "#E75480", peach: "#FFCBA4", mustard: "#E1AD01", turquoise: "#30D5C8",
  teal: "#0F766E", navy: "#1E3A8A", lavender: "#B79FE6", mint: "#98E2C6", beige: "#E8DCC4",
  brown: "#7B4B2A", copper: "#B87333", bronze: "#CD7F32", silver: "#C0C0C7", magenta: "#C026D3",
  indigo: "#4F46E5", violet: "#7C3AED", crimson: "#B91C3C", scarlet: "#E0301E", turmeric: "#E3A018",
  olive: "#6B7A2A", plum: "#7E3F8F", wine: "#722F37", sage: "#9CAF88", blush: "#F4C2C2", ruby: "#C0143C",
  sapphire: "#2554C7", pearl: "#F0EAD6", sandalwood: "#C8A27A", jade: "#00A86B", peacock: "#1A7F8E",
  cherry: "#B3122E", honey: "#E8A317", lilac: "#C8A2C8", aqua: "#3CCFCF", fuchsia: "#D946EF", tan: "#C9A37A",
  "deep red": "#9B1C1C", "off-white": "#F3EFE6", "muted grey": "#9CA3AF", "faded tones": "#C9C4CC",
};

const DEVANAGARI = /[ऀ-ॿ]/;
const str = (v, fallback = "") => (typeof v === "string" ? v.trim() : v == null ? fallback : String(v)).trim() || fallback;
const list = (v) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);

function colorHex(name) {
  const key = str(name).toLowerCase();
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  const phrase = Object.keys(COLOR_HEX).find((k) => k.includes(" ") && key.includes(k));
  if (phrase) return COLOR_HEX[phrase];
  // The colour is usually the last word ("Sunset Saffron", "Deep Royal Gold").
  const tokens = key.split(/[^a-z]+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) if (COLOR_HEX[tokens[i]]) return COLOR_HEX[tokens[i]];
  return "#CFC8D8";
}

/**
 * @param {object} record - lean MarriageVerdict document (formInput, aiVerdict, astroCore…)
 * @returns {PDFKit.PDFDocument} document — pipe it to a response, then it ends itself
 */
function buildMarriageVerdictPdf(record) {
  const verdict = record.aiVerdict || {};
  const lg = verdict.life_guidance || {};
  const wg = lg.wedding_guidance || {};
  const astro = verdict.astro_chart_view || {};
  const compat = astro.compatibility || {};
  const factors = Array.isArray(record.astroCore?.guna_factors) ? record.astroCore.guna_factors : [];
  const pa = record.formInput?.partner_a || {};
  const pb = record.formInput?.partner_b || {};
  const nameA = str(pa.full_name, str(astro.partner_a?.name, "Partner A"));
  const nameB = str(pb.full_name, str(astro.partner_b?.name, "Partner B"));

  const doc = new PDFDocument({
    size: "A4",
    // Bottom margin 0: pagination is handled by ensure() below, never by
    // PDFKit's automatic page break (which would also fight the footer).
    margins: { top: TOP, bottom: 0, left: M, right: M },
    bufferPages: true,
    info: {
      Title: `Marriage Verdict — ${nameA} & ${nameB}`,
      Author: "Astria",
      Subject: "Vedic compatibility report",
      Creator: "Astria",
    },
  });

  const FONTS = {
    Sans: "NotoSans-Regular.ttf",
    SansBold: "NotoSans-Bold.ttf",
    SansItalic: "NotoSans-Italic.ttf",
    Serif: "NotoSerif-Regular.ttf",
    SerifBold: "NotoSerif-Bold.ttf",
    Deva: "NotoSansDevanagari-Regular.ttf",
    DevaBold: "NotoSansDevanagari-Bold.ttf",
  };
  for (const [name, file] of Object.entries(FONTS)) doc.registerFont(name, path.join(FONT_DIR, file));

  // Ligatures (fi, fl, ff…) look identical but make most PDF viewers copy/search
  // "finds" as "fnds". They are switched off for Latin text; Devanagari keeps its
  // conjunct shaping untouched.
  const plain = (t, o) => (DEVANAGARI.test(String(t)) ? o : { features: { liga: false, clig: false }, ...o });
  const rawText = doc.text.bind(doc);
  const rawWidth = doc.widthOfString.bind(doc);
  const rawHeight = doc.heightOfString.bind(doc);

  // Noto Sans Devanagari has no Latin letters and Noto Sans has no Devanagari, so a
  // line like "Aarav और Ananya" must switch font per script. Text that mixes both
  // goes through this small word-wrapping layout; single-script text uses PDFKit's own.
  let styleNow = "regular";
  const isMixed = (t) => DEVANAGARI.test(t) && /[A-Za-z0-9]/.test(t);
  const isDevaChar = (ch) => /[\u0900-\u097F\u200C\u200D]/.test(ch);
  const faceFor = (deva, style) =>
    deva
      ? style === "bold" || style === "serif" ? "DevaBold" : "Deva"
      : style === "bold" ? "SansBold" : style === "italic" ? "SansItalic" : style === "serif" ? "SerifBold" : "Sans";
  const runsOf = (word) => {
    const out = [];
    for (const ch of word) {
      const deva = isDevaChar(ch);
      const last = out[out.length - 1];
      if (last && last.deva === deva) last.t += ch;
      else out.push({ t: ch, deva });
    }
    return out;
  };
  const runW = (r, size) => {
    doc.font(faceFor(r.deva, styleNow)).fontSize(size);
    return rawWidth(r.t, plain(r.t));
  };
  const mixedLayout = (text, size, width) => {
    const spaceW = runW({ t: " ", deva: false }, size);
    const tokens = text.split(" ").map((w) => {
      const runs = runsOf(w);
      return { runs, w: runs.reduce((sum, r) => sum + runW(r, size), 0) };
    });
    const lines = [];
    let cur = [];
    let curW = 0;
    for (const tk of tokens) {
      if (cur.length && width && curW + spaceW + tk.w > width) {
        lines.push({ tokens: cur, w: curW });
        cur = [];
        curW = 0;
      }
      curW += (cur.length ? spaceW : 0) + tk.w;
      cur.push(tk);
    }
    lines.push({ tokens: cur, w: curW });
    const lineH = Math.max(
      doc.font(faceFor(false, styleNow)).fontSize(size).currentLineHeight(true),
      doc.font(faceFor(true, styleNow)).fontSize(size).currentLineHeight(true),
    );
    return { lines, lineH, spaceW };
  };
  const fitOneLine = (text, size, width) => {
    let t = text;
    while (t.length > 1 && mixedLayout(t, size, 0).lines[0].w > width) t = t.slice(0, -1);
    return t === text ? text : `${t.trimEnd()}…`;
  };
  const mixedDraw = (text, x, ty, o = {}) => {
    const size = doc._fontSize;
    const oneLine = o.lineBreak === false;
    const shown = oneLine && o.ellipsis && o.width ? fitOneLine(text, size, o.width) : text;
    const { lines, lineH, spaceW } = mixedLayout(shown, size, oneLine ? 0 : o.width);
    // The two fonts have different ascenders; shift each run so both sit on one baseline.
    const ascent = (deva) => {
      doc.font(faceFor(deva, styleNow)).fontSize(size);
      return (doc._font.ascender * size) / 1000;
    };
    const topAscent = Math.max(ascent(false), ascent(true));
    let cy = ty;
    for (const line of lines) {
      let cx = x;
      if (o.width && o.align === "center") cx = x + (o.width - line.w) / 2;
      else if (o.width && o.align === "right") cx = x + o.width - line.w;
      line.tokens.forEach((tk, ti) => {
        if (ti) cx += spaceW;
        for (const r of tk.runs) {
          doc.font(faceFor(r.deva, styleNow)).fontSize(size);
          rawText(r.t, cx, cy + topAscent - (doc._font.ascender * size) / 1000, { lineBreak: false, ...plain(r.t) });
          cx += rawWidth(r.t, plain(r.t));
        }
      });
      cy += lineH + (o.lineGap || 0);
    }
    return doc;
  };
  doc.text = (t, x, ty, o = {}) => (isMixed(String(t)) ? mixedDraw(String(t), x, ty, o) : rawText(t, x, ty, plain(t, o)));
  doc.widthOfString = (t, o) =>
    isMixed(String(t)) ? mixedLayout(String(t), doc._fontSize, 0).lines[0].w : rawWidth(t, plain(t, o));
  doc.heightOfString = (t, o = {}) => {
    if (!isMixed(String(t))) return rawHeight(t, plain(t, o));
    const { lines, lineH } = mixedLayout(String(t), doc._fontSize, o.width);
    return lines.length * lineH + (lines.length - 1) * (o.lineGap || 0);
  };

  // Picks the font for a piece of text: Hindi text gets the Devanagari face.
  const face = (text, style = "regular") => {
    const deva = DEVANAGARI.test(text);
    if (style === "bold") return deva ? "DevaBold" : "SansBold";
    if (style === "italic") return deva ? "Deva" : "SansItalic";
    if (style === "serif") return deva ? "DevaBold" : "SerifBold";
    return deva ? "Deva" : "Sans";
  };
  const useFont = (text, style, size) => {
    styleNow = style || "regular";
    return doc.font(face(text, style)).fontSize(size);
  };
  const measure = (text, { style = "regular", size = 10, width, lineGap = 0, spacing = 0 }) => {
    useFont(text, style, size);
    return doc.heightOfString(text, { width, lineGap, characterSpacing: spacing });
  };
  const textWidth = (text, { style = "regular", size = 10, spacing = 0 }) => {
    useFont(text, style, size);
    return doc.widthOfString(text, { characterSpacing: spacing });
  };

  let y = TOP;
  const ensure = (h) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = TOP;
    }
  };

  // ── drawing primitives ────────────────────────────────────────────────────

  /** Score ring: full track plus a rounded arc running clockwise from 12 o'clock. */
  function ring(cx, cy, r, pct, { track, color, width }) {
    doc.save().lineWidth(width).strokeColor(track).circle(cx, cy, r).stroke();
    const p = Math.max(0, Math.min(1, pct));
    if (p >= 0.999) {
      doc.strokeColor(color).circle(cx, cy, r).stroke();
    } else if (p > 0) {
      const a0 = -Math.PI / 2;
      const a1 = a0 + Math.PI * 2 * p;
      const x1 = cx + r * Math.cos(a0);
      const y1 = cy + r * Math.sin(a0);
      const x2 = cx + r * Math.cos(a1);
      const y2 = cy + r * Math.sin(a1);
      doc.lineCap("round").strokeColor(color).path(`M ${x1} ${y1} A ${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${x2} ${y2}`).stroke();
    }
    doc.restore();
  }

  /** Pill with text; returns its width. Pass draw=false to only measure. */
  function chip(text, x, cy, { bg, fg, border, size = 8.5, padX = 10, h = 20, draw = true }) {
    const w = textWidth(text, { style: "bold", size }) + padX * 2;
    if (draw) {
      doc.save().roundedRect(x, cy, w, h, h / 2);
      if (border) doc.fillAndStroke(bg, border);
      else doc.fill(bg);
      doc.restore();
      useFont(text, "bold", size).fillColor(fg).text(text, x + padX, cy + (h - size) / 2 - 0.5, { lineBreak: false });
    }
    return w;
  }

  /** Lays chips out left-to-right, wrapping; returns total height. */
  function chipFlow(items, x, top, maxW, style, draw = true) {
    let cx = x;
    let cy = top;
    const h = 20;
    for (const item of items) {
      const w = chip(item.text, 0, 0, { ...style, draw: false });
      const full = w + (item.swatch ? 16 : 0);
      if (cx > x && cx + full > x + maxW) {
        cx = x;
        cy += h + 6;
      }
      if (draw) {
        if (item.swatch) {
          doc.save().roundedRect(cx, cy, full, h, h / 2).fillAndStroke(style.bg, style.border);
          doc.circle(cx + 12, cy + h / 2, 4.5).fillAndStroke(item.swatch, "#D6CCE4");
          useFont(item.text, "bold", 8.5).fillColor(style.fg).text(item.text, cx + 21, cy + 5.5, { lineBreak: false });
          doc.restore();
        } else {
          chip(item.text, cx, cy, style);
        }
      }
      cx += full + 6;
    }
    return items.length ? cy - top + h : 0;
  }

  const cardBox = (h, fill = C.panel) => {
    doc.save().roundedRect(M, y, CW, h, 10).fillAndStroke(fill, C.border).restore();
  };

  const smallLabel = (text, x, ty, color, width) => {
    useFont(text, "bold", 8).fillColor(color).text(text.toUpperCase(), x, ty, { characterSpacing: 1.3, width, lineBreak: false });
  };

  /**
   * `need` is how much room the first block under the heading requires: a heading
   * is never left alone at the bottom of a page (it moves with its content).
   */
  function sectionHeading(title, need = 112) {
    ensure(24 + need);
    const label = title.toUpperCase();
    doc.circle(M + 3.5, y + 6, 3).fill(C.accent);
    useFont(label, "bold", 10).fillColor(C.accent).text(label, M + 14, y + 1, { characterSpacing: 1.8, lineBreak: false });
    const tw = textWidth(label, { style: "bold", size: 10, spacing: 1.8 });
    doc.save().moveTo(M + 24 + tw, y + 6).lineTo(M + CW, y + 6).lineWidth(0.7).strokeColor(C.border).stroke().restore();
    y += 24;
  }

  const newPage = () => {
    doc.addPage();
    y = TOP;
  };

  // ── content blocks ────────────────────────────────────────────────────────

  /**
   * A card made of rows (bullets, score bars…). When it does not fit on the page
   * it is split between rows and continues on the next page in a new card, so
   * pages stay full instead of leaving a gap. A single stray row is never left
   * alone on either side of the split.
   */
  function rowsCard(title, accent, rows, gap) {
    if (!rows.length) return;
    const pad = 14;
    const headH = pad + 23;
    let i = 0;
    let first = true;
    while (i < rows.length) {
      const avail = BOTTOM - y - headH - pad;
      let take = 0;
      let used = 0;
      while (i + take < rows.length) {
        const next = rows[i + take].h + (take ? gap : 0);
        if (used + next > avail) break;
        used += next;
        take++;
      }
      let left = rows.length - i - take;
      if (left === 1 && take > 2) {
        used -= rows[i + take - 1].h + gap;
        take--;
        left++;
      }
      if ((take === 0 || (take < 3 && left > 0)) && y > TOP + 1) {
        newPage();
        continue;
      }
      if (take === 0) {
        take = 1;
        used = rows[i].h;
      }
      const h = headH + used + pad;
      cardBox(h);
      smallLabel(first ? title : `${title} (continued)`, M + pad, y + pad, accent, CW - pad * 2);
      let ty = y + headH;
      for (let r = i; r < i + take; r++) {
        rows[r].draw(M + pad, ty);
        ty += rows[r].h + gap;
      }
      y += h + 10;
      i += take;
      first = false;
      if (i < rows.length) newPage();
    }
  }

  function bulletCard(title, items, accent = C.accent) {
    const indent = 16;
    const inner = CW - 32 - indent;
    rowsCard(
      title,
      accent,
      items.map((t) => ({
        h: measure(t, { size: 10.2, width: inner, lineGap: 3 }),
        draw: (x, ty) => {
          doc.circle(x + 4, ty + 5.4, 2.6).fill(accent);
          useFont(t, "regular", 10.2).fillColor(C.ink).text(t, x + indent, ty, { width: inner, lineGap: 3 });
        },
      })),
      7,
    );
  }

  /** A paragraph card; a long paragraph flows onto the next page (no orphan/widow lines). */
  function textCard(title, text, accent = C.accent) {
    let rest = str(text);
    if (!rest) return;
    const pad = 14;
    const inner = CW - pad * 2;
    const opts = { size: 10.5, width: inner, lineGap: 3.4 };
    const bodyTop = pad + 21;
    const lineH = measure("Ag", opts);
    let first = true;
    while (rest) {
      const avail = BOTTOM - y - bodyTop - pad;
      let chunk = rest;
      let remainder = "";
      if (measure(rest, opts) > avail) {
        const words = rest.split(/\s+/);
        let lo = 0;
        let hi = words.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (measure(words.slice(0, mid).join(" "), opts) <= avail) lo = mid;
          else hi = mid - 1;
        }
        let n = lo;
        while (n > 0 && measure(words.slice(n).join(" "), opts) < lineH * 3 - 1) n--;
        if (n === 0 || measure(words.slice(0, n).join(" "), opts) < lineH * 5 - 1) {
          if (y > TOP + 1) {
            newPage();
            continue;
          }
          n = Math.max(lo, 1);
        }
        chunk = words.slice(0, n).join(" ");
        remainder = words.slice(n).join(" ");
      }
      const h = bodyTop + measure(chunk, opts) + pad;
      cardBox(h);
      smallLabel(first ? title : `${title} (continued)`, M + pad, y + pad, accent, inner);
      useFont(chunk, "regular", 10.5).fillColor(C.ink).text(chunk, M + pad, y + bodyTop, { width: inner, lineGap: 3.4 });
      y += h + 10;
      rest = remainder;
      first = false;
      if (rest) newPage();
    }
  }

  function colorsBlock(lucky, avoid) {
    if (!lucky.length && !avoid.length) return;
    const pad = 14;
    const inner = CW - pad * 2;
    const luckyItems = lucky.map((t) => ({ text: t, swatch: colorHex(t) }));
    const avoidItems = avoid.map((t) => ({ text: t, swatch: colorHex(t) }));
    const style = { bg: C.white, fg: C.ink, border: C.border };
    const lh = luckyItems.length ? chipFlow(luckyItems, 0, 0, inner, style, false) : 0;
    const ah = avoidItems.length ? chipFlow(avoidItems, 0, 0, inner, style, false) : 0;
    const h = pad + (lh ? 14 + lh + 12 : 0) + (ah ? 14 + ah + 4 : 0) + pad - (lh && !ah ? 12 : 0);
    ensure(h);
    cardBox(h);
    let ty = y + pad;
    if (lh) {
      smallLabel("Lucky colors", M + pad, ty, C.green, inner);
      chipFlow(luckyItems, M + pad, ty + 15, inner, style);
      ty += 14 + lh + 12;
    }
    if (ah) {
      smallLabel("Colors to avoid", M + pad, ty, C.muted, inner);
      chipFlow(avoidItems, M + pad, ty + 15, inner, style);
    }
    y += h + 10;
  }

  function vastuBlock(note, direction) {
    const dir = str(direction);
    if (!dir && !str(note)) return;
    const pad = 14;
    const inner = CW - pad * 2;
    const noteH = str(note) ? measure(str(note), { style: "italic", size: 9.5, width: inner, lineGap: 2.5 }) + 8 : 0;
    const dirH = dir ? measure(dir, { size: 10.5, width: inner - 14, lineGap: 3.2 }) : 0;
    const h = pad + noteH + (dir ? 12 + 9 + dirH : 0) + pad;
    ensure(h);
    cardBox(h, "#FBF6EA");
    doc.save().roundedRect(M, y, CW, h, 10).lineWidth(0.8).strokeColor("#E8D9AE").stroke().restore();
    let ty = y + pad;
    if (str(note)) {
      useFont(note, "italic", 9.5).fillColor(C.muted).text(str(note), M + pad, ty, { width: inner, lineGap: 2.5 });
      ty += noteH;
    }
    if (dir) {
      smallLabel("Vastu-aligned direction", M + pad, ty, C.amber, inner);
      useFont(dir, "regular", 10.5).fillColor(C.ink).text(dir, M + pad, ty + 21 - 9 + 9, { width: inner, lineGap: 3.2 });
    }
    y += h + 10;
  }

  function partnerRows(p) {
    if (p.is_limited) {
      return {
        note:
          p.place_provided && !p.place_resolved
            ? "We couldn't precisely locate this birth place — a nearby major city gives a fuller chart."
            : "Add birth time and place for the full chart.",
      };
    }
    const nak = [str(p.nakshatra, "—")];
    if (p.nakshatra_pada) nak.push(`Pada ${p.nakshatra_pada}`);
    return {
      rows: [
        ["Lagna", str(p.lagna, "—")],
        ["Moon sign", str(p.moon_sign, "—")],
        ["Nakshatra", nak.join(" · ")],
        ["Nakshatra lord", str(p.nakshatra_lord, "—")],
        ["Mahadasha", str(p.dasha, "—")],
        ["Antardasha", str(p.sub_dasha, "—")],
      ],
    };
  }

  const CHART_ROW_H = 21;

  function prepareChart() {
    const gap = 12;
    const colW = (CW - gap) / 2;
    const people = [astro.partner_a || {}, astro.partner_b || {}].map((p, i) => ({
      name: str(p.name, i ? nameB : nameA),
      ...partnerRows(p),
    }));
    const noteH = Math.max(...people.map((p) => (p.note ? measure(p.note, { size: 9.5, width: colW - 28, lineGap: 2.5 }) : 0)));
    const bodyH = Math.max(noteH, ...people.map((p) => (p.rows ? p.rows.length * CHART_ROW_H : 0)));
    return { people, gap, colW, h: 16 + 18 + 10 + bodyH + 12 };
  }

  function drawChart({ people, gap, colW, h }) {
    ensure(h);
    people.forEach((p, i) => {
      const x = M + i * (colW + gap);
      doc.save().roundedRect(x, y, colW, h, 10).fillAndStroke(C.panel, C.border).restore();
      doc.save().circle(x + 24, y + 26, 11).fill(i ? C.gold : C.accent).restore();
      const initial = (p.name[0] || "?").toUpperCase();
      useFont(initial, "bold", 11).fillColor(C.white).text(initial, x + 13, y + 20.5, { width: 22, align: "center", lineBreak: false });
      useFont(p.name, "bold", 10.5).fillColor(C.ink).text(p.name, x + 42, y + 20, { width: colW - 54, lineBreak: false, ellipsis: true });
      let ty = y + 50;
      if (p.rows) {
        p.rows.forEach(([k, v], r) => {
          if (r) doc.save().moveTo(x + 14, ty - 4).lineTo(x + colW - 14, ty - 4).lineWidth(0.5).strokeColor(C.border).stroke().restore();
          useFont(k, "regular", 9).fillColor(C.muted).text(k, x + 14, ty, { width: 84, lineBreak: false });
          useFont(v, "bold", 9.5).fillColor(C.ink).text(v, x + 100, ty - 0.5, { width: colW - 114, lineBreak: false, ellipsis: true });
          ty += CHART_ROW_H;
        });
      } else {
        useFont(p.note, "italic", 9.5).fillColor(C.muted).text(p.note, x + 14, ty, { width: colW - 28, lineGap: 2.5 });
      }
    });
    y += h + 10;
  }

  function compatibilityBlock() {
    const score = Number(compat.guna_score) || 0;
    const max = Number(compat.guna_score_max) || 36;
    const dosha = list(compat.dosha);
    const pad = 14;
    const inner = CW - pad * 2;
    const doshaItems = (dosha.length ? dosha : ["None"]).map((t) => ({ text: t }));
    const doshaStyle = dosha.length
      ? { bg: "#FDECEF", fg: C.rose, border: "#F5C6D0" }
      : { bg: "#E6F6EF", fg: C.green, border: "#BFE5D3" };
    const dh = chipFlow(doshaItems, 0, 0, inner, doshaStyle, false);
    const h = pad + 86 + 16 + 14 + dh + pad;
    ensure(h);
    cardBox(h);

    // three stat tiles
    const gap = 10;
    const tileW = (inner - gap * 2) / 3;
    const tiles = [
      { label: "Guna Milan", big: `${score}`, sub: `out of ${max}`, ringPct: score / max },
      { label: "Manglik status", big: str(compat.manglik_status, "—"), sub: "combined view" },
      { label: "Rashi relationship", big: str(compat.rashi_relationship, "—"), sub: "moon signs", small: true },
    ];
    tiles.forEach((t, i) => {
      const x = M + pad + i * (tileW + gap);
      doc.save().roundedRect(x, y + pad, tileW, 86, 8).fillAndStroke(C.white, C.border).restore();
      if (t.ringPct != null) {
        ring(x + 31, y + pad + 43, 21, t.ringPct, { track: "#EADFF7", color: C.accent, width: 5 });
        useFont(t.big, "bold", 13).fillColor(C.ink).text(t.big, x + 10, y + pad + 36.5, { width: 42, align: "center", lineBreak: false });
        smallLabel(t.label, x + 62, y + pad + 22, C.muted, tileW - 66);
        useFont(t.sub, "regular", 9).fillColor(C.faint).text(t.sub, x + 62, y + pad + 40, { width: tileW - 66, lineBreak: false });
        const lab = str(compat.guna_label);
        if (lab) useFont(lab, "bold", 9.5).fillColor(C.accent).text(lab, x + 62, y + pad + 56, { width: tileW - 66, lineBreak: false });
      } else {
        smallLabel(t.label, x + 10, y + pad + 12, C.muted, tileW - 20);
        useFont(t.big, "bold", t.small ? 10.5 : 17).fillColor(C.accent).text(t.big, x + 10, y + pad + (t.small ? 31 : 30), { width: tileW - 20, height: t.small ? 30 : 24, lineGap: 1, ellipsis: true });
        useFont(t.sub, "regular", 9).fillColor(C.faint).text(t.sub, x + 10, y + pad + 66, { width: tileW - 20, lineBreak: false });
      }
    });
    smallLabel("Dosha", M + pad, y + pad + 86 + 16, C.muted, inner);
    chipFlow(doshaItems, M + pad, y + pad + 86 + 32, inner, doshaStyle);
    y += h + 10;
  }

  function ashtakootBlock() {
    if (!factors.length) return;
    const inner = CW - 32;
    const labelW = 86;
    const scoreW = 44;
    const barW = inner - labelW - scoreW - 8;
    rowsCard(
      "Ashtakoot breakdown",
      C.accent,
      factors.map((f) => ({
        h: 14,
        draw: (x, ty) => {
          const pts = Number(f.points) || 0;
          const mx = Number(f.max) || 1;
          const pct = Math.max(0, Math.min(1, pts / mx));
          const color = pct >= 0.75 ? C.green : pct >= 0.4 ? C.accent : C.rose;
          useFont(f.label, "bold", 9.5).fillColor(C.ink).text(str(f.label), x, ty, { width: labelW - 6, lineBreak: false });
          doc.save().roundedRect(x + labelW, ty + 3, barW, 7, 3.5).fill("#EADFF7").restore();
          if (pct > 0) doc.save().roundedRect(x + labelW, ty + 3, Math.max(7, barW * pct), 7, 3.5).fill(color).restore();
          const label = `${Number.isInteger(pts) ? pts : pts.toFixed(1)}/${mx}`;
          useFont(label, "bold", 9.5).fillColor(C.muted).text(label, x + labelW + barW + 8, ty, { width: scoreW, align: "right", lineBreak: false });
        },
      })),
      12,
    );
  }

  // ── COVER ─────────────────────────────────────────────────────────────────

  const coverH = 384;
  const grad = doc.linearGradient(0, 0, 0, coverH);
  grad.stop(0, C.coverTop).stop(1, C.coverBottom);
  doc.rect(0, 0, PAGE.w, coverH).fill(grad);

  // soft star-field and a gold hairline: quiet decoration, drawn behind text
  doc.save();
  [
    [70, 60, 1.6], [150, 112, 1.1], [238, 44, 1.3], [352, 92, 1.8], [470, 52, 1.2], [532, 118, 1.5],
    [92, 188, 1.2], [510, 214, 1.6], [58, 286, 1.4], [540, 322, 1.1], [300, 30, 1.0], [418, 160, 1.0],
  ].forEach(([sx, sy, sr]) => {
    doc.fillOpacity(0.55).circle(sx, sy, sr).fill(C.lilac);
  });
  doc.restore();
  doc.save().moveTo(M, coverH - 1).lineTo(PAGE.w - M, coverH - 1).lineWidth(0.8).strokeColor(C.gold).opacity(0.6).stroke().restore();

  // brand
  useFont("ASTRIA", "bold", 11).fillColor(C.lilac).text("ASTRIA", 0, 40, { width: PAGE.w, align: "center", characterSpacing: 5, lineBreak: false });
  useFont("Marriage Verdict", "serif", 31).fillColor(C.coverText).text("Marriage Verdict", 0, 62, { width: PAGE.w, align: "center", lineBreak: false });
  useFont("Vedic Compatibility Report", "regular", 10.5).fillColor(C.coverMuted).text("VEDIC COMPATIBILITY REPORT", 0, 106, { width: PAGE.w, align: "center", characterSpacing: 2.4, lineBreak: false });

  // couple: avatar — interlocked rings — avatar
  const midX = PAGE.w / 2;
  const coupleY = 168;
  const avatar = (cx, name, fill) => {
    doc.save().circle(cx, coupleY, 26).fill(fill).restore();
    doc.save().circle(cx, coupleY, 29.5).lineWidth(0.8).strokeColor(C.gold).opacity(0.7).stroke().restore();
    const ini = (name[0] || "?").toUpperCase();
    useFont(ini, "bold", 19).fillColor(C.white).text(ini, cx - 26, coupleY - 12, { width: 52, align: "center", lineBreak: false });
  };
  avatar(midX - 130, nameA, "#7A4BC4");
  avatar(midX + 130, nameB, "#B8893A");
  doc.save().lineWidth(1.6).strokeColor(C.gold).circle(midX - 9, coupleY, 12).stroke().circle(midX + 9, coupleY, 12).stroke().restore();

  const details = (p) => [str(p.date_of_birth), str(p.time_of_birth), str(p.place_of_birth)].filter(Boolean);
  const person = (cx, name, p) => {
    useFont(name, "bold", 12.5).fillColor(C.coverText).text(name, cx - 90, coupleY + 40, { width: 180, align: "center", lineBreak: false, ellipsis: true });
    details(p).forEach((line, i) => {
      useFont(line, "regular", 8.8).fillColor(C.coverMuted).text(line, cx - 95, coupleY + 59 + i * 12.5, { width: 190, align: "center", lineBreak: false, ellipsis: true });
    });
  };
  person(midX - 130, nameA, pa);
  person(midX + 130, nameB, pb);

  // Cosmic Match ring
  const ringY = 280;
  const pct = Number(compat.guna_score_percent) || 0;
  ring(midX, ringY, 38, pct / 100, { track: "#3A2A52", color: C.lilac, width: 7 });
  useFont(`${pct}%`, "bold", 21).fillColor(C.coverText).text(`${pct}%`, midX - 38, ringY - 12, { width: 76, align: "center", lineBreak: false });
  useFont("COSMIC MATCH", "bold", 7.5).fillColor(C.coverMuted).text("COSMIC MATCH", midX - 60, ringY + 47, { width: 120, align: "center", characterSpacing: 1.8, lineBreak: false });

  // badges, centred under the ring
  const badges = [
    `Guna Milan: ${str(compat.guna_label, "—")}`,
    `${Number(compat.guna_score) || 0}/${Number(compat.guna_score_max) || 36}`,
    `Manglik: ${str(compat.manglik_status, "—")}`,
  ];
  const badgeStyle = { bg: "#35224E", fg: "#E4D3FA", border: "#5A4080", size: 8.5, h: 20 };
  const widths = badges.map((b) => chip(b, 0, 0, { ...badgeStyle, draw: false }));
  const totalW = widths.reduce((s, w) => s + w, 0) + 8 * (badges.length - 1);
  let bx = midX - totalW / 2;
  badges.forEach((b, i) => {
    chip(b, bx, coverH - 40, badgeStyle);
    bx += widths[i] + 8;
  });

  y = coverH + 26;

  // ── BODY ──────────────────────────────────────────────────────────────────

  if (astro.is_limited) {
    const msg = "For a full astrological analysis, please add birth time and place for both partners.";
    const h = measure(msg, { style: "italic", size: 9.5, width: CW - 32 }) + 22;
    cardBox(h, "#FFF4E6");
    doc.save().roundedRect(M, y, CW, h, 10).lineWidth(0.8).strokeColor("#F5D2A3").stroke().restore();
    useFont(msg, "italic", 9.5).fillColor(C.amber).text(msg, M + 16, y + 11, { width: CW - 32 });
    y += h + 16;
  }

  const summary = list(astro.summary_points);
  if (summary.length) {
    sectionHeading("At a glance");
    bulletCard("Three-point summary", summary, C.accent);
  }

  sectionHeading("Life guidance");
  textCard("Healing", lg.healing);
  textCard("Growth path", lg.growth_path);
  textCard("Family & cultural harmony", lg.family_cultural_harmony);

  sectionHeading("Wedding guidance");
  vastuBlock(wg.note, wg.vastu_direction);
  colorsBlock(list(wg.lucky_colors), list(wg.colors_to_avoid));
  bulletCard("Recommended gifts", list(wg.recommended_gifts), C.green);
  bulletCard("Checklist highlights", list(wg.checklist_highlights), C.accent);

  const chart = prepareChart();
  sectionHeading("Astrological chart view", chart.h);
  drawChart(chart);
  compatibilityBlock();
  textCard("Dasha summary", astro.dasha_summary);
  bulletCard("Planetary highlights", list(astro.planetary_highlights), C.accent);
  bulletCard("House influences", list(astro.house_influences), C.accent);
  ashtakootBlock();

  // closing note
  const note =
    "This report is offered for reflection and guidance. It describes patterns and tendencies from the birth details you provided — it is not a prediction, and it is not a substitute for advice from the people and professionals you trust.";
  const noteH = measure(note, { style: "italic", size: 9, width: CW - 40, lineGap: 2.5 });
  ensure(noteH + 30);
  doc.save().moveTo(M + CW / 2 - 24, y + 4).lineTo(M + CW / 2 + 24, y + 4).lineWidth(0.8).strokeColor(C.gold).stroke().restore();
  useFont(note, "italic", 9).fillColor(C.muted).text(note, M + 20, y + 16, { width: CW - 40, align: "center", lineGap: 2.5 });
  y += noteH + 30;

  // ── FOOTERS (needs every page to exist, so it runs last) ─────────────────

  const generated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (i > range.start) {
      useFont("MARRIAGE VERDICT", "bold", 7.5).fillColor(C.faint).text("MARRIAGE VERDICT", M, 28, { characterSpacing: 1.6, lineBreak: false });
      const who = `${nameA} & ${nameB}`;
      useFont(who, "regular", 8).fillColor(C.faint).text(who, M, 27.5, { width: CW, align: "right", lineBreak: false, ellipsis: true });
      doc.save().moveTo(M, 42).lineTo(PAGE.w - M, 42).lineWidth(0.6).strokeColor(C.border).stroke().restore();
    }
    const fy = PAGE.h - 38;
    doc.save().moveTo(M, fy - 8).lineTo(PAGE.w - M, fy - 8).lineWidth(0.6).strokeColor(C.border).stroke().restore();
    useFont("ASTRIA", "bold", 8).fillColor(C.accent).text("ASTRIA", M, fy, { characterSpacing: 2, lineBreak: false });
    useFont("Astria aligns your path, not dictates it.", "italic", 8).fillColor(C.faint).text("Astria aligns your path, not dictates it.", M, fy, { width: CW, align: "center", lineBreak: false });
    const right = `${generated}  ·  Page ${i + 1} of ${range.count}`;
    useFont(right, "regular", 8).fillColor(C.faint).text(right, M, fy, { width: CW, align: "right", lineBreak: false });
  }

  doc.end();
  return doc;
}

module.exports = { buildMarriageVerdictPdf };
