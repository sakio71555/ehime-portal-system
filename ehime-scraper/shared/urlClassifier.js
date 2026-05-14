const path = require('path');

const INCLUDE_LINK_KEYWORDS = [
  '補助',
  '助成',
  '補助金',
  '助成金',
  '医療費助成',
  '住宅改修助成',
  '旅客運賃助成',
  '支援金',
  '奨励金',
  '支援事業',
  '助成事業',
  '補助事業',
  '公募',
  '募集',
  '交付金',
  '事業費補助',
  '導入支援',
  '促進事業',
  '整備事業',
];

const EXCLUDE_LINK_KEYWORDS = [
  '一覧',
  'リンク集',
  'サイトマップ',
  '例規',
  '申請書',
  '様式',
  '記入例',
  '入札',
  '契約',
  '職員採用',
  'パブリックコメント',
  '統計',
  '議会',
  '認定申請',
  '児童手当',
  '介護保険',
  '証明書',
  'モニター募集',
  'アンケート',
  '審議会',
  '委員募集',
  '申請書様式のみ',
  '記入例のみ',
  'Jグランツ',
  'jgrants',
];

const ASSISTANCE_SIGNAL_PATTERN =
  /補助金|助成金|補助事業|助成事業|補助制度|助成制度|支援金|給付金|奨励金|交付金|利子補給|医療費助成|住宅改修助成|旅客運賃助成|補助|助成/;

const PERSONAL_ASSISTANCE_PATTERN =
  /母子保健|不妊治療|妊産婦|医療費助成|先進医療|子ども医療|こども医療|住宅改修|移住|定住|空き家|離島|旅客運賃助成|高齢者|障がい者|障害者|福祉/;

const DETAIL_SIGNAL_PATTERNS = [
  /申請期間/,
  /受付期間/,
  /募集期間/,
  /対象経費/,
  /助成対象/,
  /補助対象/,
  /補助率/,
  /補助上限/,
  /助成額/,
  /補助額/,
  /上限(?:額)?/,
  /対象者/,
  /対象事業/,
  /交付対象/,
];

const INDEX_TITLE_PATTERNS = [
  /一覧/,
  /リンク集/,
  /^補助金・助成金$/,
  /^補助金$/,
  /^助成金$/,
  /^補助制度$/,
  /^支援制度$/,
  /各種補助/,
  /各種補助制度/,
  /事業者向け支援制度/,
  /産業・商工業/,
  /農林水産業/,
  /目的別.*助成/,
  /目的別/,
  /くらしの情報/,
  /産業/,
];

const NOISE_PATTERNS = [
  /入札/,
  /契約/,
  /職員採用/,
  /パブリックコメント/,
  /統計/,
  /議会/,
  /認定申請/,
  /児童手当/,
  /介護保険/,
  /証明書/,
  /モニター募集/,
  /アンケート/,
  /審議会/,
  /委員募集/,
];

const APPLICATION_FORM_PATTERNS = [
  /申請書/,
  /様式/,
  /記入例/,
  /記載例/,
  /チェックリスト/,
  /同意書/,
  /委任状/,
  /チラシ/,
  /パンフレット/,
  /説明資料/,
  /shinseisho/i,
  /youshiki/i,
  /kisairei/i,
  /form/i,
];

const GUIDELINE_PDF_PATTERNS = [
  /募集要項/,
  /公募要領/,
  /交付要綱/,
  /実施要領/,
  /制度案内/,
];

function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((p) =>
      u.searchParams.delete(p)
    );
    return u.toString().replace(/\/$/, '');
  } catch {
    return String(rawUrl || '').trim();
  }
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isJgrantsUrl(url) {
  return /(^|\.)jgrants-portal\.go\.jp$/i.test(getHostname(url));
}

function isPdfUrl(url) {
  return /\.pdf(?:$|\?)/i.test(String(url || ''));
}

function countMatches(text, patterns) {
  const value = String(text || '');
  return patterns.reduce((count, pattern) => count + (pattern.test(value) ? 1 : 0), 0);
}

function includesKeyword(haystack, keywords) {
  const value = String(haystack || '');
  return keywords.some((keyword) => value.includes(keyword));
}

