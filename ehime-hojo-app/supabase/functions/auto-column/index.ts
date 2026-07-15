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

type ProgramKind = "subsidy" | "incentive" | "benefit" | "loan" | "other";

type OfficialSource = {
  id: string;
  label: string;
  url: string;
  checkedAt: string;
  evidence: string;
};

type SourceFacts = {
  articleType: ArticleType;
  programKind: ProgramKind;
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
  eligibilityConditions: string[];
  calculationMethod: string;
  paymentConditions: string[];
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

const ensureGeneratedInternalLinks = (content = "") => {
  const normalized = normalizeGeneratedInternalLinks(content);
  if (countInternalLinks(normalized) > 0) return normalized;

  return `${normalized}\n<p><strong>関連ページ:</strong> <a href="/ehime-subsidy/">愛媛県の補助金一覧を見る</a>、<a href="/simulator">補助金かんたん診断を使う</a></p>`;
};

const countH2 = (value: string) => (String(value || "").match(/<h2[\s>]/gi) || []).length;

const countTables = (value: string) => (String(value || "").match(/<table[\s>]/gi) || []).length;

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
const industryUnsupportedRe =
  /(建設業、?製造業、?サービス業|建設業・製造業・サービス業|産業廃棄物処理業者|廃棄物処理業者|リサイクル業者)/;
const expenseUnsupportedRe = /(新規設備導入費|研修費|調査費|設備投資|新技術導入|環境対策費)/;
const excludedUnsupportedRe =
  /(中古品|人件費|管理費|着手済み経費).{0,24}(対象外|補助対象外|対象にならない)|(?:対象外|補助対象外).{0,24}(中古品|人件費|管理費|着手済み経費)/;
const fictionalExampleRe =
  /(?:株式会社|有限会社)[A-ZＡ-Ｚ](?:社)?|架空(?:の|事例|企業)|仮想事例|モデルケース|導入効果.{0,60}(?:円|万円|億円)/;
const claimNumberRe = /(補助率|上限額|補助上限|補助額|給付額|助成額|金額|申請締切|締切|公募期間|受付期間|令和\s*\d+\s*年度|20\d{2}\s*年).{0,40}?(%|％|円|万円|千円|令和\s*\d+\s*年|20\d{2}[/-]\d{1,2}|20\d{2}年\d{1,2}月|\d{1,3}\s*\/\s*\d{1,3}|\d+\s*割)/g;
const singleProgramLanguageRe =
  /(この補助金|この制度|上限額が設定されています|一定の補助率が適用されます|令和\s*\d+\s*年度においても実施されています|20\d{2}\s*年においても実施されています)/;

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

const programKindLabels: Record<ProgramKind, string> = {
  subsidy: "補助金・助成金",
  incentive: "奨励金",
  benefit: "給付金・支援金",
  loan: "融資・利子補給",
  other: "その他の支援制度",
};

const sourceFactRequiredByType: Record<ArticleType, string[]> = {
  single_program: ["officialName", "administeringBody", "officialSources", "eligibleApplicants"],
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

const findSubsidyBlockById = (blocks: string[], subsidyId = "") => {
  const normalizedId = String(subsidyId || "").trim();
  if (!normalizedId) return "";
  return blocks.find((block) => extractLabeledValue(block, "ID") === normalizedId) || "";
};

const extractUrlsFromText = (text = "") =>
  Array.from(new Set(String(text || "").match(/https?:\/\/[^\s<>"')]+/g) || []));

const createEmptySourceFacts = (articleType: ArticleType = "feature"): SourceFacts => ({
  articleType,
  programKind: "other",
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
  eligibilityConditions: [],
  calculationMethod: "",
  paymentConditions: [],
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

const detectProgramKind = (
  value: unknown,
  context: { title?: string; content?: string } = {}
): ProgramKind => {
  const raw = textValue(value);
  if (["subsidy", "incentive", "benefit", "loan", "other"].includes(raw)) {
    return raw as ProgramKind;
  }

  const text = `${context.title || ""} ${context.content || ""}`;
  if (/(奨励金|立地奨励|企業立地|雇用奨励|立地促進)/.test(text)) return "incentive";
  if (/(給付金|支援金|手当|商品券|給付事業)/.test(text)) return "benefit";
  if (/(融資|貸付|利子補給|信用保証料|保証料補助)/.test(text)) return "loan";
  if (/(補助金|助成金|補助事業|助成事業)/.test(text)) return "subsidy";
  return "other";
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
  const programKind = detectProgramKind(raw.programKind || raw.program_kind, {
    title: textValue(raw.officialName || raw.official_name),
  });
  return {
    ...createEmptySourceFacts(articleType),
    articleType,
    programKind,
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
    eligibilityConditions: uniqueTextList(raw.eligibilityConditions || raw.eligibility_conditions),
    calculationMethod: textValue(raw.calculationMethod || raw.calculation_method),
    paymentConditions: uniqueTextList(raw.paymentConditions || raw.payment_conditions),
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

const hasFundingDetails = (facts: SourceFacts) =>
  Boolean(facts.subsidyRate || facts.subsidyCap || facts.calculationMethod);

const hasEligibilityDetails = (facts: SourceFacts) =>
  facts.eligibleApplicants.length > 0 || facts.eligibilityConditions.length > 0;

const hasPaymentDetails = (facts: SourceFacts) =>
  facts.paymentConditions.length > 0 || hasFundingDetails(facts);

const getMissingSourceFactFields = (facts: SourceFacts, title = "") => {
  const required = [...(sourceFactRequiredByType[facts.articleType] || sourceFactRequiredByType.feature)];
  if (facts.articleType === "single_program") {
    if (facts.programKind === "subsidy") required.push("eligibleExpenses", "fundingDetails");
    if (facts.programKind === "incentive") required.push("eligibilityConditions", "calculationMethod");
    if (facts.programKind === "benefit") required.push("eligibilityConditions", "paymentConditions");
    if (facts.programKind === "loan") required.push("eligibilityConditions", "fundingDetails");
    if (facts.programKind === "other") required.push("programDetails", "fundingDetails");
  }
  if (amountPromiseRe.test(title)) {
    required.push("officialName", "administeringBody", "officialSources", "fundingDetails");
  }
  if (facts.articleType === "single_program" || yearPromiseRe.test(title) || deadlinePromiseRe.test(title)) required.push("applicationDeadline");
  return Array.from(new Set(required.filter((field) => {
    if (field === "officialSources") return !hasUsableOfficialSource(facts);
    if (field === "fundingDetails") return !hasFundingDetails(facts);
    if (field === "eligibilityConditions") return !hasEligibilityDetails(facts);
    if (field === "paymentConditions") return !hasPaymentDetails(facts);
    if (field === "calculationMethod") return !textValue(facts.calculationMethod || facts.subsidyCap);
    if (field === "programDetails") {
      return !(facts.eligibleProjects.length || facts.eligibilityConditions.length || facts.eligibleExpenses.length);
    }
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
  const selectedBlock = findSubsidyBlockById(blocks, subsidyId) || blocks[0] || officialText;
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
    subsidyRate: existing.subsidyRate || extractLabeledValue(selectedBlock, "補助率"),
    subsidyCap: existing.subsidyCap || extractLabeledValue(selectedBlock, "上限"),
    applicationDeadline: existing.applicationDeadline || extractLabeledValue(selectedBlock, "締切"),
    officialSources,
  };
  const sourceAwareArticleType = articleType === "column" && existing.articleType
    ? existing.articleType
    : articleType || nextFacts.articleType;
  nextFacts.articleType = normalizeArticleType(sourceAwareArticleType, {
    title,
    content: `${content || ""} ${officialText}`,
    category,
  });
  nextFacts.programKind = detectProgramKind(
    existing.programKind === "other" ? "" : existing.programKind,
    { title, content: `${content || ""} ${officialText}` }
  );
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
    ...facts.eligibilityConditions,
    facts.calculationMethod,
    ...facts.paymentConditions,
    ...facts.applicationMethods,
    facts.projectPeriod,
    facts.preStartRule.safeDescription,
    ...facts.officialSources.map((source) => `${source.label} ${source.url} ${source.checkedAt} ${source.evidence}`),
  ].filter(Boolean).join("\n"));

const normalizeClaimText = (value = "") => stripHtml(value).replace(/\s/g, "");

const extractYenAmounts = (value = "") =>
  Array.from(String(value || "").replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*(億円|万円|千円|円)/g))
    .map((match) => {
      const amount = Number(match[1]);
      const multiplier = match[2] === "億円" ? 100000000 : match[2] === "万円" ? 10000 : match[2] === "千円" ? 1000 : 1;
      return Number.isFinite(amount) ? amount * multiplier : null;
    })
    .filter((amount): amount is number => amount !== null);

const hasEquivalentYenAmount = (left = "", right = "") => {
  const leftAmounts = extractYenAmounts(left);
  const rightAmounts = new Set(extractYenAmounts(right));
  return leftAmounts.some((amount) => rightAmounts.has(amount));
};

const claimSupportedByFacts = (claim: string, sourceFacts: SourceFacts, factsText: string) => {
  const normalizedClaim = normalizeClaimText(claim);
  const normalizedFacts = normalizeClaimText(factsText);
  if (normalizedFacts.includes(normalizedClaim)) return true;

  const rate = normalizeClaimText(sourceFacts.subsidyRate);
  const cap = normalizeClaimText(sourceFacts.subsidyCap);
  const start = normalizeClaimText(sourceFacts.applicationStart);
  const deadline = normalizeClaimText(sourceFacts.applicationDeadline);

  if (/補助率/.test(claim) && rate && normalizedClaim.includes(rate)) return true;
  if (
    /(上限額|補助上限|上限)/.test(claim) &&
    cap &&
    (normalizedClaim.includes(cap) || hasEquivalentYenAmount(claim, sourceFacts.subsidyCap))
  ) return true;
  if (/(締切|申請締切|公募期間|受付期間)/.test(claim) && deadline) {
    const monthMatch = normalizedClaim.match(/20\d{2}年\d{1,2}月/);
    if (normalizedClaim.includes(deadline) || (monthMatch && deadline.includes(monthMatch[0]))) return true;
  }
  if (start || deadline) {
    const claimMonths = normalizedClaim.match(/20\d{2}年\d{1,2}月/g) || [];
    const hasStart = Boolean(start && (normalizedClaim.includes(start) || claimMonths.some((month) => start.includes(month))));
    const hasDeadline = Boolean(deadline && (normalizedClaim.includes(deadline) || claimMonths.some((month) => deadline.includes(month))));
    if ((start && deadline && hasStart && hasDeadline) || hasDeadline) return true;
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

  const titlePromisesRate = /補助率/.test(title);
  const titlePromisesNumericCap = /(上限額|補助上限|補助額|給付額|助成額|上限)/.test(title);
  const titlePromisesGenericAmount = /金額/.test(title);
  const missingPromisedFunding =
    (titlePromisesRate && !sourceFacts.subsidyRate) ||
    (titlePromisesNumericCap && !sourceFacts.subsidyCap) ||
    (titlePromisesGenericAmount && !sourceFacts.subsidyCap && !sourceFacts.calculationMethod);
  if (amountPromiseRe.test(title) && missingPromisedFunding) {
    addClaim("タイトルで補助率・上限額を約束しているが、公式ファクトに具体値がありません。", "unsupported", "タイトル安全化が必要です。");
  }
  if (industryUnsupportedRe.test(text) && !industryUnsupportedRe.test(factsText)) {
    addClaim("対象者・対象業種の根拠がない", "unsupported", "suppliedFacts に本文の対象者・対象業種を裏付ける根拠がありません。");
  }
  if (expenseUnsupportedRe.test(text) && !expenseUnsupportedRe.test(factsText)) {
    addClaim("対象経費の根拠がない", "unsupported", "suppliedFacts に本文の対象経費を裏付ける根拠がありません。");
  }
  if (excludedUnsupportedRe.test(text) && !/(中古品|人件費|管理費|着手済み経費)/.test(factsText)) {
    addClaim("対象外経費の根拠がない", "unsupported", "suppliedFacts に本文の対象外経費を裏付ける根拠がありません。");
  }
  const fictionalExample = text.match(fictionalExampleRe)?.[0] || "";
  if (fictionalExample && !factsText.includes(fictionalExample)) {
    addClaim(
      `架空・仮名の事例が含まれています: ${fictionalExample}`,
      "unsupported",
      "suppliedFacts にない企業名、導入事例、試算金額は公開本文へ追加できません。"
    );
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
    const detailTitle = facts.programKind === "subsidy"
      ? `${facts.officialName}の対象者・対象経費と申請前の注意点`
      : `${facts.officialName}の対象者・交付条件と申請前の注意点`;
    return [`${facts.officialName}の確認ポイント`, detailTitle];
  }
  if (/産業廃棄物処理業者|廃棄物処理業者|リサイクル業者/.test(title)) {
    return Array.from(new Set([
      "愛媛県で産業廃棄物処理業者が確認したい補助金・支援制度｜設備更新・再資源化・省エネ対策の探し方",
      "愛媛県の産業廃棄物処理・リサイクル事業者が補助金を探すときの確認ポイント",
      "産業廃棄物処理業者向け補助金を愛媛県内で探す方法と申請前の注意点",
    ]));
  }
  return Array.from(new Set([
    `${base.replace(/向け補助金$/, "向け補助金・支援制度")}の探し方と申請前の注意点`,
    `${base.replace(/補助金$/, "補助金・支援制度")}で確認したい公式情報`,
    `${base.replace(/向け$/, "")}向け支援制度の公式情報確認ポイント`,
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
  const normalizedArticleType = normalizeArticleType(
    articleType === "column" ? sourceFacts.articleType : articleType || sourceFacts.articleType,
    {
      title,
      content: text,
      category: articleData.category || "",
    }
  );
  sourceFacts.articleType = normalizedArticleType;
  const programKind = detectProgramKind(sourceFacts.programKind, { title, content: text });
  sourceFacts.programKind = programKind;
  const requiresExpenseDetails = programKind === "subsidy";
  const hasProgramSpecificDetails = requiresExpenseDetails
    ? targetRe.test(text) && expenseRe.test(text) && excludedExpenseRe.test(text) && projectRe.test(text)
    : targetRe.test(text) && /(対象要件|交付要件|支給要件|立地要件|算定方法|交付条件|支給条件|申請条件)/.test(text);
  const fatalIssues: string[] = [];
  const warnings: string[] = [];
  const strengths: string[] = [];
  const improvementSuggestions: string[] = [];
  const scoreCapsApplied: string[] = [];
  const scoreCapValues: number[] = [];
  const externalOfficialLinks = countExternalOfficialLinks(content);
  const internalLinks = countInternalLinks(content);
  const invalidInternalLinks = getInvalidInternalLinks(content);
  const tableCount = countTables(content);
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
  const missingIdentityFacts = [
    !sourceFacts.officialName ? "正式な制度名" : "",
    !sourceFacts.administeringBody ? "実施機関" : "",
    !hasUsableOfficialSource(sourceFacts) ? "公式URL・根拠メモ" : "",
  ].filter(Boolean);
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
    addFatal(
      "本文が1,500文字未満です。",
      requiresExpenseDetails
        ? "対象者、対象経費、対象外、申請前注意、愛媛県内での探し方を追加してください。"
        : `対象者、${programKindLabels[programKind]}の交付・支給要件、算定方法、申請時期、愛媛県内での確認先を追加してください。`
    );
    addScoreCap(49, "本文が1,500文字未満です。");
  } else if (compactTextLength < 4000) {
    addWarning("本文が4,000文字未満です。", "概要だけで終わらないよう、公式ファクト表、確認項目、申請準備、よくある失敗、愛媛県内での探し方を追加してください。");
    addScoreCap(79, "本文が4,000文字未満です。");
  } else {
    strengths.push("通常コラムの推奨文字数を満たしています。");
  }

  if ((normalizedArticleType === "feature" || articleData.category === "特集") && compactTextLength < 6000) {
    addWarning("特集記事としては6,000文字未満です。", "特集では業種別・用途別の探し方と関連導線を厚めにしてください。");
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
    const titlePromisesRate = /補助率/.test(title);
    const titlePromisesNumericCap = /(上限額|補助上限|補助額|給付額|助成額|上限)/.test(title);
    const titlePromisesGenericAmount = /金額/.test(title);
    const fundingAnswerInBody =
      ((titlePromisesRate || titlePromisesNumericCap) && moneyOrRateRe.test(text)) ||
      (titlePromisesGenericAmount && (moneyOrRateRe.test(text) || /算定方法|算定基準|計算方法/.test(text)));
    const hasAmountEvidence =
      (!titlePromisesRate || sourceFacts.subsidyRate) &&
      (!titlePromisesNumericCap || sourceFacts.subsidyCap) &&
      (!titlePromisesGenericAmount || sourceFacts.subsidyCap || sourceFacts.calculationMethod) &&
      hasOfficialEvidence &&
      amountPromiseRe.test(text) &&
      fundingAnswerInBody &&
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

  if (titlePromisesSpecifics && missingIdentityFacts.length > 0) {
    addFatal(
      `正式な制度名・実施機関・公式URLが確認できません。不足: ${missingIdentityFacts.join("、")}`,
      "補助率・上限額・年度などをタイトルで約束する場合は、正式制度名、実施機関、公式URL、補助率、上限額を suppliedFacts に揃えてください。"
    );
    addScoreCap(39, "強いタイトルに必要な正式制度名・実施機関・公式URLが不足しています。");
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles(title, sourceFacts));
  }

  if (singleProgramLanguageRe.test(text) && (!sourceFacts.officialName || !hasOfficialEvidence)) {
    addFatal(
      "正式な単一制度を特定できないのに「この補助金」など単一制度を前提にした表現があります。",
      "正式制度を特定できない場合は、業種別特集として複数制度の探し方・比較方法に書き換えてください。"
    );
    addScoreCap(39, "正式制度未特定のまま単一制度として書いています。");
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles(title, sourceFacts));
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
  } else if (tableCount < 2) {
    addWarning(
      "表が1つだけです。記事の読み応えを出すため、公式ファクト表と申請前確認表など2つ以上に分けてください。",
      "公式ファクト表、不足情報の確認表、対象経費の確認表、申請前チェック表を追加してください。"
    );
    addScoreCap(79, "表が1つだけです。");
  } else {
    strengths.push("複数の表で情報を整理しています。");
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

  if (!hasProgramSpecificDetails) {
    addFatal(
      requiresExpenseDetails
        ? "対象者・対象経費・対象外になりやすい経費のいずれかが不足しています。"
        : `${programKindLabels[programKind]}として、対象者・交付要件・算定方法または支給条件の説明が不足しています。`
    );
  }

  if (requiresExpenseDetails && !preContractRe.test(text) && !startTimingRe.test(text)) {
    addFatal("契約・発注・購入・着手が可能になる時点について、制度ごとの確認を促す注意がありません。");
    addScoreCap(69, "契約・発注・購入・着手が可能になる時点の注意がありません。");
  }

  if (!ehimeContextRe.test(text)) {
    addFatal("愛媛県・市町村・地域事業者の視点が不足しています。");
  } else {
    strengths.push("愛媛県内の読者向けの文脈があります。");
  }

  if (countH2(content) < 10) {
    addWarning("H2が10個未満です。");
  } else if (countH2(content) > 12) {
    addWarning("H2が13個以上あります。内容の近い節を統合し、各H2を厚くしてください。");
    addScoreCap(79, "H2が13個以上あり、見出しが細分化されすぎています。");
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
    if (unsupportedClaims.some((claim) => /(対象者|対象業種|対象経費|対象外経費)/.test(claim))) {
      addFatal(
        "根拠のない対象者・対象経費・対象外経費が記載されています。",
        "suppliedFacts にない対象者、対象経費、対象外経費は本文から削除し、missingFacts として管理画面で確認してください。"
      );
      addScoreCap(39, "根拠のない対象者・対象経費・対象外経費があります。");
    }
  }

  if (contradictoryClaims.length > 0) {
    addFatal(`公式ファクトと矛盾する可能性がある主張があります: ${contradictoryClaims.join("、")}`);
    addScoreCap(29, "公式情報と矛盾する可能性がある主張があります。");
  }

  const factualGroundingScore = calculateFactualGroundingScore(factualClaims, hasOfficialEvidence);
  const highScoreRequirementsMet =
    compactTextLength >= 4000 &&
    sourceCoverageScore === 100 &&
    factualGroundingScore === 100 &&
    hasProgramSpecificDetails &&
    (!requiresExpenseDetails || preContractRe.test(text) || startTimingRe.test(text)) &&
    hasOfficialRoute &&
    hasOfficialEvidence &&
    ehimeContextRe.test(text) &&
    tableCount >= 2 &&
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

  // 通常の記事生成で返る自己採点は公開判定に使わない。
  // 有料APIレビューを実行した場合だけ意味評価をルール点へ反映する。
  if (!aiReview.llmReview.usedApi) {
    return {
      ...machineReview,
      strengths: Array.from(new Set([...aiReview.strengths, ...machineReview.strengths])),
      improvementSuggestions: Array.from(new Set([
        ...aiReview.improvementSuggestions,
        ...machineReview.improvementSuggestions,
      ])),
      suggestedTitles: Array.from(new Set([...aiReview.suggestedTitles, ...machineReview.suggestedTitles])),
    };
  }

  const fatalIssues = Array.from(new Set([...aiReview.fatalIssues, ...machineReview.fatalIssues]));
  const warnings = Array.from(new Set([...aiReview.warnings, ...machineReview.warnings]));
  const scoreCapsApplied = Array.from(new Set([...aiReview.scoreCapsApplied, ...machineReview.scoreCapsApplied]));
  const scoreCap = scoreCapsApplied.length
    ? Math.min(...scoreCapsApplied.map(extractScoreCap))
    : 100;
  const qualityScore = Math.min(aiReview.llmReview.semanticScore, machineReview.qualityScore, scoreCap);
  const llmReview = aiReview.llmReview.usedApi || aiReview.llmReview.enabled
    ? aiReview.llmReview
    : machineReview.llmReview;
  const factualClaims = [...aiReview.factualClaims, ...machineReview.factualClaims];
  const unsupportedClaims = Array.from(new Set([...aiReview.unsupportedClaims, ...machineReview.unsupportedClaims]));
  const contradictoryClaims = Array.from(new Set([...aiReview.contradictoryClaims, ...machineReview.contradictoryClaims]));
  const titleNeedsRewrite = aiReview.titleNeedsRewrite || machineReview.titleNeedsRewrite;
  const suggestedTitles = Array.from(new Set([...aiReview.suggestedTitles, ...machineReview.suggestedTitles]));
  const publishAllowed =
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
  const semanticProgramInstruction = sourceFacts.programKind === "subsidy"
    ? "対象者・対象事業・対象経費・対象外経費が具体的で、公式ファクトと一致しているか"
    : `${programKindLabels[sourceFacts.programKind]}として、対象者・交付または支給要件・算定方法・申請時期が具体的で、公式ファクトと一致しているか。対象経費の制度でない場合に経費項目を創作していないか`;

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
- ${semanticProgramInstruction}
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

type GeneratedArticleMetrics = {
  textLength: number;
  h2Count: number;
  tableCount: number;
};

const getGeneratedArticleMetrics = (content: string): GeneratedArticleMetrics => ({
  textLength: stripHtml(content).replace(/\s/g, "").length,
  h2Count: (String(content || "").match(/<h2\b/gi) || []).length,
  tableCount: (String(content || "").match(/<table\b/gi) || []).length,
});

const expandGeneratedArticle = async ({
  openAiKey,
  textModel,
  title,
  content,
  articleType,
  sourceFacts,
  qualityReview,
}: {
  openAiKey: string;
  textModel: string;
  title: string;
  content: string;
  articleType: string;
  sourceFacts: SourceFacts;
  qualityReview: ArticleQualityReview;
}) => {
  const requiredLength = articleType === "feature" ? 6000 : 4000;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: textModel,
      temperature: 0.35,
      max_completion_tokens: 12000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "expanded_column_article",
          strict: true,
          schema: {
            type: "object",
            properties: {
              content: { type: "string" },
            },
            required: ["content"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: `
あなたは、えひめ補助金ポータルの長文記事編集者です。
短い初稿を、公式ファクトだけに基づく読み応えのあるHTML記事へ補強してください。

厳守:
- suppliedFacts にない制度名、年度、回次、日付、補助率、上限額、対象者、対象経費、対象外経費、実施機関、公式URLを追加しない。
- suppliedFacts にない企業名、架空事例、モデルケース、導入効果、試算金額を追加しない。「株式会社A」などの仮名事例も禁止する。
- 初稿の正しい説明と公式リンクは維持し、不足する見出し・表・比較・チェックリスト・申請準備の説明だけを厚くする。
- 同じ説明の言い換えや文字数稼ぎをしない。
- H2は10〜12個に絞り、各H2に原則2段落以上の具体的な説明を入れる。薄い見出しを量産しない。
- 表を2つ以上、チェックリスト、CTA、実在する内部リンクを含める。
- 内部リンクは /ehime-subsidy/、/search、/simulator、/experts、/columns、/features、実在する /feature/ 配下だけを使う。
- /subsidy-list は使わない。
- 申請前に契約・発注・購入・着手できる時点は、公式ファクトに根拠がなければ公募要領と実施機関への確認を促す。
- 公開本文へ品質スコア、fatalIssues、warnings、missingFacts、管理用メモを入れない。
- 公式ファクトが不足する項目は具体値を作らず、「公開資料では確認できないため、公式ページまたは実施機関で確認が必要」と明記する。
- 検索順位のための一般論を水増しせず、愛媛県内の読者が対象可否、必要書類、申請前の行動を判断できる内容を優先する。
- AIを活用して情報を整理した下書きであり、公開前に運営者が公式情報を確認すること、制度内容が変わる可能性を末尾で自然に示す。
- 使用HTMLは <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <caption> のみ。
- 本文は最低${requiredLength.toLocaleString()}文字を目安にする。
`.trim(),
        },
        {
          role: "user",
          content: `
タイトル:
${title}

記事タイプ:
${articleType}

suppliedFacts:
${JSON.stringify(sourceFacts, null, 2)}

ルールベース品質レビュー:
${JSON.stringify({
  qualityScore: qualityReview.qualityScore,
  fatalIssues: qualityReview.fatalIssues,
  warnings: qualityReview.warnings,
  missingFacts: qualityReview.missingFacts,
  unsupportedClaims: qualityReview.unsupportedClaims,
  contradictoryClaims: qualityReview.contradictoryClaims,
  improvementSuggestions: qualityReview.improvementSuggestions,
  scoreCapsApplied: qualityReview.scoreCapsApplied,
}, null, 2)}

現在の初稿:
${String(content || "").slice(0, 24000)}
`.trim(),
        },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    return {
      content: "",
      error: json?.error?.message || "記事の自動補強に失敗しました。",
    };
  }

  const rawContent = json?.choices?.[0]?.message?.content;
  if (!rawContent) return { content: "", error: "記事の自動補強結果が空です。" };

  try {
    const parsed = JSON.parse(rawContent);
    return { content: ensureGeneratedInternalLinks(parsed?.content || ""), error: "" };
  } catch {
    return { content: "", error: "記事の自動補強結果を解析できませんでした。" };
  }
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
    const deferEnhancements = body?.deferEnhancements === true;
    const deferImage = body?.deferImage === true;
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
    const requestedSubsidyId =
      typeof body?.subsidy_id === "string" ? body.subsidy_id.trim() : "";
    const suppliedFacts = buildSourceFacts({
      sourceFacts: body?.sourceFacts,
      sourceText,
      subsidiesText,
      title: originalTitle || requestedTitle || title,
      content: originalBody || contentText,
      category: preferredCategory,
      articleType,
      subsidyId: requestedSubsidyId,
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

      if (ruleReview.ruleBasedScore < 80 || !hasUsableOfficialSource(ruleReview.sourceFacts)) {
        return jsonResponse({
          error:
            `APIレビューの前にルールベースの問題を修正してください。` +
            ` ルールスコア: ${ruleReview.ruleBasedScore}/100、` +
            `公式根拠: ${hasUsableOfficialSource(ruleReview.sourceFacts) ? "確認済み" : "不足"}`,
          articleQualityReview: ruleReview,
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
      const repairTextModel = Deno.env.get("OPENAI_TEXT_MODEL")?.trim() || "gpt-4o-mini";

      if (!originalBody || !originalTitle) {
        return jsonResponse({
          error: "修正生成には originalTitle と originalBody が必要です。",
          usedApi: false,
        });
      }

      const currentReview = body?.ruleBasedReview && typeof body.ruleBasedReview === "object"
        ? body.ruleBasedReview as Record<string, unknown>
        : {};
      const repairProgramInstruction = suppliedFacts.programKind === "subsidy"
        ? "対象者、対象事業、対象経費、対象外経費、契約・発注・購入・着手時期を suppliedFacts の範囲で具体化する。"
        : `${programKindLabels[suppliedFacts.programKind]}の記事として、対象者、交付・支給要件、算定方法、申請時期を具体化する。対象経費が suppliedFacts にない場合は対象経費の節を作らない。`;
      const repairRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${repairOpenAiKey}`,
        },
        body: JSON.stringify({
          model: repairTextModel,
          temperature: 0.3,
          max_completion_tokens: 9000,
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
品質レビューの指摘箇所だけを優先して、HTML記事を修正してください。

厳守:
- 正しく書けている見出し・公式ファクト・内部リンクは維持し、全面的な言い換えをしない。
- 文字数、表、見出し、チェックリストなど不足している要素を追加し、根拠不明の箇所だけを削除または安全化する。
- 通常コラムは4,000文字以上、特集記事は6,000文字以上を目安にし、同じ説明の繰り返しで水増ししない。
- H2は10〜12個に絞り、各H2に原則2段落以上の具体的な説明を入れる。
- 公式ファクト表と申請前確認表など、内容の異なる表を2つ以上入れる。
- suppliedFacts にない制度名、年度、補助率、上限額、締切、対象者、対象経費、対象外経費、公式URLを追加しない。
- suppliedFacts にない企業名、架空事例、モデルケース、導入効果、試算金額を追加しない。「株式会社A」などの仮名事例も禁止する。
- 根拠がない具体情報は削除、または「確認が必要」という安全表現に弱める。
- タイトルに補助率・上限額・締切などを入れるのは、suppliedFacts に具体値がある場合だけ。
- 管理用メモ、品質スコア、fatalIssues、warnings、missingFacts、unsupportedClaims を content に入れない。
- 使用HTMLは <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <caption> のみ。
- 表、チェックリスト、内部リンク、CTA、公式確認導線を残す。
- 内部リンクは実在するものだけにする。/subsidy-list は使わず、補助金一覧は /ehime-subsidy/ にする。
- 契約・発注・購入・着手が可能になる時点は、制度ごとに公募要領と実施機関へ確認する安全表現にする。
- ${repairProgramInstruction}
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
        subsidy_id: requestedSubsidyId,
        slug: createSlug(repairedArticle.slug || repairedArticle.title || originalTitle),
        title: repairedArticle.title || originalTitle,
        seo_title: repairedArticle.seo_title || repairedArticle.title || originalTitle,
        meta_description: repairedArticle.meta_description || "",
        thumbnail_text: repairedArticle.thumbnail_text || "Japanese local business subsidy support",
        content: ensureGeneratedInternalLinks(repairedArticle.content || originalBody),
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
    const textModel = Deno.env.get("OPENAI_TEXT_MODEL")?.trim() || "gpt-4o-mini";
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

    const articleLengthInstruction = deferEnhancements
      ? "- このリクエストは第一段階の構造化初稿です。本文は2,500〜3,200文字、H2は6〜8個、表は最低1つにまとめてください。後続の別リクエストで4,000文字以上へ補強します。"
      : "- 通常コラムは最低4,000文字以上、特集記事は6,000文字以上を目安にしてください。";
    const articleStructureInstruction = deferEnhancements
      ? "- 第一段階では必須内容を6〜8個のH2へ整理し、各H2に具体的な説明を入れてください。薄い見出しを量産しないでください。"
      : "- H2は10〜12個を目安にし、各H2に原則2段落以上の具体的な説明を入れてください。薄い見出しを量産しないでください。";
    const tableInstruction = deferEnhancements
      ? "- 第一段階の表は最低1つ入れてください。"
      : "- 表を最低2つ以上入れてください。";
    const programKind = suppliedFacts.programKind;
    const programFactInstruction = programKind === "subsidy"
      ? "- 補助金・助成金として、対象者、対象事業、対象経費、対象外経費、補助率・上限額、契約・発注・購入・着手時期を suppliedFacts の範囲で具体化してください。"
      : `- ${programKindLabels[programKind]}として、対象者、交付・支給要件、算定方法、申請時期を suppliedFacts の範囲で具体化してください。対象経費が suppliedFacts にない場合は対象経費や対象外経費を作らないでください。`;
    const programTimingInstruction = programKind === "subsidy"
      ? "- 申請前に契約・発注・購入・着手しない注意を必ず書いてください。"
      : "- 申請、契約、立地、操業開始、支給判定などの時期は suppliedFacts にある内容だけを書き、不明な場合は公式要綱で確認するよう案内してください。";
    const programRequiredContent = programKind === "subsidy"
      ? "- 対象になる可能性がある人\n- 対象になりやすい経費\n- 対象外・注意が必要な経費"
      : `- 対象になる可能性がある人\n- ${programKindLabels[programKind]}の交付・支給要件\n- 金額の算定方法と申請時期`;

    const systemPrompt = `
あなたは、愛媛県内の中小企業・個人事業主向けに補助金・助成金情報をわかりやすく整理するWebメディアの編集者です。
AIの役割は公開前の下書き作成です。公開前に人間が公式情報、断定表現、独自性を確認する前提で、確認しやすい記事を作ってください。

【重要ルール】
- 読者は愛媛県内の事業者です。
- 公式ページや入力データの要約・言い換えだけで終わらせず、読者が次に判断できる整理を加えてください。
${articleLengthInstruction}
${articleStructureInstruction}
${tableInstruction}
- チェックリスト、CTA、内部リンクを本文に自然に入れてください。
- 使用してよい主な内部リンクは /ehime-subsidy/、/search?keyword=設備投資、/simulator、/experts、/columns、/features、/feature/startup-digital です。
- 存在しない内部URLを作らないでください。/subsidy-list は存在しないため禁止です。補助金一覧へ誘導する場合は /ehime-subsidy/ または /search を使ってください。
${programFactInstruction}
- 公式ファクトで確認できていること、まだ確認が必要なこと、申請準備の流れ、よくある失敗と回避策を独立した見出しで厚めに書いてください。
${programTimingInstruction}
- 愛媛県、市町村、商工会議所、商工会、支援機関など愛媛県内の読者向けの視点を入れてください。
- 文字数稼ぎの一般論、長い前置き、同じ内容の繰り返し、キーワードだけを差し替えた文章は禁止です。
- 入力データにない日付、受付状況、金額、補助率、採択率、企業名、成功事例、URLを作らないでください。
- suppliedFacts にない架空事例、モデルケース、導入効果、試算金額を作らないでください。「株式会社A」などの仮名事例も禁止です。
- suppliedFacts にない制度名、年度、回次、日付、補助率、上限額、対象者、対象経費、対象外経費、実施機関、公式URLを推測で補完しないでください。
- suppliedFacts にない情報は missingFacts として quality_review に返し、本文では断定しないでください。
- 正式な単一制度を特定できない場合は「この補助金」「上限額が設定されています」「一定の補助率が適用されます」など単一制度前提の表現を使わず、業種別・目的別の探し方として構成してください。
- 産業廃棄物処理業者、リサイクル業者、設備投資、新技術導入、環境対策費、人件費、管理費、着手済み経費などの具体項目は、suppliedFacts に根拠がある場合だけ本文に書いてください。
- 公式URLが入力データにある場合は、本文中に必ず公式情報へのリンクを入れてください。
- 公式URLがない場合は、架空URLを作らず「公式ページや自治体窓口で確認」と書いてください。
- タイトルで「補助率」「上限額」「令和8年度」「2026年」などを約束する場合は、本文に具体的な根拠・対象制度名・公式確認導線を必ず入れてください。
- 具体的な補助率・上限額・年度を確認できない場合は、タイトルを「確認したい補助金・支援制度」「探し方と申請前の注意点」など安全な表現にしてください。
- 実在企業の成功事例を断定しないこと。
- 検索順位を目的に一般論を水増しせず、公式情報と愛媛県内の読者が次に判断するための整理を優先すること。
- AIを活用して情報を整理した下書きであること、公開前に運営者が確認すること、制度内容が変更される可能性を末尾の注意書きで自然に示すこと。
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
- 公式ファクトで確認できていること
- まだ確認が必要なこと
${programRequiredContent}
- 申請前に確認すること
- 申請準備の流れ
- よくある失敗と回避策
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
2. 具体性: 15点。制度種別に応じた対象者、対象経費または交付・支給要件、算定方法、申請前注意が具体的で、「詳しくは公式へ」だけで逃げないこと。
3. 公式確認・安全性: 15点。公式確認導線、変更可能性、断定回避、未確認数字の抑制があること。
4. 記事ボリューム: 10点。通常4,000文字以上、特集6,000文字以上を目安にすること。
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
- 制度種別に応じた対象者、対象経費または交付・支給要件、算定方法、注意点が抽象的すぎる
- 愛媛県・市町村・地域事業者の視点がない
- 管理用メモが公開本文に出ている
- 公式情報で確認していない数字を確定情報のように書いている
- 補助金・助成金で、契約・発注・購入・着手が可能になる時点について制度ごとの確認を促していない
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
    const suppliedFactsBlock = isAutoMode
      ? `
【自動選択モードの公式ファクト】
選んだ subsidy_id と同じ ID のデータブロックだけを、その記事の公式ファクトとして使用してください。
別の ID の制度名、機関、対象者、対象経費、上限額、締切、公式URLを混ぜないでください。
選択したブロックにない具体情報は推測せず、quality_review.missingFacts に返してください。
`.trim()
      : `
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

この中から、愛媛県内の事業者にとって記事化する価値が高く、公式URL、実施機関、対象者、対象経費、補助率、上限額、申請期間の情報ができるだけ揃っている制度を1つ選び、公開前確認用のコラム下書きを作成してください。

選んだ制度の ID を subsidy_id に必ず入れてください。
新しさだけで選ばず、公式ファクトの充実度を優先してください。特に補助率または上限額が欠ける制度は、他に情報が揃った候補がある限り選ばないでください。
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
        model: textModel,
        temperature: suppliedFacts.articleType === "single_program" ? 0.3 : 0.7,
        max_completion_tokens: deferEnhancements ? 7000 : 12000,
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

    articleData.subsidy_id = requestedSubsidyId || articleData.subsidy_id || "";
    articleData.title = articleData.title || requestedTitle || title || "補助金に関するお役立ちコラム";
    articleData.slug = createSlug(articleData.slug || articleData.title);
    articleData.seo_title = articleData.seo_title || articleData.title;
    articleData.meta_description = articleData.meta_description || "";
    articleData.thumbnail_text =
      articleData.thumbnail_text || "Japanese small business subsidy support";
    articleData.content =
      ensureGeneratedInternalLinks(
        articleData.content ||
          "<p>現在、記事本文を準備中です。詳細は公式情報をご確認ください。</p>"
      );
    articleData.category = articleData.category || "補助金情報";
    if (preferredCategory) {
      articleData.category = preferredCategory;
    }
    if (isAutoMode && !preferredCategory && articleData.category === "特集") {
      articleData.category = "補助金情報";
    }
    articleData.tags = Array.isArray(articleData.tags) ? articleData.tags : [];
    const autoSourceBlocks = String(subsidiesText || "").split(/\n---\n/).map((block) => block.trim()).filter(Boolean);
    const selectedAutoSourceBlock = isAutoMode
      ? findSubsidyBlockById(autoSourceBlocks, articleData.subsidy_id)
      : "";

    if (isAutoMode && !selectedAutoSourceBlock) {
      return jsonResponse({
        error: `AIが選択した subsidy_id（${articleData.subsidy_id || "未設定"}）に対応する公式データを確認できませんでした。`,
      });
    }

    const articleSourceFacts = isAutoMode
      ? buildSourceFacts({
          subsidiesText: selectedAutoSourceBlock,
          title: articleData.title,
          content: articleData.content,
          category: articleData.category,
          articleType: "single_program",
          subsidyId: articleData.subsidy_id,
        })
      : suppliedFacts;
    const requiredArticleLength = articleType === "feature" || articleData.category === "特集" ? 6000 : 4000;
    const initialArticleMetrics = getGeneratedArticleMetrics(articleData.content);
    const qualityReviewOptions = {
      sourceFacts: articleSourceFacts,
      sourceText,
      subsidiesText,
      subsidyId: articleData.subsidy_id,
    };
    const initialMachineReview = buildMachineQualityReview(articleData, articleType, qualityReviewOptions);
    const shouldExpandArticle =
      !deferEnhancements &&
      (initialArticleMetrics.textLength < requiredArticleLength ||
        initialArticleMetrics.h2Count < 10 ||
        initialArticleMetrics.h2Count > 12 ||
        initialArticleMetrics.tableCount < 2);
    const articleExpansion = {
      attempted: shouldExpandArticle,
      applied: false,
      error: "",
      rejectedReason: "",
      qualityBefore: initialMachineReview.qualityScore,
      qualityAfter: initialMachineReview.qualityScore,
      before: initialArticleMetrics,
      after: initialArticleMetrics,
    };

    if (shouldExpandArticle) {
      const expansionResult = await expandGeneratedArticle({
        openAiKey,
        textModel,
        title: articleData.title,
        content: articleData.content,
        articleType: articleType === "feature" || articleData.category === "特集" ? "feature" : articleType,
        sourceFacts: articleSourceFacts,
        qualityReview: initialMachineReview,
      });

      articleExpansion.error = expansionResult.error;
      if (expansionResult.content) {
        const expandedMetrics = getGeneratedArticleMetrics(expansionResult.content);
        const expandedArticleData = { ...articleData, content: expansionResult.content };
        const expandedReview = buildMachineQualityReview(expandedArticleData, articleType, qualityReviewOptions);
        const rejectionReasons: string[] = [];
        articleExpansion.after = expandedMetrics;
        articleExpansion.qualityAfter = expandedReview.qualityScore;

        if (expandedMetrics.textLength < requiredArticleLength) {
          rejectionReasons.push(`本文が${requiredArticleLength.toLocaleString()}文字に届いていません`);
        }
        if (expandedMetrics.h2Count < 10 || expandedMetrics.h2Count > 12) {
          rejectionReasons.push("H2が10〜12個の範囲ではありません");
        }
        if (expandedMetrics.tableCount < 2) rejectionReasons.push("表が2つ未満です");
        if (expandedReview.unsupportedClaims.length > 0) {
          rejectionReasons.push("根拠不明の主張が残っています");
        }
        if (expandedReview.contradictoryClaims.length > 0) {
          rejectionReasons.push("公式情報と矛盾する可能性が残っています");
        }
        if (expandedReview.qualityScore <= initialMachineReview.qualityScore) {
          rejectionReasons.push("ルールベース品質スコアが改善しませんでした");
        }

        if (rejectionReasons.length === 0) {
          articleData.content = expansionResult.content;
          articleExpansion.applied = true;
        } else {
          articleExpansion.rejectedReason = `${Array.from(new Set(rejectionReasons)).join("、")}。`;
        }
      }
    }

    let articleQualityReview = mergeQualityReviews(
      normalizeAiQualityReview(articleData.quality_review),
      buildMachineQualityReview(articleData, articleType, qualityReviewOptions)
    );

    if (
      !deferEnhancements &&
      isAutoMode &&
      articleQualityReview.ruleBasedScore >= 80 &&
      articleQualityReview.fatalIssues.length === 0 &&
      articleQualityReview.unsupportedClaims.length === 0 &&
      articleQualityReview.contradictoryClaims.length === 0 &&
      hasUsableOfficialSource(articleQualityReview.sourceFacts)
    ) {
      try {
        const llmPayload = await runLlmQualityReview({
          openAiKey,
          articleData,
          articleType,
          sourceFacts: articleQualityReview.sourceFacts,
          ruleBasedReview: articleQualityReview,
        });
        articleQualityReview = mergeRuleAndLlmReview(articleQualityReview, llmPayload);
      } catch (reviewError) {
        console.warn("自動LLM品質レビューを実行できませんでした:", reviewError);
      }
    }
    articleData.quality_review = articleQualityReview;
    const articleQualityWarnings = buildArticleQualityWarnings(articleQualityReview);

    const { base64Image, imageError, imageUrl, imageDebug } = deferEnhancements || deferImage
      ? {
          base64Image: "",
          imageError: "",
          imageUrl: "",
          imageDebug: { deferred: true },
        }
      : await generateImage({
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
      textModel,
      articleExpansion,
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
