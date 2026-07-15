import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXTERNAL_PORTALS = [
  "j-net21.smrj.go.jp",
  "hojyokin-portal.jp",
  "prtimes.jp",
  "shienkin.net",
];

const NOISE_LINE_PATTERNS = [
  /^!\[.*?\]\(.*?\)$/i,
  /logo\.png/i,
  /search_title\.png/i,
  /JavaScriptが無効/i,
  /文字の大きさ/i,
  /背景色/i,
  /音声読み上げ/i,
  /検索/i,
  /サイトマップ/i,
  /ページの先頭/i,
  /本文へ/i,
  /閲覧支援/i,
  /アクセシビリティ/i,
  /新型コロナウイルス/i,
  /職員採用/i,
  /まじめえひめ/i,
  /みきゃん/i,
  /愛媛県庁公式ホームページ/i,
  /愛媛県公式ホームページ/i,
  /Foreign Language/i,
  /Googleカスタム検索/i,
  /現在地/i,
  /トップページ/i,
  /組織で探す/i,
  /分野で探す/i,
  /目的で探す/i,
  /カレンダーで探す/i,
  /更新日：/i,
  /印刷用ページ/i,
  /Tweet/i,
  /LINEで送る/i,
  /Facebook/i,
  /Xでポスト/i,
];

const FOOTER_CUT_PATTERNS = [
  /このページに関するお問い合わせ先/,
  /お問い合わせ先/,
  /愛媛県庁$/,
  /法人番号/,
  /〒\d{3}-\d{4}/,
  /Copyright/i,
  /All Rights Reserved/i,
];

const IMPORTANT_WORDS = [
  "補助金",
  "助成金",
  "補助事業",
  "公募",
  "募集",
  "申請",
  "対象",
  "補助対象",
  "補助率",
  "補助額",
  "上限",
  "受付",
  "期間",
  "締切",
  "要領",
  "交付",
  "事業者",
  "愛媛県",
];

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

const isHttpUrl = (value: unknown) => {
  return typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value.trim());
};

const isOfficialDomain = (url: string) => {
  return !EXTERNAL_PORTALS.some((domain) => url.includes(domain));
};

const RELATED_DOCUMENT_WORDS =
  /(公募要領|募集要領|交付要綱|実施要領|実施要綱|申請の手引|制度概要|交付規程|募集案内|公募案内|申請書|記入例|算定方法)/i;

const RELATED_SUPPORT_WORDS =
  /(補助|助成|奨励|給付|支給|交付|申請|公募|募集|対象|要件|算定|立地|操業)/i;

const decodeHtmlEntities = (value: string) =>
  String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");

const stripHtmlTags = (value: string) =>
  decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const normalizedHostname = (value: string) => value.toLowerCase().replace(/^www\./, "");

const discoverRelatedDocumentUrls = async (sourceUrl: string) => {
  try {
    const source = new URL(sourceUrl);
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EhimeHojokinPortal/1.0; +https://ehime-hojokin.jp)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) return [];

    const html = (await response.text()).slice(0, 2_000_000);
    const candidates: Array<{ url: string; score: number }> = [];
    const anchorPattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = anchorPattern.exec(html)) !== null) {
      const rawHref = decodeHtmlEntities(match[2] || "").trim();
      if (!rawHref || /^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue;

      let target: URL;
      try {
        target = new URL(rawHref, sourceUrl);
      } catch {
        continue;
      }
      if (!/^https?:$/.test(target.protocol)) continue;
      if (normalizedHostname(target.hostname) !== normalizedHostname(source.hostname)) continue;
      target.hash = "";
      if (target.toString() === source.toString()) continue;

      const label = stripHtmlTags(match[3] || "");
      const searchable = `${label} ${target.pathname} ${target.search}`;
      if (/\.(?:jpe?g|png|gif|webp|svg|zip)(?:$|\?)/i.test(target.toString())) continue;

      let score = 3;
      if (/\.pdf(?:$|\?)/i.test(target.toString())) score += 6;
      if (RELATED_DOCUMENT_WORDS.test(searchable)) score += 8;
      if (RELATED_SUPPORT_WORDS.test(searchable)) score += 3;
      if (/uploaded\/attachment|upload|download|file/i.test(target.pathname)) score += 2;

      if (score >= 8) candidates.push({ url: target.toString(), score });
    }

    const seen = new Set<string>();
    return candidates
      .sort((left, right) => right.score - left.score)
      .filter((candidate) => {
        if (seen.has(candidate.url)) return false;
        seen.add(candidate.url);
        return true;
      })
      .slice(0, 3)
      .map((candidate) => candidate.url);
  } catch {
    return [];
  }
};