function hasAssistanceSignal(text = '') {
  return ASSISTANCE_SIGNAL_PATTERN.test(String(text || ''));
}

function normalizeLinkText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function addScore(condition, amount, label, reasons, penalties) {
  if (!condition) return 0;
  if (amount >= 0) reasons.push(label);
  else penalties.push(label);
  return amount;
}

function inferSeedType(url) {
  const normalized = normalizeUrl(url);
  if (/\/(life|kurashi|sangyo|mokuteki)\//i.test(normalized)) return 'category_index';
  return 'municipal_index';
}

function normalizeSeeds(rawSeeds) {
  if (Array.isArray(rawSeeds)) {
    return rawSeeds
      .map((seed) => (typeof seed === 'string' ? { name: '指定URL', url: seed } : seed))
      .filter((seed) => seed?.url)
      .map((seed) => normalizeSeedObject(seed.name || seed.municipality || '指定URL', seed));
  }

  return Object.entries(rawSeeds || {}).flatMap(([name, urls]) => {
    if (!Array.isArray(urls)) return [];
    return urls.map((url) => normalizeSeedObject(name, { url }));
  });
}

function normalizeSeedObject(name, seed) {
  const url = String(seed.url || '').trim();
  const normalizedForHost = normalizeUrl(url);
  const hostname = getHostname(normalizedForHost || url);
  return {
    name,
    url,
    type: seed.type || inferSeedType(url),
    prefecture: seed.prefecture || '愛媛県',
    municipality: seed.municipality || name,
    source_trust: seed.source_trust || 'official_municipality',
    enabled: seed.enabled !== false,
    crawl_links: seed.crawl_links !== false,
    max_depth: Number.isFinite(Number(seed.max_depth)) ? Number(seed.max_depth) : 2,
    allowed_domains: seed.allowed_domains || (hostname ? [hostname] : []),
    official_url_policy: seed.official_url_policy || 'child_detail_only',
  };
}

function isAllowedBySeed(url, seed) {
  if (!seed?.allowed_domains?.length) return true;
  const hostname = getHostname(url);
  return seed.allowed_domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function getDetailSignalCount(text) {
  return countMatches(text, DETAIL_SIGNAL_PATTERNS);
}

function isApplicationFormPage({ url = '', title = '', text = '' } = {}) {
  const titleUrl = `${title}\n${url}`;
  const textHead = String(text || '').slice(0, 1200);
  const haystack = `${titleUrl}\n${textHead}`;
  const hasFormSignalInTitleUrl = countMatches(titleUrl, APPLICATION_FORM_PATTERNS) >= 1;
  const hasFormSignal = hasFormSignalInTitleUrl || countMatches(textHead, APPLICATION_FORM_PATTERNS) >= 1;
  const hasGuidelineSignal = countMatches(haystack, GUIDELINE_PDF_PATTERNS) >= 1;
  const detailSignalCount = getDetailSignalCount(text);
  const titleHasAssistanceSignal = hasAssistanceSignal(title);

  if (hasFormSignalInTitleUrl && !hasGuidelineSignal) return true;
  if (hasFormSignal && titleHasAssistanceSignal) return false;
  return hasFormSignal && !hasGuidelineSignal && detailSignalCount === 0;
}

function isGenericIndexTitle(title = '') {
  const normalized = String(title || '').replace(/\s+/g, '');
  if (!normalized) return false;
  return INDEX_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isLikelyIndexPage({
  url = '',
  title = '',
  text = '',
  linkCount = 0,
  subsidyLinkCount = 0,
} = {}) {
  const detailSignals = getDetailSignalCount(text);
  const normalizedUrl = normalizeUrl(url).toLowerCase();
  const detailLikeHtmlUrl = /\.html?$/i.test(normalizedUrl) && !/\/index\.html?$/i.test(normalizedUrl);
  const titleHasSubsidySignal = hasAssistanceSignal(title);
  const indexLikeUrl =
    /\/(?:index\.html?|hojokin|josei|sangyou|sangyo|shien|life\/\d+|theme\d+)(?:\/)?$/i.test(
      normalizedUrl
    ) || /\/page\/theme\d+\.html$/i.test(normalizedUrl);

  if (detailLikeHtmlUrl && !isGenericIndexTitle(title) && (titleHasSubsidySignal || detailSignals >= 1)) {
    return false;
  }

  if (isGenericIndexTitle(title) && detailSignals < 4) return true;
  if (indexLikeUrl && detailSignals < 4) return true;
  if (subsidyLinkCount >= 4 && detailSignals < 4) return true;
  if (linkCount >= 80 && subsidyLinkCount >= 3 && detailSignals < 5) return true;
  if (/補助金|助成金|支援制度/.test(title) && subsidyLinkCount >= 3 && detailSignals < 3) {
    return true;
  }

  return false;
}

function scoreCandidate({ url = '', title = '', text = '', linkCount = 0, pageType = 'unknown' } = {}) {
  const haystack = `${title}\n${url}\n${String(text || '').slice(0, 5000)}`;
  let score = 0;
  const strongAssistanceSignal = hasAssistanceSignal(haystack);

  if (/補助金/.test(title)) score += 8;
  if (/助成金/.test(title)) score += 8;
  if (/助成/.test(title)) score += 8;
  if (/補助/.test(title)) score += 8;
  if (/支援事業/.test(title)) score += 6;
  if (/助成事業/.test(title)) score += 6;
  if (/補助事業/.test(title)) score += 6;
  if (/公募/.test(title)) score += 4;
  if (/医療費助成/.test(title)) score += 5;
  if (/住宅改修助成/.test(title)) score += 5;
  if (/移住/.test(title)) score += 5;
  if (/定住/.test(title)) score += 5;
  if (/空き家/.test(title)) score += 5;
  if (/hojokin/i.test(url)) score += 3;
  if (/josei/i.test(url)) score += 3;
  if (/shien/i.test(url)) score += 3;
  if (/対象者/.test(haystack)) score += 4;
  if (/助成対象/.test(haystack)) score += 4;
  if (/補助対象/.test(haystack)) score += 4;
  if (/対象経費/.test(haystack)) score += 3;
  if (/補助率/.test(haystack)) score += 3;
  if (/申請期間|受付期間|募集期間/.test(haystack)) score += 4;
  if (/助成額/.test(haystack)) score += 4;
  if (/補助額/.test(haystack)) score += 4;
  if (/上限/.test(haystack)) score += 3;
  if (isPdfUrl(url) && /募集要項/.test(haystack)) score += 2;
  if (isPdfUrl(url) && /公募要領/.test(haystack)) score += 2;

  if (/一覧/.test(title)) score -= 8;
  if (/リンク集/.test(title)) score -= 8;
  if (/制度案内/.test(title) && !strongAssistanceSignal) score -= 10;
  if (/認定申請/.test(title) && !strongAssistanceSignal) score -= 15;
  if (/児童手当/.test(title) && !strongAssistanceSignal) score -= 15;
  if (/介護保険|保険制度/.test(title) && !strongAssistanceSignal) score -= 15;
  if (/モニター募集/.test(title)) score -= 8;
  if (isJgrantsUrl(url) || /jgrants-portal\.go\.jp/.test(haystack)) score -= 8;
  if (/\/index\.html?$/i.test(url)) score -= 5;
  if (linkCount >= 100) score -= 5;
  if (String(text || '').trim().length > 0 && String(text || '').trim().length < 300) score -= 5;
  if (isApplicationFormPage({ url, title, text })) score -= 5;
  if (pageType === 'subsidy_detail') score += 2;
  if (pageType === 'pdf_guideline') score += 2;

  return score;
}

function scoreLinkCandidate({
  url = '',
  text = '',
  parentHeading = '',
  sourceContext = '',
  isSameDomain = true,
  isLikelyNavigation = false,
  isLikelyFooter = false,
  isLikelyBreadcrumb = false,
} = {}) {
  const normalizedText = normalizeLinkText(text);
  const normalizedHeading = normalizeLinkText(parentHeading);
  const haystack = `${normalizedText}\n${normalizedHeading}\n${sourceContext}\n${url}`;
  const reasons = [];
  const penalties = [];
  let score = 0;

  score += addScore(/補助(?!者|員|職員|事務|業務|作業)/.test(normalizedText), 8, 'link_text:補助 +8', reasons, penalties);
  score += addScore(/助成/.test(normalizedText), 8, 'link_text:助成 +8', reasons, penalties);
  score += addScore(/補助金/.test(normalizedText), 8, 'link_text:補助金 +8', reasons, penalties);
  score += addScore(/助成金/.test(normalizedText), 8, 'link_text:助成金 +8', reasons, penalties);
  score += addScore(/支援事業/.test(normalizedText), 6, 'link_text:支援事業 +6', reasons, penalties);
  score += addScore(/助成事業/.test(normalizedText), 6, 'link_text:助成事業 +6', reasons, penalties);
  score += addScore(/補助事業/.test(normalizedText), 6, 'link_text:補助事業 +6', reasons, penalties);
  score += addScore(/医療費助成/.test(normalizedText), 5, 'link_text:医療費助成 +5', reasons, penalties);
  score += addScore(/住宅改修助成/.test(normalizedText), 5, 'link_text:住宅改修助成 +5', reasons, penalties);
  score += addScore(/移住/.test(normalizedText), 5, 'link_text:移住 +5', reasons, penalties);
  score += addScore(/定住/.test(normalizedText), 5, 'link_text:定住 +5', reasons, penalties);
  score += addScore(/空き家/.test(normalizedText), 5, 'link_text:空き家 +5', reasons, penalties);
  score += addScore(/支援金/.test(normalizedText), 5, 'link_text:支援金 +5', reasons, penalties);
  score += addScore(/奨励金/.test(normalizedText), 5, 'link_text:奨励金 +5', reasons, penalties);
  score += addScore(/公募/.test(normalizedText), 5, 'link_text:公募 +5', reasons, penalties);
  score += addScore(/募集/.test(normalizedText), 4, 'link_text:募集 +4', reasons, penalties);
  score += addScore(/交付金/.test(normalizedText), 4, 'link_text:交付金 +4', reasons, penalties);
  score += addScore(/hojokin/i.test(url), 4, 'url:hojokin +4', reasons, penalties);
  score += addScore(/hojyokin/i.test(url), 4, 'url:hojyokin +4', reasons, penalties);
  score += addScore(/\/hojo(?:\/|\.|_|-)/i.test(url), 4, 'url:/hojo +4', reasons, penalties);
  score += addScore(/josei/i.test(url), 4, 'url:josei +4', reasons, penalties);
  score += addScore(/shien/i.test(url), 4, 'url:shien +4', reasons, penalties);
  score += addScore(/business|sangyoshinko/i.test(url), 3, 'url:business/sangyoshinko +3', reasons, penalties);
  score += addScore(/sangyou/i.test(url), 3, 'url:sangyou +3', reasons, penalties);
  score += addScore(/chusyou/i.test(url), 3, 'url:chusyou +3', reasons, penalties);
  score += addScore(/keizai/i.test(url), 3, 'url:keizai +3', reasons, penalties);
  score += addScore(/nougyou/i.test(url), 3, 'url:nougyou +3', reasons, penalties);
  score += addScore(/kankou/i.test(url), 3, 'url:kankou +3', reasons, penalties);
  score += addScore(/sougyou/i.test(url), 3, 'url:sougyou +3', reasons, penalties);
  score += addScore(
    isPdfUrl(url) && /youkou|boshu|koubo|guideline/i.test(url),
    3,
    'pdf_filename:youkou/boshu/koubo/guideline +3',
    reasons,
    penalties
  );

  score += addScore(/補助金/.test(normalizedHeading), 4, 'parent_heading:補助金 +4', reasons, penalties);
  score += addScore(/助成金/.test(normalizedHeading), 4, 'parent_heading:助成金 +4', reasons, penalties);
  score += addScore(/中小企業/.test(normalizedHeading), 3, 'parent_heading:中小企業 +3', reasons, penalties);
  score += addScore(/商工/.test(normalizedHeading), 3, 'parent_heading:商工 +3', reasons, penalties);
  score += addScore(/産業/.test(normalizedHeading), 2, 'parent_heading:産業 +2', reasons, penalties);
  score += addScore(/農業/.test(normalizedHeading), 2, 'parent_heading:農業 +2', reasons, penalties);
  score += addScore(/観光/.test(normalizedHeading), 2, 'parent_heading:観光 +2', reasons, penalties);
  score += addScore(/創業/.test(normalizedHeading), 3, 'parent_heading:創業 +3', reasons, penalties);
  score += addScore(/支援制度/.test(normalizedHeading), 3, 'parent_heading:支援制度 +3', reasons, penalties);

  const strongSubsidyText = hasAssistanceSignal(normalizedText) && !/事務補助|業務補助|作業補助/.test(normalizedText);
  score += addScore(/暮らし/.test(normalizedHeading), -2, 'parent_heading:暮らし -2', reasons, penalties);
  score += addScore(/税/.test(normalizedHeading), -4, 'parent_heading:税 -4', reasons, penalties);
  score += addScore(/戸籍/.test(normalizedHeading), -4, 'parent_heading:戸籍 -4', reasons, penalties);
  score += addScore(/ごみ/.test(normalizedHeading), -4, 'parent_heading:ごみ -4', reasons, penalties);
  score += addScore(/消防/.test(normalizedHeading), -3, 'parent_heading:消防 -3', reasons, penalties);
  score += addScore(/教育/.test(normalizedHeading), -3, 'parent_heading:教育 -3', reasons, penalties);
  score += addScore(/子育て/.test(normalizedHeading) && !strongSubsidyText, -2, 'parent_heading:子育て -2', reasons, penalties);

  score += addScore(/一覧/.test(normalizedText), -10, 'link_text:一覧 -10', reasons, penalties);
  score += addScore(/リンク集/.test(normalizedText), -10, 'link_text:リンク集 -10', reasons, penalties);
  score += addScore(/サイトマップ/.test(normalizedText), -10, 'link_text:サイトマップ -10', reasons, penalties);
  score += addScore(/例規/.test(normalizedText), -10, 'link_text:例規 -10', reasons, penalties);
  score += addScore(/申請書/.test(normalizedText), -10, 'link_text:申請書 -10', reasons, penalties);
  score += addScore(/様式/.test(normalizedText), -10, 'link_text:様式 -10', reasons, penalties);
  score += addScore(/記入例/.test(normalizedText), -10, 'link_text:記入例 -10', reasons, penalties);
  score += addScore(/認定申請/.test(normalizedText) && !strongSubsidyText, -15, 'link_text:認定申請のみ -15', reasons, penalties);
  score += addScore(/手当/.test(normalizedText) && !strongSubsidyText, -15, 'link_text:手当のみ -15', reasons, penalties);
  score += addScore(/児童手当/.test(normalizedText) && !strongSubsidyText, -15, 'link_text:児童手当のみ -15', reasons, penalties);
  score += addScore(/介護保険|保険制度/.test(normalizedText) && !strongSubsidyText, -15, 'link_text:保険制度のみ -15', reasons, penalties);
  score += addScore(/入札/.test(normalizedText), -10, 'link_text:入札 -10', reasons, penalties);
  score += addScore(/契約/.test(normalizedText), -10, 'link_text:契約 -10', reasons, penalties);
  score += addScore(/職員採用|会計年度任用職員|職員/.test(normalizedText) && !strongSubsidyText, -10, 'link_text:職員募集 -10', reasons, penalties);
  score += addScore(/パブリックコメント/.test(normalizedText), -10, 'link_text:パブリックコメント -10', reasons, penalties);
  score += addScore(/統計/.test(normalizedText) && !strongSubsidyText, -10, 'link_text:統計 -10', reasons, penalties);
  score += addScore(/取消|取り消し|取り消しました/.test(normalizedText), -30, 'link_text:取消 -30', reasons, penalties);
  score += addScore(/受付終了|募集終了/.test(normalizedText), -6, 'link_text:受付終了 -6', reasons, penalties);
  score += addScore(/報告|策定しました/.test(normalizedText), -8, 'link_text:報告/策定 -8', reasons, penalties);
  score += addScore(/融資制度/.test(normalizedText) && !/利子補給|補助/.test(normalizedText), -6, 'link_text:融資制度のみ -6', reasons, penalties);
  score += addScore(/導入計画/.test(normalizedText) && !strongSubsidyText, -6, 'link_text:導入計画のみ -6', reasons, penalties);
  score += addScore(/商品券|キャンペーン/.test(normalizedText) && !strongSubsidyText, -5, 'link_text:商品券/キャンペーン -5', reasons, penalties);
  score += addScore(/sitemap/i.test(url), -8, 'url:sitemap -8', reasons, penalties);
  score += addScore(/gikai/i.test(url), -8, 'url:gikai -8', reasons, penalties);
  score += addScore(/nyusatsu/i.test(url), -8, 'url:nyusatsu -8', reasons, penalties);
  score += addScore(/keiyaku/i.test(url), -8, 'url:keiyaku -8', reasons, penalties);
  score += addScore(/saiyou/i.test(url), -8, 'url:saiyou -8', reasons, penalties);
  score += addScore(/toukei/i.test(url), -8, 'url:toukei -8', reasons, penalties);
  score += addScore(/form/i.test(url), -8, 'url:form -8', reasons, penalties);
  score += addScore(/style/i.test(url), -8, 'url:style -8', reasons, penalties);
  score += addScore(/shinseisho/i.test(url), -8, 'url:shinseisho -8', reasons, penalties);
  score += addScore(/kisairei/i.test(url), -8, 'url:kisairei -8', reasons, penalties);
  score += addScore(isJgrantsUrl(url), -8, 'url:jgrants-portal.go.jp -8', reasons, penalties);
  score += addScore(/^#/.test(url), -5, 'same_page_anchor -5', reasons, penalties);
  score += addScore(/^(mailto|tel|javascript):/i.test(url), -5, 'invalid_scheme -5', reasons, penalties);
  score += addScore(/\.(?:jpe?g|png|gif|webp|svg|ico|zip|docx?|xlsx?|pptx?)$/i.test(url), -5, 'asset_or_non_page_file -5', reasons, penalties);
  score += addScore(normalizedText.length > 0 && normalizedText.length < 3, -5, 'link_text:短すぎる -5', reasons, penalties);
  score += addScore(isLikelyNavigation || isLikelyFooter || isLikelyBreadcrumb, -5, 'common_navigation_area -5', reasons, penalties);
  score += addScore(!isSameDomain, -4, 'external_domain -4', reasons, penalties);
  score += addScore(
    /\/(?:kenko|fukushi|kosodate)\//i.test(url) && !strongSubsidyText,
    -4,
    'url:kenko/fukushi/kosodate without strong subsidy -4',
    reasons,
    penalties
  );

  const hasPositiveSignal = reasons.length > 0 && score > -10;
  const hasSubsidySignal = hasAssistanceSignal(haystack) || /支援|公募|募集|交付/.test(haystack) || /hojo|josei|shien/i.test(url);

  return {
    score,
    reasons,
    penalties,
    normalizedText,
    hasPositiveSignal,
    hasSubsidySignal,
  };
}

function classifyPage(page = {}) {
  const { url = '', title = '', text = '', linkCount = 0, subsidyLinkCount = 0, isPdf = false } = page;

  if (isJgrantsUrl(url)) return 'jgrants_page';

  const haystack = `${title}\n${url}\n${String(text || '').slice(0, 2500)}`;

  if (isPdf || isPdfUrl(url)) {
    if (isApplicationFormPage(page)) return 'application_form';
    if (countMatches(haystack, GUIDELINE_PDF_PATTERNS) >= 1) return 'pdf_guideline';
    return 'application_form';
  }

  if (isLikelyIndexPage({ url, title, text, linkCount, subsidyLinkCount })) {
    if (/産業|商工|農業|観光|住宅|環境|kurashi|sangyo|life/i.test(`${title} ${url}`)) {
      return 'category_index';
    }
    return 'municipal_index';
  }

  if (isApplicationFormPage(page)) return 'application_form';
  if (NOISE_PATTERNS.some((pattern) => pattern.test(`${title}\n${url}`)) && !hasAssistanceSignal(haystack)) {
    return 'noise_page';
  }

  if (PERSONAL_ASSISTANCE_PATTERN.test(haystack) && hasAssistanceSignal(haystack)) {
    return 'personal_assistance';
  }

  if (
    /\.html?$/i.test(url) &&
    /hojo|hojokin|josei|shien/i.test(url) &&
    (getDetailSignalCount(text) >= 1 || hasAssistanceSignal(haystack) || /支援/.test(haystack))
  ) {
    return 'subsidy_detail';
  }

  if (getDetailSignalCount(text) >= 2 && hasAssistanceSignal(haystack)) {
    return 'subsidy_detail';
  }

  return 'unknown';
}

function extractCandidateLinksFromIndexPage({ links = [], seed = null } = {}) {
  const candidates = [];
  const seen = new Set();

  links.forEach((link) => {
    const url = normalizeUrl(link.url);
    const text = normalizeLinkText(link.text);
    if (!url || seen.has(url)) return;
    const isSameDomain = !seed || isAllowedBySeed(url, seed);
    const scored = scoreLinkCandidate({
      url,
      text,
      parentHeading: link.parentHeading,
      sourceContext: link.sourceContext,
      isSameDomain,
      isLikelyNavigation: link.isLikelyNavigation,
      isLikelyFooter: link.isLikelyFooter,
      isLikelyBreadcrumb: link.isLikelyBreadcrumb,
    });
    const haystack = `${text} ${link.parentHeading || ''} ${url}`;
    const hasKeyword = includesKeyword(haystack, INCLUDE_LINK_KEYWORDS);
    const hasStrongAssistanceSignal = hasAssistanceSignal(haystack);
    const hasExcludedKeyword = includesKeyword(haystack, EXCLUDE_LINK_KEYWORDS) && !hasStrongAssistanceSignal;

    if (!hasKeyword && !scored.hasSubsidySignal && scored.score < 5) return;

    seen.add(url);
    candidates.push({
      url,
      text,
      normalizedText: scored.normalizedText,
      sourceContext: link.sourceContext || '',
      parentHeading: link.parentHeading || '',
      score: hasExcludedKeyword ? Math.min(scored.score, 0) : scored.score,
      reasons: scored.reasons,
      penalties: hasExcludedKeyword
        ? [...scored.penalties, 'excluded_keyword']
        : scored.penalties,
      isPdf: isPdfUrl(url),
      isSameDomain,
      isLikelyNavigation: Boolean(link.isLikelyNavigation),
      isLikelyFooter: Boolean(link.isLikelyFooter),
      isLikelyBreadcrumb: Boolean(link.isLikelyBreadcrumb),
      shouldCrawl:
        (hasExcludedKeyword ? Math.min(scored.score, 0) : scored.score) >= 8 &&
        isSameDomain &&
        !hasExcludedKeyword &&
        !isJgrantsUrl(url) &&
        !isApplicationFormPage({ url, title: text }),
    });
  });

  return candidates.sort((a, b) => b.score - a.score);
}

function getUrlBasename(url) {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(path.basename(pathname));
  } catch {
    return String(url || '');
  }
}

function decideOfficialUrl({ pageType, sourceUrl, extractedOfficialUrl = '' } = {}) {
  if (pageType === 'subsidy_detail' || pageType === 'personal_assistance' || pageType === 'pdf_guideline') {
    return { officialUrl: normalizeUrl(sourceUrl), reason: `${pageType}: source_urlを公式URLに採用` };
  }

  const candidate = extractedOfficialUrl ? normalizeUrl(extractedOfficialUrl) : '';
  if (
    candidate &&
    !isJgrantsUrl(candidate) &&
    !isLikelyIndexPage({ url: candidate }) &&
    !isApplicationFormPage({ url: candidate, title: getUrlBasename(candidate) })
  ) {
    return { officialUrl: candidate, reason: '本文内の公式・詳細リンクを採用' };
  }

  return { officialUrl: '', reason: `${pageType}: official_url対象外` };
}

module.exports = {
  normalizeUrl,
  getHostname,
  isJgrantsUrl,
  isPdfUrl,
  normalizeSeeds,
  isAllowedBySeed,
  isApplicationFormPage,
  isGenericIndexTitle,
  isLikelyIndexPage,
  scoreCandidate,
  scoreLinkCandidate,
  classifyPage,
  extractCandidateLinksFromIndexPage,
  decideOfficialUrl,
  getUrlBasename,
  normalizeLinkText,
};
