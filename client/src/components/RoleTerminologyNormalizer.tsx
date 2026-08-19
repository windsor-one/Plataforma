import { useEffect } from "react";
import { normalizeRoleTerminology } from "@/lib/roleTerminology";

function normalizeNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const next = normalizeRoleTerminology(node.textContent || "");
    if (next !== node.textContent) node.textContent = next;
    return;
  }
  node.childNodes.forEach(normalizeNode);
}

/** Mantiene legibles los textos históricos mientras la interfaz se actualiza progresivamente. */
export function RoleTerminologyNormalizer() {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    normalizeNode(root);
    const observer = new MutationObserver((entries) => entries.forEach((entry) => entry.addedNodes.forEach(normalizeNode)));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
