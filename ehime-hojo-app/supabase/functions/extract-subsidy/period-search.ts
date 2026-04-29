import type { ExtractFacts } from "./types.ts";
import {
  determineApplicationStatus,
  extractBestPeriodText,
  isBadApplicationPeriodCandidate,
  parsePeriodDates,
} from "./period-utils.ts";
import { cleanLine, getLines, unique } from "./text-utils.ts";

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
};

type TavilyResponse = {
  results?: TavilyResult[];
  answer?: string;
  query?: string;
};

export type PeriodSearchResult = {
  found: boolean;
  application_period_text: string;
  application_start_date: string | null;
  application_end_date: string | null;
  application_status: string;
  confidence: number;
  evidence: string;
  source_url: string;
  searched_queries: string[];
  used_query: string;
};

const PERIOD_QUERY_WORDS = [
  "申請期間",
  "募集期間",
  "受付期間",
  "提出期限",
  "応募期限",
  "申請期限",
  "締切",
  "企画提案書 提出期限",
  "公募開始 提出期限",
];

const PERIOD_BAD_SNIPPET_PATTERN =
  /(更新|更新日|お知らせ|お忘れない|忘れない|一覧|新着|トップページ|ページ一覧|関連情報|くらし|生活|子育て応援手当|物価高対応|FAQ|よくある質問|\*|#|^\s*[-・●])/;

const BAD_PERIOD_TEXT_PATTERN =
  /(対象児童|出生|新生児|児童手当|住民登録|給付対象者|支給対象者|から今|から現在|より今|より現在|更新|更新日|お忘れない|忘れない|一覧|新着|物価高対応子育て応援手当)/;

const PERIOD_SHAPE_PATTERN =
  /(令和[元0-9０-９]+年\s*[0-9０-９]{1,2}月\s*[0-9０-９]{1,2}日|20[0-9]{2}年\s*[0-9]{1,2}月\s*[0-9]{1,2}日|随時|通年)/;

const PERIOD_END_HINT_PATTERN =
  /(～|〜|から|より|まで|期限|締切|締め切り|必着|受付|募集|申請|提出|応募|達し次第|なくなり次第|予算|定員)/;

const SCHEDULE_CONTEXT_PATTERN =
  /(公募開始|募集開始|受付開始|申請開始|提出期限|提出締切|応募期限|申請期限|企画提案書|提案書|プロポーザル|参加申込|申込書|締切|締め切り|必着)/;

const GENERIC_LIST_PAGE_PATH_PATTERN =
  /\/life\/sub\/?$|\/life\/sub\/\d+\/?$|\/kurashi\/?$|\/soshiki\/?$|\/sub\/\d+\/?$/;

const getHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const getPath = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};

const getBaseDomain = (url: string) => {
  const host = getHost(url);
  return host || "";
};

const compact = (value: string, max = 380) => {
  const s = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (s.length <= max) return s;

  return s.slice(0, max);
};

const stripQuotes = (value: string) => {
  return String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[「」『』]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeSearchText = (value: string) => {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[　]/g, " ")
    .trim();
};

const buildQueries = ({
  title,
  organization,
  officialUrl,
}: {
  title: string;
  organization: string;
  officialUrl: string;
}) => {
  const safeTitle = stripQuotes(title);
  const safeOrg = stripQuotes(organization);
  const host = getBaseDomain(officialUrl);

  const queries: string[] = [];

  for (const word of PERIOD_QUERY_WORDS) {
    if (host) {
      queries.push(compact(`site:${host} "${safeTitle}" "${word}"`));
    }

    if (safeOrg) {
      queries.push(compact(`"${safeOrg}" "${safeTitle}" "${word}"`));
    }

    queries.push(compact(`"${safeTitle}" "${word}"`));
  }

  return unique(queries).slice(0, 8);
};

