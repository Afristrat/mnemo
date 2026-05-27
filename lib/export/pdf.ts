// Rendu PDF du livrable (F6) via jsPDF. Police standard Helvetica (encodage
// WinAnsi/CP1252) : couvre toute la typographie française (é è à ç, ’ « » —, €).
// Sources rendues en liens cliquables (textWithLink). Pagination automatique.

import { jsPDF } from "jspdf";
import type { Deliverable } from "./model";

const MARGIN = 48;
const PAGE_W = 595.28; // A4 en points
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Sous-ensemble Unicode des 27 caractères « hauts » de WinAnsi/CP1252 (plage
// 0x80–0x9F : € ‚ ƒ „ … † ‡ ˆ ‰ Š ‹ Œ Ž ‘ ’ “ ” • – — ˜ ™ š › œ ž Ÿ).
const CP1252_HIGH: ReadonlySet<number> = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/**
 * Réduit un texte à ce que la police standard de jsPDF (WinAnsi/CP1252) sait
 * rendre : ASCII imprimable, Latin-1 (0xA0–0xFF, dont é è à ç ç… et l'espace
 * insécable) et les 27 caractères spéciaux CP1252 (€ « » — ’ …). Les émojis et
 * autres glyphes hors plage — qui sortiraient sinon en « Ø=ÜÄ » (surrogate UTF-16
 * réémis en CP1252) — sont retirés, et les espaces ainsi libérés sont compactés.
 * La typographie française reste intacte ; le Markdown (UTF-8) garde ses émojis.
 */
export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const renderable =
      cp === 0x09 || // tabulation
      (cp >= 0x20 && cp <= 0x7e) || // ASCII imprimable
      (cp >= 0xa0 && cp <= 0xff) || // Latin-1 (typo FR + espace insécable)
      CP1252_HIGH.has(cp); // spéciaux CP1252 (€ « » — ’ …)
    if (renderable) out += ch;
  }
  return out.replace(/ {2,}/g, " ").trim();
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number): number {
  const parts: string[] = doc.splitTextToSize(toWinAnsi(text), width);
  let cursor = y;
  for (const part of parts) {
    cursor = ensureSpace(doc, cursor, lineHeight);
    doc.text(part, x, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

function writeRow(doc: jsPDF, leftRaw: string, rightRaw: string, y: number): number {
  const lineHeight = 14;
  const left = toWinAnsi(leftRaw);
  const right = toWinAnsi(rightRaw);
  const rightWidth = doc.getTextWidth(right);
  const leftWidth = CONTENT_W - rightWidth - 14;
  const parts: string[] = doc.splitTextToSize(left, leftWidth > 80 ? leftWidth : CONTENT_W);
  let cursor = ensureSpace(doc, y, lineHeight);
  doc.text(parts[0] ?? left, MARGIN, cursor);
  doc.text(right, PAGE_W - MARGIN, cursor, { align: "right" });
  for (let i = 1; i < parts.length; i += 1) {
    cursor += lineHeight;
    cursor = ensureSpace(doc, cursor, lineHeight);
    doc.text(parts[i] ?? "", MARGIN, cursor);
  }
  return cursor + lineHeight;
}

function writeBullet(doc: jsPDF, text: string, y: number): number {
  return writeWrapped(doc, `• ${text}`, MARGIN, y, CONTENT_W, 14);
}

/** Construit le document PDF du livrable. */
export function renderPdf(d: Deliverable): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  y = writeWrapped(doc, d.title, MARGIN, y, CONTENT_W, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  y = writeWrapped(doc, d.subtitle, MARGIN, y + 4, CONTENT_W, 15);
  y = writeWrapped(doc, `Généré le ${d.generatedAt}`, MARGIN, y + 2, CONTENT_W, 15);
  doc.setTextColor(0);
  y += 10;

  doc.setFontSize(10.5);
  for (const m of d.meta) y = writeRow(doc, m.left, m.right, y);
  y += 8;

  for (const section of d.sections) {
    y = ensureSpace(doc, y, 44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    y = writeWrapped(doc, section.heading, MARGIN, y + 6, CONTENT_W, 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    for (const row of section.rows) y = writeRow(doc, row.left, row.right, y);
    for (const bullet of section.bullets) y = writeBullet(doc, bullet, y);
    y += 6;
  }

  if (d.sources.length > 0) {
    y = ensureSpace(doc, y, 44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    y = writeWrapped(doc, "Sources", MARGIN, y + 6, CONTENT_W, 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    for (const src of d.sources) {
      y = ensureSpace(doc, y, 15);
      doc.setTextColor(20, 80, 160);
      doc.textWithLink(toWinAnsi(`• ${src.label}, vérifié le ${src.checkedAt}`), MARGIN, y, { url: src.url });
      doc.setTextColor(0);
      y += 15;
    }
  }

  y = ensureSpace(doc, y, 50);
  y += 8;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  writeWrapped(doc, d.disclaimer, MARGIN, y, CONTENT_W, 13);
  doc.setTextColor(0);

  return doc;
}

/** Sérialise le PDF en Blob (pour téléchargement navigateur). */
export function pdfBlob(d: Deliverable): Blob {
  return renderPdf(d).output("blob");
}
