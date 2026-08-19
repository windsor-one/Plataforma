import type { jsPDF } from "jspdf";

export const pdfPalette = {
  navy: [10, 35, 48] as [number, number, number],
  teal: [15, 143, 115] as [number, number, number],
  blue: [22, 118, 243] as [number, number, number],
  ink: [35, 47, 58] as [number, number, number],
  muted: [104, 116, 126] as [number, number, number],
  line: [220, 226, 230] as [number, number, number],
  pale: [243, 247, 248] as [number, number, number],
};

export function addDocumentHeader(document: jsPDF, title: string, metadata: string[], accent: [number, number, number] = pdfPalette.teal) {
  const width = document.internal.pageSize.getWidth();
  document.setFillColor(...pdfPalette.navy); document.rect(0, 0, width, 29, "F");
  document.setFillColor(...accent); document.rect(0, 27, width, 2, "F");
  document.setTextColor(255, 255, 255); document.setFont("helvetica", "bold"); document.setFontSize(16); document.text("SIGES", 16, 13);
  document.setFont("helvetica", "normal"); document.setFontSize(7.5); document.text("Sistema Integral de Gestión Estratégica", 16, 20);
  document.setTextColor(...pdfPalette.ink); document.setFont("helvetica", "bold"); document.setFontSize(18); document.text(title, 16, 42);
  document.setFont("helvetica", "normal"); document.setFontSize(8.5); metadata.forEach((line, index) => document.text(line, 16, 49 + index * 4.5));
  return 58 + Math.max(0, metadata.length - 1) * 4.5;
}

export function addSectionHeading(document: jsPDF, title: string, y: number, accent: [number, number, number] = pdfPalette.teal) {
  const width = document.internal.pageSize.getWidth() - 32;
  document.setFillColor(...pdfPalette.pale); document.roundedRect(16, y, width, 9, 2, 2, "F");
  document.setFillColor(...accent); document.roundedRect(16, y, 3, 9, 1.5, 1.5, "F");
  document.setTextColor(...pdfPalette.ink); document.setFont("helvetica", "bold"); document.setFontSize(10); document.text(title, 25, y + 6);
  return y + 15;
}

export function addKeyValueGrid(document: jsPDF, rows: Array<[string, string]>, y: number, columns = 2) {
  const gap = 4; const width = (document.internal.pageSize.getWidth() - 32 - gap * (columns - 1)) / columns; const height = 18;
  rows.forEach(([label, value], index) => { const column = index % columns; const row = Math.floor(index / columns); const x = 16 + column * (width + gap); const top = y + row * (height + gap); document.setFillColor(248, 250, 251); document.setDrawColor(...pdfPalette.line); document.roundedRect(x, top, width, height, 2, 2, "FD"); document.setTextColor(...pdfPalette.muted); document.setFont("helvetica", "normal"); document.setFontSize(7.5); document.text(label, x + 4, top + 6); document.setTextColor(...pdfPalette.ink); document.setFont("helvetica", "bold"); document.setFontSize(10); const wrapped = document.splitTextToSize(value, width - 8) as string[]; document.text(wrapped.slice(0, 2), x + 4, top + 13); });
  return y + Math.ceil(rows.length / columns) * (height + gap);
}

export function addTable(document: jsPDF, headers: string[], rows: string[][], y: number, widths?: number[]) {
  const totalWidth = document.internal.pageSize.getWidth() - 32; const columnWidths = widths || headers.map(() => totalWidth / headers.length); const lineHeight = 5.5; let cursor = y;
  const drawHeader = () => { document.setFillColor(...pdfPalette.navy); document.rect(16, cursor, totalWidth, 9, "F"); document.setTextColor(255, 255, 255); document.setFont("helvetica", "bold"); document.setFontSize(7.5); let x = 19; headers.forEach((header, index) => { document.text(header, x, cursor + 6); x += columnWidths[index]; }); cursor += 9; };
  drawHeader();
  rows.forEach((row, rowIndex) => { const safeRow = headers.map((_, index) => row[index] === undefined || row[index] === "" ? "—" : String(row[index])); const wrapped = safeRow.map((value, index) => document.splitTextToSize(value, Math.max(8, columnWidths[index] - 6)) as string[]); const height = Math.max(8, ...wrapped.map(lines => Math.min(3, lines.length) * lineHeight + 3)); if (cursor + height > 280) { document.addPage(); cursor = 18; drawHeader(); } document.setFillColor(rowIndex % 2 ? 250 : 255, rowIndex % 2 ? 252 : 255, rowIndex % 2 ? 253 : 255); document.setDrawColor(...pdfPalette.line); document.rect(16, cursor, totalWidth, height, "FD"); document.setTextColor(...pdfPalette.ink); document.setFont("helvetica", "normal"); document.setFontSize(7.5); let x = 19; safeRow.forEach((_, index) => { document.text(wrapped[index].slice(0, 3), x, cursor + 5.5); x += columnWidths[index]; }); cursor += height; });
  return cursor;
}
