import { NOISE_PATTERNS } from "./constants.ts";

export const normalizeJapaneseNumber = (value: string) => {
  return String(value || "").replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
};

export const normalizeText = (value: string) => {
  return normalizeJapaneseNumber(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const cleanLine = (line: string) => {
  return normalizeJapaneseNumber(line || "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 $2")
    .replace(/^#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/^[-・●■◆◇※]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const stripLeadingLabel = (value: string) => {
  return cleanLine(value)
    .replace(/^【[^】]+】\s*/g, "")
    .replace(
      /^(補助限度額|助成限度額|補助率|助成率|対象経費|補助対象経費|助成対象経費|対象事業者|対象者|補助対象者|助成対象者|給付額|支給額|給付対象者|支給対象者)[:：]\s*/g,
      ""
    )
    .trim();
};

export const shouldDropLine = (line: string) => {
  const s = cleanLine(line);

  if (!s) return true;
  if (s.length <= 1) return true;

  return NOISE_PATTERNS.some((pattern) => pattern.test(s));
};

export const getLines = (text: string) => {
  return normalizeText(text)
    .split("\n")
    .map(cleanLine)
    .filter((line) => !shouldDropLine(line));
};

export const unique = <T,>(items: T[]) => {
  return Array.from(new Set(items.filter(Boolean)));
};

export const takeNearbyLines = (
  lines: string[],
  index: number,
  before = 1,
  after = 3
) => {
  const start = Math.max(0, index - before);
  const end = Math.min(lines.length, index + after + 1);
  return lines.slice(start, end);
};

export const stripCodeFence = (value: string) => {
  return String(value || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
};

export const parseJsonSafely = (value: string) => {
  const raw = stripCodeFence(value);

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }

    throw new Error("AIのJSON解析に失敗しました。");
  }
};

export const toStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[、,\n/・]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};