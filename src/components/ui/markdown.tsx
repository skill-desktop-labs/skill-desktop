import { Fragment, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useToastActions } from "../../lib/toast-store";
import { cn } from "./kit";

/**
 * Dependency-free markdown renderer for a curated SKILL.md subset: headings,
 * paragraphs, ordered/unordered lists, fenced code, blockquotes, horizontal
 * rules, and inline `code` / **bold** / [links](url). No raw HTML passthrough —
 * safe by construction. Links open in the system browser via plugin-opener.
 *
 * Intentionally not a full CommonMark parser: SKILL.md bodies are authored, not
 * arbitrary, so this covers what they actually use and stays styleable with our
 * design tokens.
 */

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; code: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" };

function isBlockStart(line: string): boolean {
  return (
    /^```/.test(line) ||
    /^(#{1,4})\s+/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line)
  );
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ kind: "code", code: buf.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    // Blockquote (consecutive `>` lines)
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered: true, items });
      continue;
    }

    // Paragraph: gather soft-wrapped lines until a blank line or a new block
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", text: buf.join(" ") });
  }

  return blocks;
}

function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  const { show } = useToastActions();
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        openUrl(href).catch(() => show("Could not open link"));
      }}
      className="font-medium text-accent-text underline decoration-accent-text/30 underline-offset-2 hover:decoration-accent-text"
    >
      {children}
    </a>
  );
}

/**
 * Inline parser for `code`, **bold**, [text](url). Recursive so bold/links can
 * wrap other inline elements — e.g. **prod DB(`db.prod.*`)** renders the code
 * span inside the bold instead of leaking stray `**`. Code spans are atomic
 * (their contents are never re-parsed). "Earliest match wins" at each step;
 * a bold whose opener comes first swallows the code span and recurses into it.
 */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let key = 0;
  let s = text;

  while (s.length) {
    const code = /`([^`]+)`/.exec(s);
    const bold = /\*\*([\s\S]+?)\*\*/.exec(s);
    const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(s);

    // Pick the match that starts earliest; ties resolve code > bold > link.
    let pick: "code" | "bold" | "link" | null = null;
    let at = Infinity;
    if (code && code.index < at) (pick = "code"), (at = code.index);
    if (bold && bold.index < at) (pick = "bold"), (at = bold.index);
    if (link && link.index < at) (pick = "link"), (at = link.index);

    if (pick === null) {
      out.push(s);
      break;
    }

    const m = (pick === "code" ? code : pick === "bold" ? bold : link)!;
    if (m.index > 0) out.push(s.slice(0, m.index));

    if (pick === "code") {
      out.push(
        <code
          key={key++}
          className="rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-fg"
        >
          {m[1]}
        </code>,
      );
    } else if (pick === "bold") {
      out.push(
        <strong key={key++} className="font-semibold text-fg">
          {renderInline(m[1])}
        </strong>,
      );
    } else {
      out.push(
        <InlineLink key={key++} href={m[2]}>
          {renderInline(m[1])}
        </InlineLink>,
      );
    }

    s = s.slice(m.index + m[0].length);
  }

  return out;
}

const HEADING_CLASS: Record<number, string> = {
  1: "pt-1 text-[16px] font-semibold text-fg",
  2: "pt-1 text-[15px] font-semibold text-fg",
  3: "text-[13px] font-semibold text-fg",
  4: "text-[12px] font-semibold uppercase tracking-wide text-muted",
};

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.kind) {
    case "heading": {
      const Tag = (`h${Math.min(block.level + 1, 6)}` as "h2");
      return (
        <Tag key={key} className={HEADING_CLASS[block.level] ?? HEADING_CLASS[3]}>
          {renderInline(block.text)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="text-[13.5px] leading-[1.7] text-muted">
          {renderInline(block.text)}
        </p>
      );
    case "code":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-lg border border-border bg-surface-2 p-3.5"
        >
          <code className="font-mono text-[12.5px] leading-relaxed text-fg">
            {block.code}
          </code>
        </pre>
      );
    case "list":
      return block.ordered ? (
        <ol key={key} className="flex flex-col gap-2 pl-0.5">
          {block.items.map((item, n) => (
            <li key={n} className="flex gap-2.5 text-[13.5px] leading-[1.6] text-muted">
              <span className="shrink-0 pt-px font-mono text-[12px] font-semibold tabular-nums text-accent-text">
                {n + 1}.
              </span>
              <span className="min-w-0">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="flex flex-col gap-2">
          {block.items.map((item, n) => (
            <li key={n} className="flex gap-2.5 text-[13.5px] leading-[1.6] text-muted">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-subtle" />
              <span className="min-w-0">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-[3px] border-accent/50 pl-3.5 text-[13.5px] leading-[1.7] text-muted"
        >
          {renderInline(block.text)}
        </blockquote>
      );
    case "hr":
      return <hr key={key} className="border-t border-border" />;
    default:
      return null;
  }
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return (
    // select-text: body copy is documentation — commands and prose should be
    // copyable even though the app chrome disables selection.
    <div className={cn("flex select-text flex-col gap-3.5", className)}>
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block, i)}</Fragment>
      ))}
    </div>
  );
}
