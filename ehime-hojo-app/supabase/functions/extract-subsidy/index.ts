import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders } from "./constants.ts";
import type { CandidateSet, ExtractFacts, ExtractResult, JsonRecord } from "./types.ts";
import { inferEhimeAreaFromUrl } from "./municipality.ts";
import { parseJsonSafely, toStringArray, unique } from "./text-utils.ts";
import {
  buildCandidateSet,
  chooseBestAmountText,
  chooseBestRateText,
  chooseOfficialUrl,
  chooseTargetEntities,
  chooseTargetExpenses,
  parseAmountMaxYen,
} from "./extraction-utils.ts";
import {
  determineApplicationStatus,
  extractBestPeriodText,
  isBadApplicationPeriodCandidate,
  normalizeDateToISO,
  parsePeriodDates,
} from "./period-utils.ts";
import {
  clampConfidence,
  makeFieldConfidence,
  makeWarnings,
} from "./confidence-utils.ts";
import { buildPrompt } from "./prompt.ts";
import {
  searchPeriodOnly,
  shouldSearchPeriod,
  type PeriodSearchResult,
} from "./period-search.ts";

const jsonResponse = (body: JsonRecord, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

const filterTags = (selected: unknown, allowedCsv: string) => {
  const allowed = allowedCsv
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const selectedList = toStringArray(selected);

  if (allowed.length === 0) {
    return selectedList.slice(0, 8);
  }

  return selectedList.filter((tag) => allowed.includes(tag)).slice(0, 8);
};

const inferTagsFromText = (text: string, allowedCsv: string) => {
  const allowed = allowedCsv
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return allowed.filter((tag) => text.includes(tag)).slice(0, 8);
};

const detectProgramKind = (value: unknown, text: string): ExtractFacts["program_kind"] => {
  const raw = String(value || "").trim();
  if (["subsidy", "incentive", "benefit", "loan", "other"].includes(raw)) {
    return raw as ExtractFacts["program_kind"];
  }
  if (/(奨励金|立地奨励|企業立地|雇用奨励|立地促進)/.test(text)) return "incentive";
  if (/(給付金|支援金|手当|商品券|給付事業)/.test(text)) return "benefit";
  if (/(融資|貸付|利子補給|信用保証料|保証料補助)/.test(text)) return "loan";
  if (/(補助金|助成金|補助事業|助成事業)/.test(text)) return "subsidy";
  return "other";
};

const callOpenAI = async (prompt: string) => {
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_EXTRACT_MODEL") || "gpt-4o-mini";

  if (!openAiKey) {
    throw new Error("Supabase Secrets に OPENAI_API_KEY が設定されていません。");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "あなたは補助金・助成金・給付金情報の抽出専門AIです。必ず妥当なJSONのみを返してください。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data?.error?.message ||
        data?.message ||
        "OpenAI APIでエラーが発生しました。",
    );
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAIから応答本文が返ってきませんでした。");
  }

  return parseJsonSafely(content) as ExtractResult;
};

const forceRecalculateStatusFromPeriod = (facts: ExtractFacts) => {
  const periodText = String(facts.application_period_text || "").trim();

  if (!periodText || isBadApplicationPeriodCandidate(periodText)) {
    return {
      ...facts,
      application_start_date: null,
      application_end_date: null,
      application_status:
        facts.application_status === "予告" ||
        facts.application_status === "公募中" ||
        facts.application_status === "受付終了"
          ? facts.application_status
          : "不明",
    };
  }

  const periodDates = parsePeriodDates(periodText);

  const startDate = periodDates.start || facts.application_start_date || null;
  const endDate = periodDates.end || facts.application_end_date || null;

  const applicationStatus = determineApplicationStatus({
    periodText,
    startDate,
    endDate,
    aiStatus: "",
  });

  return {
    ...facts,
    application_start_date: startDate,
    application_end_date: endDate,
    application_status: applicationStatus,
  };
};

