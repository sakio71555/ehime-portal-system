export const SITE_NAME = '愛媛の補助金・助成金ポータル';

export const SITE_URL =
  import.meta.env.VITE_SITE_URL ||
  'https://ehime-hojokin.jp';

export const DEFAULT_SEO = {
  title: '愛媛の補助金・助成金ポータル｜愛媛県内の事業者向け支援制度を検索',
  description:
    '愛媛県内の事業者向け補助金・助成金情報を検索できるポータルサイトです。松山市、今治市、西予市、宇和島市などの支援制度を、地域・目的・業種から探せます。',
  image: `${SITE_URL}/ogp.jpg`,
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

function firstSeoValue(subsidy, keys = []) {
  for (const key of keys) {
    const value = stripForSeo(subsidy?.[key]);

    if (
      value &&
      !['不明', '未確認', '未設定', 'null', 'undefined'].includes(value)
    ) {
      return value;
    }
  }

  return '';
}

function joinSeoParts(parts = [], separator = '・') {
  return parts.filter(Boolean).join(separator);
}

export function buildSubsidySeoTitle(subsidy) {
  const title = stripForSeo(subsidy?.title || '補助金・助成金情報');
  const amount = firstSeoValue(subsidy, ['amount_text', 'amount']);
  const period = firstSeoValue(subsidy, [
    'application_period_text',
    'application_period',
    'deadline',
  ]);
  const target = firstSeoValue(subsidy, [
    'target_entities',
    'eligible_applicants',
    'target_businesses',
  ]);

  const detailLabels = joinSeoParts([
    period ? '申請期間' : '',
    amount ? '補助上限' : '',
    target ? '対象者' : '',
  ]);

  const suffix = detailLabels || '制度概要';

  return truncateText(`${title}｜${suffix}｜愛媛の補助金`, 68);
}

export function buildSubsidySeoDescription(subsidy) {
  const title = stripForSeo(subsidy?.title || '補助金・助成金');
  const region = getSubsidyRegion(subsidy);

  const period = firstSeoValue(subsidy, [
    'application_period_text',
    'application_period',
    'deadline',
  ]);

  const amount = firstSeoValue(subsidy, ['amount_text', 'amount']);

  const status = firstSeoValue(subsidy, [
    'application_status',
    'status_text',
    'recruitment_status',
  ]);

  const target = firstSeoValue(subsidy, [
    'target_entities',
    'eligible_applicants',
    'target_businesses',
  ]);

  const details = joinSeoParts([
    target ? '対象者' : '',
    amount ? `補助上限額：${amount}` : '',
    period ? `申請期間：${period}` : '',
    status ? `公募状況：${status}` : '',
  ]);

  const tail = details
    ? `${details}、公式情報を整理。`
    : '対象者、補助上限額、申請期間、公募状況、公式情報を整理。';

  return truncateText(
    `${title}の${tail}${region}の事業者・個人向けに要点を確認できます。申請前に必ず公式情報をご確認ください。`,
    155
  );
}