const searchRelatedOfficialUrls = async (
  tavilyKey: string,
  sourceUrl: string,
  title: string,
  organization: string,
) => {
  try {
    const source = new URL(sourceUrl);
    const query =
      `"${title}" "${organization}" ` +
      `(公募要領 OR 募集要領 OR 交付要綱 OR 実施要領 OR 申請の手引 OR 算定方法)`;
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: "advanced",
        include_raw_content: false,
        include_domains: [source.hostname],
        max_results: 6,
      }),
    });
    const data = await response.json();
    if (!response.ok) return [];

    const candidates = (data?.results || [])
      .map((result: { url?: string; title?: string; content?: string }) => {
        if (!result?.url) return null;
        try {
          const target = new URL(result.url);
          target.hash = "";
          if (normalizedHostname(target.hostname) !== normalizedHostname(source.hostname)) return null;
          if (target.toString() === source.toString()) return null;
          const searchable = `${result.title || ""} ${result.content || ""} ${target.pathname}`;
          let score = 3;
          if (/\.pdf(?:$|\?)/i.test(target.toString())) score += 6;
          if (RELATED_DOCUMENT_WORDS.test(searchable)) score += 8;
          if (RELATED_SUPPORT_WORDS.test(searchable)) score += 3;
          if (title && normalizeText(searchable).includes(normalizeText(title))) score += 5;
          return score >= 8 ? { url: target.toString(), score } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<{ url: string; score: number }>;

    return candidates
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map((candidate) => candidate.url);
  } catch {
    return [];
  }
};

const normalizeText = (value: string) => {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[「」『』【】\[\]（）()・｜|:：,，.。]/g, "")
    .toLowerCase();
};

const compactSpaces = (value: string) => {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const shouldDropLine = (line: string) => {
  const s = line.trim();

  if (!s) return true;
  if (s.length <= 1) return true;

  if (NOISE_LINE_PATTERNS.some((pattern) => pattern.test(s))) {
    return true;
  }

  // 記号や短いメニューだけの行を落とす
  if (s.length <= 8 && /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}a-zA-Z0-9\s]+$/u.test(s)) {
    const menuWords = [
      "検索",
      "組織",
      "分野",
      "目的",
      "防災",
      "観光",
      "県政",
      "採用",
      "入札",
      "相談",
      "申請",
    ];

    if (menuWords.includes(s)) {
      return true;
    }
  }

  return false;
};