const postProcessFacts = ({
  aiFacts,
  candidateSet,
  extractedText,
  resolvedUrl,
  editFormTitle,
  org,
}: {
  aiFacts: ExtractFacts;
  candidateSet: CandidateSet;
  extractedText: string;
  resolvedUrl: string;
  editFormTitle: string;
  org: string;
}) => {
  const facts: ExtractFacts = {
    ...aiFacts,
  };

  const evidence: Record<string, string> = {
    ...(typeof aiFacts.evidence === "object" && aiFacts.evidence
      ? (aiFacts.evidence as Record<string, string>)
      : {}),
  };

  let badPeriodCleared = false;

  const bestPeriodText = extractBestPeriodText(
    candidateSet.periodCandidates,
    extractedText,
  );

  if (bestPeriodText) {
    facts.application_period_text = bestPeriodText;
    evidence.application_period_text = bestPeriodText;
  } else if (
    facts.application_period_text &&
    isBadApplicationPeriodCandidate(facts.application_period_text)
  ) {
    facts.application_period_text = "";
    facts.application_start_date = null;
    facts.application_end_date = null;
    evidence.application_period_text = "";
    badPeriodCleared = true;
  }

  const periodText = facts.application_period_text || "";
  const periodDates = parsePeriodDates(periodText);

  if (periodDates.start) {
    facts.application_start_date = periodDates.start;
  } else {
    facts.application_start_date = normalizeDateToISO(
      facts.application_start_date,
    );
  }

  if (periodDates.isOpenEnded) {
    facts.application_end_date = null;
  } else if (periodDates.end) {
    facts.application_end_date = periodDates.end;
  } else {
    facts.application_end_date = normalizeDateToISO(facts.application_end_date);
  }

  facts.application_status = determineApplicationStatus({
    periodText,
    startDate: facts.application_start_date || null,
    endDate: facts.application_end_date || null,
    aiStatus: badPeriodCleared ? "" : facts.application_status || "",
  });

  facts.amount_text = chooseBestAmountText(
    candidateSet.amountCandidates,
    facts.amount_text || "",
  );

  facts.amount_max_yen = parseAmountMaxYen(facts.amount_text || "");

  if (facts.amount_text) {
    evidence.amount_text = facts.amount_text;
  }

  facts.subsidy_rate_text = chooseBestRateText(
    candidateSet.rateCandidates,
    facts.subsidy_rate_text || "",
  );

  if (facts.subsidy_rate_text) {
    evidence.subsidy_rate_text = facts.subsidy_rate_text;
  }

  facts.target_expenses_arr = chooseTargetExpenses(
    candidateSet,
    facts.target_expenses_arr,
  );

  facts.target_entities_arr = chooseTargetEntities(
    candidateSet,
    facts.target_entities_arr,
  );

  facts.program_kind = detectProgramKind(
    facts.program_kind,
    `${facts.title || editFormTitle} ${candidateSet.focusedText}`,
  );
  facts.eligibility_conditions_arr = toStringArray(facts.eligibility_conditions_arr);
  facts.payment_conditions_arr = toStringArray(facts.payment_conditions_arr);
  facts.application_methods_arr = toStringArray(facts.application_methods_arr);
  facts.calculation_method_text = String(facts.calculation_method_text || "").trim();
  facts.pre_start_rule_text = String(facts.pre_start_rule_text || "").trim();

  if (facts.target_expenses_arr.length > 0) {
    evidence.target_expenses_arr = facts.target_expenses_arr.join(" / ");
  }

  if (facts.target_entities_arr.length > 0) {
    evidence.target_entities_arr = facts.target_entities_arr.join(" / ");
  }

  if (facts.eligibility_conditions_arr.length > 0) {
    evidence.eligibility_conditions_arr = facts.eligibility_conditions_arr.join(" / ");
  }
  if (facts.calculation_method_text) {
    evidence.calculation_method_text = facts.calculation_method_text;
  }
  if (facts.payment_conditions_arr.length > 0) {
    evidence.payment_conditions_arr = facts.payment_conditions_arr.join(" / ");
  }
  if (facts.application_methods_arr.length > 0) {
    evidence.application_methods_arr = facts.application_methods_arr.join(" / ");
  }
  if (facts.pre_start_rule_text) {
    evidence.pre_start_rule_text = facts.pre_start_rule_text;
  }

  if (!facts.title) {
    facts.title = candidateSet.titleCandidates[0] || editFormTitle || "";
  }

  if (!facts.organization) {
    facts.organization = org || "";
  }

  if (!facts.region_text) {
    facts.region_text = "愛媛";
  }

  if (!facts.prefecture) {
    facts.prefecture = "愛媛県";
  }

  facts.official_url = chooseOfficialUrl(
    candidateSet.urlCandidates,
    facts.official_url || "",
    resolvedUrl,
  );

  facts.source_url = resolvedUrl || facts.source_url || "";

  if (facts.official_url) {
    evidence.official_url = facts.official_url;
  }

  const inferredArea = inferEhimeAreaFromUrl(
    facts.official_url || facts.source_url || resolvedUrl,
  );

  if (inferredArea) {
    facts.prefecture = inferredArea.prefecture;
    facts.municipality = inferredArea.municipality;
    facts.organization = inferredArea.organization;
    facts.region_text = inferredArea.region_text;

    evidence.organization = `URLドメインから推定: ${inferredArea.organization}`;
    evidence.region_text = `URLドメインから推定: ${inferredArea.region_text}`;
  }

  const recalculatedFacts = forceRecalculateStatusFromPeriod(facts);

  recalculatedFacts.confidence = clampConfidence(recalculatedFacts.confidence, 82);

  recalculatedFacts.evidence = evidence;
  recalculatedFacts.field_confidence = makeFieldConfidence({
    facts: recalculatedFacts,
    evidence,
  });
  recalculatedFacts.warnings = unique([
    ...toStringArray(recalculatedFacts.warnings),
    ...makeWarnings(recalculatedFacts),
  ]);

  return recalculatedFacts;
};

