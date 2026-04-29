import {
  AMOUNT_LABEL_PATTERN,
  APPLICATION_PERIOD_HINT_PATTERN,
  ENTITY_LABEL_PATTERN,
  ENTITY_QUALITY_PATTERN,
  EXPENSE_LABEL_PATTERN,
  EXPENSE_QUALITY_PATTERN,
  IMPORTANT_WORDS,
  PERIOD_LABEL_PATTERN,
  RATE_LABEL_PATTERN,
  URL_PATTERN,
} from "./constants.ts";
import type { CandidateSet } from "./types.ts";
import {
  cleanLine,
  getLines,
  normalizeJapaneseNumber,
  normalizeText,
  stripLeadingLabel,
  takeNearbyLines,
  toStringArray,
  unique,
} from "./text-utils.ts";
import {
  isBadApplicationPeriodCandidate,
  isGoodApplicationPeriodCandidate,
} from "./period-utils.ts";

const MONEY_PATTERN = /(\d+(?:\.\d+)?)(億円|万円|千円|円)/;

const MONEY_CONTEXT_PATTERN =
  /(補助|助成|上限|限度|交付|給付|支給|額|1事業者|一事業者|1人|一人|こども1人|子ども1人|児童1人|対象児童1人|当たり|あたり)/;

const AMOUNT_DESCRIPTION_NOISE_PATTERN =
  /(物価高の影響|目的|概要|趣旨|背景|長期化|影響を強く受けている|支援します|実施します|お知らせ|について|次のとおり|制度です|更新|更新日|一覧|お忘れない|忘れない)/;

const NOT_AMOUNT_LINE_PATTERN =
  /(対象児童|給付対象者|支給対象者|対象者|出生|生年月日|住民登録|児童手当|申請|受付|期限|期間|問い合わせ|お問い合わせ)/;

const RATE_VALUE_PATTERN =
  /(\d+\s*\/\s*\d+|\d+分の\d+|\d+％|\d+%)/;

const RATE_CONTEXT_PATTERN =
  /(補助率|助成率|補助割合|助成割合|対象経費の|補助対象経費の|以内|以下)/;