const scoreLine = (line: string, title: string) => {
  const normalizedLine = normalizeText(line);
  const normalizedTitle = normalizeText(title);

  let score = 0;

  if (normalizedTitle.length >= 8) {
    if (normalizedLine.includes(normalizedTitle)) score += 20;
    if (normalizedTitle.includes(normalizedLine) && normalizedLine.length >= 8) score += 10;
  }

  const titleParts = normalizedTitle
    .split(/年度|事業|補助|助成|公募|募集/)
    .map((v) => v.trim())
    .filter((v) => v.length >= 4);

  for (const part of titleParts) {
    if (normalizedLine.includes(part)) score += 4;
  }

  for (const word of IMPORTANT_WORDS) {
    if (line.includes(word)) score += 2;
  }

  if (/^#+\s*/.test(line)) score += 2;
  if (/概要|目的|対象|補助対象|申請|募集|公募|補助率|補助額|受付期間|提出先/.test(line)) score += 3;

  return score;
};

const cleanAndFocusText = (rawText: string, title: string) => {
  const raw = compactSpaces(rawText);

  const preCleaned = raw
    // Markdown画像を削除
    .replace(/!\[.*?\]\(.*?\)/g, "")
    // Markdownリンクは表示テキストだけ残す
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 $2")
    // 余計な空白調整
    .replace(/\u00a0/g, " ");

  const rawLines = preCleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !shouldDropLine(line));

  if (rawLines.length === 0) {
    return raw;
  }

  // フッター以降をカット
  let footerIndex = rawLines.findIndex((line) =>
    FOOTER_CUT_PATTERNS.some((pattern) => pattern.test(line))
  );

  let lines = footerIndex >= 0 ? rawLines.slice(0, footerIndex) : rawLines;

  // タイトル・補助金関連語に近い位置から本文開始
  let bestIndex = -1;
  let bestScore = 0;

  lines.forEach((line, index) => {
    const score = scoreLine(line, title);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex >= 0 && bestScore >= 6) {
    // タイトル行の少し前から残す。ただしヘッダー混入を避けるため最大3行だけ戻す
    const start = Math.max(0, bestIndex - 3);
    lines = lines.slice(start);
  } else {
    // タイトルが見つからない場合でも、最初の補助金関連行より前を削る
    const firstImportantIndex = lines.findIndex((line) =>
      IMPORTANT_WORDS.some((word) => line.includes(word))
    );

    if (firstImportantIndex > 0) {
      lines = lines.slice(firstImportantIndex);
    }
  }

  // 末尾側の共通フッター再カット
  footerIndex = lines.findIndex((line) =>
    FOOTER_CUT_PATTERNS.some((pattern) => pattern.test(line))
  );

  if (footerIndex >= 0) {
    lines = lines.slice(0, footerIndex);
  }

  // 連続重複行を削除
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const key = normalizeText(line);

    if (!key) continue;

    // 短い汎用行は重複削除
    if (key.length <= 20 && seen.has(key)) continue;

    seen.add(key);
    deduped.push(line);
  }

  let cleaned = deduped.join("\n");

  cleaned = compactSpaces(cleaned);

  // 取りすぎ防止：長すぎる場合は先頭を優先。AI解析には十分。
  if (cleaned.length > 12000) {
    cleaned = cleaned.slice(0, 12000);
  }

  // クリーニングしすぎた場合は元テキストを返す
  if (cleaned.length < 300 && raw.length > cleaned.length) {
    return raw.slice(0, 12000);
  }

  return cleaned;
};

const extractWithTavily = async (
  tavilyKey: string,
  url: string,
  title: string,
  relatedUrls: string[] = []
) => {
  const urls = Array.from(new Set([url, ...relatedUrls])).slice(0, 4);
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: tavilyKey,
      urls,
      extract_depth: "advanced",
      include_images: false,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data?.error || data?.message || "Tavily extract APIでエラーが発生しました。"
    );
  }

  const documents = (data?.results || [])
    .map((result: { raw_content?: string; content?: string; url?: string }) => {
      const rawSourceText = result?.raw_content || result?.content || "";
      if (!rawSourceText) return null;
      return {
        url: result?.url || url,
        rawSourceText,
        cleanedText: cleanAndFocusText(rawSourceText, title),
      };
    })
    .filter(Boolean) as Array<{ url: string; rawSourceText: string; cleanedText: string }>;

  if (!documents.length) {
    throw new Error("指定されたURLのテキストを抽出できませんでした。");
  }

  const sourceHostname = normalizedHostname(new URL(url).hostname);
  const primaryDocument =
    documents.find((document) => {
      try {
        const documentUrl = new URL(document.url);
        return normalizedHostname(documentUrl.hostname) === sourceHostname &&
          documentUrl.pathname === new URL(url).pathname;
      } catch {
        return false;
      }
    }) || documents[0];
  const supportingDocuments = documents.filter((document) => document !== primaryDocument);
  const orderedDocuments = supportingDocuments.length
    ? [...supportingDocuments, primaryDocument]
    : [primaryDocument];
  const sourceText = supportingDocuments.length
    ? orderedDocuments
      .map((document, index) => {
        const maxLength = document === primaryDocument ? 5000 : 8000;
        return `【公式資料 ${index + 1}】\n資料URL: ${document.url}\n${document.cleanedText.slice(0, maxLength)}`;
      })
      .join("\n\n")
      .slice(0, 24000)
    : primaryDocument.cleanedText;

  return {
    sourceText,
    resolvedUrl: primaryDocument.url || url,
    rawLength: documents.reduce((sum, document) => sum + document.rawSourceText.length, 0),
    cleanedLength: sourceText.length,
  };
};

