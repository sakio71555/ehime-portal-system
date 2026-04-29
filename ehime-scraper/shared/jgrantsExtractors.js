function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function asString(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join(' / ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeZenkakuNumber(value) {
  return String(value || '')
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/，/g, ',')
    .replace(/％/g, '%');
}

function stripHtmlForExtraction(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/th>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(obj, keys, fallback = '') {
  if (!obj || typeof obj !== 'object') return fallback;

  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
}

function parseMoneyYen(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  const text = normalizeZenkakuNumber(stripHtmlForExtraction(value))
    .replace(/,/g, '')
    .trim();

  const numeric = Number(text.replace(/[^\d.]/g, ''));

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;

  if (text.includes('億')) return Math.round(numeric * 100000000);
  if (text.includes('万円') || text.includes('万')) return Math.round(numeric * 10000);
  if (text.includes('千円')) return Math.round(numeric * 1000);

  return Math.round(numeric);
}

function formatAmountText(value) {
  const yen = parseMoneyYen(value);
  if (!yen) return '不明';
  return `上限 ${yen.toLocaleString()}円`;
}

function extractAmountFromText(text) {
  const source = normalizeZenkakuNumber(stripHtmlForExtraction(text))
    .replace(/\s+/g, '')
    .replace(/,/g, '');

  if (!source) return 0;

  const patterns = [
    /(?:補助上限額|助成上限額|上限額|限度額|補助限度額|助成限度額|上限|最大)[：:・]?([0-9.]+)(億円|億|万円|万|千円|円)/,
    /([0-9.]+)(億円|億|万円|万|千円|円)(?:以内|以下|を上限|まで|限度)/,
    /(?:補助額|助成額)[：:・]?[^0-9]{0,12}([0-9.]+)(億円|億|万円|万|千円|円)/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;

    const num = Number(match[1]);
    const unit = match[2];

    if (!Number.isFinite(num) || num <= 0) continue;

    if (unit === '億円' || unit === '億') return Math.round(num * 100000000);
    if (unit === '万円' || unit === '万') return Math.round(num * 10000);
    if (unit === '千円') return Math.round(num * 1000);
    if (unit === '円') return Math.round(num);
  }

  return 0;
}

function isSafeRateValue(value) {
  const text = String(value || '').trim();

  if (!text) return false;
  if (text.length > 40) return false;

  if (/[<>=]/.test(text)) return false;
  if (/strong|span|style|class|div|href|<\/|<\//i.test(text)) return false;

  if (/上限|限度額|補助額|助成額|円|万円|億円|千円/.test(text)) return false;
  if (/対象経費$|補助対象$|金額$/.test(text)) return false;

  return true;
}

function normalizeRateValue(value) {
  const clean = normalizeZenkakuNumber(stripHtmlForExtraction(value))
    .replace(/\s+/g, '')
    .trim();

  if (!isSafeRateValue(clean)) return '';

  return clean;
}

function extractRateFromText(text) {
  const clean = normalizeZenkakuNumber(stripHtmlForExtraction(text));
  if (!clean) return '';

  const compact = clean.replace(/\s+/g, '');

  const patterns = [
    /(?:補助率|助成率)[：:・]?(?:補助対象経費の)?((?:[0-9]+分の[0-9]+|[0-9]+\/[0-9]+|[0-9]+%)(?:以内|以下)?)/,
    /(?:補助率|助成率)[：:・]?(定額)/,
    /(?:補助率|助成率)[：:・]?(全額)/,
    /((?:[0-9]+分の[0-9]+|[0-9]+\/[0-9]+|[0-9]+%)(?:以内|以下)?)/,
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (!match) continue;

    const value = normalizeRateValue(match[1]);
    if (!value) continue;

    return value;
  }

  return '';
}

const EXPENSE_KEYWORDS = [
  '機械装置費',
  '機械器具費',
  '設備・機器',
  'システム導入費',
  'ソフトウェア費',
  'クラウド利用料',
  '広告宣伝費',
  '展示会出展費',
  '専門家経費',
  '専門家謝金',
  '委託費',
  '外注費',
  '開発費',
  '試作費',
  '設計費',
  '工事費',
  '輸送費',
  '物流費',
  '運搬費',
  '原材料費',
  '材料費',
  '借料',
  '使用料',
  '賃借料',
  '印刷製本費',
  '通信運搬費',
  '消耗品費',
  '検査費',
  '認証取得費',
  '研修費',
  '翻訳費',
  '通訳費',
  '人件費',
  '旅費',
  '謝金',
  '設備費',
  '機器費',
  '広報費',
  '設備',
  '機器',
];

function isBadExpenseText(value) {
  const text = normalizeZenkakuNumber(stripHtmlForExtraction(value)).trim();

  if (!text) return true;
  if (text.length < 2) return true;
  if (text.length > 60) return true;

  if (/[<>=]/.test(text)) return true;
  if (/strong|span|style|class|div|href|<\/|<\//i.test(text)) return true;

  if (/補助率|助成率|上限|限度額|補助額|助成額|申請期間|受付期間|募集期間/.test(text)) {
    return true;
  }

  if (/[0-9]+分の[0-9]+|[0-9]+\/[0-9]+|[0-9]+%|[0-9]+％/.test(text)) {
    return true;
  }

  if (/円|万円|億円|千円|千円未満|切捨て|切り捨て/.test(text)) {
    return true;
  }

  if (/以内|以下|以上|未満/.test(text) && !EXPENSE_KEYWORDS.some((word) => text.includes(word))) {
    return true;
  }

  return false;
}

function cleanupExpenseItem(value) {
  let text = stripHtmlForExtraction(value)
    .replace(/^[・\-—◆◇■□●○◎※＊*]+/, '')
    .replace(/^[0-9]+[.)．、]/, '')
    .replace(/^[①-⑳]/, '')
    .replace(/^(及び|または|又は|並びに)/, '')
    .replace(/[。．]+$/g, '')
    .trim();

  text = text
    .replace(/^対象経費[：:・]?/, '')
    .replace(/^補助対象経費[：:・]?/, '')
    .replace(/^助成対象経費[：:・]?/, '')
    .replace(/^対象となる経費[：:・]?/, '')
    .trim();

  if (isBadExpenseText(text)) return '';

  return text;
}

function extractExpenseKeywordsFromText(value) {
  const clean = stripHtmlForExtraction(value);
  if (!clean) return [];

  const found = [...new Set(EXPENSE_KEYWORDS.filter((word) => clean.includes(word)))];

  const filtered = found.filter((word) => {
    if (word === '設備' && found.some((w) => w.includes('設備') && w !== '設備')) return false;
    if (word === '機器' && found.some((w) => w.includes('機器') && w !== '機器')) return false;
    if (word === '謝金' && found.includes('専門家謝金')) return false;
    if (word === '広報費' && found.includes('広告宣伝費')) return false;

    if (
      word === '設備費' &&
      found.some((w) => ['機械装置費', '機械器具費', '設備・機器'].includes(w))
    ) {
      return false;
    }

    if (
      word === '機器費' &&
      found.some((w) => ['機械装置費', '機械器具費', '設備・機器'].includes(w))
    ) {
      return false;
    }

    return true;
  });

  return filtered.slice(0, 8);
}

function splitExpenseText(value) {
  const clean = stripHtmlForExtraction(value);
  if (!clean) return [];

  const directItems = clean
    .split(/[\n、，,／/]|(?:及び)|(?:または)|(?:又は)|(?:並びに)/)
    .map(cleanupExpenseItem)
    .filter(Boolean);

  const keywordItems = extractExpenseKeywordsFromText(clean);

  return [...new Set([...directItems, ...keywordItems])].slice(0, 8);
}

function extractTargetExpensesFromText(text) {
  const clean = stripHtmlForExtraction(text);
  if (!clean) return [];

  return extractExpenseKeywordsFromText(clean);
}

function splitTags(value) {
  if (!value) return [];

  return String(value)
    .split(/[\/,、，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  normalizeText,
  asString,
  normalizeZenkakuNumber,
  stripHtmlForExtraction,
  pick,
  parseMoneyYen,
  formatAmountText,
  extractAmountFromText,
  normalizeRateValue,
  extractRateFromText,
  splitExpenseText,
  extractTargetExpensesFromText,
  splitTags,
};
