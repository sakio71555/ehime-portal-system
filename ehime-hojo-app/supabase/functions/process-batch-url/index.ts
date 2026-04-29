import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

type ProcessResult = {
  url: string;
  status: "added" | "skipped" | "error";
  title?: string;
  id?: string;
  reason?: string;
};

const DEFAULT_PURPOSE_TAGS = [
  "設備投資",
  "販路開拓",
  "人材育成",
  "雇用",
  "創業",
  "新規事業",
  "事業承継",
  "DX",
  "IT導入",
  "省エネ",
  "脱炭素",
  "環境対策",
  "農業支援",
  "水産業支援",
  "観光支援",
  "研究開発",
  "商品開発",
  "海外展開",
  "災害対策",
  "移住・定住",
];

const DEFAULT_INDUSTRY_TAGS = [
  "製造業",
  "建設業",
  "卸売業",
  "小売業",
  "飲食業",
  "宿泊業",
  "観光業",
  "農業",
  "林業",
  "水産業",
  "医療・福祉",
  "情報通信業",
  "運輸業",
  "サービス業",
  "不動産業",
  "教育",
  "全業種",
];

const jsonResponse = (body: JsonRecord, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

const normalizeJapaneseNumber = (value: string) => {
  return String(value || "").replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
};

const isHttpUrl = (value: unknown) => {
  return typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value.trim());
};

const normalizeUrl = (value: string) => {
  return String(value || "")
    .trim()
    .replace(/[）)]$/, "")
    .replace(/[、,。]$/, "");
};

const toStringArray = (value: unknown) => {
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

const normalizeDateForDB = (value: unknown) => {
  if (!value) return null;

  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  return null;
};

const stripLabel = (value: string) => {
  return String(value || "")
    .replace(/^【[^】]+】\s*/g, "")
    .replace(
      /^(補助限度額|助成限度額|補助率|助成率|対象経費|補助対象経費|助成対象経費|対象事業者|対象者|補助対象者|助成対象者)[:：]\s*/g,
      "",
    )
    .trim();
};

const parseAmountMaxYen = (value: string) => {
  const s = normalizeJapaneseNumber(value || "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");

  let max = 0;

  const regex = /(\d+(?:\.\d+)?)(億円|万円|千円|円)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(s)) !== null) {
    let num = Number(match[1]);

    if (match[2] === "億円") num *= 100000000;
    if (match[2] === "万円") num *= 10000;
    if (match[2] === "千円") num *= 1000;

    if (num > max) {
      max = num;
    }
  }

  return Math.round(max);
};

