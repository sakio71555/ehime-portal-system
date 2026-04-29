import { OPEN_ENDED_PATTERN } from "./constants.ts";
import type { ExtractFacts } from "./types.ts";
import { hasHighQualityEntity, hasHighQualityExpense } from "./extraction-utils.ts";
import { toStringArray } from "./text-utils.ts";

export const clampConfidence = (value: unknown, fallback = 75) => {
  const num = Number(value);

  if (!Number.isFinite(num)) return fallback;

  return Math.max(0, Math.min(100, Math.round(num)));
};

export const isBenefitLikeProgram = (facts: ExtractFacts) => {
  const source = [
    facts.title,
    facts.summary,
    facts.amount_text,
    facts.subsidy_rate_text,
    ...(facts.target_entities_arr || []),
    ...(facts.target_expenses_arr || []),
  ].join(" ");

  return /(給付金|給付|支給|手当|応援手当|子育て応援|児童手当)/.test(source);
};

export const makeFieldConfidence = ({
  facts,
  evidence,
}: {
  facts: ExtractFacts;
  evidence: Record<string, string>;
}) => {
  const expenseItems = facts.target_expenses_arr || [];
  const entityItems = facts.target_entities_arr || [];
  const benefitLike = isBenefitLikeProgram(facts);

  const fieldConfidence: Record<string, number> = {
    title: facts.title ? 90 : 40,
    organization: facts.organization ? 85 : 45,
    region_text: facts.region_text ? 85 : 45,
    application_period_text: facts.application_period_text ? 88 : 35,
    amount_text: facts.amount_text ? 85 : 40,
    subsidy_rate_text: facts.subsidy_rate_text ? 82 : benefitLike ? 90 : 40,
    target_entities_arr: entityItems.length ? 70 : 35,
    target_expenses_arr: expenseItems.length ? 70 : benefitLike ? 90 : 35,
    official_url: facts.official_url ? 90 : 40,
  };

  if (
    facts.application_period_text &&
    facts.application_status &&
    facts.application_status !== "不明"
  ) {
    fieldConfidence.application_period_text = 93;
  }

  if (facts.amount_text && Number(facts.amount_max_yen || 0) > 0) {
    fieldConfidence.amount_text = 90;
  }

  if (
    facts.subsidy_rate_text &&
    /(\d+\s*\/\s*\d+|\d+分の\d+|\d+％|\d+%|以内)/.test(facts.subsidy_rate_text)
  ) {
    fieldConfidence.subsidy_rate_text = 87;
  }

  if (hasHighQualityEntity(entityItems)) {
    fieldConfidence.target_entities_arr = Math.max(
      fieldConfidence.target_entities_arr,
      83
    );
  }

  if (hasHighQualityExpense(expenseItems)) {
    fieldConfidence.target_expenses_arr = Math.max(
      fieldConfidence.target_expenses_arr,
      76
    );
  }

  for (const key of Object.keys(fieldConfidence)) {
    if (evidence[key]) {
      fieldConfidence[key] = Math.min(100, fieldConfidence[key] + 5);
    }
  }

  return fieldConfidence;
};

export const makeWarnings = (facts: ExtractFacts) => {
  const warnings: string[] = [];
  const benefitLike = isBenefitLikeProgram(facts);

  if (!facts.application_period_text) {
    warnings.push("申請期間が取得できていません。公式ページで確認してください。");
  } else if (
    !facts.application_end_date &&
    !OPEN_ENDED_PATTERN.test(facts.application_period_text)
  ) {
    warnings.push("終了日が明記されていない可能性があります。");
  }

  if (!facts.amount_text) {
    warnings.push("補助上限額・助成額・給付額が取得できていません。");
  }

  if (!facts.subsidy_rate_text && !benefitLike) {
    warnings.push("補助率が取得できていません。");
  }

  if (!facts.target_entities_arr || facts.target_entities_arr.length === 0) {
    warnings.push("対象事業者・対象者の取得精度が低い可能性があります。");
  }

  if (!facts.target_expenses_arr || facts.target_expenses_arr.length === 0) {
    if (!benefitLike) {
      warnings.push("対象経費の取得精度が低い可能性があります。");
    }
  } else if (!hasHighQualityExpense(facts.target_expenses_arr)) {
    warnings.push("対象経費の根拠文が短いため、念のため公式ページで確認してください。");
  }

  if (!facts.official_url) {
    warnings.push("公式URLが取得できていません。");
  }

  return Array.from(new Set(toStringArray(warnings)));
};