const searchWithTavily = async (
  tavilyKey: string,
  title: string,
  organization: string
) => {
  const cleanTitle = String(title || "")
    .replace(/の(公募|お知らせ|募集|案内)/g, "")
    .trim();

  const org = organization || "愛媛県";

  const query = `"${cleanTitle}" "${org}" (補助金 OR 助成金 OR 補助事業) (募集要項 OR 申請 OR 公募 OR 詳細)`;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: tavilyKey,
      query,
      search_depth: "advanced",
      include_raw_content: true,
      max_results: 5,
      exclude_domains: EXTERNAL_PORTALS,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data?.error || data?.message || "Tavily search APIでエラーが発生しました。"
    );
  }

  const results = data?.results || [];

  if (!results.length) {
    throw new Error("検索結果が見つかりませんでした。");
  }

  const bestResult =
    results.find((item: { url?: string }) => item?.url && isOfficialDomain(item.url)) ||
    results[0];

  const rawSourceText = bestResult?.raw_content || bestResult?.content || "";

  if (!rawSourceText) {
    throw new Error("検索結果から本文を抽出できませんでした。");
  }

  const cleanedText = cleanAndFocusText(rawSourceText, title);

  return {
    sourceText: cleanedText,
    resolvedUrl: bestResult?.url || "",
    rawLength: rawSourceText.length,
    cleanedLength: cleanedText.length,
  };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POSTメソッドで呼び出してください。" }, 405);
  }

  try {
    const tavilyKey = Deno.env.get("TAVILY_API_KEY");

    if (!tavilyKey) {
      return jsonResponse(
        { error: "Supabase Secrets に TAVILY_API_KEY が設定されていません。" },
        200
      );
    }

    const body = await req.json();

    const rawText =
      typeof body?.rawText === "string" ? body.rawText.trim() : "";

    const sourceUrl =
      typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";

    const fallbackUrl =
      typeof body?.fallbackUrl === "string" ? body.fallbackUrl.trim() : "";

    const title =
      typeof body?.title === "string" ? body.title.trim() : "";

    const organization =
      typeof body?.organization === "string" ? body.organization.trim() : "";

    const enrichOfficialSources = body?.enrichOfficialSources === true;

    if (rawText) {
      if (isHttpUrl(rawText)) {
        return jsonResponse(
          { error: "本文欄にはURLではなく、文章を直接貼り付けてください。" },
          200
        );
      }

      const cleanedText = cleanAndFocusText(rawText, title);

      return jsonResponse({
        sourceText: cleanedText,
        resolvedUrl: isHttpUrl(sourceUrl) ? sourceUrl : fallbackUrl || "",
        rawLength: rawText.length,
        cleanedLength: cleanedText.length,
      });
    }

    if (isHttpUrl(sourceUrl)) {
      const linkedUrls = enrichOfficialSources
        ? await discoverRelatedDocumentUrls(sourceUrl)
        : [];
      const searchedUrls = enrichOfficialSources && linkedUrls.length < 3
        ? await searchRelatedOfficialUrls(tavilyKey, sourceUrl, title, organization)
        : [];
      const relatedUrls = Array.from(new Set([...linkedUrls, ...searchedUrls])).slice(0, 3);
      const result = await extractWithTavily(tavilyKey, sourceUrl, title, relatedUrls);
      return jsonResponse(result);
    }

    if (isHttpUrl(fallbackUrl)) {
      const linkedUrls = enrichOfficialSources
        ? await discoverRelatedDocumentUrls(fallbackUrl)
        : [];
      const searchedUrls = enrichOfficialSources && linkedUrls.length < 3
        ? await searchRelatedOfficialUrls(tavilyKey, fallbackUrl, title, organization)
        : [];
      const relatedUrls = Array.from(new Set([...linkedUrls, ...searchedUrls])).slice(0, 3);
      const result = await extractWithTavily(tavilyKey, fallbackUrl, title, relatedUrls);
      return jsonResponse(result);
    }

    if (!title) {
      return jsonResponse(
        { error: "URLまたは検索用タイトルが不足しています。" },
        200
      );
    }

    const result = await searchWithTavily(tavilyKey, title, organization);

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "本文取得中に不明なエラーが発生しました。",
      },
      200
    );
  }
});
