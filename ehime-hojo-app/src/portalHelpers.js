export const EHIME_MUNICIPALITIES = [
  '松山市', '今治市', '宇和島市', '八幡浜市', '新居浜市', '西条市', '大洲市', '伊予市',
  '四国中央市', '西予市', '東温市', '上島町', '久万高原町', '松前町', '砥部町', '内子町',
  '伊方町', '松野町', '鬼北町', '愛南町'
];

export const normalizeToArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[、,\n/]/).map(v => v.trim()).filter(Boolean);
  }
  return [];
};

export const getPurposeTagList = (item) => {
  return [
    ...normalizeToArray(item?.purposes),
    ...normalizeToArray(item?.tags)
  ];
};

export const getItemRegionCategories = (item) => {
  const targetText = `${item?.region_text || item?.region || ''} ${item?.organization || ''} ${item?.title || ''}`;
  const cats = [];
  let hasCity = false;
  EHIME_MUNICIPALITIES.forEach(city => {
    if (targetText.includes(city)) {
      cats.push(city);
      hasCity = true;
    }
  });
  if (!hasCity) cats.push('県・全国 (市町村指定なし)');
  return cats;
};

export const normalizeJapaneseDateText = (value) => {
  if (!value) return '';
  let str = String(value);
  str = str.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  str = str.replace(/令和([元0-9]+)年/g, (match, p1) => {
    const y = p1 === '元' ? 2019 : 2018 + parseInt(p1, 10);
    return `${y}年`;
  });
  str = str.replace(/平成([元0-9]+)年/g, (match, p1) => {
    const y = p1 === '元' ? 1989 : 1988 + parseInt(p1, 10);
    return `${y}年`;
  });
  return str;
};

export const extractDatesFromText = (value) => {
  const str = normalizeJapaneseDateText(value);
  const dates = [];
  let currentYear = new Date().getFullYear();

  const jpRegex = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?/g;
  let match;
  while ((match = jpRegex.exec(str)) !== null) {
    if (match[1]) currentYear = parseInt(match[1], 10);
    const parsed = new Date(currentYear, parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    if (!isNaN(parsed.getTime())) dates.push(parsed);
  }

  const isoRegex = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/g;
  while ((match = isoRegex.exec(str)) !== null) {
    const parsed = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    if (!isNaN(parsed.getTime())) dates.push(parsed);
  }
  return dates;
};

export const isExpired = (deadlineStr) => {
  if (!deadlineStr) return false;
  const rawStr = String(deadlineStr);
  if (rawStr === '不明' || rawStr === '未定' || rawStr.includes('随時')) return false;

  const dates = extractDatesFromText(rawStr);
  const str = normalizeJapaneseDateText(rawStr);

  if (dates.length === 0) {
    if (/(201[0-9]年|202[0-5]年|202[0-5]年度)/.test(str)) return true;
    return false;
  }

  const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));

  if (dates.length === 1 && (str.includes('開始') || str.includes('より') || str.includes('から') || str.includes('以降'))) {
    if (!str.includes('まで') && !str.includes('締切') && !str.includes('必着')) {
      return false;
    }
  }

  const now = new Date();
  latestDate.setHours(23, 59, 59, 999);
  return latestDate < now;
};

export const isItemClosed = (item) => {
  if (!item) return false;
  const now = new Date();

  if (item.application_end_date) {
    const endDate = new Date(item.application_end_date);
    if (!isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);
      return endDate < now;
    }
  }

  const periodText = item.application_period_text || item.deadline;
  if (periodText) {
    const dates = extractDatesFromText(periodText);
    if (dates.length > 0) return isExpired(periodText);
    if (String(periodText).includes('随時')) return false;
  }

  if (item.application_status === '受付終了') return true;
  if (item.application_status === '公募中' || item.application_status === '予告') return false;

  return false;
};

export const formatDisplayAmount = (amountStr) => {
  if (!amountStr) return '----';
  if (!/[0-9０-９]/.test(String(amountStr))) return '----';
  return amountStr;
};

export const parseAmount = (amountStr) => {
  if (!amountStr || amountStr === '不明' || amountStr === '未定') return 0;
  const str = String(amountStr).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/,/g, '');
  const match = str.match(/([0-9.]+)\s*(億円|万円|円)/);
  if (!match) return 0;
  let num = parseFloat(match[1]);
  if (match[2] === '億円') num *= 100000000;
  if (match[2] === '万円') num *= 10000;
  return num;
};

export const getSortableDateTimestamp = (item) => {
  if (item?.application_end_date) {
    const date = new Date(item.application_end_date);
    if (!isNaN(date.getTime())) return date.getTime();
  }

  const deadlineStr = item?.application_period_text || item?.deadline;
  if (!deadlineStr || deadlineStr === '不明' || deadlineStr === '未定' || String(deadlineStr).includes('随時')) {
    return 9999999999999;
  }

  const dates = extractDatesFromText(deadlineStr);
  if (dates.length > 0) {
    return Math.max(...dates.map(d => d.getTime()));
  }

  const normalized = normalizeJapaneseDateText(deadlineStr);
  if (/(201[0-9]年|202[0-5]年|202[0-5]年度)/.test(normalized)) return 0;

  return 9999999999998;
};