const extractUrlsFromBody = (body: JsonRecord) => {
  const urls: string[] = [];

  if (Array.isArray(body.urls)) {
    for (const item of body.urls) {
      if (typeof item === "string") {
        urls.push(item);
      } else if (
        item &&
        typeof item === "object" &&
        typeof (item as JsonRecord).url === "string"
      ) {
        urls.push(String((item as JsonRecord).url));
      }
    }
  }

  if (typeof body.url === "string") {
    urls.push(body.url);
  }

  if (typeof body.text === "string") {
    const found = body.text.match(/https?:\/\/[^\s"'<>）)]+/g) || [];
    urls.push(...found);
  }

  if (typeof body.rawText === "string") {
    const found = body.rawText.match(/https?:\/\/[^\s"'<>）)]+/g) || [];
    urls.push(...found);
  }

  return Array.from(new Set(urls.map(normalizeUrl).filter(isHttpUrl)));
};

const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} が Supabase Secrets に設定されていません。`);
  }

  return value;
};

const getSupabaseClient = () => {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const invokeEdgeFunction = async <T = JsonRecord>(
  functionName: string,
  body: JsonRecord,
  authHeaderFromRequest?: string | null,
): Promise<T> => {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const forwardedAuth =
    authHeaderFromRequest && authHeaderFromRequest.startsWith("Bearer ")
      ? authHeaderFromRequest
      : anonKey
        ? `Bearer ${anonKey}`
        : serviceRoleKey
          ? `Bearer ${serviceRoleKey}`
          : "";

  const apiKey = anonKey || serviceRoleKey;

  if (!forwardedAuth || !apiKey) {
    throw new Error(
      "Edge Function内部呼び出し用のJWTがありません。SUPABASE_ANON_KEY または SUPABASE_SERVICE_ROLE_KEY を確認してください。",
    );
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      Authorization: forwardedAuth,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  let parsed: JsonRecord | null = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const detail =
      parsed?.error ||
      parsed?.message ||
      text ||
      `HTTP ${res.status}`;

    throw new Error(`${functionName} エラー(${res.status}): ${detail}`);
  }

  if (parsed?.error) {
    throw new Error(`${functionName} エラー: ${parsed.error}`);
  }

  return (parsed || {}) as T;
};

const decodeHtmlEntities = (value: string) => {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, num) =>
      String.fromCharCode(parseInt(num, 10))
    );
};

const htmlToText = (html: string) => {
  let text = String(html || "");

  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "\n")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .replace(
      /<\/(h1|h2|h3|h4|h5|h6|p|div|section|article|main|li|tr|dt|dd)>/gi,
      "\n",
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  text = decodeHtmlEntities(text);

  const lines = text
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/[ \t　]+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const noisePatterns = [
    /ページの先頭へ/,
    /本文へ/,
    /サイトマップ/,
    /文字サイズ/,
    /背景色/,
    /Foreign Language/,
    /Googleカスタム検索/,
    /閲覧支援/,
    /アクセシビリティ/,
    /印刷用ページ/,
    /Xでポスト/,
    /Facebook/,
    /LINEで送る/,
  ];

  return lines
    .filter((line) => !noisePatterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const directFetchPageText = async (url: string) => {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; EhimeSubsidyPortalBot/1.0; +https://ehime-hojokin.jp)",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`直接取得エラー HTTP ${res.status}`);
  }

  const html = await res.text();
  const sourceText = htmlToText(html);

  if (!sourceText) {
    throw new Error("直接取得でも本文テキストを抽出できませんでした。");
  }

  return {
    sourceText,
    resolvedUrl: res.url || url,
    rawLength: html.length,
    cleanedLength: sourceText.length,
    via: "direct-fetch",
  };
};

const findExistingSubsidy = async (
  supabase: ReturnType<typeof createClient>,
  url: string,
) => {
  const byOfficial = await supabase
    .from("subsidies")
    .select("id,title,official_url,source_url")
    .eq("official_url", url)
    .maybeSingle();

  if (byOfficial.data) {
    return byOfficial.data;
  }

  const bySource = await supabase
    .from("subsidies")
    .select("id,title,official_url,source_url")
    .eq("source_url", url)
    .maybeSingle();

  if (bySource.data) {
    return bySource.data;
  }

  return null;
};

const fetchPageText = async ({
  url,
  title,
  organization,
  authHeader,
}: {
  url: string;
  title: string;
  organization: string;
  authHeader?: string | null;
}) => {
  try {
    const data = await invokeEdgeFunction<JsonRecord>(
      "fetch-page-text",
      {
        rawText: "",
        sourceUrl: url,
        fallbackUrl: url,
        title,
        organization,
      },
      authHeader,
    );

    const sourceText =
      typeof data?.sourceText === "string" ? data.sourceText : "";

    const resolvedUrl =
      typeof data?.resolvedUrl === "string" ? data.resolvedUrl : url;

    if (!sourceText) {
      throw new Error("本文テキストを取得できませんでした。");
    }

    return {
      sourceText,
      resolvedUrl,
      rawLength: Number(data?.rawLength || 0),
      cleanedLength: Number(data?.cleanedLength || sourceText.length),
      via: "fetch-page-text",
    };
  } catch (error) {
    const firstError =
      error instanceof Error
        ? error.message
        : "fetch-page-text が失敗しました。";

    const fallback = await directFetchPageText(url);

    return {
      ...fallback,
      warning: `fetch-page-text失敗のため直接取得に切替: ${firstError}`,
    };
  }
};

const extractSubsidy = async ({
  extractedText,
  resolvedUrl,
  title,
  organization,
  purposesTags,
  industryTags,
  authHeader,
}: {
  extractedText: string;
  resolvedUrl: string;
  title: string;
  organization: string;
  purposesTags: string;
  industryTags: string;
  authHeader?: string | null;
}) => {
  const data = await invokeEdgeFunction<JsonRecord>(
    "extract-subsidy",
    {
      extractedText,
      resolvedUrl,
      editFormTitle: title,
      org: organization,
      summary: "",
      purposesTags,
      industryTags,
    },
    authHeader,
  );

  const facts = (data?.facts || {}) as JsonRecord;
  const tags = (data?.tags || {}) as JsonRecord;
  const finalTitle = String(data?.finalTitle || facts?.title || title || "");

  return {
    facts,
    tags,
    finalTitle,
    candidateDebug: data?.candidate_debug || {},
  };
};

const buildInsertPayload = ({
  facts,
  tags,
  finalTitle,
  resolvedUrl,
}: {
  facts: JsonRecord;
  tags: JsonRecord;
  finalTitle: string;
  resolvedUrl: string;
}) => {
  const targetExpensesArr = toStringArray(facts.target_expenses_arr).map(
    stripLabel,
  );

  const targetEntitiesArr = toStringArray(facts.target_entities_arr).map(
    stripLabel,
  );

  const amountText = stripLabel(String(facts.amount_text || ""));
  const subsidyRateText = stripLabel(String(facts.subsidy_rate_text || ""));

  const purposes = toStringArray(tags.purposes);
  const industries = toStringArray(tags.industries);
  const allTags = Array.from(new Set([...purposes, ...industries]));

  const title = String(finalTitle || facts.title || "").trim();

  const officialUrl =
    typeof facts.official_url === "string" &&
    facts.official_url.startsWith("http")
      ? facts.official_url
      : resolvedUrl;

  const sourceUrl =
    typeof facts.source_url === "string" && facts.source_url.startsWith("http")
      ? facts.source_url
      : resolvedUrl;

  const applicationPeriodText = String(
    facts.application_period_text || facts.deadline || "",
  ).trim();

  return {
    title,
    region: String(facts.region_text || facts.region || "愛媛県内").trim(),
    region_text: String(facts.region_text || facts.region || "愛媛県内").trim(),
    prefecture: String(facts.prefecture || "愛媛県").trim(),
    municipality: String(facts.municipality || "").trim(),
    organization: String(facts.organization || "愛媛県").trim(),

    deadline: applicationPeriodText,
    application_period_text: applicationPeriodText,
    application_start_date: normalizeDateForDB(facts.application_start_date),
    application_end_date: normalizeDateForDB(facts.application_end_date),
    application_status: String(facts.application_status || "不明").trim(),

    amount: amountText,
    amount_text: amountText,
    amount_max_yen:
      Number(facts.amount_max_yen || 0) > 0
        ? Number(facts.amount_max_yen)
        : parseAmountMaxYen(amountText),

    subsidy_rate: subsidyRateText,
    subsidy_rate_text: subsidyRateText,

    target_expenses: targetExpensesArr.join(" / "),
    target_expenses_arr: targetExpensesArr,

    target_entities: targetEntitiesArr.join(" / "),
    target_entities_arr: targetEntitiesArr,

    summary: String(facts.summary || "").trim(),

    source_url: sourceUrl,
    official_url: officialUrl,

    purposes,
    industries,
    tags: allTags,

    fiscal_year: String(facts.fiscal_year || "").trim(),

    crawl_status: "draft",
    is_active: false,

    fetched_at: new Date().toISOString(),
  };
};

const insertSubsidy = async (
  supabase: ReturnType<typeof createClient>,
  payload: JsonRecord,
) => {
  const { data, error } = await supabase
    .from("subsidies")
    .insert([payload])
    .select("id,title")
    .single();

  if (error) {
    throw new Error(`DB保存エラー: ${error.message}`);
  }

  return data;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POSTメソッドで呼び出してください。" }, 405);
  }

  try {
    const body = await req.json();
    const authHeader = req.headers.get("Authorization");

    const supabase = getSupabaseClient();

    const urls = extractUrlsFromBody(body);

    const organization =
      typeof body.organization === "string" && body.organization.trim()
        ? body.organization.trim()
        : "愛媛県";

    const titleHint =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "";

    const maxUrls =
      Number(body.maxUrls || body.limit || 0) > 0
        ? Math.min(Number(body.maxUrls || body.limit), 30)
        : 30;

    const targetUrls = urls.slice(0, maxUrls);

    const purposesTags =
      typeof body.purposesTags === "string" && body.purposesTags.trim()
        ? body.purposesTags
        : DEFAULT_PURPOSE_TAGS.join(",");

    const industryTags =
      typeof body.industryTags === "string" && body.industryTags.trim()
        ? body.industryTags
        : DEFAULT_INDUSTRY_TAGS.join(",");

    const force = Boolean(body.force);

    if (targetUrls.length === 0) {
      return jsonResponse(
        {
          error: "処理対象URLがありません。",
          added: 0,
          skipped: 0,
          errors: 0,
          results: [],
          logs: [],
        },
        200,
      );
    }

    const logs: string[] = [];
    const results: ProcessResult[] = [];

    logs.push(`🚀 ${targetUrls.length}件のURL一括収集を開始します！`);

    for (let i = 0; i < targetUrls.length; i += 1) {
      const url = targetUrls[i];

      logs.push(`▶ [${i + 1}/${targetUrls.length}] 処理中: ${url}`);

      try {
        if (!force) {
          const existing = await findExistingSubsidy(supabase, url);

          if (existing) {
            logs.push(
              `⏭ スキップ: 既に登録済みです（${existing.title || existing.id}）`,
            );

            results.push({
              url,
              status: "skipped",
              title: existing.title,
              id: existing.id,
              reason: "既に登録済みです。",
            });

            continue;
          }
        }

        const page = await fetchPageText({
          url,
          title: titleHint,
          organization,
          authHeader,
        });

        if (page.warning) {
          logs.push(`⚠️ ${page.warning}`);
        }

        logs.push(`📄 本文取得成功: ${page.cleanedLength}文字 / via ${page.via}`);

        if (page.sourceText.length < 300) {
          throw new Error(`抽出本文が短すぎます（${page.sourceText.length}文字）。`);
        }

        const extracted = await extractSubsidy({
          extractedText: page.sourceText,
          resolvedUrl: page.resolvedUrl || url,
          title: titleHint,
          organization,
          purposesTags,
          industryTags,
          authHeader,
        });

        const payload = buildInsertPayload({
          facts: extracted.facts,
          tags: extracted.tags,
          finalTitle: extracted.finalTitle,
          resolvedUrl: page.resolvedUrl || url,
        });

        if (!payload.title) {
          throw new Error("タイトルが抽出できませんでした。");
        }

        if (!force) {
          const existingOfficial = await findExistingSubsidy(
            supabase,
            String(payload.official_url || url),
          );

          if (existingOfficial) {
            logs.push(
              `⏭ スキップ: 公式URLが既に登録済みです（${existingOfficial.title || existingOfficial.id}）`,
            );

            results.push({
              url,
              status: "skipped",
              title: existingOfficial.title,
              id: existingOfficial.id,
              reason: "公式URLが既に登録済みです。",
            });

            continue;
          }
        }

        const inserted = await insertSubsidy(supabase, payload);

        logs.push(`✨ 成功: ${inserted.title || payload.title}`);

        results.push({
          url,
          status: "added",
          title: inserted.title || String(payload.title),
          id: inserted.id,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "不明なエラーが発生しました。";

        logs.push(`❌ エラー: ${message}`);

        results.push({
          url,
          status: "error",
          reason: message,
        });
      }
    }

    const added = results.filter((item) => item.status === "added").length;
    const skipped = results.filter((item) => item.status === "skipped").length;
    const errors = results.filter((item) => item.status === "error").length;

    logs.push(
      `🏆 全処理完了！ [追加: ${added}件 | スキップ: ${skipped}件 | エラー: ${errors}件]`,
    );

    return jsonResponse({
      success: true,
      added,
      skipped,
      errors,
      results,
      logs,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "URL一括収集中に不明なエラーが発生しました。",
        added: 0,
        skipped: 0,
        errors: 1,
        results: [],
        logs: [],
      },
      200,
    );
  }
});