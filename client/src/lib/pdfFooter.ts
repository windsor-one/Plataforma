import type { jsPDF } from "jspdf";

export const downloadFooterText = (downloadedAt = new Date()) => `Obtenido del Sistema SIGES — ${new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "medium" }).format(downloadedAt)}`;

export function addDownloadFooter(document: jsPDF, downloadedAt = new Date()) {
  const totalPages = document.getNumberOfPages();
  const footer = downloadFooterText(downloadedAt);
  for (let page = 1; page <= totalPages; page += 1) {
    document.setPage(page);
    const height = document.internal.pageSize.getHeight();
    const width = document.internal.pageSize.getWidth();
    document.setFont("helvetica", "normal");
    document.setFontSize(7.5);
    document.setTextColor(105, 105, 105);
    document.text(footer, width / 2, height - 8, { align: "center" });
  }
  document.setTextColor(0, 0, 0);
}
