import { FEATURE_PAGES } from './featurePages';

const MISSING_WORDS = [
  '不明',
  '未記載',
  '未設定',
  '要確認',
  '公式ページをご確認ください',
];

const PERIOD_PLACEHOLDER_WORDS = [
  '公式ページをご確認ください',
  '不明',
  '未定',
  '更新日',
  '掲載日',
  '対象期間',
  '対象経費',
  '制度概要',
];

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTags = (value) =>
  Array.isArray(value) ? value.filter(Boolean) : [];

const includesAny = (text, words) => {
  const normalized = normalizeText(text);
  return words.some((word) => normalized.includes(word));
};

const isMissingText = (value) => {
  const text = normalizeText(value);
  if (!text) return true;
  return includesAny(text, MISSING_WORDS);
};

const toWesternYearText = (value) =>
  normalizeText(value).replace(/令和(元|\d+)年/g, (_, year) => {
    const reiwaYear = year === '元' ? 1 : Number(year);
    return `${2018 + reiwaYear}年`;
  });

const extractDeadlineTime = (periodText) => {
  const text = toWesternYearText(periodText);
  if (!text || /随時|予算上限|上限に達するまで|通年|年度中/.test(text)) return null;

  const matches = [
    ...text.matchAll(/(20\d{2})[年/.-]\s*(\d{1,2})[月/.-]\s*(\d{1,2})日?/g),
  ];

  if (matches.length === 0) return null;

  const times = matches
    .map((match) => {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const time = new Date(year, month - 1, day, 23, 59, 59).getTime();
      return Number.isFinite(time) ? time : null;
    })
    .filter(Boolean);

  if (times.length === 0) return null;
  return Math.max(...times);
};

export const getQualityIssues = (item) => {
  const issues = [];
  const purposes = normalizeTags(item?.purposes);
  const industries = normalizeTags(item?.industries);
  const periodText = item?.application_period_text || item?.deadline || '';
  const amountText = item?.amount_text || item?.amount || '';
  const officialUrl = normalizeText(item?.official_url);

  if (purposes.length === 0) {
    issues.push({
      code: 'missing_purpose_tags',
      label: '利用目的タグなし',
      severity: 'warning',
    });
  }

  if (industries.length === 0) {
    issues.push({
      code: 'missing_industry_tags',
      label: '業種タグなし',
      severity: 'warning',
    });
  }

  if (!officialUrl) {
    issues.push({
      code: 'missing_official_url',
      label: '公式URLなし',
      severity: 'danger',
    });
  }

  if (isMissingText(amountText)) {
    issues.push({
      code: 'missing_amount',
      label: '金額未記載',
      severity: 'warning',
    });
  }

  if (isMissingText(periodText) || includesAny(periodText, PERIOD_PLACEHOLDER_WORDS)) {
    issues.push({
      code: 'unclear_application_period',
      label: '申請期間要確認',
      severity: 'warning',
    });
  }

  const deadlineTime = extractDeadlineTime(periodText);
  const isPublishedActive = item?.crawl_status === 'published' && item?.is_active !== false;
  if (isPublishedActive && deadlineTime && deadlineTime < Date.now()) {
    issues.push({
      code: 'deadline_passed',
      label: '期限経過の可能性',
      severity: 'danger',
    });
  }

  if (item?.duplicate_of_id) {
    issues.push({
      code: 'duplicate_candidate',
      label: `重複候補 ID:${item.duplicate_of_id}`,
      severity: 'danger',
    });
  }

  if (item?.admin_note || item?.duplicate_reason) {
    issues.push({
      code: 'admin_review_note',
      label: '管理メモあり',
      severity: 'warning',
    });
  }

  return issues;
};

export const getPublishQualityIssues = (item) =>
  getQualityIssues(item).filter(
    (issue) =>
      !['duplicate_candidate', 'admin_review_note'].includes(issue.code)
  );

export const buildPublishQualityWarningMessage = (item) => {
  const issues = getPublishQualityIssues(item);
  if (issues.length === 0) return null;

  return [
    '⚠ 公開前チェックで要確認項目があります。',
    '',
    `タイトル: ${item?.title || '未記載'}`,
    ...issues.map((issue) => `・${issue.label}`),
    '',
    '内容を確認したうえで公開しますか？',
  ].join('\n');
};

export const getQualityGrade = (item) => {
  const issues = getQualityIssues(item);
  const hasDanger = issues.some((issue) => issue.severity === 'danger');
  if (hasDanger) {
    return {
      label: '要確認',
      color: '#991b1b',
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
    };
  }
  if (issues.length > 0) {
    return {
      label: '情報不足',
      color: '#92400e',
      backgroundColor: '#fffbeb',
      borderColor: '#fde68a',
    };
  }
  return {
    label: '良好',
    color: '#065f46',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  };
};

export const getSuggestedFeatures = (item, limit = 3) => {
  const purposes = normalizeTags(item?.purposes);
  const industries = normalizeTags(item?.industries);
  const haystack = [
    item?.title,
    item?.summary,
    item?.description,
    item?.target_entities,
    item?.target_expenses,
    ...(Array.isArray(item?.target_entities_arr) ? item.target_entities_arr : []),
    ...(Array.isArray(item?.target_expenses_arr) ? item.target_expenses_arr : []),
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ]
    .map(normalizeText)
    .join(' ');

  return FEATURE_PAGES.map((feature) => {
    let score = 0;

    (feature.purposeTags || []).forEach((tag) => {
      if (purposes.includes(tag)) score += 4;
    });

    (feature.industryTags || []).forEach((tag) => {
      if (industries.includes(tag)) score += 5;
    });

    [...(feature.searchKeywords || []), ...(feature.targetKeywords || [])].forEach((keyword) => {
      if (keyword && haystack.includes(keyword)) score += 1;
    });

    return { feature, score };
  })
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score || b.feature.priority - a.feature.priority)
    .slice(0, limit)
    .map(({ feature }) => feature);
};

export const QUALITY_FILTERS = [
  { value: 'all', label: 'すべて' },
  { value: 'needs_review', label: '要確認あり' },
  { value: 'missing_tags', label: 'タグ未設定' },
  { value: 'missing_period', label: '申請期間要確認' },
  { value: 'missing_amount', label: '金額未記載' },
  { value: 'missing_official_url', label: '公式URLなし' },
  { value: 'deadline_passed', label: '期限経過の可能性' },
  { value: 'feature_suggestions', label: '特集候補あり' },
];

export const matchesQualityFilter = (item, filter) => {
  if (!filter || filter === 'all') return true;
  const issues = getQualityIssues(item);
  const issueCodes = new Set(issues.map((issue) => issue.code));

  if (filter === 'needs_review') return issues.length > 0;
  if (filter === 'missing_tags') {
    return issueCodes.has('missing_purpose_tags') || issueCodes.has('missing_industry_tags');
  }
  if (filter === 'missing_period') return issueCodes.has('unclear_application_period');
  if (filter === 'missing_amount') return issueCodes.has('missing_amount');
  if (filter === 'missing_official_url') return issueCodes.has('missing_official_url');
  if (filter === 'deadline_passed') return issueCodes.has('deadline_passed');
  if (filter === 'feature_suggestions') return getSuggestedFeatures(item, 1).length > 0;

  return true;
};
