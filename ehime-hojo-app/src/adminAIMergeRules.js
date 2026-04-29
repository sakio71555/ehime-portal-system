// src/adminAIMergeRules.js

const EMPTY_VALUES = new Set([
  '',
  '不明',
  '未定',
  'なし',
  '無し',
  'null',
  'undefined',
  '-',
  'ー',
]);

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isEmptyLike(value) {
  const text = normalizeValue(value);
  return EMPTY_VALUES.has(text);
}

function isReferenceLike(value) {
  const text = normalizeValue(value);

  return /参照|要領|サマリー|公募要領|公式|確認|別紙|募集要項/.test(text);
}

function hasDateLikeText(value) {
  const text = normalizeValue(value);

  return (
    /\d{4}年\d{1,2}月\d{1,2}日/.test(text) ||
    /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(text) ||
    /令和\d+年\d{1,2}月\d{1,2}日/.test(text) ||
    /令和[元一二三四五六七八九十]+年\d{1,2}月\d{1,2}日/.test(text)
  );
}

function looksLikeTitle(value) {
  const text = normalizeValue(value);

  if (!text) return false;

  return (
    text.length >= 20 &&
    /補助金|助成金|給付金|支援金|事業|支援|導入|設備|公募|令和|年度/.test(text) &&
    !hasDateLikeText(text)
  );
}

function isValidApplicationPeriod(value) {
  const text = normalizeValue(value);

  if (!text) return false;
  if (looksLikeTitle(text)) return false;

  if (/随時|通年|予算に達し次第|受付中|募集中|期限なし/.test(text)) {
    return true;
  }

  return hasDateLikeText(text);
}

function isValidRegion(value) {
  const text = normalizeValue(value);

  if (!text) return false;
  if (text.length > 40) return false;

  return /全国|愛媛|四国|松山市|今治市|宇和島市|八幡浜市|新居浜市|西条市|大洲市|伊予市|四国中央市|西予市|東温市|上島町|久万高原町|松前町|砥部町|内子町|伊方町|松野町|鬼北町|愛南町/.test(
    text
  );
}

function isValidUrl(value) {
  const text = normalizeValue(value);
  return /^https?:\/\/.+/i.test(text);
}

function isJgrantsItem(formData) {
  return normalizeValue(formData?.source_type) === 'jgrants';
}

function isConcreteAmount(value) {
  const text = normalizeValue(value);

  if (isEmptyLike(text)) return false;

  return /[0-9０-９]/.test(text) || /上限|最大|限度額/.test(text);
}

function isConcreteRate(value) {
  const text = normalizeValue(value);

  if (isEmptyLike(text)) return false;
  if (isReferenceLike(text)) return false;

  return (
    /[0-9０-９]+分の[0-9０-９]+/.test(text) ||
    /[0-9０-９]+\/[0-9０-９]+/.test(text) ||
    /[0-9０-９]+%/.test(text) ||
    /[0-9０-９]+％/.test(text) ||
    /定額|全額|以内|以下/.test(text)
  );
}

function isUsefulArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function normalizeAIResultKeys(aiResult) {
  const ai = aiResult || {};

  const normalized = {
    ...ai,
  };

  /**
   * AI / Edge Function側のキー揺れ吸収
   */
  if (normalized.application_period && !normalized.application_period_text) {
    normalized.application_period_text = normalized.application_period;
  }

  if (normalized.applicationPeriod && !normalized.application_period_text) {
    normalized.application_period_text = normalized.applicationPeriod;
  }

  if (normalized.region && !normalized.region_text) {
    normalized.region_text = normalized.region;
  }

  if (normalized.max_amount && !normalized.amount_text) {
    normalized.amount_text = normalized.max_amount;
  }

  if (normalized.amount && !normalized.amount_text) {
    normalized.amount_text = normalized.amount;
  }

  if (normalized.subsidy_rate && !normalized.subsidy_rate_text) {
    normalized.subsidy_rate_text = normalized.subsidy_rate;
  }

  if (normalized.target_expenses && !normalized.target_expenses_arr) {
    normalized.target_expenses_arr = Array.isArray(normalized.target_expenses)
      ? normalized.target_expenses
      : String(normalized.target_expenses)
          .split(/[、,\n]/)
          .map((v) => v.trim())
          .filter(Boolean);
  }

  if (normalized.target_entities && !normalized.target_entities_arr) {
    normalized.target_entities_arr = Array.isArray(normalized.target_entities)
      ? normalized.target_entities
      : String(normalized.target_entities)
          .split(/[、,\n]/)
          .map((v) => v.trim())
          .filter(Boolean);
  }

  return normalized;
}

