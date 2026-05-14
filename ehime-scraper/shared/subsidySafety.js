const POSTGRES_INT4_MAX = 2147483647;

function normalizeAmountMaxYen(value) {
  if (value === null || value === undefined || value === '') return null;

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount > POSTGRES_INT4_MAX) return null;

  return Math.trunc(amount);
}

function sanitizeSubsidyRow(row = {}) {
  return {
    ...row,
    amount_max_yen: normalizeAmountMaxYen(row.amount_max_yen),
  };
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function isNoisySubsidyCandidate(candidate = {}) {
  const title = String(candidate.title || '').trim();
  const summary = String(candidate.summary || '').trim();
  const sourceUrl = String(candidate.sourceUrl || candidate.source_url || '');
  const haystack = `${title}\n${summary}\n${sourceUrl}`;

  const hasSubsidyWord = /補助金|助成金|支援金|給付金|奨励金|交付金|利子補給|税制優遇/.test(
    haystack
  );

  if (/モニター/.test(title)) return 'モニター募集の可能性が高い';
  if (/名簿|登録を募集|利用者の募集|募集について/.test(title) && !hasSubsidyWord) {
    return '募集案内で補助制度ではない可能性が高い';
  }
  if (/認定申請|保証[45]号|セーフティネット保証|危機関連保証/.test(title)) {
    return '認定・保証申請ページの可能性が高い';
  }
  if (/商品券|キャンペーン/.test(title) && !hasSubsidyWord) {
    return '商品券・キャンペーン案内の可能性が高い';
  }
  if (/融資制度/.test(title) && !/利子補給|補助金|助成金|支援金/.test(title)) {
    return '融資制度のみの案内の可能性が高い';
  }
  if (/導入計画/.test(title) && !hasSubsidyWord) {
    return '導入計画のみの案内の可能性が高い';
  }
  if (/ビジョン|計画策定|策定しました|報告書/.test(title) && !hasSubsidyWord) {
    return '計画・報告ページの可能性が高い';
  }
  if (/手当/.test(title) && !/補助金|助成金|支援金|給付金/.test(title)) {
    return '手当制度の案内の可能性が高い';
  }
  if (
    includesAny(title, [/制度について$/, /支援について$/, /のご案内$/]) &&
    !hasSubsidyWord
  ) {
    return '制度案内ページの可能性が高い';
  }

  return '';
}

module.exports = {
  POSTGRES_INT4_MAX,
  normalizeAmountMaxYen,
  sanitizeSubsidyRow,
  isNoisySubsidyCandidate,
};
