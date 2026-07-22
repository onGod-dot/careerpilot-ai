/**
 * Strip markdown formatting from AI-generated text so it renders
 * as clean, minimal plain text with no stray * # _ ~ ` characters.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Remove ATX headings: # ## ### etc
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic: ***text***, **text**, *text*, ___text___, __text__, _text_
      .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
      // Remove inline code: `code`
      .replace(/`([^`]+)`/g, "$1")
      // Remove fenced code blocks: ```…```
      .replace(/```[\s\S]*?```/g, (match) =>
        match
          .replace(/```[a-z]*\n?/gi, "")
          .replace(/```/g, "")
          .trim(),
      )
      // Remove blockquotes: > text
      .replace(/^>\s+/gm, "")
      // Remove horizontal rules: --- or *** or ___
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove unordered list markers: * - + at start of line → keep text
      .replace(/^[\*\-\+]\s+/gm, "• ")
      // Remove ordered list markers: 1. 2. etc
      .replace(/^\d+\.\s+/gm, (m, offset, str) => {
        // keep the numbering but strip the dot-space formatting
        const num = m.trim().replace(".", "");
        return `${num}. `;
      })
      // Remove strikethrough: ~~text~~
      .replace(/~~(.*?)~~/g, "$1")
      // Remove link syntax: [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove image syntax: ![alt](url)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      // Collapse 3+ consecutive newlines to 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Render clean AI text inside a <pre>-like block.
 * Splits on double newlines into paragraphs, single newlines stay.
 */
export function cleanAIText(text: string): string {
  return stripMarkdown(text);
}
