import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";

type SupportedLocale = "es" | "en";

type ParsedBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "hr" }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

const PRIVACY_META: Record<
  SupportedLocale,
  { title: string; description: string; backToHome: string; markdownFile: string }
> = {
  es: {
    title: "Política de Privacidad | Finnon",
    description:
      "Conoce cómo Finnon recopila, usa y protege tu información personal en la app web y móvil.",
    backToHome: "Volver al inicio",
    markdownFile: "privacy-es.md",
  },
  en: {
    title: "Privacy Policy | Finnon",
    description:
      "Learn how Finnon collects, uses, and protects your personal information across web and mobile apps.",
    backToHome: "Back to home",
    markdownFile: "privacy-en.md",
  },
};

const INLINE_TOKEN_REGEX = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

const normalizeLocale = (locale: string): SupportedLocale =>
  locale.toLowerCase().startsWith("en") ? "en" : "es";

const splitTableRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const isTableSeparator = (line: string): boolean =>
  /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());

async function resolvePrivacyMarkdownPath(markdownFile: string): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "docs/privacy", markdownFile),
    path.resolve(process.cwd(), "../../docs/privacy", markdownFile),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep trying candidate paths.
    }
  }

  throw new Error(`Privacy markdown file not found: ${markdownFile}`);
}

async function readPrivacyMarkdown(locale: SupportedLocale): Promise<string> {
  const markdownFile = PRIVACY_META[locale].markdownFile;
  const filePath = await resolvePrivacyMarkdownPath(markdownFile);
  return readFile(filePath, "utf8");
}

function parseMarkdown(markdown: string): ParsedBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ParsedBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index];
    const line = raw.trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      index += 1;
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1] ?? "")) {
      const headers = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];

      while (index < lines.length) {
        const rowLine = (lines[index] ?? "").trim();
        if (!rowLine || !rowLine.includes("|")) {
          break;
        }
        rows.push(splitTableRow(rowLine));
        index += 1;
      }

      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = (lines[index] ?? "").trim();
        if (!/^[-*]\s+/.test(itemLine)) break;
        items.push(itemLine.replace(/^[-*]\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = (lines[index] ?? "").trim();
        if (!/^\d+\.\s+/.test(itemLine)) break;
        items.push(itemLine.replace(/^\d+\.\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = (lines[index] ?? "").trim();
      if (
        !paragraphLine ||
        paragraphLine.startsWith("# ") ||
        paragraphLine.startsWith("## ") ||
        paragraphLine.startsWith("### ") ||
        /^[-*]\s+/.test(paragraphLine) ||
        /^\d+\.\s+/.test(paragraphLine) ||
        (paragraphLine.includes("|") &&
          index + 1 < lines.length &&
          isTableSeparator(lines[index + 1] ?? ""))
      ) {
        break;
      }
      paragraphLines.push(paragraphLine);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: "p", text: paragraphLines.join(" ") });
      continue;
    }

    index += 1;
  }

  return blocks;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const tokens = text.split(INLINE_TOKEN_REGEX).filter(Boolean);

  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      return (
        <a key={key} href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {label}
        </a>
      );
    }

    const bold = token.match(/^\*\*(.+)\*\*$/);
    if (bold) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {bold[1]}
        </strong>
      );
    }

    const code = token.match(/^`(.+)`$/);
    if (code) {
      return (
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] text-foreground">
          {code[1]}
        </code>
      );
    }

    return <span key={key}>{token}</span>;
  });
}

function renderBlock(block: ParsedBlock, idx: number): ReactNode {
  if (block.type === "h1") {
    return (
      <h1 key={`h1-${idx}`} className="text-3xl font-semibold tracking-tight text-foreground">
        {renderInline(block.text, `h1-${idx}`)}
      </h1>
    );
  }

  if (block.type === "h2") {
    return (
      <h2 key={`h2-${idx}`} className="pt-2 text-xl font-semibold text-foreground">
        {renderInline(block.text, `h2-${idx}`)}
      </h2>
    );
  }

  if (block.type === "h3") {
    return (
      <h3 key={`h3-${idx}`} className="pt-1 text-lg font-semibold text-foreground">
        {renderInline(block.text, `h3-${idx}`)}
      </h3>
    );
  }

  if (block.type === "hr") {
    return <hr key={`hr-${idx}`} className="border-border" />;
  }

  if (block.type === "ul") {
    return (
      <ul key={`ul-${idx}`} className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
        {block.items.map((item, itemIdx) => (
          <li key={`ul-${idx}-${itemIdx}`}>{renderInline(item, `ul-${idx}-${itemIdx}`)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "ol") {
    return (
      <ol key={`ol-${idx}`} className="list-decimal space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
        {block.items.map((item, itemIdx) => (
          <li key={`ol-${idx}-${itemIdx}`}>{renderInline(item, `ol-${idx}-${itemIdx}`)}</li>
        ))}
      </ol>
    );
  }

  if (block.type === "table") {
    return (
      <div key={`table-${idx}`} className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              {block.headers.map((header, headerIdx) => (
                <th key={`th-${idx}-${headerIdx}`} className="px-4 py-3 font-semibold text-foreground">
                  {renderInline(header, `th-${idx}-${headerIdx}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIdx) => (
              <tr key={`tr-${idx}-${rowIdx}`} className="border-t border-border align-top">
                {row.map((cell, cellIdx) => (
                  <td key={`td-${idx}-${rowIdx}-${cellIdx}`} className="px-4 py-3 text-muted-foreground">
                    {renderInline(cell, `td-${idx}-${rowIdx}-${cellIdx}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <p key={`p-${idx}`} className="text-sm leading-7 text-muted-foreground">
      {renderInline(block.text, `p-${idx}`)}
    </p>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale(await getLocale());
  const meta = PRIVACY_META[locale];

  return {
    title: meta.title,
    description: meta.description,
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PrivacyPage() {
  const locale = normalizeLocale(await getLocale());
  const meta = PRIVACY_META[locale];
  const markdown = await readPrivacyMarkdown(locale);
  const blocks = parseMarkdown(markdown);

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[720px] rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
        <Link href="/" className="text-sm text-primary hover:underline">
          {meta.backToHome}
        </Link>
        <article className="mt-4 space-y-4">{blocks.map(renderBlock)}</article>
      </div>
    </main>
  );
}