const applyPeriodSearchResult = ({
  facts,
  result,
}: {
  facts: ExtractFacts;
  result: PeriodSearchResult;
}) => {
  if (!result.found) {
    return facts;
  }

  if (!result.application_period_text) {
    return facts;
  }

  if (result.confidence < 75) {
    return facts;
  }

  const currentPeriod = facts.application_period_text || "";
  const currentConfidence = Number(
    facts.field_confidence?.application_period_text || 0,
  );

  const shouldReplace =
    !currentPeriod ||
    isBadApplicationPeriodCandidate(currentPeriod) ||
    currentConfidence < 88 ||
    result.confidence >= currentConfidence;

  if (!shouldReplace) {
    return facts;
  }

  const evidence: Record<string, string> = {
    ...(facts.evidence || {}),
    application_period_text: result.evidence || result.application_period_text,
    application_period_search: `検索補正: ${result.used_query}`,
  };

  const nextFacts: ExtractFacts = {
    ...facts,
    application_period_text: result.application_period_text,
    application_start_date: result.application_start_date,
    application_end_date: result.application_end_date,
    application_status: result.application_status || facts.application_status,
    evidence,
  };

  const recalculatedFacts = forceRecalculateStatusFromPeriod(nextFacts);

  recalculatedFacts.field_confidence = {
    ...(facts.field_confidence || {}),
    application_period_text: Math.max(
      Number(facts.field_confidence?.application_period_text || 0),
      Math.min(98, result.confidence),
    ),
  };

  recalculatedFacts.warnings = unique([
    ...toStringArray(facts.warnings).filter(
      (warning) =>
        !String(warning).includes("申請期間") &&
        !String(warning).includes("終了日"),
    ),
    ...makeWarnings(recalculatedFacts),
  ]);

  return recalculatedFacts;
};