function shouldKeepExistingField({ key, currentValue, nextValue, formData }) {
  const current = normalizeValue(currentValue);
  const next = normalizeValue(nextValue);
  const fromJgrants = isJgrantsItem(formData);

  if (nextValue === undefined || nextValue === null) return true;

  if (typeof nextValue === 'string' && !next.trim()) {
    return true;
  }

  /**
   * Jグランツ由来の確定情報はAIで上書きしない。
   */
  if (fromJgrants) {
    const lockedFields = new Set([
      'title',
      'organization',
      'region',
      'region_text',
      'prefecture',
      'municipality',
      'application_period',
      'application_period_text',
      'application_start_date',
      'application_end_date',
      'application_start_at',
      'application_end_at',
      'application_status',
      'official_url',
      'source_url',
      'source_type',
      'source_external_id',
      'crawl_status',
      'is_active',
      'fiscal_year',
    ]);

    if (lockedFields.has(key)) {
      return Boolean(current);
    }
  }

  /**
   * 申請期間は日付らしさがないAI結果では上書き禁止。
   */
  if (key === 'application_period' || key === 'application_period_text') {
    if (!isValidApplicationPeriod(next)) return true;
    if (current && isValidApplicationPeriod(current)) return true;
  }

  /**
   * 地域はJグランツで全国ならAIの「愛媛」に変えない。
   */
  if (key === 'region' || key === 'region_text' || key === 'prefecture') {
    if (!isValidRegion(next)) return true;

    if (fromJgrants && current === '全国' && next.includes('愛媛')) {
      return true;
    }

    if (current && isValidRegion(current)) {
      return true;
    }
  }

  /**
   * URLは既存の公式URLがあるならAIで上書きしない。
   */
  if (key === 'official_url' || key === 'source_url') {
    if (!isValidUrl(next)) return true;
    if (isValidUrl(current)) return true;
  }

  /**
   * 上限金額は既存が有効なら保持。
   * ただし既存が「不明」の場合だけAI補完を許可。
   */
  if (key === 'amount_text' || key === 'max_amount' || key === 'amount_max_yen') {
    if (isConcreteAmount(current)) return true;
  }

  /**
   * 補助率は既存が具体的なら保持。
   * ただし「公募要領参照」系はAI補完を許可。
   */
  if (key === 'subsidy_rate_text' || key === 'subsidy_rate') {
    if (isConcreteRate(current)) return true;
  }

  /**
   * 配列フィールドは、既存に値があるなら空配列で上書きしない。
   */
  if (
    key === 'target_expenses_arr' ||
    key === 'target_entities_arr' ||
    key === 'purposes' ||
    key === 'industries' ||
    key === 'tags'
  ) {
    if (isUsefulArray(currentValue) && !isUsefulArray(nextValue)) {
      return true;
    }
  }

  return false;
}

function restoreLockedJgrantsFields(current, merged) {
  if (!isJgrantsItem(current)) return merged;

  const lockedKeys = [
    'source_type',
    'source_external_id',
    'source_url',
    'official_url',
    'title',
    'organization',
    'region',
    'region_text',
    'prefecture',
    'municipality',
    'application_period',
    'application_period_text',
    'application_start_date',
    'application_end_date',
    'application_start_at',
    'application_end_at',
    'application_status',
    'crawl_status',
    'is_active',
    'fiscal_year',
  ];

  const restored = {
    ...merged,
  };

  for (const key of lockedKeys) {
    if (current[key] !== undefined && current[key] !== null && current[key] !== '') {
      restored[key] = current[key];
    }
  }

  return restored;
}

export function mergeAIResultSafely(currentForm, aiResult) {
  const current = currentForm || {};
  const ai = normalizeAIResultKeys(aiResult || {});

  let merged = {
    ...current,
  };

  for (const [key, nextValue] of Object.entries(ai)) {
    const currentValue = current[key];

    if (
      shouldKeepExistingField({
        key,
        currentValue,
        nextValue,
        formData: current,
      })
    ) {
      continue;
    }

    merged[key] = nextValue;
  }

  merged = restoreLockedJgrantsFields(current, merged);

  return merged;
}

export function sanitizeAIResultBeforeMerge(aiResult) {
  const ai = normalizeAIResultKeys(aiResult || {});
  const sanitized = {
    ...ai,
  };

  /**
   * 申請期間にタイトルっぽい文字列が入ってきたら破棄。
   */
  if (
    sanitized.application_period_text &&
    !isValidApplicationPeriod(sanitized.application_period_text)
  ) {
    delete sanitized.application_period_text;
  }

  if (sanitized.application_period && !isValidApplicationPeriod(sanitized.application_period)) {
    delete sanitized.application_period;
  }

  /**
   * 地域として不自然な文字列は破棄。
   */
  if (sanitized.region_text && !isValidRegion(sanitized.region_text)) {
    delete sanitized.region_text;
  }

  if (sanitized.region && !isValidRegion(sanitized.region)) {
    delete sanitized.region;
  }

  /**
   * URLとして不自然なものは破棄。
   */
  if (sanitized.official_url && !isValidUrl(sanitized.official_url)) {
    delete sanitized.official_url;
  }

  return sanitized;
}

export function explainAIMergeProtection(formData) {
  if (!isJgrantsItem(formData)) {
    return {
      protected: false,
      message: '通常データのため、AI補完は通常ルールで反映されます。',
    };
  }

  return {
    protected: true,
    message:
      'Jグランツ由来データのため、タイトル・地域・申請期間・公式URLなどの確定項目はAIで上書きしません。',
  };
}