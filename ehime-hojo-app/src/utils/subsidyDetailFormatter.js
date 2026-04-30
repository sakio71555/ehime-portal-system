const UNKNOWN_WORDS = [
  '',
  '-',
  'ー',
  '—',
  '不明',
  '未設定',
  'なし',
  '該当なし',
  'n/a',
  'na',
  'null',
  'undefined',
];

const LABEL_WORDS = [
  '制度名',
  '補助金のキャッチコピー',
  'キャッチコピー',
  '目的',
  '概要',
  '制度の概要',
  '事業の目的',
  '対象事業者',
  '対象者',
  '補助対象者',
  '対象経費',
  '補助対象経費',
  '申請期間',
  '募集期間',
  '公募期間',
  '受付期間',
  '提出期限',
  'お問い合わせ',
  '連絡先',
  '提出先',
  '提出方法',
  '参照ホームページ',
  '公式URL',
  '詳細URL',
];

const EXPENSE_KEYWORDS = [
  '経費',
  '費用',
  '補助対象',
  '設備',
  '機器',
  '工事',
  '改修',
  '修繕',
  '導入',
  '整備',
  '購入',
  '建設',
  '設置',
  '開発',
  '制作',
  '製作',
  '委託',
  '広告',
  '広報',
  '旅費',
  '人件費',
  'システム',
  '機械',
  '車両',
  '備品',
];

const BUSINESS_KEYWORDS = [
  '中小企業',
  '小規模',
  '事業者',
  '法人',
  '個人事業主',
  '団体',
  '農業者',
  '漁業者',
  '市町村',
  '自治体',
  '組合',
  'NPO',
  '学校',
  '医療',
  '介護',
  '宿泊',
  '観光',
];

