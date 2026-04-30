export const toHalfWidthNumberForStatus = (value = '') => {
  return String(value).replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
};

export const warekiToWesternTextForStatus = (value = '') => {
  let text = toHalfWidthNumberForStatus(value);

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

const normalizeIsoDate = (value) => {
  const text = String(value || '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return null;
};

const toIsoFromDateMatch = (match) => {
  if (!match) return null;

  const year = match[1];
  const month = String(Number(match[2])).padStart(2, '0');
  const day = String(Number(match[3])).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const parsePeriodDatesForStatus = (periodText = '') => {
  const text = warekiToWesternTextForStatus(periodText)
    .replace(/[〜~]/g, '～')
    .replace(/[－―ー]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const openEnded =
    /(助成枠に達するまで|予算に達するまで|予算額に達するまで|予算枠に達し次第|予算上限に達し次第|定員に達し次第|達し次第|なくなり次第|随時|通年|常時)/.test(
      text
    );

  const allDates = [
    ...text.matchAll(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日?/g),
  ];

  const firstIso = allDates.length > 0 ? toIsoFromDateMatch(allDates[0]) : null;
  const lastIso =
    allDates.length > 0 ? toIsoFromDateMatch(allDates[allDates.length - 1]) : null;

  if (openEnded) {
    return {
      startDate: firstIso,
      endDate: null,
      isOpenEnded: true,
    };
  }

  /**
   * 最重要:
   * 「2026年1月30日から2027年3月31日まで」のように
   * 開始日と終了日が両方ある場合は、最初を開始日、最後を終了日として扱う。
   * AI抽出文やJグランツ本文は途中に余計な文字が混ざることがあるため、
   * 正規表現1本で範囲を取るより、この方が安定する。
   */
  if (allDates.length >= 2) {
    return {
      startDate: firstIso,
      endDate: lastIso,
      isOpenEnded: false,
    };
  }

  const rangeMatch = text.match(
    /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日?.{0,40}(?:から|より|～|-).{0,40}(?:(20\d{2})年\s*)?(\d{1,2})月\s*(\d{1,2})日?/
  );

  if (rangeMatch) {
    const startDate = `${rangeMatch[1]}-${String(Number(rangeMatch[2])).padStart(
      2,
      '0'
    )}-${String(Number(rangeMatch[3])).padStart(2, '0')}`;

    const endYear = rangeMatch[4] || rangeMatch[1];

    const endDate = `${endYear}-${String(Number(rangeMatch[5])).padStart(
      2,
      '0'
    )}-${String(Number(rangeMatch[6])).padStart(2, '0')}`;

    return {
      startDate,
      endDate,
      isOpenEnded: false,
    };
  }

  if (allDates.length === 1) {
    return {
      startDate: null,
      endDate: firstIso,
      isOpenEnded: false,
    };
  }

  return {
    startDate: null,
    endDate: null,
    isOpenEnded: false,
  };
};

export const todayJstIsoForStatus = () => {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

export const forceApplicationStatusByPeriod = (data = {}) => {
  const periodText = String(
    data.application_period_text ||
      data.application_period ||
      data.applicationPeriod ||
      data.deadline ||
      ''
  ).trim();

  if (!periodText) {
    return data;
  }

  const closedText =
    /(受付終了|募集終了|公募終了|終了しました|募集は終了|受付は終了|申請受付を終了|終了いたしました)/.test(
      periodText
    );

  const badPeriodText =
    /(対象児童|出生|新生児|児童手当|住民登録|給付対象者|支給対象者|から今|から現在|より今|より現在|更新|更新日|お知らせ|一覧|忘れない)/.test(
      periodText
    );

  if (badPeriodText) {
    return {
      ...data,
      application_status:
        data.application_status === '受付終了' ? '受付終了' : '不明',
    };
  }

  const parsed = parsePeriodDatesForStatus(periodText);

  const startDate =
    parsed.startDate ||
    normalizeIsoDate(data.application_start_date) ||
    null;

  const endDate =
    parsed.endDate ||
    normalizeIsoDate(data.application_end_date) ||
    null;

  const isOpenEnded = parsed.isOpenEnded;
  const today = todayJstIsoForStatus();

  /**
   * 明示的に「受付終了」と書かれていて、かつ終了日が未来ではない場合のみ受付終了。
   * 終了日が未来なら、AIや既存値の受付終了を上書きして公募中に戻す。
   */
  if (closedText && (!endDate || endDate < today)) {
    return {
      ...data,
      application_start_date: startDate || data.application_start_date || null,
      application_end_date: endDate || data.application_end_date || null,
      application_status: '受付終了',
    };
  }

  if (endDate && endDate < today) {
    return {
      ...data,
      application_start_date: startDate || data.application_start_date || null,
      application_end_date: endDate,
      application_status: '受付終了',
    };
  }

  if (startDate && today < startDate) {
    return {
      ...data,
      application_start_date: startDate,
      application_end_date: endDate || data.application_end_date || null,
      application_status: '予告',
    };
  }

  if (isOpenEnded) {
    return {
      ...data,
      application_start_date: startDate || data.application_start_date || null,
      application_end_date: null,
      application_status: '公募中',
    };
  }

  if (startDate && endDate && startDate <= today && today <= endDate) {
    return {
      ...data,
      application_start_date: startDate,
      application_end_date: endDate,
      application_status: '公募中',
    };
  }

  /**
   * 終了日だけでも未来なら公募中扱い。
   * JグランツやAI抽出では開始日が欠けるケースがあるため。
   */
  if (!startDate && endDate && today <= endDate) {
    return {
      ...data,
      application_start_date: data.application_start_date || null,
      application_end_date: endDate,
      application_status: '公募中',
    };
  }

  return data;
};

export const normalizeJapaneseNumber = (value) => {
  return String(value || '').replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
};

export const parseAmountMaxYen = (text) => {
  if (!text) return 0;

  const s = normalizeJapaneseNumber(text).replace(/,/g, '').replace(/\s+/g, '');

  let maxVal = 0;
  const regex = /(\d+(?:\.\d+)?)(億円|万円|千円|円)/g;
  let match;

  while ((match = regex.exec(s)) !== null) {
    let num = parseFloat(match[1]);

    if (match[2] === '億円') num *= 100000000;
    if (match[2] === '万円') num *= 10000;
    if (match[2] === '千円') num *= 1000;

    if (num > maxVal) {
      maxVal = num;
    }
  }

  return Math.round(maxVal);
};

export const normalizeDateForDB = (value) => {
  if (!value) return null;

  const s = String(value).trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export const getConfidenceColor = (score) => {
  const n = Number(score || 0);

  if (n >= 85) return '#059669';
  if (n >= 70) return '#d97706';
  return '#dc2626';
};

export const getConfidenceLabel = (key) => {
  const labels = {
    title: 'タイトル',
    organization: '実施機関',
    region_text: '地域',
    application_period_text: '申請期間',
    amount_text: '金額',
    subsidy_rate_text: '補助率',
    target_entities_arr: '対象事業者',
    target_expenses_arr: '対象経費',
    official_url: '公式URL',
  };

  return labels[key] || key;
};
