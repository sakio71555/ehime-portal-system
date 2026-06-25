import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

const createSlug = (value: string) => {
  const base = String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ぁ-んァ-ン一-龥]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || `column-${Date.now()}`;
};

const stripHtml = (value: string) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractLinks = (value: string) =>
  Array.from(String(value || "").matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => match[1])
    .filter(Boolean);

const countExternalOfficialLinks = (value: string) =>
  extractLinks(value).filter((href) => /^https?:\/\//i.test(href) && !/ehime-hojokin\.jp/i.test(href)).length;

type ArticleType =
  | "single_program"
  | "feature"
  | "feasibility_study"
  | "equipment"
  | "digital"
  | "employment"
  | "research"
  | "marketing";

type OfficialSource = {
  id: string;
  label: string;
  url: string;
  checkedAt: string;
  evidence: string;
};

type SourceFacts = {
  articleType: ArticleType;
  officialName: string;
  fiscalYear: string;
  applicationRound: string;
  administeringBody: string;
  supervisingBody: string;
  applicationStart: string;
  applicationDeadline: string;
  subsidyRate: string;
  subsidyCap: string;
  eligibleApplicants: string[];
  eligibleProjects: string[];
  eligibleExpenses: string[];
  ineligibleExpenses: string[];
  applicationMethods: string[];
  projectPeriod: string;
  preStartRule: {
    confirmed: boolean;
    allowedFrom: string;
    safeDescription: string;
    sourceId: string;
  };
  officialSources: OfficialSource[];
  unknownFields: string[];
};

type FactualClaim = {
  claim: string;
  status: "supported" | "unsupported" | "contradictory" | "unclear";
  sourceIds: string[];
  reason: string;
};

type LlmQualityReview = {
  enabled: boolean;
  usedApi: boolean;
  semanticScore: number;
  titleBodyAlignment: string;
  factualRisk: string;
  searchIntentFit: string;
  reviewerComments: string[];
};

type ArticleQualityReview = {
  qualityScore: number;
  ruleBasedScore: number;
  sourceCoverageScore: number;
  factualGroundingScore: number;
  contentQualityScore: number;
  finalScore: number;
  grade: "A" | "B" | "C" | "D";
  articleType: ArticleType;
  articleTypeLabel: string;
  sourceFacts: SourceFacts;
  missingFacts: string[];
  factualClaims: FactualClaim[];
  unsupportedClaims: string[];
  contradictoryClaims: string[];
  fatalIssues: string[];
  warnings: string[];
  strengths: string[];
  improvementSuggestions: string[];
  scoreCapsApplied: string[];
  titleNeedsRewrite: boolean;
  suggestedTitles: string[];
  publishAllowed: boolean;
  llmReview: LlmQualityReview;
  shouldRegenerate: boolean;
  shouldHumanReview: boolean;
  repairIterations?: number;
};

const clampScore = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const gradeFromScore = (score: number): ArticleQualityReview["grade"] => {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 60) return "C";
  return "D";
};

const uniqueStrings = (items: unknown) =>
  Array.isArray(items)
    ? Array.from(
        new Set(
          items
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
        )
      )
    : [];

const defaultLlmReview = (overrides: Partial<LlmQualityReview> = {}): LlmQualityReview => ({
  enabled: Boolean(overrides.enabled),
  usedApi: Boolean(overrides.usedApi),
  semanticScore: clampScore(overrides.semanticScore || 0),
  titleBodyAlignment: overrides.titleBodyAlignment || "APIレビュー未実行",
  factualRisk: overrides.factualRisk || "APIレビュー未実行",
  searchIntentFit: overrides.searchIntentFit || "APIレビュー未実行",
  reviewerComments: Array.isArray(overrides.reviewerComments)
    ? Array.from(new Set(overrides.reviewerComments.map((item) => String(item || "").trim()).filter(Boolean)))
    : [],
});

const normalizeLlmReview = (value: unknown): LlmQualityReview => {
  if (!value || typeof value !== "object") return defaultLlmReview();
  const review = value as Record<string, unknown>;
  return defaultLlmReview({
    enabled: Boolean(review.enabled),
    usedApi: Boolean(review.usedApi),
    semanticScore: clampScore(review.semanticScore),
    titleBodyAlignment: typeof review.titleBodyAlignment === "string" ? review.titleBodyAlignment : "",
    factualRisk: typeof review.factualRisk === "string" ? review.factualRisk : "",
    searchIntentFit: typeof review.searchIntentFit === "string" ? review.searchIntentFit : "",
    reviewerComments: uniqueStrings(review.reviewerComments),
  });
};

const normalizeFactualClaims = (items: unknown): FactualClaim[] =>
  Array.isArray(items)
    ? items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const claim = item as Record<string, unknown>;
          const status = ["supported", "unsupported", "contradictory", "unclear"].includes(textValue(claim.status))
            ? textValue(claim.status) as FactualClaim["status"]
            : "unclear";
          return {
            claim: textValue(claim.claim),
            status,
            sourceIds: uniqueTextList(claim.sourceIds || claim.source_ids),
            reason: textValue(claim.reason),
          };
        })
        .filter((item): item is FactualClaim => Boolean(item?.claim))
    : [];

const scoreCapText = (maxScore: number, reason: string) => `${maxScore}点上限: ${reason}`;

const extractScoreCap = (value: string) => {
  const match = String(value || "").match(/(\d{1,3})\s*点?上限/);
  return match ? clampScore(match[1]) : 100;
};

const normalizeAiQualityReview = (value: unknown): ArticleQualityReview | null => {
  if (!value || typeof value !== "object") return null;

  const review = value as Record<string, unknown>;
  const qualityScore = clampScore(review.qualityScore);
  const ruleBasedScore = clampScore(review.ruleBasedScore || review.qualityScore);
  const fatalIssues = uniqueStrings(review.fatalIssues);
  const scoreCapsApplied = uniqueStrings(review.scoreCapsApplied);
  const scoreCap = scoreCapsApplied.length
    ? Math.min(...scoreCapsApplied.map(extractScoreCap))
    : 100;
  const cappedQualityScore = Math.min(clampScore(review.finalScore || qualityScore), qualityScore || 100, scoreCap);
  const gradeValue = typeof review.grade === "string" ? review.grade : "";
  const grade = ["A", "B", "C", "D"].includes(gradeValue)
    ? (gradeValue as ArticleQualityReview["grade"])
    : gradeFromScore(cappedQualityScore);
  const sourceFacts = normalizeSourceFacts(review.sourceFacts || review.source_facts);
  const articleType = normalizeArticleType(review.articleType || sourceFacts.articleType);
  sourceFacts.articleType = articleType;
  const factualClaims = normalizeFactualClaims(review.factualClaims);
  const unsupportedClaims = uniqueTextList(
    review.unsupportedClaims ||
      factualClaims.filter((claim) => claim.status === "unsupported").map((claim) => claim.claim)
  );
  const contradictoryClaims = uniqueTextList(
    review.contradictoryClaims ||
      factualClaims.filter((claim) => claim.status === "contradictory").map((claim) => claim.claim)
  );

  return {
    qualityScore: cappedQualityScore,
    ruleBasedScore,
    sourceCoverageScore: clampScore(review.sourceCoverageScore),
    factualGroundingScore: clampScore(review.factualGroundingScore),
    contentQualityScore: clampScore(review.contentQualityScore),
    finalScore: cappedQualityScore,
    grade: gradeFromScore(cappedQualityScore) === grade ? grade : gradeFromScore(cappedQualityScore),
    articleType,
    articleTypeLabel: articleTypeLabels[articleType],
    sourceFacts,
    missingFacts: uniqueTextList(review.missingFacts || sourceFacts.unknownFields),
    factualClaims,
    unsupportedClaims,
    contradictoryClaims,
    fatalIssues,
    warnings: uniqueStrings(review.warnings),
    strengths: uniqueStrings(review.strengths),
    improvementSuggestions: uniqueStrings(review.improvementSuggestions),
    scoreCapsApplied,
    titleNeedsRewrite: Boolean(review.titleNeedsRewrite),
    suggestedTitles: uniqueTextList(review.suggestedTitles),
    publishAllowed: Boolean(
      review.publishAllowed &&
        fatalIssues.length === 0 &&
        unsupportedClaims.length === 0 &&
        contradictoryClaims.length === 0 &&
        cappedQualityScore >= 90
    ),
    llmReview: normalizeLlmReview(review.llmReview),
    shouldRegenerate: Boolean(review.shouldRegenerate || fatalIssues.length > 0 || cappedQualityScore < 80),
    shouldHumanReview: review.shouldHumanReview !== false,
  };
};

const countInternalLinks = (value: string) =>
  extractLinks(value).filter((href) => href.startsWith("/") || /ehime-hojokin\.jp/i.test(href)).length;