const FIELD_NOISE_PATTERN =
  /(更新|更新日|お知らせ|お忘れない|忘れない|一覧|新着|トップページ|ページ一覧|関連情報|くらし|生活|物価高対応|子育て応援手当|\*|#|URL|http|https)/;

const TITLE_LIKE_NOISE_PATTERN =
  /(令和[0-9０-９]+年度.{0,40}(補助|助成|支援|給付|手当)|ゼロ・エネルギー・ハウス|ZEH|物価高対応|子育て応援手当)/;

export const collectCandidateLines = (
  lines: string[],
  labelPattern: RegExp,
  options?: {
    before?: number;
    after?: number;
    max?: number;
  },
) => {
  const before = options?.before ?? 1;
  const after = options?.after ?? 3;
  const max = options?.max ?? 12;

  const results: string[] = [];

  lines.forEach((line, index) => {
    if (labelPattern.test(line)) {
      results.push(takeNearbyLines(lines, index, before, after).join("\n"));
    }
  });

  return unique(results).slice(0, max);
};

export const collectTitleCandidates = (lines: string[], editFormTitle: string) => {
  const candidates: string[] = [];

  if (editFormTitle) {
    candidates.push(editFormTitle);
  }

  for (const line of lines.slice(0, 100)) {
    if (
      line.length >= 6 &&
      line.length <= 90 &&
      /(補助金|助成金|補助事業|助成事業|支援事業|給付金|手当|応援)/.test(line) &&
      !/(一覧|検索|サイトマップ|問い合わせ|お問い合わせ|ホームページ|更新|更新日)/.test(line)
    ) {
      candidates.push(line);
    }
  }

  return unique(candidates).slice(0, 10);
};

export const collectPeriodCandidates = (lines: string[]) => {
  const candidates: string[] = [];

  lines.forEach((line, index) => {
    const block = takeNearbyLines(lines, index, 1, 4).join("\n");

    if (PERIOD_LABEL_PATTERN.test(line) || APPLICATION_PERIOD_HINT_PATTERN.test(line)) {
      if (!isBadApplicationPeriodCandidate(block)) {
        candidates.push(block);
      }
    }
  });

  for (const line of lines) {
    if (isGoodApplicationPeriodCandidate(line)) {
      candidates.push(line);
    }
  }

  return unique(candidates).slice(0, 15);
};

export const collectAmountCandidates = (lines: string[]) => {
  const candidates = collectCandidateLines(lines, AMOUNT_LABEL_PATTERN, {
    before: 0,
    after: 3,
    max: 20,
  });

  for (const line of lines) {
    if (FIELD_NOISE_PATTERN.test(line)) continue;

    if (MONEY_PATTERN.test(line) && MONEY_CONTEXT_PATTERN.test(line)) {
      candidates.push(line);
    }
  }

  return unique(candidates).slice(0, 20);
};

export const collectRateCandidates = (lines: string[]) => {
  const candidates = collectCandidateLines(lines, RATE_LABEL_PATTERN, {
    before: 1,
    after: 3,
    max: 15,
  });

  for (const line of lines) {
    if (FIELD_NOISE_PATTERN.test(line)) continue;

    if (
      RATE_CONTEXT_PATTERN.test(line) &&
      (RATE_VALUE_PATTERN.test(line) || /以内|以下/.test(line))
    ) {
      candidates.push(line);
    }
  }

  return unique(candidates).slice(0, 15);
};

export const collectUrlCandidates = (text: string, resolvedUrl: string) => {
  const urls = normalizeText(text).match(URL_PATTERN) || [];

  const scored = unique([resolvedUrl, ...urls])
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => {
      let score = 0;

      if (/pref\.ehime\.jp|city\.|town\.|lg\.jp|go\.jp|or\.jp/i.test(url)) score += 10;
      if (/j-net21|mirasapo|prtimes|hojyokin-portal|shienkin/i.test(url)) score -= 5;
      if (/pdf/i.test(url)) score += 1;
      if (/apply|boshu|koubo|hojo|subsidy|shinsei|page|teate|kyufu/i.test(url)) score += 2;

      return { url, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.url).slice(0, 10);
};

export const buildCandidateSet = ({
  extractedText,
  editFormTitle,
  org,
  resolvedUrl,
}: {
  extractedText: string;
  editFormTitle: string;
  org: string;
  resolvedUrl: string;
}): CandidateSet => {
  const lines = getLines(extractedText);

  const titleCandidates = collectTitleCandidates(lines, editFormTitle);
  const periodCandidates = collectPeriodCandidates(lines);
  const amountCandidates = collectAmountCandidates(lines);
  const rateCandidates = collectRateCandidates(lines);

  const targetEntityCandidates = collectCandidateLines(lines, ENTITY_LABEL_PATTERN, {
    before: 1,
    after: 5,
    max: 12,
  });

  const targetExpenseCandidates = collectCandidateLines(lines, EXPENSE_LABEL_PATTERN, {
    before: 1,
    after: 5,
    max: 12,
  });

  const urlCandidates = collectUrlCandidates(extractedText, resolvedUrl);

  const importantLines = lines.filter((line) =>
    IMPORTANT_WORDS.some((word) => line.includes(word)),
  );

  const focusedText = unique([
    ...titleCandidates,
    ...periodCandidates,
    ...amountCandidates,
    ...rateCandidates,
    ...targetEntityCandidates,
    ...targetExpenseCandidates,
    ...importantLines.slice(0, 140),
  ])
    .join("\n")
    .slice(0, 12000);

  return {
    lines,
    titleCandidates,
    periodCandidates,
    amountCandidates,
    rateCandidates,
    targetEntityCandidates,
    targetExpenseCandidates,
    urlCandidates,
    focusedText,
    sourceInfo: {
      editFormTitle,
      org,
      resolvedUrl,
    },
  };
};

export const normalizeMoneyText = (value: string) => {
  return normalizeJapaneseNumber(value || "")
    .replace(/\s+/g, " ")
    .replace(/(補助率|助成率)[^。\n]{0,60}/g, "")
    .trim();
};

export const parseAmountMaxYen = (value: string) => {
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

const isGoodAmountLine = (line: string) => {
  const s = normalizeMoneyText(line);

  if (!s) return false;
  if (s === "不明") return false;
  if (FIELD_NOISE_PATTERN.test(s)) return false;
  if (TITLE_LIKE_NOISE_PATTERN.test(s) && !MONEY_PATTERN.test(s)) return false;
  if (!MONEY_PATTERN.test(s)) return false;
  if (AMOUNT_DESCRIPTION_NOISE_PATTERN.test(s)) return false;

  if (NOT_AMOUNT_LINE_PATTERN.test(s) && !/(給付額|支給額|補助額|助成額)/.test(s)) {
    return false;
  }

  return true;
};

const extractAmountAtomicCandidates = (amountCandidates: string[], aiAmount: string) => {
  const items: string[] = [];

  if (isGoodAmountLine(aiAmount)) {
    items.push(aiAmount);
  }

  for (const block of amountCandidates) {
    const lines = block.split("\n").map(cleanLine).filter(Boolean);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (FIELD_NOISE_PATTERN.test(line)) continue;

      if (AMOUNT_LABEL_PATTERN.test(line)) {
        const sameLineValue = stripLeadingLabel(line.replace(AMOUNT_LABEL_PATTERN, ""));

        if (isGoodAmountLine(sameLineValue)) {
          items.push(sameLineValue);
        }

        const nextLines = [lines[i + 1], lines[i + 2], lines[i + 3]]
          .map((item) => cleanLine(item || ""))
          .filter(Boolean);

        for (const nextLine of nextLines) {
          if (FIELD_NOISE_PATTERN.test(nextLine)) continue;

          if (isGoodAmountLine(nextLine)) {
            items.push(nextLine);
          }
        }
      }

      if (isGoodAmountLine(line)) {
        items.push(line);
      }
    }
  }

  return unique(items.map(stripLeadingLabel).filter(Boolean));
};

export const chooseBestAmountText = (amountCandidates: string[], aiAmount: string) => {
  const atomicCandidates = extractAmountAtomicCandidates(amountCandidates, aiAmount);

  const scored = atomicCandidates.map((text) => {
    const s = normalizeMoneyText(text);
    let score = 0;

    if (MONEY_PATTERN.test(s)) score += 40;
    if (/給付額|支給額|補助額|助成額|補助限度額|助成限度額|補助上限|上限額|限度額/.test(s)) score += 18;
    if (/こども1人|子ども1人|児童1人|対象児童1人|1人当たり|一人当たり|1人あたり|一人あたり/.test(s)) score += 18;
    if (/1事業者|一事業者|あたり|当たり/.test(s)) score += 10;
    if (s.length <= 40) score += 12;
    if (s.length <= 70) score += 6;
    if (s.length > 100) score -= 25;
    if (s.length > 150) score -= 50;
    if (AMOUNT_DESCRIPTION_NOISE_PATTERN.test(s)) score -= 45;
    if (FIELD_NOISE_PATTERN.test(s)) score -= 80;
    if (/対象児童|給付対象者|出生|住民登録|児童手当/.test(s)) score -= 25;
    if (/補助率|助成率|分の|\//.test(s)) score -= 20;

    return {
      text: stripLeadingLabel(s),
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  if (!scored[0] || scored[0].score < 35) {
    return "";
  }

  return scored[0].text || "";
};

const isGoodRateLine = (line: string) => {
  const s = cleanLine(line || "");

  if (!s) return false;
  if (s === "不明") return false;
  if (FIELD_NOISE_PATTERN.test(s)) return false;
  if (TITLE_LIKE_NOISE_PATTERN.test(s) && !RATE_VALUE_PATTERN.test(s)) return false;
  if (!RATE_CONTEXT_PATTERN.test(s) && !RATE_VALUE_PATTERN.test(s)) return false;
  if (!RATE_VALUE_PATTERN.test(s) && !/以内|以下/.test(s)) return false;
  if (/(万円|円|限度額|上限額|給付額|支給額)/.test(s)) return false;

  return true;
};

export const chooseBestRateText = (rateCandidates: string[], aiRate: string) => {
  const candidates = unique([
    aiRate,
    ...rateCandidates.map((item) => item.split("\n").join(" ")),
  ])
    .map((item) => normalizeJapaneseNumber(item || "").trim())
    .filter(isGoodRateLine);

  const scored = candidates.map((text) => {
    let score = 0;

    if (/補助率|助成率/.test(text)) score += 20;
    if (/対象経費の|補助対象経費の/.test(text)) score += 10;
    if (RATE_VALUE_PATTERN.test(text)) score += 20;
    if (/以内|以下/.test(text)) score += 5;
    if (text.length <= 45) score += 10;
    if (text.length > 90) score -= 20;
    if (FIELD_NOISE_PATTERN.test(text)) score -= 100;
    if (TITLE_LIKE_NOISE_PATTERN.test(text) && !RATE_VALUE_PATTERN.test(text)) score -= 80;
    if (/(万円|円|限度額|上限額|給付額|支給額)/.test(text)) score -= 30;

    return { text: stripLeadingLabel(text), score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (!scored[0] || scored[0].score < 20) {
    return "";
  }

  return scored[0].text || "";
};

export const isMeaningfulExpense = (value: string) => {
  const s = stripLeadingLabel(value);

  if (!s) return false;
  if (s.length < 4) return false;
  if (s.length > 120) return false;
  if (FIELD_NOISE_PATTERN.test(s)) return false;
  if (
    /(補助率|助成率|万円|上限|限度額|締切|募集期間|申請期間|問い合わせ|お問い合わせ)/.test(
      s,
    )
  ) {
    return false;
  }

  return EXPENSE_QUALITY_PATTERN.test(s);
};

export const isMeaningfulEntity = (value: string) => {
  const s = stripLeadingLabel(value);

  if (!s) return false;
  if (s.length < 3) return false;
  if (s.length > 180) return false;
  if (FIELD_NOISE_PATTERN.test(s)) return false;
  if (
    /(補助率|助成率|万円|上限|限度額|締切|募集期間|申請期間|問い合わせ|お問い合わせ)/.test(
      s,
    )
  ) {
    return false;
  }

  return ENTITY_QUALITY_PATTERN.test(s);
};

export const extractItemsFromCandidateBlocks = ({
  candidates,
  labelPattern,
  type,
}: {
  candidates: string[];
  labelPattern: RegExp;
  type: "expense" | "entity";
}) => {
  const items: string[] = [];

  for (const block of candidates) {
    const lines = block.split("\n").map(cleanLine).filter(Boolean);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (FIELD_NOISE_PATTERN.test(line)) continue;

      if (labelPattern.test(line)) {
        const sameLineValue = stripLeadingLabel(line.replace(labelPattern, ""));

        if (type === "expense" && isMeaningfulExpense(sameLineValue)) {
          items.push(sameLineValue);
        }

        if (type === "entity" && isMeaningfulEntity(sameLineValue)) {
          items.push(sameLineValue);
        }

        const nextLines = [lines[i + 1], lines[i + 2], lines[i + 3], lines[i + 4]]
          .map((item) => stripLeadingLabel(item || ""))
          .filter(Boolean);

        for (const nextLine of nextLines) {
          if (FIELD_NOISE_PATTERN.test(nextLine)) continue;
          if (labelPattern.test(nextLine)) continue;

          if (type === "expense" && isMeaningfulExpense(nextLine)) {
            items.push(nextLine);
          }

          if (type === "entity" && isMeaningfulEntity(nextLine)) {
            items.push(nextLine);
          }
        }
      } else {
        const normalized = stripLeadingLabel(line);

        if (type === "expense" && isMeaningfulExpense(normalized)) {
          items.push(normalized);
        }

        if (type === "entity" && isMeaningfulEntity(normalized)) {
          items.push(normalized);
        }
      }
    }
  }

  return unique(items).slice(0, 8);
};

export const chooseTargetExpenses = (
  candidateSet: CandidateSet,
  aiItems: unknown,
) => {
  const aiList = toStringArray(aiItems).map(stripLeadingLabel).filter(isMeaningfulExpense);

  const candidateList = extractItemsFromCandidateBlocks({
    candidates: candidateSet.targetExpenseCandidates,
    labelPattern: EXPENSE_LABEL_PATTERN,
    type: "expense",
  });

  const directLines = candidateSet.lines
    .map(stripLeadingLabel)
    .filter(isMeaningfulExpense)
    .slice(0, 8);

  return unique([...aiList, ...candidateList, ...directLines]).slice(0, 8);
};

export const chooseTargetEntities = (
  candidateSet: CandidateSet,
  aiItems: unknown,
) => {
  const aiList = toStringArray(aiItems).map(stripLeadingLabel).filter(isMeaningfulEntity);

  const candidateList = extractItemsFromCandidateBlocks({
    candidates: candidateSet.targetEntityCandidates,
    labelPattern: ENTITY_LABEL_PATTERN,
    type: "entity",
  });

  const directLines = candidateSet.lines
    .map(stripLeadingLabel)
    .filter(isMeaningfulEntity)
    .slice(0, 8);

  return unique([...aiList, ...candidateList, ...directLines]).slice(0, 8);
};

export const resolveUrlMaybeRelative = (url: string, baseUrl: string) => {
  if (!url) return "";

  try {
    if (/^https?:\/\//i.test(url)) return url;
    if (baseUrl) return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }

  return "";
};

export const chooseOfficialUrl = (
  urlCandidates: string[],
  aiUrl: string,
  resolvedUrl: string,
) => {
  const candidates = unique([aiUrl, ...urlCandidates, resolvedUrl])
    .map((url) => resolveUrlMaybeRelative(url, resolvedUrl))
    .filter(Boolean);

  const scored = candidates.map((url) => {
    let score = 0;

    if (/pref\.ehime\.jp|city\.|town\.|lg\.jp|go\.jp|or\.jp/i.test(url)) score += 10;
    if (/j-net21|mirasapo|prtimes|hojyokin-portal|shienkin/i.test(url)) score -= 5;
    if (/pdf/i.test(url)) score += 1;
    if (/page|hojo|koubo|boshu|subsidy|shinsei|apply|teate|kyufu/i.test(url)) score += 2;

    return { url, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.url || resolvedUrl || "";
};

export const hasHighQualityExpense = (items: string[]) => {
  return items.some((item) => EXPENSE_QUALITY_PATTERN.test(item) && item.length >= 4);
};

export const hasHighQualityEntity = (items: string[]) => {
  return items.some((item) => ENTITY_QUALITY_PATTERN.test(item) && item.length >= 3);
};