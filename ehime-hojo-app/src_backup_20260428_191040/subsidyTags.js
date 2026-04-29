export const PURPOSE_TAGS = [
  '経営改善・経営強化', '地域活性・まちづくり', '設備投資', '人材育成・雇用',
  '生産性向上・業務効率化', '起業・創業・ベンチャー', '販路開拓・販路拡大', 'ものづくり・新商品開発',
  'デジタル', '省エネ', '環境', '再エネ・蓄エネ', '研究・実証実験・産学連携', '防犯・防災・BCP',
  '海外展開', '観光・インバウンド', '新規事業・第二創業', '空き家利用', '省力化・省人化', '事業承継'
];

export const INDUSTRY_TAGS = [
  '業種指定無し', 'サービス業', '農業', '医療・福祉', '製造業', '運輸業', '介護', '飲食業', '小売業',
  '宿泊業', '卸売業', '情報通信業', '漁業', '建設業', '林業', '食品製造業', '畜産業'
];

export const EXTERNAL_PORTALS = [
  'hojyokin-portal.jp', 'smart-hojokin.jp', 'subsidy-el.jp', 'biz-supporter.com',
  'tokyo-kosha.or.jp', 'lycorp.co.jp', 'yahoo.co.jp', 'prtimes.jp', 'note.com',
  'j-net21.smrj.go.jp', 'mirasapo-plus.go.jp', 'navinavi', 'shikin-pro',
  'kamome-ops.com', 'financeinjapan.com'
];

export const isOfficialDomain = (url) => {
  if (!url) return false;
  return url.includes('.go.jp') || url.includes('.lg.jp') || url.includes('.or.jp') || 
         url.includes('.ehime.jp') || url.includes('city.') || url.includes('pref.') || url.includes('town.');
};

export const isExternalPortal = (url) => {
  if (!url) return false;
  return EXTERNAL_PORTALS.some(domain => url.includes(domain)) || 
         (url.includes('hojokin') && !isOfficialDomain(url));
};

export const isMissingValue = (val) => {
  if (!val) return true; 
  const s = val.toString();
  return s.includes('未記載') || s.includes('不明') || s.includes('未設定') || s.includes('未具体化') || s.includes('要確認');
};

export const normalizeUrl = (rawUrl) => {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, '');
  } catch { // 🔥 UPDATE: (e) を削除しました
    return rawUrl; 
  }
};

export const resolveUrlMaybeRelative = (rawUrl, baseUrl) => {
  if (!rawUrl) return '';
  try {
    return normalizeUrl(new URL(rawUrl, baseUrl).toString());
  } catch {
    return normalizeUrl(rawUrl);
  }
};

export const makeSubsidyKey = (data) => {
  const norm = (s) => String(s || '').replace(/\s+/g, '').trim();
  const datePart = (data.application_start_date || data.application_end_date)
    ? `${norm(data.application_start_date)}~${norm(data.application_end_date)}`
    : norm(data.application_period_text || '');
  return [
    norm(data.organization),
    norm(data.title),
    norm(data.fiscal_year || ''),
    datePart
  ].join('::');
};