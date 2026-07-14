/**
 * Strips the YAML frontmatter block (`--- ... ---`) from the start of a
 * SKILL.md and returns only the body. `name`/`description` are already parsed
 * and shown in the detail header, so the body region must not re-leak them.
 *
 * Mock bodies have no frontmatter so this is a no-op on them, but it's a
 * safety net so we only render the body even when the backend returns the
 * full file.
 */
export function stripFrontmatter(md: string): string {
  // Only strips a leading `---` ~ `---` block (tolerating a leading BOM and
  // whitespace). If the closing `---` isn't on its own line (= not
  // frontmatter), nothing matches and the input is returned unchanged.
  return md.replace(/^\uFEFF?\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n\s*|$)/, "");
}