const callTavily = async ({
  query,
  includeDomain,
}: {
  query: string;
  includeDomain: string;
}): Promise<TavilyResponse> => {
  const apiKey = Deno.env.get("TAVILY_API_KEY");

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY が Supabase Secrets に設定されていません。");
  }

  const body: Record<string, unknown> = {
    query,
    search_depth: "basic",
    topic: "general",
    country: "japan",
    max_results: 5,
    include_answer: false,
    include_raw_content: "text",
    include_images: false,
  };

  if (includeDomain) {
    body.include_domains = [includeDomain];
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Tavily Search エラー: HTTP ${res.status}`,
    );
  }

  return data as TavilyResponse;
};

const scoreResultUrl = ({
  url,
  officialHost,
}: {
  url: string;
  officialHost: string;
}) => {
  const host = getHost(url);
  const path = getPath(url);

  let score = 0;

  if (officialHost && host === officialHost) score += 45;
  if (officialHost && host.endsWith(officialHost)) score += 25;

  if (/pref\.ehime\.jp|city\.|town\.|lg\.jp|go\.jp|or\.jp/.test(host)) {
    score += 20;
  }

  if (/mirasapo|j-net21|prtimes|facebook|x\.com|twitter/.test(host)) {
    score -= 40;
  }

  if (GENERIC_LIST_PAGE_PATH_PATTERN.test(path)) {
    score -= 25;
  }

  return score;
};

const isOfficialHostMatch = ({
  url,
  officialHost,
}: {
  url: string;
  officialHost: string;
}) => {
  const host = getHost(url);

  if (!officialHost) {
    return /pref\.ehime\.jp|city\.|town\.|lg\.jp|go\.jp|or\.jp/.test(host);
  }

  return host === officialHost || host.endsWith(officialHost);
};

const titleTokens = (title: string) => {
  const normalized = normalizeSearchText(title)
    .replace(/[（）()【】［］\[\]「」『』・,，、。:：/／\-―—]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= 2)
    .filter((token) => !/令和\d+年度|令和|年度|補助金|補助事業|事業|支援/.test(token));

  return unique(normalized).slice(0, 8);
};

const isTitleRelated = ({
  title,
  text,
}: {
  title: string;
  text: string;
}) => {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedText = normalizeSearchText(text);

  if (!normalizedTitle) return false;

  if (normalizedText.includes(normalizedTitle)) {
    return true;
  }

  const tokens = titleTokens(normalizedTitle);

  if (tokens.length === 0) {
    return false;
  }

  const hitCount = tokens.filter((token) => normalizedText.includes(token)).length;

  if (tokens.length <= 2) {
    return hitCount >= 1;
  }

  return hitCount >= 2;
};

const isAcceptablePeriodText = (periodText: string) => {
  const s = cleanLine(periodText || "");

  if (!s) return false;
  if (s.length < 6) return false;
  if (s.length > 100) return false;
  if (isBadApplicationPeriodCandidate(s)) return false;
  if (BAD_PERIOD_TEXT_PATTERN.test(s)) return false;
  if (PERIOD_BAD_SNIPPET_PATTERN.test(s)) return false;
  if (!PERIOD_SHAPE_PATTERN.test(s)) return false;
  if (!PERIOD_END_HINT_PATTERN.test(s)) return false;

  return true;
};

const scorePeriodText = (periodText: string) => {
  const s = cleanLine(periodText);

  if (!isAcceptablePeriodText(s)) return -100;

  let score = 0;

  if (/令和|平成|20\d{2}年/.test(s)) score += 25;
  if (/～|〜|から|より/.test(s)) score += 20;
  if (/まで|期限|締切|締め切り|必着|時/.test(s)) score += 20;
  if (/企画提案書|提案書|プロポーザル|申請書|応募書類/.test(s)) score += 20;
  if (/公募開始|募集開始|受付開始|申請開始/.test(s)) score += 10;
  if (s.length >= 15 && s.length <= 80) score += 10;
  if (s.length > 90) score -= 15;

  return score;
};

const buildSearchText = (result: TavilyResult) => {
  return [
    result.title || "",
    result.url || "",
    result.content || "",
    result.raw_content || "",
  ]
    .filter(Boolean)
    .join("\n");
};

const makeEvidence = (text: string, periodText: string) => {
  const lines = getLines(text);
  const periodCore = cleanLine(periodText).slice(0, 20);

  const hitIndex = lines.findIndex((line) => line.includes(periodCore));

  if (hitIndex >= 0) {
    return lines.slice(Math.max(0, hitIndex - 2), hitIndex + 3).join(" / ");
  }

  const scheduleLine = lines.find((line) => SCHEDULE_CONTEXT_PATTERN.test(line));

  if (scheduleLine) return scheduleLine;

  return cleanLine(periodText);
};

const extractPeriodFromSearchText = (text: string) => {
  const lines = getLines(text);

  const scheduleOnlyText = lines
    .filter((line) => {
      if (PERIOD_BAD_SNIPPET_PATTERN.test(line)) return false;

      return (
        SCHEDULE_CONTEXT_PATTERN.test(line) ||
        /令和[元0-9０-９]+年\s*[0-9０-９]{1,2}月\s*[0-9０-９]{1,2}日/.test(line)
      );
    })
    .join("\n");

  const periodFromSchedule = extractBestPeriodText([], scheduleOnlyText);

  if (isAcceptablePeriodText(periodFromSchedule)) {
    return periodFromSchedule;
  }

  const periodFromAll = extractBestPeriodText([], text);

  if (isAcceptablePeriodText(periodFromAll)) {
    return periodFromAll;
  }

  return "";
};

export const searchPeriodOnly = async ({
  title,
  organization,
  officialUrl,
  currentFacts,
}: {
  title: string;
  organization: string;
  officialUrl: string;
  currentFacts: ExtractFacts;
}): Promise<PeriodSearchResult> => {
  const emptyResult: PeriodSearchResult = {
    found: false,
    application_period_text: "",
    application_start_date: null,
    application_end_date: null,
    application_status: "",
    confidence: 0,
    evidence: "",
    source_url: "",
    searched_queries: [],
    used_query: "",
  };

  const safeTitle = String(title || currentFacts.title || "").trim();

  if (!safeTitle) {
    return emptyResult;
  }

  const officialHost = getBaseDomain(officialUrl || currentFacts.official_url || "");
  const queries = buildQueries({
    title: safeTitle,
    organization: organization || currentFacts.organization || "",
    officialUrl: officialUrl || currentFacts.official_url || "",
  });

  if (queries.length === 0) {
    return emptyResult;
  }

  const candidates: Array<{
    periodText: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    confidence: number;
    evidence: string;
    sourceUrl: string;
    query: string;
  }> = [];

  for (const query of queries) {
    try {
      const data = await callTavily({
        query,
        includeDomain: officialHost,
      });

      const results = Array.isArray(data.results) ? data.results : [];

      for (const result of results) {
        const sourceUrl = result.url || "";
        const combinedText = buildSearchText(result);

        if (!combinedText) continue;

        if (!isOfficialHostMatch({ url: sourceUrl, officialHost })) continue;

        if (!isTitleRelated({ title: safeTitle, text: combinedText })) continue;

        const periodText = extractPeriodFromSearchText(combinedText);

        if (!isAcceptablePeriodText(periodText)) continue;

        const dates = parsePeriodDates(periodText);

        const status = determineApplicationStatus({
          periodText,
          startDate: dates.start,
          endDate: dates.end,
          aiStatus: currentFacts.application_status || "",
        });

        const evidence = makeEvidence(combinedText, periodText);

        if (PERIOD_BAD_SNIPPET_PATTERN.test(evidence)) continue;

        const confidence =
          35 +
          scoreResultUrl({ url: sourceUrl, officialHost }) +
          scorePeriodText(periodText) +
          Math.round(Number(result.score || 0) * 8);

        candidates.push({
          periodText,
          startDate: dates.start,
          endDate: dates.end,
          status,
          confidence: Math.max(0, Math.min(99, confidence)),
          evidence,
          sourceUrl,
          query,
        });
      }
    } catch {
      // 検索失敗は抽出全体を止めない
    }
  }

  if (candidates.length === 0) {
    return {
      ...emptyResult,
      searched_queries: queries,
    };
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  const best = candidates[0];

  if (best.confidence < 75) {
    return {
      ...emptyResult,
      searched_queries: queries,
      used_query: best.query,
    };
  }

  return {
    found: true,
    application_period_text: best.periodText,
    application_start_date: best.startDate,
    application_end_date: best.endDate,
    application_status: best.status,
    confidence: best.confidence,
    evidence: best.evidence,
    source_url: best.sourceUrl,
    searched_queries: queries,
    used_query: best.query,
  };
};

export const shouldSearchPeriod = (facts: ExtractFacts) => {
  const periodText = String(facts.application_period_text || "");
  const confidence = Number(facts.field_confidence?.application_period_text || 0);

  if (!periodText) return true;
  if (confidence > 0 && confidence < 88) return true;

  if (isBadApplicationPeriodCandidate(periodText)) return true;

  if (BAD_PERIOD_TEXT_PATTERN.test(periodText)) return true;

  if (PERIOD_BAD_SNIPPET_PATTERN.test(periodText)) return true;

  if (/(から今|から現在|より今|より現在)/.test(periodText)) return true;

  if (
    /(公募開始|募集開始|受付開始|申請開始)/.test(periodText) &&
    !/(～|〜|まで|期限|締切|締め切り)/.test(periodText)
  ) {
    return true;
  }

  if (
    facts.application_status === "受付終了" &&
    !facts.application_end_date &&
    !/終了|締切|期限/.test(periodText)
  ) {
    return true;
  }

  return false;
};