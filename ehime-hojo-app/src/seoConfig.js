export const SITE_NAME = '愛媛の補助金・助成金ポータル';

export const SITE_URL =
  import.meta.env.VITE_SITE_URL ||
  'https://ehime-hojokin.jp';

export const DEFAULT_SEO = {
  title: '愛媛の補助金・助成金ポータル｜愛媛県内の事業者向け支援制度を検索',
  description:
    '愛媛県内の事業者向け補助金・助成金情報を検索できるポータルサイトです。松山市、今治市、西予市、宇和島市などの支援制度を、地域・目的・業種から探せます。',
  image: `${SITE_URL}/logo.png`,
};

export function absoluteUrl(path = '/') {
  if (!path) return SITE_URL;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}

export function truncateText(text, max = 150) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();

  if (value.length <= max) return value;

  return `${value.slice(0, max - 1)}…`;
}

export function stripForSeo(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSubsidyRegion(subsidy) {
  return (
    subsidy?.municipality ||
    subsidy?.region_text ||
    subsidy?.region ||
    subsidy?.prefecture ||
    '愛媛県'
  );
}

export function buildSubsidySeoTitle(subsidy) {
  const title = stripForSeo(subsidy?.title || '補助金・助成金情報');
  const region = getSubsidyRegion(subsidy);

  return `【${region}】${title}｜申請期間・上限金額・補助率`;
}

export function buildSubsidySeoDescription(subsidy) {
  const title = stripForSeo(subsidy?.title || '補助金・助成金');
  const region = getSubsidyRegion(subsidy);

  const period =
    subsidy?.application_period_text ||
    subsidy?.deadline ||
    '申請期間未確認';

  const amount =
    subsidy?.amount_text ||
    subsidy?.amount ||
    '上限金額未確認';

  const rate =
    subsidy?.subsidy_rate_text ||
    subsidy?.subsidy_rate ||
    '補助率未確認';

  const organization =
    subsidy?.organization ||
    '実施機関未確認';

  return truncateText(
    `${region}の「${title}」は、${organization}が実施する補助金・助成金情報です。申請期間：${period}。${amount}。補助率：${rate}。対象者・対象経費・公式公募ページを確認できます。申請前に必ず公式情報をご確認ください。`,
    155
  );
}