const allowedInternalLinkRe =
  /^\/(?:$|[?#]|ehime-subsidy\/?(?:[?#].*)?$|search(?:[?#].*)?$|simulator\/?(?:[?#].*)?$|experts\/?(?:[?#].*)?$|columns\/?(?:[?#].*)?$|features\/?(?:[?#].*)?$|beginners\/?(?:[?#].*)?$|feature\/[a-z0-9-]+\/?(?:[?#].*)?$|purpose\/[a-z0-9-]+\/?(?:[?#].*)?$|area\/[a-z0-9-]+\/?(?:[?#].*)?$|column\/[a-z0-9-]+\/?(?:[?#].*)?$|subsidy\/[0-9]+\/?(?:[?#].*)?$)/i;

const normalizeInternalHrefPath = (href = "") => {
  const value = String(href || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;
  if (/^https?:\/\//i.test(value) && /ehime-hojokin\.jp/i.test(value)) {
    try {
      const url = new URL(value);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return value;
    }
  }
  return "";
};

const getInvalidInternalLinks = (content = "") =>
  Array.from(new Set(
    extractLinks(content)
      .map(normalizeInternalHrefPath)
      .filter(Boolean)
      .filter((href) => !allowedInternalLinkRe.test(href))
  ));

const normalizeGeneratedInternalLinks = (content = "") =>
  String(content || "")
    .replace(/href=(["'])\/subsidy-list\/?\1/gi, 'href=$1/ehime-subsidy/$1')
    .replace(/href=(["'])https:\/\/ehime-hojokin\.jp\/subsidy-list\/?\1/gi, 'href=$1/ehime-subsidy/$1');

const countH2 = (value: string) => (String(value || "").match(/<h2[\s>]/gi) || []).length;

const hasTable = (value: string) => /<table[\s>]|<th[\s>]|<td[\s>]/i.test(value);

const hasChecklist = (value: string) => /チェックリスト|確認リスト|<ul[\s>]|<ol[\s>]/i.test(value);

const yearPromiseRe = /(令和\s*\d+\s*年度|20\d{2}\s*年|2026\s*年|2027\s*年)/;
const amountPromiseRe = /(補助率|上限額|補助上限|補助額|給付額|助成額|金額|上限)/;
const moneyOrRateRe = /(%|％|円|万円|千円|分の[一二三四五六七八九0-9０-９]|[0-9０-９]+\s*\/\s*[0-9０-９]+|[0-9０-９]+\s*割|以内)/;
const officialRe = /(公式|募集要項|公募要領|交付要綱|自治体|実施機関|窓口|申請前|最新情報|確認日)/;
const reviewedDateRe = /(確認日|更新日|掲載日|参照日|閲覧日|令和\s*\d+\s*年\s*\d+\s*月|20\d{2}[/-]\d{1,2}[/-]\d{1,2}|20\d{2}年\d{1,2}月\d{1,2}日)/;
const deadlinePromiseRe = /(締切|期限|申請期間|公募期間|受付期間|募集期間|第\s*[0-9０-９一二三四五六七八九]+\s*次\s*公募)/;
const deadlineDetailRe = /(締切|期限|申請期間|公募期間|受付期間|募集期間|開始|終了|必着|消印有効|令和\s*\d+\s*年\s*\d+\s*月|20\d{2}[/-]\d{1,2}[/-]\d{1,2}|20\d{2}年\d{1,2}月\d{1,2}日)/;
const roundDetailRe = /(第\s*[0-9０-９一二三四五六七八九]+\s*次|一次|二次|三次|四次|公募回|回次)/;
const implementerRe = /(実施機関|所管|事務局|主催|運営主体|自治体|国|県|市|町|村|愛媛県|経済産業省|中小企業庁|商工会議所|商工会)/;
const publicOfferingTitleRe = /(第\s*[0-9０-９一二三四五六七八九]+\s*次\s*公募|令和\s*\d+\s*年度.{0,30}(補助金|助成金|給付金|支援事業|調査事業|補助事業)|[一-龥ぁ-んァ-ンA-Za-z0-9０-９・ー]{6,}(補助金|助成金|給付金|支援事業|調査事業|補助事業))/;
const genericTitleRe = /(一覧|まとめ|探し方|とは|解説|基礎|選び方|向けの補助金|使える補助金|補助金を探す)/;
const fsTitleRe = /(FS\s*調査|フィージビリティ|実現可能性調査|調査事業)/i;
const fsDetailRe = /(調査計画|実現可能性|市場調査|事業化可能性|検証|調査費|専門家|委託調査|報告書|計画策定)/;
const equipmentCenteredRe = /(設備投資|設備導入|機械導入|機器購入|設備購入|購入費|導入費|省エネ設備|生産設備|システム導入)/;
const definiteNumberRe = /(補助率|上限額|補助上限|補助額|給付額|助成額|金額|令和\s*\d+\s*年度|20\d{2}\s*年).{0,24}(です|となります|対象です|支給されます|補助されます|受けられます|使えます|利用できます)/;
const riskyPromiseRe = /(必ず|絶対).{0,12}(対象|採択|受給|支給|受け取|もらえ|通る|使える)|誰でも.{0,12}(対象|もらえ|使える|受給|受け取)/;
const managementMemoRe = /(この記事の作成・確認方針|AIを下書き・整理に活用し、公開前に運営者が|本文内の外部確認リンク|本文内に外部リンクがない場合も|qualityScore|fatalIssues|shouldRegenerate|shouldHumanReview|管理用メモ)/;
const ehimeContextRe = /(愛媛県|県内|松山市|今治市|宇和島市|新居浜市|西条市|大洲市|西予市|八幡浜市|四国中央市|商工会議所|商工会|地域事業者|えひめ補助金ポータル)/;
const preContractRe = /(申請前|交付申請前|交付決定前|事前着手届).{0,60}(契約|発注|購入|着手)|(?:契約|発注|購入|着手).{0,60}(申請前|交付申請前|交付決定前|事前着手届|制度ごと|公募要領|実施機関|確認)/;
const targetRe = /(対象者|対象になる|対象となる|事業者|個人事業主|中小企業|法人|市町村|県内事業者)/;
const expenseRe = /(対象経費|補助対象経費|経費|設備|購入|改修|委託|広告|人件費|旅費|受講費|システム|ソフトウェア|機器)/;
const excludedExpenseRe = /(対象外|対象にならない|対象外経費|注意が必要な経費|補助対象外)/;
const ctaRe = /(相談|診断|探す|確認する|問い合わせ|専門家|シミュレーター|次のステップ|公式ページで確認|補助金を探す|申請前に確認)/;
const projectRe = /(対象事業|補助対象事業|取り組み|取組|事業内容|対象となる事業|支援対象事業)/;
const startTimingRe = /(契約|発注|購入|着手).{0,60}(制度ごと|交付決定前|事前着手|公募要領|実施機関|確認)|(?:交付決定前|事前着手届|公募要領).{0,60}(契約|発注|購入|着手|経費)/;
const industryUnsupportedRe = /(建設業、?製造業、?サービス業|建設業・製造業・サービス業)/;
const expenseUnsupportedRe = /(新規設備導入費|研修費|調査費)/;
const excludedUnsupportedRe = /(中古品|人件費).{0,24}(対象外|補助対象外|対象にならない)|(?:対象外|補助対象外).{0,24}(中古品|人件費)/;
const claimNumberRe = /(補助率|上限額|補助上限|補助額|給付額|助成額|金額|申請締切|締切|公募期間|受付期間|令和\s*\d+\s*年度|20\d{2}\s*年).{0,40}?(%|％|円|万円|千円|令和\s*\d+\s*年|20\d{2}[/-]\d{1,2}|20\d{2}年\d{1,2}月|\d{1,3}\s*\/\s*\d{1,3}|\d+\s*割)/g;

const articleTypeLabels: Record<ArticleType, string> = {
  single_program: "個別制度記事",
  feature: "特集記事",
  feasibility_study: "FS・実現可能性調査",
  equipment: "設備投資",
  digital: "IT・デジタル化",
  employment: "雇用・人材",
  research: "研究開発",
  marketing: "販路開拓",
};

const sourceFactRequiredByType: Record<ArticleType, string[]> = {
  single_program: ["officialName", "administeringBody", "officialSources", "eligibleApplicants", "eligibleExpenses"],
  feature: ["officialSources"],
  feasibility_study: ["officialSources", "eligibleProjects"],
  equipment: ["officialSources", "eligibleExpenses"],
  digital: ["officialSources", "eligibleExpenses"],
  employment: ["officialSources", "eligibleApplicants"],
  research: ["officialSources", "eligibleProjects"],
  marketing: ["officialSources", "eligibleProjects"],
};

const textValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const uniqueTextList = (items: unknown): string[] =>
  Array.isArray(items)
    ? Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)))
    : [];

const splitFactList = (value = "") =>
  Array.from(new Set(String(value || "").split(/[、,\n／/・|]+/).map((item) => item.trim()).filter(Boolean)));

const extractLabeledValue = (text = "", label = "") => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(text || "").match(new RegExp(`${escapedLabel}\\s*[:：]\\s*([^|\\n]+)`, "i"));
  return match ? match[1].trim() : "";
};

const extractUrlsFromText = (text = "") =>
  Array.from(new Set(String(text || "").match(/https?:\/\/[^\s<>"')]+/g) || []));

const createEmptySourceFacts = (articleType: ArticleType = "feature"): SourceFacts => ({
  articleType,
  officialName: "",
  fiscalYear: "",
  applicationRound: "",
  administeringBody: "",
  supervisingBody: "",
  applicationStart: "",
  applicationDeadline: "",
  subsidyRate: "",
  subsidyCap: "",
  eligibleApplicants: [],
  eligibleProjects: [],
  eligibleExpenses: [],
  ineligibleExpenses: [],
  applicationMethods: [],
  projectPeriod: "",
  preStartRule: {
    confirmed: false,
    allowedFrom: "",
    safeDescription: "",
    sourceId: "",
  },
  officialSources: [],
  unknownFields: [],
});

const normalizeArticleType = (value: unknown, context: { title?: string; content?: string; category?: string } = {}): ArticleType => {
  const raw = textValue(value);
  if (["single_program", "feature", "feasibility_study", "equipment", "digital", "employment", "research", "marketing"].includes(raw)) {
    return raw as ArticleType;
  }
  const text = `${context.title || ""} ${context.content || ""} ${context.category || ""}`;
  if (raw === "feature" || context.category === "特集") return "feature";
  if (fsTitleRe.test(text)) return "feasibility_study";
  if (/(設備投資|設備導入|省エネ|太陽光|蓄電池|機械)/.test(text)) return "equipment";
  if (/(IT|DX|デジタル|システム|ソフトウェア|AI|クラウド)/i.test(text)) return "digital";
  if (/(雇用|採用|人材|賃上げ|研修|リスキリング)/.test(text)) return "employment";
  if (/(研究|開発|実証|試作|技術開発)/.test(text)) return "research";
  if (/(販路|販売促進|展示会|広告|PR|マーケティング|売上)/.test(text)) return "marketing";
  if (publicOfferingTitleRe.test(text) && !genericTitleRe.test(text)) return "single_program";
  return "feature";
};

const normalizeOfficialSource = (source: unknown, index: number): OfficialSource => {
  const value = source && typeof source === "object" ? source as Record<string, unknown> : {};
  return {
    id: textValue(value.id) || `source-${index + 1}`,
    label: textValue(value.label) || textValue(value.url) || `公式情報 ${index + 1}`,
    url: textValue(value.url),
    checkedAt: textValue(value.checkedAt || value.checked_at),
    evidence: textValue(value.evidence),
  };
};

const normalizeSourceFacts = (value: unknown): SourceFacts => {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const articleType = normalizeArticleType(raw.articleType || raw.article_type || "feature");
  return {
    ...createEmptySourceFacts(articleType),
    articleType,
    officialName: textValue(raw.officialName || raw.official_name),
    fiscalYear: textValue(raw.fiscalYear || raw.fiscal_year),
    applicationRound: textValue(raw.applicationRound || raw.application_round),
    administeringBody: textValue(raw.administeringBody || raw.administering_body),
    supervisingBody: textValue(raw.supervisingBody || raw.supervising_body),
    applicationStart: textValue(raw.applicationStart || raw.application_start),
    applicationDeadline: textValue(raw.applicationDeadline || raw.application_deadline),
    subsidyRate: textValue(raw.subsidyRate || raw.subsidy_rate),
    subsidyCap: textValue(raw.subsidyCap || raw.subsidy_cap),
    eligibleApplicants: uniqueTextList(raw.eligibleApplicants || raw.eligible_applicants),
    eligibleProjects: uniqueTextList(raw.eligibleProjects || raw.eligible_projects),
    eligibleExpenses: uniqueTextList(raw.eligibleExpenses || raw.eligible_expenses),
    ineligibleExpenses: uniqueTextList(raw.ineligibleExpenses || raw.ineligible_expenses),
    applicationMethods: uniqueTextList(raw.applicationMethods || raw.application_methods),
    projectPeriod: textValue(raw.projectPeriod || raw.project_period),
    preStartRule: {
      confirmed: Boolean((raw.preStartRule as Record<string, unknown> | undefined)?.confirmed || (raw.pre_start_rule as Record<string, unknown> | undefined)?.confirmed),
      allowedFrom: textValue((raw.preStartRule as Record<string, unknown> | undefined)?.allowedFrom || (raw.pre_start_rule as Record<string, unknown> | undefined)?.allowed_from),
      safeDescription: textValue((raw.preStartRule as Record<string, unknown> | undefined)?.safeDescription || (raw.pre_start_rule as Record<string, unknown> | undefined)?.safe_description),
      sourceId: textValue((raw.preStartRule as Record<string, unknown> | undefined)?.sourceId || (raw.pre_start_rule as Record<string, unknown> | undefined)?.source_id),
    },
    officialSources: Array.isArray(raw.officialSources)
      ? (raw.officialSources as unknown[]).map(normalizeOfficialSource)
      : Array.isArray(raw.official_sources)
        ? (raw.official_sources as unknown[]).map(normalizeOfficialSource)
        : [],
    unknownFields: uniqueTextList(raw.unknownFields || raw.unknown_fields),
  };
};

const hasUsableOfficialSource = (facts: SourceFacts) =>
  facts.officialSources.some((source) => source.url && source.evidence && source.evidence.length >= 12);

const getMissingSourceFactFields = (facts: SourceFacts, title = "") => {
  const required = [...(sourceFactRequiredByType[facts.articleType] || sourceFactRequiredByType.feature)];
  if (facts.articleType === "single_program" || amountPromiseRe.test(title)) required.push("subsidyRate", "subsidyCap");
  if (facts.articleType === "single_program" || yearPromiseRe.test(title) || deadlinePromiseRe.test(title)) required.push("applicationDeadline");
  return Array.from(new Set(required.filter((field) => {
    if (field === "officialSources") return !hasUsableOfficialSource(facts);
    const value = (facts as unknown as Record<string, unknown>)[field];
    return Array.isArray(value) ? value.length === 0 : !textValue(value);
  })));
};

const buildSourceFacts = ({
  sourceFacts,
  sourceText,
  subsidiesText,
  title,
  content,
  category,
  articleType,
  subsidyId,
}: {
  sourceFacts?: unknown;
  sourceText?: string;
  subsidiesText?: string;
  title?: string;
  content?: string;
  category?: string;
  articleType?: string;
  subsidyId?: string;
}): SourceFacts => {
  const officialText = stripHtml([sourceText || "", subsidiesText || ""].filter(Boolean).join("\n"));
  const existing = normalizeSourceFacts(sourceFacts || {});
  const blocks = String(subsidiesText || sourceText || "").split(/\n---\n/).map((block) => block.trim()).filter(Boolean);
  const selectedBlock = blocks.find((block) => subsidyId && block.includes(`ID:${subsidyId}`)) || blocks[0] || officialText;
  const urls = extractUrlsFromText(officialText || selectedBlock);
  const officialUrlFromLabel = extractLabeledValue(selectedBlock, "公式URL");
  const officialUrl = officialUrlFromLabel && officialUrlFromLabel !== "なし"
    ? officialUrlFromLabel
    : urls.find((url) => !/ehime-hojokin\.jp/i.test(url)) || "";
  const sourceEvidence = stripHtml(selectedBlock || officialText).replace(officialUrl, "").trim();
  const hasSourceEvidence = sourceEvidence.length >= 24 && /(タイトル|機関|実施機関|概要|対象|経費|上限|締切|募集|公募|確認日|交付要綱|公募要領)/.test(sourceEvidence);
  const officialSources = [...existing.officialSources];
  if (officialUrl && !officialSources.some((source) => source.url === officialUrl)) {
    officialSources.push({
      id: "source-1",
      label: extractLabeledValue(selectedBlock, "タイトル") || "公式情報",
      url: officialUrl,
      checkedAt: extractLabeledValue(officialText, "確認日"),
      evidence: hasSourceEvidence ? sourceEvidence.slice(0, 800) : "",
    });
  }
  const nextFacts: SourceFacts = {
    ...existing,
    officialName: existing.officialName || extractLabeledValue(selectedBlock, "タイトル"),
    administeringBody: existing.administeringBody || extractLabeledValue(selectedBlock, "機関") || extractLabeledValue(officialText, "実施機関"),
    eligibleApplicants: Array.from(new Set([...existing.eligibleApplicants, ...splitFactList(extractLabeledValue(selectedBlock, "対象"))])),
    eligibleExpenses: Array.from(new Set([...existing.eligibleExpenses, ...splitFactList(extractLabeledValue(selectedBlock, "経費"))])),
    subsidyCap: existing.subsidyCap || extractLabeledValue(selectedBlock, "上限"),
    applicationDeadline: existing.applicationDeadline || extractLabeledValue(selectedBlock, "締切"),
    officialSources,
  };
  nextFacts.articleType = normalizeArticleType(articleType || nextFacts.articleType, {
    title,
    content: `${content || ""} ${officialText}`,
    category,
  });
  if (!nextFacts.preStartRule.confirmed && !nextFacts.preStartRule.safeDescription && startTimingRe.test(officialText)) {
    nextFacts.preStartRule.safeDescription = "契約・発注・購入・着手が可能になる時点は、入力素材内の記載をもとに確認が必要です。";
  }
  nextFacts.unknownFields = Array.from(new Set([...nextFacts.unknownFields, ...getMissingSourceFactFields(nextFacts, title || "")]));
  return nextFacts;
};

const sourceFactEvidenceText = (facts: SourceFacts) =>
  stripHtml([
    facts.officialName,
    facts.fiscalYear,
    facts.applicationRound,
    facts.administeringBody,
    facts.supervisingBody,
    facts.applicationStart,
    facts.applicationDeadline,
    facts.subsidyRate,
    facts.subsidyCap,
    ...facts.eligibleApplicants,
    ...facts.eligibleProjects,
    ...facts.eligibleExpenses,
    ...facts.ineligibleExpenses,
    ...facts.applicationMethods,
    facts.projectPeriod,
    facts.preStartRule.safeDescription,
    ...facts.officialSources.map((source) => `${source.label} ${source.url} ${source.checkedAt} ${source.evidence}`),
  ].filter(Boolean).join("\n"));

const normalizeClaimText = (value = "") => stripHtml(value).replace(/\s/g, "");

const claimSupportedByFacts = (claim: string, sourceFacts: SourceFacts, factsText: string) => {
  const normalizedClaim = normalizeClaimText(claim);
  const normalizedFacts = normalizeClaimText(factsText);
  if (normalizedFacts.includes(normalizedClaim)) return true;

  const rate = normalizeClaimText(sourceFacts.subsidyRate);
  const cap = normalizeClaimText(sourceFacts.subsidyCap);
  const deadline = normalizeClaimText(sourceFacts.applicationDeadline);

  if (/補助率/.test(claim) && rate && normalizedClaim.includes(rate)) return true;
  if (/(上限額|補助上限|上限)/.test(claim) && cap && normalizedClaim.includes(cap)) return true;
  if (/(締切|申請締切|公募期間|受付期間)/.test(claim) && deadline) {
    const monthMatch = normalizedClaim.match(/20\d{2}年\d{1,2}月/);
    if (normalizedClaim.includes(deadline) || (monthMatch && deadline.includes(monthMatch[0]))) return true;
  }
  if (rate && cap && normalizedClaim.includes(rate) && normalizedClaim.includes(cap)) return true;
  return false;
};

const buildFactualClaims = (title: string, text: string, sourceFacts: SourceFacts): FactualClaim[] => {
  const factsText = sourceFactEvidenceText(sourceFacts);
  const claims: FactualClaim[] = [];
  const addClaim = (claim: string, status: FactualClaim["status"], reason = "", sourceIds: string[] = []) => {
    claims.push({ claim, status, sourceIds, reason });
  };

  for (const match of Array.from(String(text || "").matchAll(claimNumberRe))) {
    const claim = match[0];
    const supported = claimSupportedByFacts(claim, sourceFacts, factsText);
    addClaim(
      claim,
      supported ? "supported" : "unsupported",
      supported ? "" : "suppliedFacts に同じ金額・日付・補助率の根拠がありません。",
      supported ? ["source-1"] : []
    );
  }

  if (amountPromiseRe.test(title) && (!sourceFacts.subsidyRate || !sourceFacts.subsidyCap)) {
    addClaim("タイトルで補助率・上限額を約束しているが、公式ファクトに具体値がありません。", "unsupported", "タイトル安全化が必要です。");
  }
  if (industryUnsupportedRe.test(text) && !/(建設業|製造業|サービス業)/.test(factsText)) {
    addClaim("対象業種の根拠がない", "unsupported", "suppliedFacts に建設業・製造業・サービス業の根拠がありません。");
  }
  if (expenseUnsupportedRe.test(text) && !/(新規設備導入費|研修費|調査費)/.test(factsText)) {
    addClaim("対象経費の根拠がない", "unsupported", "suppliedFacts に新規設備導入費・研修費・調査費の根拠がありません。");
  }
  if (excludedUnsupportedRe.test(text) && !/(中古品|人件費)/.test(factsText)) {
    addClaim("対象外経費の根拠がない", "unsupported", "suppliedFacts に中古品・人件費を対象外とする根拠がありません。");
  }

  return Array.from(new Map(claims.map((claim) => [`${claim.status}:${claim.claim}`, claim])).values());
};

const calculateSourceCoverageScore = (missingFacts: string[]) =>
  Math.max(0, Math.min(100, 100 - Array.from(new Set(missingFacts)).length * 12));

const calculateFactualGroundingScore = (claims: FactualClaim[], hasOfficialEvidence: boolean) => {
  const unsupportedCount = claims.filter((claim) => claim.status === "unsupported").length;
  const contradictoryCount = claims.filter((claim) => claim.status === "contradictory").length;
  const base = hasOfficialEvidence ? 100 : 60;
  return Math.max(0, Math.min(100, base - unsupportedCount * 20 - contradictoryCount * 35));
};

const suggestSafeTitles = (title: string, facts: SourceFacts) => {
  const theme = title
    .replace(/｜.*$/, "")
    .replace(/令和\s*\d+\s*年度|20\d{2}\s*年|補助率|上限額|補助上限|締切|第\s*[0-9０-９一二三四五六七八九]+\s*次公募/g, "")
    .replace(/[|｜:：]+/g, "")
    .replace(/\s+/g, "")
    .trim();
  const base = theme || facts.officialName || "愛媛県の補助金";
  if (facts.articleType === "single_program" && facts.officialName) {
    return [`${facts.officialName}の確認ポイント`, `${facts.officialName}の対象者・対象経費と申請前の注意点`];
  }
  return Array.from(new Set([
    `${base}の探し方と申請前の注意点`,
    `${base}で確認したい補助金・支援制度`,
    `${base}向け補助金の公式情報確認ポイント`,
  ]));
};

const buildMachineQualityReview = (
  articleData: { title?: string; seo_title?: string; content?: string; category?: string },
  articleType = "feature",
  options: { sourceFacts?: unknown; sourceText?: string; subsidiesText?: string; subsidyId?: string; humanReviewed?: boolean } = {}
): ArticleQualityReview => {
  const title = articleData.title || articleData.seo_title || "";
  const content = articleData.content || "";
  const text = stripHtml(content);
  const compactTextLength = text.replace(/\s/g, "").length;
  const sourceFacts = buildSourceFacts({
    sourceFacts: options.sourceFacts,
    sourceText: options.sourceText,
    subsidiesText: options.subsidiesText,
    title,
    content,
    category: articleData.category || "",
    articleType,
    subsidyId: options.subsidyId,
  });
  const normalizedArticleType = normalizeArticleType(articleType || sourceFacts.articleType, {
    title,
    content: text,
    category: articleData.category || "",
  });
  sourceFacts.articleType = normalizedArticleType;
  const fatalIssues: string[] = [];
  const warnings: string[] = [];
  const strengths: string[] = [];
  const improvementSuggestions: string[] = [];
  const scoreCapsApplied: string[] = [];
  const scoreCapValues: number[] = [];
  const externalOfficialLinks = countExternalOfficialLinks(content);
  const internalLinks = countInternalLinks(content);
  const invalidInternalLinks = getInvalidInternalLinks(content);
  const hasOfficialRoute = externalOfficialLinks > 0 || officialRe.test(text);
  const hasOfficialEvidence = hasUsableOfficialSource(sourceFacts);
  const missingFacts = getMissingSourceFactFields(sourceFacts, title);
  const sourceCoverageScore = calculateSourceCoverageScore(missingFacts);
  const factualClaims = buildFactualClaims(title, text, sourceFacts);
  const unsupportedClaims = Array.from(new Set(factualClaims.filter((claim) => claim.status === "unsupported").map((claim) => claim.claim)));
  const contradictoryClaims = Array.from(new Set(factualClaims.filter((claim) => claim.status === "contradictory").map((claim) => claim.claim)));
  const hasConcretePublicOfferingTitle = publicOfferingTitleRe.test(title) && !genericTitleRe.test(title);
  const titlePromisesSpecifics =
    amountPromiseRe.test(title) || yearPromiseRe.test(title) || deadlinePromiseRe.test(title);
  let titleNeedsRewrite = false;
  const suggestedTitles: string[] = [];

  const addFatal = (message: string, suggestion = "") => {
    fatalIssues.push(message);
    if (suggestion) improvementSuggestions.push(suggestion);
  };

  const addWarning = (message: string, suggestion = "") => {
    warnings.push(message);
    if (suggestion) improvementSuggestions.push(suggestion);
  };

  const addScoreCap = (maxScore: number, reason: string) => {
    scoreCapValues.push(maxScore);
    scoreCapsApplied.push(scoreCapText(maxScore, reason));
  };

  if (compactTextLength < 1500) {
    addFatal("本文が1,500文字未満です。", "対象者、対象経費、対象外、申請前注意、愛媛県内での探し方を追加してください。");
    addScoreCap(49, "本文が1,500文字未満です。");
  } else if (compactTextLength < 3000) {
    addWarning("本文が3,000文字未満です。", "概要だけで終わらないよう、用途別・経費別の見方や次の行動を追加してください。");
    addScoreCap(79, "本文が3,000文字未満です。");
  } else {
    strengths.push("通常コラムの推奨文字数を満たしています。");
  }

  if ((normalizedArticleType === "feature" || articleData.category === "特集") && compactTextLength < 5000) {
    addWarning("特集記事としては5,000文字未満です。", "特集では業種別・用途別の探し方と関連導線を厚めにしてください。");
  }

  if (!hasOfficialEvidence) {
    addWarning("公式URLだけ、または本文内リンクだけでは公式ファクト確認済みとして扱えません。");
    addScoreCap(89, "公式URLと根拠メモが揃っていないため、100点・90点台の上限を制限します。");
  }

  if (missingFacts.length > 0) {
    addWarning(`公式ファクトが不足しています: ${missingFacts.join("、")}`);
  } else {
    strengths.push("公式ファクトの必須項目が揃っています。");
  }

  if (amountPromiseRe.test(title)) {
    const hasAmountEvidence =
      sourceFacts.subsidyRate &&
      sourceFacts.subsidyCap &&
      hasOfficialEvidence &&
      amountPromiseRe.test(text) &&
      moneyOrRateRe.test(text) &&
      officialRe.test(text);
    if (!hasAmountEvidence) {
      addFatal(
        "タイトルで補助率・上限額を約束しているが本文と公式ファクトに具体情報がありません。",
        "具体情報を確認できない場合は、タイトルを「確認ポイント」「探し方」など安全な表現に弱めてください。"
      );
      addScoreCap(39, "タイトルの補助率・上限額・金額の約束に本文が答えていません。");
      titleNeedsRewrite = true;
      suggestedTitles.push(...suggestSafeTitles(title, sourceFacts));
    }
  }

  if (yearPromiseRe.test(title) && (!yearPromiseRe.test(text) || !hasOfficialEvidence)) {
    addFatal("タイトルに年度・年号がありますが、本文で同じ年度の根拠説明が不足しています。");
    addScoreCap(39, "タイトルの年度・年号の約束に本文が答えていません。");
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles(title, sourceFacts));
  }

  if (deadlinePromiseRe.test(title) && (!deadlineDetailRe.test(text) || !hasOfficialEvidence)) {
    addFatal("タイトルに締切・公募回・申請期間がありますが、本文に対応する期間・締切・回次の説明が不足しています。");
    addScoreCap(39, "タイトルの締切・公募回の約束に本文が答えていません。");
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles(title, sourceFacts));
  }

  if (riskyPromiseRe.test(text)) {
    addFatal("補助金の対象・受給を断定する表現があります。", "「対象になる可能性があります」「公式要件の確認が必要です」などに弱めてください。");
  }

  if (managementMemoRe.test(content)) {
    addFatal("管理用メモや品質レビュー用の文言が公開本文に混ざっています。");
    addScoreCap(39, "管理用メモが公開本文に混ざっています。");
  }

  if (!hasOfficialRoute) {
    addFatal("公式ページ・自治体窓口・実施機関への確認導線がありません。");
    addScoreCap(49, "公式情報確認の導線がありません。");
  } else if (externalOfficialLinks === 0) {
    addWarning("本文内に公式ページなどの外部確認リンクがありません。");
  } else {
    strengths.push("公式情報への外部リンクがあります。");
  }

  if (!hasTable(content)) {
    addFatal("表が1つもありません。", "対象者、対象経費、補助率、上限額、注意点などを表で整理してください。");
    addScoreCap(59, "表がありません。");
  } else {
    strengths.push("表で情報を整理しています。");
  }

  if (internalLinks === 0) {
    addFatal("えひめ補助金ポータル内の内部リンクがありません。");
    addScoreCap(59, "内部リンクがありません。");
  } else if (invalidInternalLinks.length > 0) {
    addFatal(`存在しない可能性がある内部リンクがあります: ${invalidInternalLinks.join("、")}`);
    addScoreCap(59, "存在しない可能性がある内部リンクがあります。");
  } else {
    strengths.push("内部リンクがあります。");
  }

  if (!targetRe.test(text) || !expenseRe.test(text) || !excludedExpenseRe.test(text)) {
    addFatal("対象者・対象経費・対象外になりやすい経費のいずれかが不足しています。");
  }

  if (!preContractRe.test(text) && !startTimingRe.test(text)) {
    addFatal("契約・発注・購入・着手が可能になる時点について、制度ごとの確認を促す注意がありません。");
    addScoreCap(69, "契約・発注・購入・着手が可能になる時点の注意がありません。");
  }

  if (!ehimeContextRe.test(text)) {
    addFatal("愛媛県・市町村・地域事業者の視点が不足しています。");
  } else {
    strengths.push("愛媛県内の読者向けの文脈があります。");
  }

  if (countH2(content) < 8) {
    addWarning("H2が8個未満です。");
  }

  if (!hasChecklist(content)) {
    addWarning("チェックリストがありません。");
  }

  if (!ctaRe.test(text)) {
    addWarning("CTAが弱い可能性があります。");
  }

  if (titlePromisesSpecifics && !hasOfficialRoute) {
    addFatal("タイトルに具体的な条件があるのに、公式情報で確認する導線が不足しています。");
    addScoreCap(39, "タイトルの具体情報に対する公式確認導線がありません。");
  }

  if (titlePromisesSpecifics && !hasOfficialEvidence) {
    addFatal("タイトルに具体的な条件があるのに、suppliedFacts に公式根拠がありません。");
    addScoreCap(39, "タイトルの具体情報に対する公式ファクトがありません。");
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles(title, sourceFacts));
  }

  if (normalizedArticleType === "single_program" || hasConcretePublicOfferingTitle) {
    const missingOfferingFields: string[] = [];
    if (!deadlineDetailRe.test(text) || !sourceFacts.applicationDeadline) missingOfferingFields.push("公募期間・締切");
    if (!implementerRe.test(text) || !sourceFacts.administeringBody) missingOfferingFields.push("実施機関");
    if (deadlinePromiseRe.test(title) && !roundDetailRe.test(text)) missingOfferingFields.push("回次");
    if (externalOfficialLinks === 0 || !hasOfficialEvidence) missingOfferingFields.push("公式URL・根拠メモ");
    if (!reviewedDateRe.test(text)) missingOfferingFields.push("確認日");

    if (missingOfferingFields.some((field) => ["公募期間・締切", "実施機関", "公式URL・根拠メモ"].includes(field))) {
      addFatal(`具体的な公募名・制度名の記事として、${missingOfferingFields.join("、")}が不足しています。`);
      addScoreCap(49, "具体的な公募名・制度名に必要な実施機関・公募期間・公式URL・根拠メモが不足しています。");
    }
  }

  if (fsTitleRe.test(`${title} ${text}`) && equipmentCenteredRe.test(text) && !fsDetailRe.test(text)) {
    addFatal("FS調査事業の記事なのに、本文が設備導入・購入中心の説明になっています。");
    addScoreCap(49, "FS調査事業と本文内容がズレています。");
  }

  if ((definiteNumberRe.test(text) || (moneyOrRateRe.test(text) && yearPromiseRe.test(text))) && !hasOfficialEvidence) {
    addFatal("未確認の補助率・上限額・年度情報を確定情報として書いている可能性があります。");
    addScoreCap(39, "未確認の補助率・上限額・年度情報を断定しています。");
  }

  if (unsupportedClaims.length > 0) {
    addFatal(`公式ファクトで裏付けられない具体的主張があります: ${unsupportedClaims.join("、")}`);
    addScoreCap(39, "本文中に根拠不明の金額・日付・対象者・対象経費があります。");
  }

  if (contradictoryClaims.length > 0) {
    addFatal(`公式ファクトと矛盾する可能性がある主張があります: ${contradictoryClaims.join("、")}`);
    addScoreCap(29, "公式情報と矛盾する可能性がある主張があります。");
  }

  const factualGroundingScore = calculateFactualGroundingScore(factualClaims, hasOfficialEvidence);
  const highScoreRequirementsMet =
    compactTextLength >= 3000 &&
    sourceCoverageScore === 100 &&
    factualGroundingScore === 100 &&
    targetRe.test(text) &&
    expenseRe.test(text) &&
    excludedExpenseRe.test(text) &&
    projectRe.test(text) &&
    (preContractRe.test(text) || startTimingRe.test(text)) &&
    hasOfficialRoute &&
    hasOfficialEvidence &&
    ehimeContextRe.test(text) &&
    hasTable(content) &&
    hasChecklist(content) &&
    internalLinks > 0 &&
    invalidInternalLinks.length === 0 &&
    ctaRe.test(text) &&
    !managementMemoRe.test(content) &&
    unsupportedClaims.length === 0 &&
    contradictoryClaims.length === 0 &&
    !((definiteNumberRe.test(text) || moneyOrRateRe.test(text)) && !hasOfficialEvidence);

  if (!highScoreRequirementsMet) {
    addScoreCap(89, "90点以上に必要な強条件をすべて満たしていません。");
  }

  if (!options.humanReviewed) {
    addScoreCap(99, "人間確認完了が確認できないため100点にはしません。");
  }

  const baseScore = Math.max(0, Math.min(100, 100 - fatalIssues.length * 12 - warnings.length * 4));
  const hardScoreCap = scoreCapValues.length ? Math.min(...scoreCapValues) : 100;
  const contentQualityScore = Math.min(baseScore, hardScoreCap);
  const qualityScore = Math.min(baseScore, sourceCoverageScore, factualGroundingScore, hardScoreCap);
  const publishAllowed =
    qualityScore >= 90 &&
    fatalIssues.length === 0 &&
    unsupportedClaims.length === 0 &&
    contradictoryClaims.length === 0 &&
    !titleNeedsRewrite &&
    hasOfficialEvidence;

  return {
    qualityScore,
    ruleBasedScore: qualityScore,
    sourceCoverageScore,
    factualGroundingScore,
    contentQualityScore,
    finalScore: qualityScore,
    grade: gradeFromScore(qualityScore),
    articleType: normalizedArticleType,
    articleTypeLabel: articleTypeLabels[normalizedArticleType],
    sourceFacts: {
      ...sourceFacts,
      unknownFields: Array.from(new Set([...sourceFacts.unknownFields, ...missingFacts])),
    },
    missingFacts: Array.from(new Set(missingFacts)),
    factualClaims,
    unsupportedClaims,
    contradictoryClaims,
    fatalIssues: Array.from(new Set(fatalIssues)),
    warnings: Array.from(new Set(warnings)),
    strengths: Array.from(new Set(strengths)),
    improvementSuggestions: Array.from(new Set(improvementSuggestions)),
    scoreCapsApplied: Array.from(new Set(scoreCapsApplied)),
    titleNeedsRewrite,
    suggestedTitles: Array.from(new Set(suggestedTitles)),
    publishAllowed,
    llmReview: defaultLlmReview(),
    shouldRegenerate: fatalIssues.length > 0 || qualityScore < 80,
    shouldHumanReview: true,
  };
};

const mergeQualityReviews = (
  aiReview: ArticleQualityReview | null,
  machineReview: ArticleQualityReview
): ArticleQualityReview => {
  if (!aiReview) return machineReview;

  const fatalIssues = Array.from(new Set([...aiReview.fatalIssues, ...machineReview.fatalIssues]));
  const warnings = Array.from(new Set([...aiReview.warnings, ...machineReview.warnings]));
  const scoreCapsApplied = Array.from(new Set([...aiReview.scoreCapsApplied, ...machineReview.scoreCapsApplied]));
  const scoreCap = scoreCapsApplied.length
    ? Math.min(...scoreCapsApplied.map(extractScoreCap))
    : 100;
  const qualityScore = Math.min(aiReview.qualityScore, machineReview.qualityScore, scoreCap);
  const llmReview = aiReview.llmReview.usedApi || aiReview.llmReview.enabled
    ? aiReview.llmReview
    : machineReview.llmReview;
  const factualClaims = [...aiReview.factualClaims, ...machineReview.factualClaims];
  const unsupportedClaims = Array.from(new Set([...aiReview.unsupportedClaims, ...machineReview.unsupportedClaims]));
  const contradictoryClaims = Array.from(new Set([...aiReview.contradictoryClaims, ...machineReview.contradictoryClaims]));
  const titleNeedsRewrite = aiReview.titleNeedsRewrite || machineReview.titleNeedsRewrite;
  const suggestedTitles = Array.from(new Set([...aiReview.suggestedTitles, ...machineReview.suggestedTitles]));
  const publishAllowed =
    aiReview.publishAllowed &&
    machineReview.publishAllowed &&
    fatalIssues.length === 0 &&
    unsupportedClaims.length === 0 &&
    contradictoryClaims.length === 0 &&
    !titleNeedsRewrite &&
    qualityScore >= 90;

  return {
    qualityScore,
    ruleBasedScore: machineReview.ruleBasedScore,
    sourceCoverageScore: machineReview.sourceCoverageScore,
    factualGroundingScore: machineReview.factualGroundingScore,
    contentQualityScore: machineReview.contentQualityScore,
    finalScore: qualityScore,
    grade: gradeFromScore(qualityScore),
    articleType: machineReview.articleType,
    articleTypeLabel: machineReview.articleTypeLabel,
    sourceFacts: machineReview.sourceFacts,
    missingFacts: Array.from(new Set([...aiReview.missingFacts, ...machineReview.missingFacts])),
    factualClaims: Array.from(new Map(factualClaims.map((claim) => [`${claim.status}:${claim.claim}`, claim])).values()),
    unsupportedClaims,
    contradictoryClaims,
    fatalIssues,
    warnings,
    strengths: Array.from(new Set([...aiReview.strengths, ...machineReview.strengths])),
    improvementSuggestions: Array.from(new Set([...aiReview.improvementSuggestions, ...machineReview.improvementSuggestions])),
    scoreCapsApplied,
    titleNeedsRewrite,
    suggestedTitles,
    publishAllowed,
    llmReview,
    shouldRegenerate: aiReview.shouldRegenerate || machineReview.shouldRegenerate || fatalIssues.length > 0 || qualityScore < 80,
    shouldHumanReview: true,
  };
};

type LlmReviewPayload = {
  llmReview: LlmQualityReview;
  fatalIssues: string[];
  warnings: string[];
  strengths: string[];
  improvementSuggestions: string[];
  factualClaims: FactualClaim[];
  unsupportedClaims: string[];
  contradictoryClaims: string[];
};

const normalizeLlmReviewPayload = (value: unknown): LlmReviewPayload => {
  if (!value || typeof value !== "object") {
    return {
      llmReview: defaultLlmReview(),
      fatalIssues: [],
      warnings: [],
      strengths: [],
      improvementSuggestions: [],
      factualClaims: [],
      unsupportedClaims: [],
      contradictoryClaims: [],
    };
  }

  const review = value as Record<string, unknown>;
  return {
    llmReview: defaultLlmReview({
      enabled: true,
      usedApi: true,
      semanticScore: clampScore(review.semanticScore),
      titleBodyAlignment: toText(review.titleBodyAlignment),
      factualRisk: toText(review.factualRisk),
      searchIntentFit: toText(review.searchIntentFit),
      reviewerComments: uniqueStrings(review.reviewerComments),
    }),
    fatalIssues: uniqueStrings(review.fatalIssues),
    warnings: uniqueStrings(review.warnings),
    strengths: uniqueStrings(review.strengths),
    improvementSuggestions: uniqueStrings(review.improvementSuggestions),
    factualClaims: normalizeFactualClaims(review.factualClaims),
    unsupportedClaims: uniqueTextList(review.unsupportedClaims),
    contradictoryClaims: uniqueTextList(review.contradictoryClaims),
  };
};

const mergeRuleAndLlmReview = (
  ruleReview: ArticleQualityReview,
  llmPayload: LlmReviewPayload
): ArticleQualityReview => {
  const fatalIssues = Array.from(new Set([...ruleReview.fatalIssues, ...llmPayload.fatalIssues]));
  const warnings = Array.from(new Set([...ruleReview.warnings, ...llmPayload.warnings]));
  const factualClaims = Array.from(new Map([
    ...ruleReview.factualClaims,
    ...llmPayload.factualClaims,
  ].map((claim) => [`${claim.status}:${claim.claim}`, claim])).values());
  const unsupportedClaims = Array.from(new Set([
    ...ruleReview.unsupportedClaims,
    ...llmPayload.unsupportedClaims,
    ...factualClaims.filter((claim) => claim.status === "unsupported").map((claim) => claim.claim),
  ]));
  const contradictoryClaims = Array.from(new Set([
    ...ruleReview.contradictoryClaims,
    ...llmPayload.contradictoryClaims,
    ...factualClaims.filter((claim) => claim.status === "contradictory").map((claim) => claim.claim),
  ]));
  const semanticScore = llmPayload.llmReview.usedApi && llmPayload.llmReview.semanticScore > 0
    ? llmPayload.llmReview.semanticScore
    : 100;
  const scoreCap = ruleReview.scoreCapsApplied.length
    ? Math.min(...ruleReview.scoreCapsApplied.map(extractScoreCap))
    : 100;
  const qualityScore = Math.min(ruleReview.ruleBasedScore, semanticScore, scoreCap);
  const publishAllowed =
    ruleReview.publishAllowed &&
    fatalIssues.length === 0 &&
    unsupportedClaims.length === 0 &&
    contradictoryClaims.length === 0 &&
    qualityScore >= 90;

  return {
    qualityScore,
    ruleBasedScore: ruleReview.ruleBasedScore,
    sourceCoverageScore: ruleReview.sourceCoverageScore,
    factualGroundingScore: ruleReview.factualGroundingScore,
    contentQualityScore: ruleReview.contentQualityScore,
    finalScore: qualityScore,
    grade: gradeFromScore(qualityScore),
    articleType: ruleReview.articleType,
    articleTypeLabel: ruleReview.articleTypeLabel,
    sourceFacts: ruleReview.sourceFacts,
    missingFacts: ruleReview.missingFacts,
    factualClaims,
    unsupportedClaims,
    contradictoryClaims,
    fatalIssues,
    warnings,
    strengths: Array.from(new Set([...ruleReview.strengths, ...llmPayload.strengths])),
    improvementSuggestions: Array.from(new Set([
      ...ruleReview.improvementSuggestions,
      ...llmPayload.improvementSuggestions,
    ])),
    scoreCapsApplied: ruleReview.scoreCapsApplied,
    titleNeedsRewrite: ruleReview.titleNeedsRewrite,
    suggestedTitles: ruleReview.suggestedTitles,
    publishAllowed,
    llmReview: llmPayload.llmReview,
    shouldRegenerate: fatalIssues.length > 0 || qualityScore < 80,
    shouldHumanReview: true,
  };
};

const runLlmQualityReview = async ({
  openAiKey,
  articleData,
  articleType,
  sourceFacts,
  ruleBasedReview,
}: {
  openAiKey: string;
  articleData: { title?: string; seo_title?: string; content?: string; category?: string };
  articleType: string;
  sourceFacts: SourceFacts;
  ruleBasedReview: ArticleQualityReview;
}): Promise<LlmReviewPayload> => {
  const reviewModel = Deno.env.get("OPENAI_QUALITY_REVIEW_MODEL")?.trim() || "gpt-4o-mini";
  const articleText = stripHtml(articleData.content || "").slice(0, 12000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: reviewModel,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "column_quality_semantic_review",
          strict: true,
          schema: {
            type: "object",
            properties: {
              semanticScore: { type: "number" },
              titleBodyAlignment: { type: "string" },
              factualRisk: { type: "string" },
              searchIntentFit: { type: "string" },
              reviewerComments: { type: "array", items: { type: "string" } },
              factualClaims: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    claim: { type: "string" },
                    status: { type: "string", enum: ["supported", "unsupported", "contradictory", "unclear"] },
                    sourceIds: { type: "array", items: { type: "string" } },
                    reason: { type: "string" },
                  },
                  required: ["claim", "status", "sourceIds", "reason"],
                  additionalProperties: false,
                },
              },
              unsupportedClaims: { type: "array", items: { type: "string" } },
              contradictoryClaims: { type: "array", items: { type: "string" } },
              fatalIssues: { type: "array", items: { type: "string" } },
              warnings: { type: "array", items: { type: "string" } },
              strengths: { type: "array", items: { type: "string" } },
              improvementSuggestions: { type: "array", items: { type: "string" } },
            },
            required: [
              "semanticScore",
              "titleBodyAlignment",
              "factualRisk",
              "searchIntentFit",
              "reviewerComments",
              "factualClaims",
              "unsupportedClaims",
              "contradictoryClaims",
              "fatalIssues",
              "warnings",
              "strengths",
              "improvementSuggestions",
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `
あなたは、えひめ補助金ポータルの公開前品質レビュー担当です。
本文を書き換えず、管理画面用のレビューだけを返してください。

評価する観点:
- 検索意図との一致
- タイトルと本文の整合性
- 制度内容との整合性
- FS調査事業なのに設備導入費の記事になっていないか
- 公式情報の扱いが安全か
- 補助率・上限額・年度・締切などを根拠なく断定していないか
- 対象者・対象経費・対象外経費が具体的か
- 愛媛県内の事業者向けの地域性があるか
- SEO記事として読み応えがあるか
- 管理用メモが混入していないか
- 本文中の具体的主張が suppliedFacts と照合できるか

unsupported または contradictory の具体的主張があれば factualClaims、unsupportedClaims、contradictoryClaims に入れてください。
ルールベースのスコア上限は絶対に上書きしない前提で、意味・事実面のレビューだけを返してください。

semanticScore は0〜100の整数です。公開前に人間確認すべきリスクがあれば fatalIssues または warnings に入れてください。
`.trim(),
        },
        {
          role: "user",
          content: `
記事種別: ${articleType}
カテゴリ: ${articleData.category || ""}
タイトル: ${articleData.title || articleData.seo_title || ""}

suppliedFacts:
${JSON.stringify(sourceFacts, null, 2)}

ruleBasedReview:
${JSON.stringify({
  finalScore: ruleBasedReview.finalScore,
  sourceCoverageScore: ruleBasedReview.sourceCoverageScore,
  factualGroundingScore: ruleBasedReview.factualGroundingScore,
  fatalIssues: ruleBasedReview.fatalIssues,
  warnings: ruleBasedReview.warnings,
  missingFacts: ruleBasedReview.missingFacts,
  unsupportedClaims: ruleBasedReview.unsupportedClaims,
  contradictoryClaims: ruleBasedReview.contradictoryClaims,
  scoreCapsApplied: ruleBasedReview.scoreCapsApplied,
}, null, 2)}

本文:
${articleText}
`.trim(),
        },
      ],
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error?.message || "LLM品質レビューに失敗しました。");
  }

  const rawContent = json?.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM品質レビューの結果が空です。");

  return normalizeLlmReviewPayload(JSON.parse(rawContent));
};

const buildArticleQualityWarnings = (review: ArticleQualityReview) => {
  return [...review.fatalIssues, ...review.warnings];
};

const toText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const imageQualityOrDefault = (value: string) => {
  const quality = value.trim();
  return ["low", "medium", "high", "auto"].includes(quality) ? quality : "medium";
};

const imageSizeOrDefault = (value: string) => {
  const size = value.trim();
  return ["1024x1024", "1536x1024", "1024x1536", "auto"].includes(size) ? size : "1536x1024";
};

const buildImagePrompt = ({
  theme,
  title,
  category,
  articleType,
  contentContext,
}: {
  theme: string;
  title: string;
  category: string;
  articleType: string;
  contentContext: string;
}) => `
Create a high-quality editorial hero image for a Japanese subsidy and grant information article.

Article:
- Title: ${title || theme}
- Category: ${category || "補助金情報"}
- Type: ${articleType || "column"}
- Theme: ${theme}
- Context: ${contentContext}

Visual direction:
- Premium Japanese web media thumbnail, calm and trustworthy
- Soft editorial illustration with a refined public-service feeling
- Local Ehime atmosphere, small business support, consultation, documents, planning, community, or public assistance
- Warm but restrained colors: ivory, deep teal, soft orange, muted blue, gentle green
- Clean 16:9 composition with clear focal point and generous whitespace
- Modern, polished, not childish, not clip-art, not a flyer, not a poster
- Suitable for a government-adjacent subsidy information portal

Strict constraints:
- No text
- No Japanese characters
- No letters, numbers, logos, watermarks, signs, screenshots, UI panels, or fake documents with readable text
- Do not create distorted currency symbols or giant yen marks
- Avoid extra fingers, distorted hands, uncanny faces, or celebrity-like people
- Avoid crowded collage layouts and over-saturated colors
`.trim();

const outputImageItem = (imageJson: Record<string, unknown>) => {
  const output = Array.isArray(imageJson?.output) ? imageJson.output : [];
  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== "object") continue;
    const content = Array.isArray((outputItem as Record<string, unknown>).content)
      ? ((outputItem as Record<string, unknown>).content as unknown[])
      : [];
    const imageItem = content.find(
      (item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "output_image"
    );
    if (imageItem && typeof imageItem === "object") {
      return imageItem as Record<string, unknown>;
    }
  }
  return null;
};

const nestedImageValue = (item: Record<string, unknown> | null, key: string) => {
  if (!item) return "";
  const image = item.image;
  if (image && typeof image === "object") {
    return toText((image as Record<string, unknown>)[key]);
  }
  return "";
};

const extractImageBase64 = (imageJson: Record<string, unknown>) => {
  const firstData = Array.isArray(imageJson?.data) && imageJson.data[0]
    ? imageJson.data[0] as Record<string, unknown>
    : null;
  const outputImage = outputImageItem(imageJson);

  return (
    toText(firstData?.b64_json) ||
    nestedImageValue(firstData, "b64_json") ||
    toText(outputImage?.b64_json) ||
    nestedImageValue(outputImage, "b64_json")
  );
};

const extractImageUrl = (imageJson: Record<string, unknown>) => {
  const firstData = Array.isArray(imageJson?.data) && imageJson.data[0]
    ? imageJson.data[0] as Record<string, unknown>
    : null;
  const outputImage = outputImageItem(imageJson);

  return (
    toText(firstData?.url) ||
    nestedImageValue(firstData, "url") ||
    toText(outputImage?.url) ||
    nestedImageValue(outputImage, "url")
  );
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const buildImageDebug = (imageJson: Record<string, unknown>, response: Response) => {
  const firstData = Array.isArray(imageJson?.data) && imageJson.data[0]
    ? imageJson.data[0] as Record<string, unknown>
    : null;
  const error = imageJson?.error && typeof imageJson.error === "object"
    ? toText((imageJson.error as Record<string, unknown>).message)
    : null;

  return {
    ok: response.ok,
    status: response.status,
    hasDataArray: Array.isArray(imageJson?.data),
    dataLength: Array.isArray(imageJson?.data) ? imageJson.data.length : 0,
    firstKeys: firstData ? Object.keys(firstData) : [],
    hasB64: Boolean(toText(firstData?.b64_json) || nestedImageValue(firstData, "b64_json")),
    b64Length: (toText(firstData?.b64_json) || nestedImageValue(firstData, "b64_json")).length,
    hasUrl: Boolean(toText(firstData?.url) || nestedImageValue(firstData, "url")),
    error,
  };
};

const generateImage = async ({
  openAiKey,
  imageModel,
  imageQuality,
  imageSize,
  imageTheme,
  imageTitle,
  imageCategory,
  articleType,
  contentContext,
}: {
  openAiKey: string;
  imageModel: string;
  imageQuality: string;
  imageSize: string;
  imageTheme: string;
  imageTitle: string;
  imageCategory: string;
  articleType: string;
  contentContext: string;
}) => {
  let base64Image = "";
  let imageError = "";
  let imageUrl = "";
  let imageDebug: Record<string, unknown> | null = null;

  try {
    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: imageModel,
        prompt: buildImagePrompt({
          theme: imageTheme,
          title: imageTitle,
          category: imageCategory,
          articleType,
          contentContext,
        }),
        n: 1,
        size: imageSize,
        quality: imageQuality,
        output_format: "png",
      }),
    });

    const imageJson = await imageRes.json();
    imageDebug = buildImageDebug(imageJson, imageRes);
    console.log("column image generation response summary", {
      ...imageDebug,
      imageModel,
      imageQuality,
      imageSize,
    });

    if (imageRes.ok) {
      base64Image = extractImageBase64(imageJson);
      imageUrl = extractImageUrl(imageJson);
      if (!base64Image && imageUrl) {
        try {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            base64Image = arrayBufferToBase64(await imageResponse.arrayBuffer());
          } else {
            imageError = `画像URLの取得に失敗しました。status: ${imageResponse.status}`;
          }
        } catch (err) {
          imageError = err instanceof Error ? err.message : "画像URLの取得に失敗しました。";
        }
      }
      if (!base64Image) {
        imageError = imageError || "画像生成APIは成功しましたが、画像データが返りませんでした。";
      }
    } else {
      imageError =
        imageJson?.error?.message ||
        "OpenAIでの画像生成に失敗しました。";
      console.warn("画像生成エラー:", imageError);
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "画像生成処理で不明なエラーが発生しました。";
    imageError = message;
    console.warn("画像生成処理でエラー:", message);
  }

  return { base64Image, imageError, imageUrl, imageDebug };
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

    const title =
      typeof body?.title === "string" ? body.title.trim() : "";
    const requestedTitle =
      typeof body?.requestedTitle === "string" ? body.requestedTitle.trim() : "";
    const sourceText =
      typeof body?.sourceText === "string" ? body.sourceText.trim() : "";

    const subsidiesText =
      typeof body?.subsidiesText === "string" ? body.subsidiesText.trim() : "";
    const articleType =
      typeof body?.articleType === "string" ? body.articleType.trim() : "column";
    const preferredCategory =
      typeof body?.category === "string" ? body.category.trim() : "";
    const extraInstructions =
      typeof body?.extraInstructions === "string"
        ? body.extraInstructions.trim()
        : "";
    const imageOnly = body?.imageOnly === true;
    const qualityReviewOnly = body?.qualityReviewOnly === true;
    const repairArticleOnly = body?.repairArticleOnly === true;
    const useLlmReview = body?.useLlmReview === true;
    const confirmUsePaidApi = body?.confirmUsePaidApi === true;
    const thumbnailText =
      typeof body?.thumbnailText === "string" ? body.thumbnailText.trim() : "";
    const contentText =
      typeof body?.content === "string" ? body.content.trim() : "";
    const originalBody =
      typeof body?.originalBody === "string" ? body.originalBody.trim() : "";
    const originalTitle =
      typeof body?.originalTitle === "string" ? body.originalTitle.trim() : "";
    const suppliedFacts = buildSourceFacts({
      sourceFacts: body?.sourceFacts,
      sourceText,
      subsidiesText,
      title: originalTitle || requestedTitle || title,
      content: originalBody || contentText,
      category: preferredCategory,
      articleType,
      subsidyId: typeof body?.subsidy_id === "string" ? body.subsidy_id : "",
    });

    if (qualityReviewOnly) {
      const reviewArticleData = {
        title,
        seo_title: typeof body?.seo_title === "string" ? body.seo_title.trim() : "",
        content: contentText,
        category: preferredCategory,
      };
      const ruleReview = buildMachineQualityReview(reviewArticleData, articleType, {
        sourceFacts: suppliedFacts,
        sourceText,
        subsidiesText,
      });

      if (!useLlmReview) {
        return jsonResponse({
          articleQualityReview: ruleReview,
          articleQualityWarnings: buildArticleQualityWarnings(ruleReview),
          sourceFacts: ruleReview.sourceFacts,
          usedApi: false,
        });
      }

      if (!confirmUsePaidApi) {
        return jsonResponse({
          error: "LLM品質レビューを実行するには、confirmUsePaidApi を true にしてください。",
          articleQualityReview: {
            ...ruleReview,
            llmReview: defaultLlmReview({
              enabled: true,
              usedApi: false,
              reviewerComments: ["APIレビューは確認フラグがないため未実行です。"],
            }),
          },
          articleQualityWarnings: buildArticleQualityWarnings(ruleReview),
          sourceFacts: ruleReview.sourceFacts,
          usedApi: false,
        });
      }

      const reviewOpenAiKey = Deno.env.get("OPENAI_API_KEY");

      if (!reviewOpenAiKey) {
        return jsonResponse({
          error: "Supabase Secrets に OPENAI_API_KEY が設定されていないため、LLM品質レビューは実行できません。",
          articleQualityReview: {
            ...ruleReview,
            llmReview: defaultLlmReview({
              enabled: true,
              usedApi: false,
              reviewerComments: ["APIキー未設定のため、ルールベース採点のみ実行しました。"],
            }),
          },
          articleQualityWarnings: buildArticleQualityWarnings(ruleReview),
          sourceFacts: ruleReview.sourceFacts,
          usedApi: false,
        });
      }

      const llmPayload = await runLlmQualityReview({
        openAiKey: reviewOpenAiKey,
        articleData: reviewArticleData,
        articleType,
        sourceFacts: ruleReview.sourceFacts,
        ruleBasedReview: ruleReview,
      });
      const articleQualityReview = mergeRuleAndLlmReview(ruleReview, llmPayload);

      return jsonResponse({
        articleQualityReview,
        articleQualityWarnings: buildArticleQualityWarnings(articleQualityReview),
        sourceFacts: articleQualityReview.sourceFacts,
        usedApi: true,
      });
    }

    if (repairArticleOnly) {
      if (!confirmUsePaidApi) {
        return jsonResponse({
          error: "修正生成を実行するには、confirmUsePaidApi を true にしてください。",
          usedApi: false,
        });
      }

      const repairIteration = Math.max(1, Math.min(2, Number(body?.repairIteration || 1)));
      if (repairIteration > 2) {
        return jsonResponse({
          error: "自動修正は最大2回までです。",
          usedApi: false,
        });
      }

      const repairOpenAiKey = Deno.env.get("OPENAI_API_KEY");
      if (!repairOpenAiKey) {
        return jsonResponse({
          error: "Supabase Secrets に OPENAI_API_KEY が設定されていないため、修正生成は実行できません。",
          usedApi: false,
        });
      }

      if (!originalBody || !originalTitle) {
        return jsonResponse({
          error: "修正生成には originalTitle と originalBody が必要です。",
          usedApi: false,
        });
      }

      const currentReview = body?.ruleBasedReview && typeof body.ruleBasedReview === "object"
        ? body.ruleBasedReview as Record<string, unknown>
        : {};
      const repairRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${repairOpenAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "column_article_repair",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  seo_title: { type: "string" },
                  meta_description: { type: "string" },
                  thumbnail_text: { type: "string" },
                  content: { type: "string" },
                  category: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                },
                required: ["title", "seo_title", "meta_description", "thumbnail_text", "content", "category", "tags"],
                additionalProperties: false,
              },
            },
          },
          messages: [
            {
              role: "system",
              content: `
あなたは、えひめ補助金ポータルの公開前編集者です。
品質レビューの指摘を反映して、HTML記事を修正してください。

厳守:
- suppliedFacts にない制度名、年度、補助率、上限額、締切、対象者、対象経費、対象外経費、公式URLを追加しない。
- 根拠がない具体情報は削除、または「確認が必要」という安全表現に弱める。
- タイトルに補助率・上限額・締切などを入れるのは、suppliedFacts に具体値がある場合だけ。
- 管理用メモ、品質スコア、fatalIssues、warnings、missingFacts、unsupportedClaims を content に入れない。
- 使用HTMLは <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <caption> のみ。
- 表、チェックリスト、内部リンク、CTA、公式確認導線を残す。
- 内部リンクは実在するものだけにする。/subsidy-list は使わず、補助金一覧は /ehime-subsidy/ にする。
- 契約・発注・購入・着手が可能になる時点は、制度ごとに公募要領と実施機関へ確認する安全表現にする。
`.trim(),
            },
            {
              role: "user",
              content: `
originalTitle:
${originalTitle}

originalBody:
${originalBody.slice(0, 16000)}

suppliedFacts:
${JSON.stringify(suppliedFacts, null, 2)}

qualityReview:
${JSON.stringify({
  fatalIssues: currentReview.fatalIssues || [],
  missingFacts: currentReview.missingFacts || [],
  unsupportedClaims: currentReview.unsupportedClaims || [],
  contradictoryClaims: currentReview.contradictoryClaims || [],
  improvementSuggestions: currentReview.improvementSuggestions || [],
  scoreCapsApplied: currentReview.scoreCapsApplied || [],
  suggestedTitles: currentReview.suggestedTitles || [],
}, null, 2)}
`.trim(),
            },
          ],
        }),
      });

      const repairJson = await repairRes.json();
      if (!repairRes.ok) {
        return jsonResponse({
          error: repairJson?.error?.message || "OpenAIでの修正生成に失敗しました。",
          usedApi: true,
        });
      }

      const repairContent = repairJson?.choices?.[0]?.message?.content;
      if (!repairContent) {
        return jsonResponse({ error: "修正生成の結果が空です。", usedApi: true });
      }

      let repairedArticle: {
        title: string;
        seo_title: string;
        meta_description: string;
        thumbnail_text: string;
        content: string;
        category: string;
        tags: string[];
        slug?: string;
      };

      try {
        repairedArticle = JSON.parse(repairContent);
      } catch {
        return jsonResponse({ error: "修正生成の返却JSONを解析できませんでした。", usedApi: true });
      }

      const articleData = {
        subsidy_id: typeof body?.subsidy_id === "string" ? body.subsidy_id : "",
        slug: createSlug(repairedArticle.slug || repairedArticle.title || originalTitle),
        title: repairedArticle.title || originalTitle,
        seo_title: repairedArticle.seo_title || repairedArticle.title || originalTitle,
        meta_description: repairedArticle.meta_description || "",
        thumbnail_text: repairedArticle.thumbnail_text || "Japanese local business subsidy support",
        content: normalizeGeneratedInternalLinks(repairedArticle.content || originalBody),
        category: repairedArticle.category || preferredCategory || "補助金情報",
        tags: Array.isArray(repairedArticle.tags) ? repairedArticle.tags : [],
      };
      const articleQualityReview = buildMachineQualityReview(articleData, articleType, {
        sourceFacts: suppliedFacts,
        sourceText,
        subsidiesText,
      });

      return jsonResponse({
        articleData: {
          ...articleData,
          quality_review: {
            ...articleQualityReview,
            repairIterations: repairIteration,
          },
        },
        articleQualityReview: {
          ...articleQualityReview,
          repairIterations: repairIteration,
        },
        articleQualityWarnings: buildArticleQualityWarnings(articleQualityReview),
        sourceFacts: articleQualityReview.sourceFacts,
        usedApi: true,
      });
    }

    if (imageOnly && !title && !thumbnailText && !contentText) {
      return jsonResponse(
        { error: "画像生成用のタイトルまたは本文が指定されていません。" },
        200
      );
    }

    if (!imageOnly && !title && !subsidiesText) {
      return jsonResponse(
        { error: "タイトル、または補助金データが指定されていません。" },
        200
      );
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiKey) {
      return jsonResponse(
        { error: "Supabase Secrets に OPENAI_API_KEY が設定されていません。" },
        200
      );
    }

    const isAutoMode = Boolean(subsidiesText);
    const imageModel = Deno.env.get("OPENAI_IMAGE_MODEL")?.trim() || "gpt-image-1";
    const imageQuality = imageQualityOrDefault(Deno.env.get("OPENAI_IMAGE_QUALITY") || "medium");
    const imageSize = imageSizeOrDefault(Deno.env.get("OPENAI_IMAGE_SIZE") || "1536x1024");

    if (imageOnly) {
      const fallbackTheme = stripHtml(contentText).slice(0, 180);
      const imageTheme =
        thumbnailText ||
        title ||
        fallbackTheme ||
        "Ehime subsidy support and local business assistance";
      const { base64Image, imageError, imageUrl, imageDebug } = await generateImage({
        openAiKey,
        imageModel,
        imageQuality,
        imageSize,
        imageTheme,
        imageTitle: title,
        imageCategory: preferredCategory,
        articleType,
        contentContext: fallbackTheme,
      });

      return jsonResponse({
        base64Image,
        imageError,
        imageUrl,
        imageDebug,
        imageModel,
        imageQuality,
        imageSize,
      });
    }

    const systemPrompt = `
あなたは、愛媛県内の中小企業・個人事業主向けに補助金・助成金情報をわかりやすく整理するWebメディアの編集者です。
AIの役割は公開前の下書き作成です。公開前に人間が公式情報、断定表現、独自性を確認する前提で、確認しやすい記事を作ってください。

【重要ルール】
- 読者は愛媛県内の事業者です。
- 公式ページや入力データの要約・言い換えだけで終わらせず、読者が次に判断できる整理を加えてください。
- 通常コラムは最低3,000文字以上、特集記事は5,000文字以上を目安にしてください。
- H2を8個以上入れてください。
- 表を最低1つ、できれば2つ以上入れてください。
- チェックリスト、CTA、内部リンクを本文に自然に入れてください。
- 使用してよい主な内部リンクは /ehime-subsidy/、/search?keyword=設備投資、/simulator、/experts、/columns、/features、/feature/startup-digital です。
- 存在しない内部URLを作らないでください。/subsidy-list は存在しないため禁止です。補助金一覧へ誘導する場合は /ehime-subsidy/ または /search を使ってください。
- 対象者、対象経費、対象外になりやすい経費、申請前注意を具体的に書いてください。
- 申請前に契約・発注・購入・着手しない注意を必ず書いてください。
- 愛媛県、市町村、商工会議所、商工会、支援機関など愛媛県内の読者向けの視点を入れてください。
- 文字数稼ぎの一般論、長い前置き、同じ内容の繰り返し、キーワードだけを差し替えた文章は禁止です。
- 入力データにない日付、受付状況、金額、補助率、採択率、企業名、成功事例、URLを作らないでください。
- suppliedFacts にない制度名、年度、回次、日付、補助率、上限額、対象者、対象経費、対象外経費、実施機関、公式URLを推測で補完しないでください。
- suppliedFacts にない情報は missingFacts として quality_review に返し、本文では断定しないでください。
- 公式URLが入力データにある場合は、本文中に必ず公式情報へのリンクを入れてください。
- 公式URLがない場合は、架空URLを作らず「公式ページや自治体窓口で確認」と書いてください。
- タイトルで「補助率」「上限額」「令和8年度」「2026年」などを約束する場合は、本文に具体的な根拠・対象制度名・公式確認導線を必ず入れてください。
- 具体的な補助率・上限額・年度を確認できない場合は、タイトルを「確認したい補助金・支援制度」「探し方と申請前の注意点」など安全な表現にしてください。
- 実在企業の成功事例を断定しないこと。
- 「必ず採択される」「必ず受給できる」などの断定表現を避けること。
- 初心者にもわかりやすい日本語にすること。
- 本文はHTMLで出力すること。
- 使用してよいHTMLタグは <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <caption> のみ。
- 本文の最後に、必ず公式情報確認を促す自然な注意書きを入れること。
- 公開本文に、品質スコア、自己採点、fatalIssues、warnings、shouldRegenerate、管理用メモを混ぜないこと。
- 「この記事の作成・確認方針」「本文内の外部確認リンク」「本文内に外部リンクがない場合も」という管理文言を本文に出さないこと。
- 画像プロンプトには「文字を入れない」指定を含めること。
- 追加指示がある場合は、法令・事実・安全性に反しない範囲で必ず本文に反映すること。

【本文に必ず入れる内容】
- 冒頭の結論
- この記事でわかること
- 対象になる可能性がある人
- 対象になりやすい経費
- 対象外・注意が必要な経費
- 申請前に確認すること
- 業種別または用途別の見方
- 愛媛県内での探し方
- 公式情報の確認先
- 注意点
- 内部リンク
- CTA
- 愛媛県内の読者が次に取る行動
- まとめ

【100点満点の品質基準】
1. 検索意図との一致: 15点。読者が知りたい答えに早く到達し、タイトルと本文がズレていないこと。
2. 具体性: 15点。対象者、対象経費、対象外、申請前注意が具体的で、「詳しくは公式へ」だけで逃げないこと。
3. 公式確認・安全性: 15点。公式確認導線、変更可能性、断定回避、未確認数字の抑制があること。
4. 記事ボリューム: 10点。通常3,000文字以上、特集5,000文字以上を目安にすること。
5. 愛媛県向けの地域性: 10点。県内事業者、市町村、商工会議所、商工会、支援機関の視点があること。
6. 読みやすさ: 10点。H2/H3、表、チェックリスト、CTAが自然であること。
7. SEO内部リンク: 10点。関連検索、特集、シミュレーター、専門家導線につながること。
8. 独自性・読み応え: 10点。業種別・用途別・経費別の見方と次の行動があること。
9. NG表現チェック: 5点。断定、管理用メモ、タイトルと本文の不一致がないこと。

【致命的NG】
- タイトルに補助率・上限額・令和年度・2026年などの具体情報があるのに、本文に具体的な根拠・説明がない
- 必ず対象になる、必ず受け取れる、必ず使えるなどと断定している
- 公式確認導線がない
- 本文が1,500文字未満
- 表が1つもない
- 内部リンクが1つもない
- /subsidy-list など存在しない内部リンクがある
- 対象者・対象経費・注意点が抽象的すぎる
- 愛媛県・市町村・地域事業者の視点がない
- 管理用メモが公開本文に出ている
- 公式情報で確認していない数字を確定情報のように書いている
- 契約・発注・購入・着手が可能になる時点について、制度ごとの確認を促していない
- 本文中の金額・日付・対象者・対象経費・対象外経費に、公式ファクトで裏付けられない具体的主張がある

【品質レビュー】
- quality_review は管理画面表示用です。content には絶対に混ぜないでください。
- qualityScore は0〜100の整数で自己採点してください。
- ruleBasedScore は qualityScore と同じ整数を入れてください。最終的にはシステム側のルールベース採点で補正します。
- grade は A / B / C / D のいずれかです。
- 90点以上: A、80〜89点: B、60〜79点: C、60点未満: D。
- fatalIssues が1つでもある場合、shouldRegenerate は true、shouldHumanReview は true にしてください。
- 80点未満は shouldRegenerate true にしてください。
- scoreCapsApplied は必ず配列で返してください。該当がなければ空配列にしてください。
- llmReview は別の任意APIレビュー用です。記事生成時は enabled:false、usedApi:false、semanticScore:0、各コメントは「APIレビュー未実行」にしてください。
- sourceCoverageScore、factualGroundingScore、contentQualityScore、finalScore、missingFacts、unsupportedClaims、contradictoryClaims、titleNeedsRewrite、suggestedTitles、publishAllowed を返してください。
- unsupportedClaims または contradictoryClaims がある場合は publishAllowed:false、shouldRegenerate:true にしてください。

【出力JSON】
次のキーだけを持つJSONを返してください。

{
  "subsidy_id": "自動生成の場合は選んだ補助金のID。手動タイトル生成の場合は空文字",
  "slug": "URL用スラッグ。英数字とハイフンのみ",
  "title": "記事タイトル",
  "seo_title": "SEOタイトル。32文字前後",
  "meta_description": "メタディスクリプション。120文字前後",
  "thumbnail_text": "画像生成用の英語プロンプト。20単語以内。文字・数字なしの絵にする",
  "content": "HTML本文",
  "category": "カテゴリ名",
  "tags": ["タグ1", "タグ2"],
  "quality_review": {
    "qualityScore": 0,
    "ruleBasedScore": 0,
    "grade": "A",
    "fatalIssues": ["致命的NG"],
    "warnings": ["注意点"],
    "strengths": ["良い点"],
    "improvementSuggestions": ["改善提案"],
    "scoreCapsApplied": ["39点上限: 理由"],
    "llmReview": {
      "enabled": false,
      "usedApi": false,
      "semanticScore": 0,
      "titleBodyAlignment": "APIレビュー未実行",
      "factualRisk": "APIレビュー未実行",
      "searchIntentFit": "APIレビュー未実行",
      "reviewerComments": []
    },
    "shouldRegenerate": true,
    "shouldHumanReview": true
  }
}

【カテゴリ候補】
特集、基礎知識、用語解説、農業支援、IT・デジタル、設備投資、販路開拓、創業支援、事業承継、人材育成、補助金情報
`;

    const extraInstructionBlock = extraInstructions
      ? `
【必ず反映したい文章・観点】
${extraInstructions}
`
      : "";
    const suppliedFactsBlock = `
【構造化済み公式ファクト suppliedFacts】
${JSON.stringify(suppliedFacts, null, 2)}

【記事タイプ】
${suppliedFacts.articleType}

【重要】
制度名、年度、回次、補助率、上限額、締切、対象者、対象経費、対象外経費、実施機関、公式URLは suppliedFacts に含まれる情報だけを使ってください。
suppliedFacts にない具体情報は推測せず、quality_review.missingFacts に返してください。
`.trim();

    const userPrompt = isAutoMode
      ? `
以下は、現在公開中の補助金データです。

この中から、愛媛県内の事業者にとって記事化する価値が高く、公式URLや申請前の判断材料を本文に入れやすい制度を1つ選び、公開前確認用のコラム下書きを作成してください。

選んだ制度の ID を subsidy_id に必ず入れてください。
公式URLがある制度を優先してください。公式URLがない制度を選ぶ場合は、本文内で公式確認先が未確認であることを明記してください。

【補助金データ】
${subsidiesText}

${suppliedFactsBlock}
${extraInstructionBlock}
`
      : `
以下のテーマで、補助金・助成金に関する公開前確認用のコラム下書きを作成してください。

【テーマ】
${requestedTitle || title}

${sourceText ? `【公式情報・素材メモ】\n${sourceText}` : ""}

${suppliedFactsBlock}

${articleType === "feature"
  ? `