export const normalizeText = (value) => {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\u3000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const isUnknownValue = (value) => {
  const text = normalizeText(value).toLowerCase();
  return UNKNOWN_WORDS.includes(text);
};

const removeUrls = (text) => {
  return normalizeText(text).replace(/https?:\/\/[^\s]+/g, '').trim();
};

const removeNoise = (text) => {
  return removeUrls(text)
    .replace(/[■□◆◇●○◎※]/g, ' ')
    .replace(/[|｜]{2,}/g, ' | ')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const removeOverviewNoise = (text) => {
  return removeUrls(text)
    .replace(/[■□◆◇●○◎※]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const firstNonEmpty = (obj, keys = []) => {
  for (const key of keys) {
    const value = obj?.[key];

    if (Array.isArray(value)) {
      const joined = value
        .map((item) => normalizeText(item))
        .filter((item) => !isUnknownValue(item))
        .join(' / ');

      if (joined) return joined;
    }

    const text = normalizeText(value);
    if (text && !isUnknownValue(text)) return text;
  }

  return '';
};

const isLabelOnly = (text) => {
  const value = normalizeText(text).replace(/[:：]/g, '');
  return LABEL_WORDS.includes(value);
};

const looksLikeRawDump = (text) => {
  const value = normalizeText(text);

  if (!value) return false;

  const pipeCount = (value.match(/[|｜]/g) || []).length;
  const slashCount = (value.match(/\s\/\s/g) || []).length;
  const urlCount = (value.match(/https?:\/\//g) || []).length;

  const labelHit = LABEL_WORDS.some((label) => value.includes(label));

  return (
    value.length > 240 ||
    pipeCount >= 4 ||
    slashCount >= 4 ||
    urlCount >= 1 ||
    (labelHit && value.length > 120)
  );
};

const splitCandidateText = (text) => {
  return removeNoise(text)
    .split(/[|｜/\n]/)
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item) => !isUnknownValue(item))
    .filter((item) => !isLabelOnly(item))
    .filter((item) => !/^https?:\/\//.test(item))
    .filter((item) => item.length <= 160);
};

const removeTitleLikeItems = (items, title) => {
  const normalizedTitle = normalizeText(title)
    .replace(/[【】「」『』（）()［\]\s]/g, '');

  return items.filter((item) => {
    const normalizedItem = normalizeText(item)
      .replace(/[【】「」『』（）()［\]\s]/g, '');

    if (!normalizedItem) return false;
    if (!normalizedTitle) return true;

    if (normalizedTitle.includes(normalizedItem) && normalizedItem.length >= 8) {
      return false;
    }

    if (normalizedItem.includes(normalizedTitle) && normalizedTitle.length >= 8) {
      return false;
    }

    return true;
  });
};

const extractByLabels = (text, labels = []) => {
  const value = removeNoise(text);

  if (!value) return '';

  const pipeTokens = value
    .split(/[|｜]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  for (let i = 0; i < pipeTokens.length - 1; i += 1) {
    const key = pipeTokens[i].replace(/[:：]/g, '').trim();
    const nextValue = pipeTokens[i + 1];

    if (labels.includes(key) && nextValue && !isLabelOnly(nextValue)) {
      return normalizeText(nextValue);
    }
  }

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(
      `${escaped}\\s*[:：]?\\s*([\\s\\S]{1,500})`,
      'i'
    );

    const match = value.match(regex);

    if (match?.[1]) {
      const extracted = match[1]
        .split(/\n{2,}/)[0]
        .split(/[|｜]/)[0]
        .trim();

      if (extracted && !isLabelOnly(extracted)) {
        return extracted;
      }
    }
  }

  return '';
};

const extractOverviewFullByLabels = (text, labels = []) => {
  const value = normalizeText(text);

  if (!value) return '';

  /**
   * pipe形式:
   * 制度の概要 | 本文 | 対象事業者 | ...
   * のような場合、次のラベル直前までを全文として取る。
   */
  const pipeTokens = value
    .split(/[|｜]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  for (let i = 0; i < pipeTokens.length - 1; i += 1) {
    const key = pipeTokens[i].replace(/[:：]/g, '').trim();

    if (!labels.includes(key)) continue;

    const values = [];

    for (let j = i + 1; j < pipeTokens.length; j += 1) {
      const token = pipeTokens[j];
      const tokenKey = token.replace(/[:：]/g, '').trim();

      if (LABEL_WORDS.includes(tokenKey)) break;
      if (isLabelOnly(token)) break;
      if (/^https?:\/\//.test(token)) continue;

      values.push(token);
    }

    const result = removeOverviewNoise(values.join('\n'));
    if (result) return result;
  }

  /**
   * 通常文:
   * 制度の概要：本文...
   * のような場合、次の大きなラベル候補までを全文として取る。
   */
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const nextLabels = LABEL_WORDS
      .filter((l) => l !== label)
      .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    const regex = new RegExp(
      `${escapedLabel}\\s*[:：]?\\s*([\\s\\S]*?)(?=\\n?\\s*(?:${nextLabels})\\s*[:：]?|$)`,
      'i'
    );

    const match = value.match(regex);

    if (match?.[1]) {
      const result = removeOverviewNoise(match[1]);
      if (result && !isLabelOnly(result)) return result;
    }
  }

  return '';
};

const hasAnyKeyword = (text, keywords) => {
  return keywords.some((keyword) => normalizeText(text).includes(keyword));
};

const formatIsoDateToJapanese = (value) => {
  const text = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const [year, month, day] = text.split('-');

  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
};

const toHalfWidthNumber = (value = '') => {
  return String(value).replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
};

const warekiToWesternText = (value = '') => {
  let text = toHalfWidthNumber(value);

  text = text.replace(/令和(元|\d+)年/g, (_, y) => {
    const year = y === '元' ? 2019 : 2018 + Number(y);
    return `${year}年`;
  });

  text = text.replace(/平成(元|\d+)年/g, (_, y) => {
    const year = y === '元' ? 1989 : 1988 + Number(y);
    return `${year}年`;
  });

  return text;
};

const parseDatesFromText = (periodText = '') => {
  const text = warekiToWesternText(periodText);
  const dates = [
    ...text.matchAll(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日?/g),
  ].map((match) => {
    const year = match[1];
    const month = String(Number(match[2])).padStart(2, '0');
    const day = String(Number(match[3])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  return dates;
};

const todayJstIso = () => {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const buildStatus = (subsidy) => {
  const rawStatus = firstNonEmpty(subsidy, [
    'application_status',
    'status_text',
    'recruitment_status',
  ]);

  const periodText = firstNonEmpty(subsidy, [
    'application_period_text',
    'application_period',
    'deadline',
  ]);

  const dates = parseDatesFromText(periodText);
  const today = todayJstIso();

  const endDate =
    normalizeText(subsidy?.application_end_date) ||
    normalizeText(subsidy?.end_date) ||
    dates[dates.length - 1] ||
    '';

  const startDate =
    normalizeText(subsidy?.application_start_date) ||
    normalizeText(subsidy?.start_date) ||
    dates[0] ||
    '';

  const explicitClosed =
    /(受付終了|募集終了|公募終了|終了しました|募集は終了|受付は終了|申請受付を終了|終了いたしました)/.test(
      periodText
    );

  if (endDate && endDate < today) return '受付終了';
  if (startDate && today < startDate) return '予告';
  if (endDate && today <= endDate) return '公募中';
  if (explicitClosed) return '受付終了';

  if (rawStatus) return rawStatus;

  return '要確認';
};

const buildApplicationPeriod = (subsidy) => {
  const start = firstNonEmpty(subsidy, [
    'application_start_date',
    'start_date',
    'start_at',
  ]);

  const end = firstNonEmpty(subsidy, [
    'application_end_date',
    'end_date',
    'end_at',
  ]);

  if (start && end) {
    return `${formatIsoDateToJapanese(start)}から${formatIsoDateToJapanese(
      end
    )}まで`;
  }

  if (start) return `${formatIsoDateToJapanese(start)}から`;
  if (end) return `${formatIsoDateToJapanese(end)}まで`;

  const raw = firstNonEmpty(subsidy, [
    'application_period_text',
    'application_period',
    'period_text',
    'deadline',
  ]);

  if (!raw) return '公式ページをご確認ください。';

  if (looksLikeRawDump(raw)) {
    const extracted = extractByLabels(raw, [
      '申請期間',
      '募集期間',
      '公募期間',
      '受付期間',
      '提出期限',
    ]);

    return extracted || '公式ページをご確認ください。';
  }

  return raw;
};

const buildGrantInfo = (subsidy) => {
  const amount = firstNonEmpty(subsidy, [
    'amount_text',
    'amount',
    'subsidy_amount_text',
    'subsidy_max_amount',
    'max_amount_text',
    'grant_amount_text',
  ]);

  const rate = firstNonEmpty(subsidy, [
    'subsidy_rate_text',
    'subsidy_rate',
    'grant_rate_text',
    'rate_text',
  ]);

  const cleanAmount = amount && !looksLikeRawDump(amount) ? amount : '';
  const cleanRate = rate && !looksLikeRawDump(rate) ? rate : '';

  if (cleanAmount && cleanRate) {
    return {
      main: cleanAmount,
      sub: `補助率：${cleanRate}`,
    };
  }

  if (cleanAmount) {
    return {
      main: cleanAmount,
      sub: '',
    };
  }

  if (cleanRate) {
    return {
      main: `補助率 ${cleanRate}`,
      sub: '',
    };
  }

  return {
    main: '公式ページをご確認ください。',
    sub: '',
  };
};

const buildOverview = (subsidy) => {
  const direct = firstNonEmpty(subsidy, [
    'summary',
    'overview',
    'overview_text',
    'description',
    'purpose',
    'purpose_text',
  ]);

  if (!direct) return '詳細は公式ページをご確認ください。';

  /**
   * ここが今回の修正ポイント：
   * 制度の概要は省略せず全文を返す。
   * 以前のような「…」での短縮はしない。
   */
  if (!looksLikeRawDump(direct)) {
    return removeOverviewNoise(direct);
  }

  const extracted = extractOverviewFullByLabels(direct, [
    '制度の概要',
    '概要',
    '目的',
    '事業の目的',
  ]);

  if (extracted) return extracted;

  return removeOverviewNoise(direct);
};

const buildTargetEntities = (subsidy) => {
  const direct = firstNonEmpty(subsidy, [
    'target_entities_arr',
    'target_entities',
    'target_businesses',
    'target_businesses_text',
    'eligible_applicants',
    'eligible_applicants_text',
    'applicant_eligibility',
    'target_applicants',
  ]);

  if (!direct) return '公式ページをご確認ください。';

  if (!looksLikeRawDump(direct)) return direct;

  const extracted = extractByLabels(direct, [
    '対象事業者',
    '補助対象者',
    '対象者',
    '申請者',
    '応募者',
  ]);

  if (extracted) return extracted;

  const candidates = removeTitleLikeItems(
    splitCandidateText(direct).filter((item) => hasAnyKeyword(item, BUSINESS_KEYWORDS)),
    subsidy?.title
  );

  return candidates.slice(0, 3).join(' / ') || '公式ページをご確認ください。';
};

const buildTargetExpenses = (subsidy) => {
  const direct = firstNonEmpty(subsidy, [
    'target_expenses_arr',
    'target_expenses',
    'target_expenses_text',
    'eligible_expenses',
    'eligible_expenses_text',
  ]);

  if (!direct) return '公式ページをご確認ください。';

  if (!looksLikeRawDump(direct)) return direct;

  const extracted = extractByLabels(direct, [
    '対象経費',
    '補助対象経費',
    '経費',
  ]);

  if (extracted) return extracted;

  const candidates = removeTitleLikeItems(
    splitCandidateText(direct).filter((item) => hasAnyKeyword(item, EXPENSE_KEYWORDS)),
    subsidy?.title
  );

  return candidates.slice(0, 4).join(' / ') || '公式ページをご確認ください。';
};

const buildTags = (subsidy, purposeTags = [], regionTags = []) => {
  const result = [];

  const push = (value) => {
    if (!value) return;

    const values = Array.isArray(value)
      ? value
      : String(value).split(/[,\n、/]/);

    values.forEach((item) => {
      const text = normalizeText(item);

      if (!text) return;
      if (isUnknownValue(text)) return;
      if (text.length > 24) return;
      if (isLabelOnly(text)) return;
      if (result.includes(text)) return;

      result.push(text);
    });
  };

  push(purposeTags);
  push(regionTags);
  push(subsidy?.tags);
  push(subsidy?.keywords);
  push(subsidy?.tag_names);

  return result.slice(0, 10);
};

const buildOrganization = (subsidy) => {
  const title = normalizeText(subsidy?.title);
  const organization = firstNonEmpty(subsidy, [
    'organization',
    'organization_name',
    'agency_name',
    'implementation_agency',
    'implementation_body',
    'institution_name',
    'provider',
  ]);

  if (!organization) return '';

  const normalizedTitle = title.replace(/[【】「」『』（）()［\]\s]/g, '');
  const normalizedOrg = organization.replace(/[【】「」『』（）()［\]\s]/g, '');

  if (
    normalizedOrg.length >= 8 &&
    normalizedTitle &&
    normalizedTitle.includes(normalizedOrg)
  ) {
    return '';
  }

  return organization;
};

export const buildDisplaySubsidy = ({
  subsidy,
  purposeTags = [],
  regionTags = [],
}) => {
  const grantInfo = buildGrantInfo(subsidy);

  return {
    id: subsidy?.id,
    title: firstNonEmpty(subsidy, ['title']) || '補助金・助成金情報',
    region:
      firstNonEmpty(subsidy, [
        'region_text',
        'region',
        'prefecture',
        'municipality',
      ]) || '全国',
    organization: buildOrganization(subsidy),
    status: buildStatus(subsidy),
    officialUrl: firstNonEmpty(subsidy, [
      'official_url',
      'source_url',
      'url',
    ]),
    amountMain: grantInfo.main,
    amountSub: grantInfo.sub,
    overview: buildOverview(subsidy),
    targetEntities: buildTargetEntities(subsidy),
    targetExpenses: buildTargetExpenses(subsidy),
    applicationPeriod: buildApplicationPeriod(subsidy),
    tags: buildTags(subsidy, purposeTags, regionTags),
    sourceType: firstNonEmpty(subsidy, ['source_type']),
  };
};
