import type { QAEntry } from "../types/api";

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }

  // Fallback for non-secure contexts
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (_) {
    return false;
  }
}

export function formatQANoteAsMarkdown(entry: QAEntry): string {
  const lines: string[] = [
    `# DocuMind AI — Note`,
    `**Scope**: ${entry.scopeLabel}`,
    `**Time**: ${entry.timestamp}`,
    ``,
    `### Question`,
    entry.question,
    ``,
    `### Answer`,
    entry.answer || "No answer generated.",
    ``,
  ];

  if (entry.sources && entry.sources.length > 0) {
    lines.push(`### Sources & Citations`);
    entry.sources.forEach((s, idx) => {
      const scoreStr = typeof s.score === "number" ? ` (Score: ${s.score.toFixed(4)})` : "";
      lines.push(`${idx + 1}. **[${s.filename}, ${s.page_citation}]**${scoreStr}`);
      lines.push(`   > "${s.text.replace(/\n+/g, " ").trim()}"`);
      lines.push(``);
    });
  }

  return lines.join("\n");
}

export async function copyCitationSnippet(
  filename: string,
  pageCitation: string,
  text?: string
): Promise<boolean> {
  const content = text
    ? `[${filename}, ${pageCitation}]\n"${text.trim()}"`
    : `[${filename}, ${pageCitation}]`;
  return copyTextToClipboard(content);
}