この記事はトップページの「人気の特集から探す」に表示する特集記事です。
通常のコラムよりも、対象読者・探せる制度・次に取る行動・公式確認先がすぐ分かる構成にしてください。
category は必ず「特集」にしてください。
`
  : ""}
${preferredCategory ? `希望カテゴリ：${preferredCategory}` : ""}
${extraInstructionBlock}
`;

    const articleRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "column_article",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subsidy_id: { type: "string" },
                slug: { type: "string" },
                title: { type: "string" },
                seo_title: { type: "string" },
                meta_description: { type: "string" },
                thumbnail_text: { type: "string" },
                content: { type: "string" },
                category: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                },
                quality_review: {
                  type: "object",
	                  properties: {
	                    qualityScore: { type: "number" },
	                    ruleBasedScore: { type: "number" },
	                    sourceCoverageScore: { type: "number" },
	                    factualGroundingScore: { type: "number" },
	                    contentQualityScore: { type: "number" },
	                    finalScore: { type: "number" },
	                    grade: { type: "string", enum: ["A", "B", "C", "D"] },
	                    articleType: {
	                      type: "string",
	                      enum: [
	                        "single_program",
	                        "feature",
	                        "feasibility_study",
	                        "equipment",
	                        "digital",
	                        "employment",
	                        "research",
	                        "marketing",
	                      ],
	                    },
	                    missingFacts: {
	                      type: "array",
	                      items: { type: "string" },
	                    },
	                    factualClaims: {
	                      type: "array",
	                      items: {
	                        type: "object",
	                        properties: {
	                          claim: { type: "string" },
	                          status: { type: "string", enum: ["supported", "unsupported", "contradictory", "unclear"] },
	                          sourceIds: {
	                            type: "array",
	                            items: { type: "string" },
	                          },
	                          reason: { type: "string" },
	                        },
	                        required: ["claim", "status", "sourceIds", "reason"],
	                        additionalProperties: false,
	                      },
	                    },
	                    unsupportedClaims: {
	                      type: "array",
	                      items: { type: "string" },
	                    },
	                    contradictoryClaims: {
	                      type: "array",
	                      items: { type: "string" },
	                    },
	                    fatalIssues: {
	                      type: "array",
                      items: { type: "string" },
                    },
                    warnings: {
                      type: "array",
                      items: { type: "string" },
                    },
                    strengths: {
                      type: "array",
                      items: { type: "string" },
                    },
	                    improvementSuggestions: {
	                      type: "array",
	                      items: { type: "string" },
	                    },
	                    scoreCapsApplied: {
	                      type: "array",
	                      items: { type: "string" },
	                    },
	                    titleNeedsRewrite: { type: "boolean" },
	                    suggestedTitles: {
	                      type: "array",
	                      items: { type: "string" },
	                    },
	                    publishAllowed: { type: "boolean" },
	                    llmReview: {
	                      type: "object",
	                      properties: {
	                        enabled: { type: "boolean" },
	                        usedApi: { type: "boolean" },
	                        semanticScore: { type: "number" },
	                        titleBodyAlignment: { type: "string" },
	                        factualRisk: { type: "string" },
	                        searchIntentFit: { type: "string" },
	                        reviewerComments: {
	                          type: "array",
	                          items: { type: "string" },
	                        },
	                      },
	                      required: [
	                        "enabled",
	                        "usedApi",
	                        "semanticScore",
	                        "titleBodyAlignment",
	                        "factualRisk",
	                        "searchIntentFit",
	                        "reviewerComments",
	                      ],
	                      additionalProperties: false,
	                    },
	                    shouldRegenerate: { type: "boolean" },
	                    shouldHumanReview: { type: "boolean" },
	                  },
	                  required: [
	                    "qualityScore",
	                    "ruleBasedScore",
	                    "sourceCoverageScore",
	                    "factualGroundingScore",
	                    "contentQualityScore",
	                    "finalScore",
	                    "grade",
	                    "articleType",
	                    "missingFacts",
	                    "factualClaims",
	                    "unsupportedClaims",
	                    "contradictoryClaims",
	                    "fatalIssues",
	                    "warnings",
	                    "strengths",
	                    "improvementSuggestions",
	                    "scoreCapsApplied",
	                    "titleNeedsRewrite",
	                    "suggestedTitles",
	                    "publishAllowed",
	                    "llmReview",
	                    "shouldRegenerate",
	                    "shouldHumanReview",
	                  ],
                  additionalProperties: false,
                },
              },
              required: [
                "subsidy_id",
                "slug",
                "title",
                "seo_title",
                "meta_description",
                "thumbnail_text",
                "content",
                "category",
                "tags",
                "quality_review",
              ],
              additionalProperties: false,
            },
          },
        },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    const articleJson = await articleRes.json();

    if (!articleRes.ok) {
      return jsonResponse(
        {
          error:
            articleJson?.error?.message ||
            "OpenAIでの記事生成に失敗しました。",
        },
        200
      );
    }

    const rawContent = articleJson?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return jsonResponse(
        { error: "OpenAIから記事本文が返ってきませんでした。" },
        200
      );
    }

    let articleData: {
      subsidy_id: string;
      slug: string;
      title: string;
      seo_title: string;
      meta_description: string;
      thumbnail_text: string;
      content: string;
      category: string;
      tags: string[];
      quality_review?: ArticleQualityReview;
    };

    try {
      articleData = JSON.parse(rawContent);
    } catch {
      return jsonResponse(
        { error: "OpenAIの返却JSONを解析できませんでした。" },
        200
      );
    }

    articleData.subsidy_id = articleData.subsidy_id || "";
    articleData.title = articleData.title || requestedTitle || title || "補助金に関するお役立ちコラム";
    articleData.slug = createSlug(articleData.slug || articleData.title);
    articleData.seo_title = articleData.seo_title || articleData.title;
    articleData.meta_description = articleData.meta_description || "";
    articleData.thumbnail_text =
      articleData.thumbnail_text || "Japanese small business subsidy support";
    articleData.content =
      normalizeGeneratedInternalLinks(
        articleData.content ||
          "<p>現在、記事本文を準備中です。詳細は公式情報をご確認ください。</p>"
      );
    articleData.category = articleData.category || "補助金情報";
    if (preferredCategory) {
      articleData.category = preferredCategory;
    }
    articleData.tags = Array.isArray(articleData.tags) ? articleData.tags : [];
    const articleQualityReview = mergeQualityReviews(
      normalizeAiQualityReview(articleData.quality_review),
      buildMachineQualityReview(articleData, articleType, {
        sourceFacts: suppliedFacts,
        sourceText,
        subsidiesText,
        subsidyId: articleData.subsidy_id,
      })
    );
    articleData.quality_review = articleQualityReview;
    const articleQualityWarnings = buildArticleQualityWarnings(articleQualityReview);

    const { base64Image, imageError, imageUrl, imageDebug } = await generateImage({
      openAiKey,
      imageModel,
      imageQuality,
      imageSize,
      imageTheme: articleData.thumbnail_text,
      imageTitle: articleData.title,
      imageCategory: articleData.category,
      articleType,
      contentContext: stripHtml(articleData.content).slice(0, 280),
    });

    return jsonResponse({
      articleData,
      articleQualityReview,
      articleQualityWarnings,
      base64Image,
      imageError,
      imageUrl,
      imageDebug,
      imageModel,
      imageQuality,
      imageSize,
      sourceFacts: articleQualityReview.sourceFacts,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "不明なエラーが発生しました。",
      },
      200
    );
  }
});