const maybeSearchPeriod = async ({
  facts,
  title,
  organization,
  officialUrl,
}: {
  facts: ExtractFacts;
  title: string;
  organization: string;
  officialUrl: string;
}) => {
  if (!shouldSearchPeriod(facts)) {
    return {
      facts,
      periodSearch: null as PeriodSearchResult | null,
    };
  }

  try {
    const periodSearch = await searchPeriodOnly({
      title,
      organization,
      officialUrl,
      currentFacts: facts,
    });

    return {
      facts: applyPeriodSearchResult({
        facts,
        result: periodSearch,
      }),
      periodSearch,
    };
  } catch {
    return {
      facts,
      periodSearch: null as PeriodSearchResult | null,
    };
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

    const extractedText =
      typeof body?.extractedText === "string" ? body.extractedText.trim() : "";

    const resolvedUrl =
      typeof body?.resolvedUrl === "string" ? body.resolvedUrl.trim() : "";

    const editFormTitle =
      typeof body?.editFormTitle === "string" ? body.editFormTitle.trim() : "";

    const org = typeof body?.org === "string" ? body.org.trim() : "愛媛県";

    const summary =
      typeof body?.summary === "string" ? body.summary.trim() : "";

    const purposesTags =
      typeof body?.purposesTags === "string" ? body.purposesTags : "";

    const industryTags =
      typeof body?.industryTags === "string" ? body.industryTags : "";

    if (!extractedText) {
      return jsonResponse({ error: "解析対象テキストが空です。" }, 200);
    }

    const candidateSet = buildCandidateSet({
      extractedText,
      editFormTitle,
      org,
      resolvedUrl,
    });

    const prompt = buildPrompt({
      candidateSet,
      purposesTags,
      industryTags,
    });

    const aiResult = await callOpenAI(prompt);

    const aiFacts = aiResult?.facts || {};
    const aiTags = aiResult?.tags || { purposes: [], industries: [] };

    let facts = postProcessFacts({
      aiFacts,
      candidateSet,
      extractedText,
      resolvedUrl,
      editFormTitle,
      org,
    });

    if (summary && !facts.summary) {
      facts.summary = summary;
    }

    const periodSearchResult = await maybeSearchPeriod({
      facts,
      title:
        facts.title ||
        aiResult?.finalTitle ||
        candidateSet.titleCandidates[0] ||
        editFormTitle ||
        "",
      organization: facts.organization || org || "",
      officialUrl: facts.official_url || resolvedUrl || "",
    });

    facts = periodSearchResult.facts;

    facts = forceRecalculateStatusFromPeriod(facts);

    facts.field_confidence = makeFieldConfidence({
      facts,
      evidence: facts.evidence || {},
    });

    facts.warnings = unique([
      ...toStringArray(facts.warnings),
      ...makeWarnings(facts),
    ]);

    const textForTagInference = `${candidateSet.focusedText}\n${facts.summary || ""}`;

    const purposes = unique([
      ...filterTags(aiTags.purposes, purposesTags),
      ...inferTagsFromText(textForTagInference, purposesTags),
    ]).slice(0, 8);

    const industries = unique([
      ...filterTags(aiTags.industries, industryTags),
      ...inferTagsFromText(textForTagInference, industryTags),
    ]).slice(0, 8);

    const finalTitle =
      aiResult?.finalTitle ||
      facts.title ||
      candidateSet.titleCandidates[0] ||
      editFormTitle ||
      "";

    return jsonResponse({
      facts,
      tags: {
        purposes,
        industries,
      },
      finalTitle,
      candidate_debug: {
        titleCandidates: candidateSet.titleCandidates,
        periodCandidates: candidateSet.periodCandidates,
        amountCandidates: candidateSet.amountCandidates,
        rateCandidates: candidateSet.rateCandidates,
        targetEntityCandidates: candidateSet.targetEntityCandidates,
        targetExpenseCandidates: candidateSet.targetExpenseCandidates,
        periodSearch: periodSearchResult.periodSearch,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "補助金情報のAI抽出中に不明なエラーが発生しました。",
      },
      200,
    );
  }
});
