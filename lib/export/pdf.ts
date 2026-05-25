// Rendu PDF du livrable (F6) via jsPDF. Police standard Helvetica (encodage
// WinAnsi/CP1252) : couvre toute la typographie française (é è à ç, ’ « » —, €).
// Sources rendues en liens cliquables (textWithLink). Pagination automatique.

import { jsPDF } from "jspdf";
import type { Deliverable } from "./model";

const MARGIN = 48;
const PAGE_W = 595.28; // A4 en points
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number): number {
  const parts: string[] = doc.splitTextToSize(text, width);
  let cursor = y;
  for (const part of parts) {
    cursor = ensureSpace(doc, cursor, lineHeight);
    doc.text(part, x, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

function writeRow(doc: jsPDF, left: string, right: string, y: number): number {
  const lineHeight = 14;
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
      doc.textWithLink(`• ${src.label} — vérifié le ${src.checkedAt}`, MARGIN, y, { url: src.url });
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
