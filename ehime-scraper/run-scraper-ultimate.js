require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = global.fetch || require('node-fetch');

const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning: TODO:')) return;
  originalWarn(...args);
};

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const pdfParseModule = require('pdf-parse');
const {
  sanitizeSubsidyRow,
  isNoisySubsidyCandidate,
} = require('./shared/subsidySafety');
const {
  isJgrantsUrl,
  normalizeSeeds,
  isApplicationFormPage,
  isGenericIndexTitle,
  isLikelyIndexPage,
  scoreCandidate,
  classifyPage,
  extractCandidateLinksFromIndexPage,
  decideOfficialUrl,
  getUrlBasename,
  normalizeLinkText,
} = require('./shared/urlClassifier');

const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, TAVILY_API_KEY } = process.env;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('❌ 環境変数が不足しています。.envファイルを確認してください。');
}

if (!TAVILY_API_KEY) {
  console.warn('⚠️ TAVILY_API_KEY が未設定です。seed_urls.json / SCRAPER_URLS の巡回のみ実行します。');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const toPositiveInt = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};
const CONFIG = {
  dryRun: process.env.SCRAPER_DRY_RUN === '1',
  maxUrls: toPositiveInt(process.env.SCRAPER_MAX_URLS, 0),
  maxInserts: toPositiveInt(process.env.SCRAPER_MAX_INSERTS, 0),
  prefilterRegisteredUrls: process.env.SCRAPER_PREFILTER_SOURCE_URL !== '0',
  maxDepth: toPositiveInt(process.env.SCRAPER_MAX_DEPTH, 0),
  logCandidates: process.env.SCRAPER_LOG_CANDIDATES !== '0',
  seedOnly: process.env.SCRAPER_SEED_ONLY === '1',
  detailOnly: process.env.SCRAPER_DETAIL_ONLY === '1',
  seedUrls: String(process.env.SCRAPER_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
};

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const reiwaYear = currentYear - 2018; 
const todayStr = `${currentYear}年（令和${reiwaYear}年）${currentMonth}月${new Date().getDate()}日`;

// ==============================================
// 👑 秘伝の書：愛媛県20自治体＋αの完全攻略マスターデータ
// ==============================================
const BASE_SUBSIDY_WORDS = "(補助金 OR 助成金 OR 交付金 OR 給付金 OR 支援 OR 奨励金 OR 利子補給 OR 融資)";
const EXCLUDE_WORDS = "-議事録 -予算 -交付要綱だけ -広報 -入札 -審議会 -募集終了 -実績報告";

const EHIME_STRATEGIES = [
  { name: '愛媛県庁', domain: 'pref.ehime.jp', keywords: '令和 募集' },
  { name: 'ミラサポ', domain: 'mirasapo-plus.go.jp', keywords: '愛媛県' },
  { name: '今治市', domain: 'city.imabari.ehime.jp', keywords: '創業 OR 省エネ OR 空き家 OR 移住' },
  { name: '新居浜市', domain: 'city.niihama.lg.jp', keywords: '産業振興 OR 中小企業 OR 住宅 OR 子育て' },
  { name: '西条市', domain: 'city.saijo.ehime.jp', keywords: '地域産業競争力 OR 新エネルギー OR 農業' },
  { name: '四国中央市', domain: 'city.shikokuchuo.ehime.jp', keywords: '人材確保 OR 創業 OR EV OR ZEH' },
  { name: '上島町', domain: 'town.kamijima.lg.jp', keywords: '町民補助制度 OR 子育て OR 移住 OR 耐震' },
  { name: '松山市', domain: 'city.matsuyama.ehime.jp', keywords: '利子補助 OR 融資 OR 人材育成 OR ゼロカーボン' },
  { name: '伊予市', domain: 'city.iyo.lg.jp', keywords: '出産世帯 OR ZEH OR EV OR 省エネ家電' },
  { name: '東温市', domain: 'city.toon.ehime.jp', keywords: '蓄電池 OR 燃料電池 OR EV OR 家具固定' },
  { name: '久万高原町', domain: 'kumakogen.jp', keywords: '移住者住宅改修 OR 定住促進 OR 結婚新生活 OR 出産世帯' },
  { name: '松前町', domain: 'town.masaki.ehime.jp', keywords: '出産世帯 OR 耐震 OR 空家 OR 創業' },
  { name: '砥部町', domain: 'town.tobe.ehime.jp', keywords: '住宅 OR 新エネルギー OR 不妊治療 OR 出産世帯 OR UIJ' },
  { name: '宇和島市', domain: 'city.uwajima.ehime.jp', keywords: '新エネルギー OR 中小企業者等応援 OR 防災 OR 子育て' },
  { name: '八幡浜市', domain: 'city.yawatahama.ehime.jp', keywords: '省エネルギー対応設備 OR 生産性向上 OR 漁業' },
  { name: '大洲市', domain: 'city.ozu.ehime.jp', keywords: '中小企業者 OR 移住定住 OR 農林業 OR 蓄電池' },
  { name: '西予市', domain: 'city.seiyo.ehime.jp', keywords: '利子補給 OR サテライトオフィス OR 空き家 OR 子育て' },
  { name: '内子町', domain: 'town.uchiko.ehime.jp', keywords: '創業 OR 事業承継 OR 地域づくり OR 子育て OR 住まい' },
  { name: '伊方町', domain: 'town.ikata.ehime.jp', keywords: '農林漁業振興 OR 耐震 OR 出産祝い金 OR 不妊治療' },
  { name: '松野町', domain: 'town.matsuno.ehime.jp', keywords: '定住住宅建築奨励金 OR EV OR 新エネルギー OR 通学定期券 OR 協働のまちづくり' },
  { name: '鬼北町', domain: 'town.kihoku.ehime.jp', keywords: '移住定住 OR 空き家 OR 子育て OR 住宅リフォーム OR ZEH' },
  { name: '愛南町', domain: 'town.ainan.ehime.jp', keywords: '新エネルギー OR 移住者住宅改修 OR 中小企業者等経営強化 OR 出産世帯' }
];

const EHIME_AREAS = ['全国', '愛媛県', ...EHIME_STRATEGIES.slice(2).map(s => s.name)];

const SEED_URLS = {
  '愛媛県庁': ['https://www.pref.ehime.jp/page/theme11.html', 'https://www.pref.ehime.jp/site/kurashi/'],
  '今治市': ['https://www.city.imabari.ehime.jp/sangyou/', 'https://www.city.imabari.ehime.jp/kurashi/'],
  '新居浜市': ['https://www.city.niihama.lg.jp/life/3/', 'https://www.city.niihama.lg.jp/life/4/'],
  '西条市': ['https://www.city.saijo.ehime.jp/life/3/'],
  '四国中央市': ['https://www.city.shikokuchuo.ehime.jp/life/3/'],
  '上島町': ['https://www.town.kamijima.lg.jp/life/3/'],
  '松山市': [
    'https://www.city.matsuyama.ehime.jp/kurashi/kurashi/hojokin/',
    'https://www.city.matsuyama.ehime.jp/kurashi/sangyo/chusyoukigyou/'
  ],
  '伊予市': ['https://www.city.iyo.lg.jp/kurashi/sangyo/'],
  '東温市': ['https://www.city.toon.ehime.jp/life/3/'],
  '久万高原町': ['https://www.kumakogen.jp/life/3/'],
  '松前町': ['https://www.town.masaki.ehime.jp/life/3/'],
  '砥部町': ['https://www.town.tobe.ehime.jp/life/3/'],
  '宇和島市': ['https://www.city.uwajima.ehime.jp/life/3/'],
  '八幡浜市': ['https://www.city.yawatahama.ehime.jp/life/3/'],
  '大洲市': ['https://www.city.ozu.ehime.jp/life/3/'],
  '西予市': [
    'https://www.city.seiyo.ehime.jp/kakuka/sangyo_kensetsu/keizai_suishin/hojyokinn/'
  ],
  '内子町': ['https://www.town.uchiko.ehime.jp/life/3/'],
  '伊方町': ['https://www.town.ikata.ehime.jp/life/3/'],
  '松野町': ['https://www.town.matsuno.ehime.jp/life/3/'],
  '鬼北町': ['https://www.town.kihoku.ehime.jp/life/3/'],
  '愛南町': [
    'https://www.town.ainan.ehime.jp/kurashi/mokuteki/josei/'
  ]
};

const OTHER_PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','福岡県','佐賀県','長崎県','熊本県','大分県',
  '宮崎県','鹿児島県','沖縄県'
];

function isOtherPrefectureRegion(region = '') {
  if (!region) return false;
  if (region.includes('愛媛')) return false;
  if (region.includes('全国')) return false;
  return OTHER_PREFECTURES.some(pref => region.includes(pref));
}

function makeSubsidyKey(data) {
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
}

function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    [...u.searchParams.keys()].forEach((p) => {
      if (/^utm_/i.test(p) || /^(fbclid|gclid|yclid)$/i.test(p)) u.searchParams.delete(p);
    });
    return u.toString().replace(/\/$/, '');
  } catch (e) { return rawUrl; }
}

function normalizeFetchUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch (e) { return rawUrl; }
}

function normalizeUrlKey(rawUrl) {
  return normalizeUrl(rawUrl);
}

function normalizeOfficialUrlForSourceId(rawUrl) {
  return normalizeUrl(rawUrl);
}

function createOfficialSiteSourceExternalId(officialUrl, sourceUrl = '') {
  const normalizedOfficialUrl = normalizeOfficialUrlForSourceId(officialUrl || sourceUrl);
  if (!normalizedOfficialUrl) {
    return {
      sourceType: '',
      sourceExternalId: '',
      normalizedOfficialUrl: '',
    };
  }

  const hash = crypto
    .createHash('sha256')
    .update(normalizedOfficialUrl)
    .digest('hex')
    .slice(0, 32);

  return {
    sourceType: 'official_site',
    sourceExternalId: `official_site:${hash}`,
    normalizedOfficialUrl,
  };
}

function resolveUrlMaybeRelative(rawUrl, baseUrl) {
  if (!rawUrl) return '';
  try {
    return normalizeFetchUrl(new URL(rawUrl, baseUrl).toString());
  } catch {
    return normalizeFetchUrl(rawUrl);
  }
}

function isSameDomain(url, domain) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function shouldKeepUrl(url, domain) {
  const u = normalizeUrl(url);
  if (!isSameDomain(u, domain)) return false;

  const ng = ['/nyusatsu/', '/bid/', '/koho/', '/gikai/', '/zaisei/'];
  if (ng.some(x => u.includes(x))) return false;

  return true;
}

function looksLikeSubsidyLink(text, url) {
  const hay = `${text || ''} ${url || ''}`;
  return /補助金|助成金|給付金|支援|支援制度|奨励金|利子補給|交付金|要領|募集|申請|手当|補助事業|ガイドブック|応援/.test(hay);
}

const EXCLUDED_LINK_AREA_SELECTOR = [
  'header',
  'footer',
  'nav',
  '.breadcrumb',
  '.breadcrumbs',
  '.pankuzu',
  '.side',
  '.sidebar',
  '.sidemenu',
  '.global-nav',
  '.gnav',
  '.local-nav',
  '.footer',
  '#footer',
  '#header',
  '#gnav',
  '#breadcrumb',
  '#tmp_pankuzu',
  '#tmp_footer',
  '#tmp_header',
  '#tmp_menu',
  '#tmp_lnavi',
].join(',');

const CONTENT_AREA_SELECTORS = [
  'main',
  'article',
  '#tmp_contents',
  '#contents',
  '#main',
  '.content',
  '.main',
  '.article',
  '.entry',
  '.body',
];

function pickContentRoot($) {
  for (const selector of CONTENT_AREA_SELECTORS) {
    const candidates = $(selector).filter((_, el) => $(el).find('a[href]').length > 0 || $(el).text().trim().length > 300);
    if (candidates.length > 0) return candidates.first();
  }
  return $('body');
}

function getAreaFlags($, el) {
  const classIdHaystack = $(el)
    .parents()
    .addBack()
    .map((_, node) => `${$(node).attr('id') || ''} ${$(node).attr('class') || ''}`)
    .get()
    .join(' ');

  return {
    isLikelyNavigation:
      $(el).closest('header, nav, .global-nav, .gnav, .local-nav, .sidemenu, .side, .sidebar, #gnav, #tmp_menu, #tmp_lnavi').length > 0 ||
      /nav|gnav|menu|side|sidebar|lnavi|global/i.test(classIdHaystack),
    isLikelyFooter:
      $(el).closest('footer, .footer, #footer, #tmp_footer').length > 0 ||
      /footer|tmp_footer/i.test(classIdHaystack),
    isLikelyBreadcrumb:
      $(el).closest('.breadcrumb, .breadcrumbs, .pankuzu, #breadcrumb, #tmp_pankuzu').length > 0 ||
      /breadcrumb|breadcrumbs|pankuzu|tmp_pankuzu/i.test(classIdHaystack),
  };
}

function findParentHeading($, el) {
  let node = $(el);
  for (let depth = 0; depth < 7 && node.length; depth++) {
    const previousHeading = node.prevAll('h1,h2,h3,h4,h5,h6').first();
    if (previousHeading.length) return normalizeLinkText(previousHeading.text());

    const parent = node.parent();
    const parentHeading = parent.children('h1,h2,h3,h4,h5,h6').first();
    if (parentHeading.length) return normalizeLinkText(parentHeading.text());

    node = parent;
  }
  return normalizeLinkText($('h1').first().text());
}

function getSourceContext($, el) {
  const container = $(el).closest('li, tr, section, article, .box, .list, .item, div');
  const text = normalizeLinkText((container.length ? container : $(el).parent()).text());
  return text.slice(0, 220);
}

function collectCandidateLinksFromDocument($, baseUrl) {
  const root = pickContentRoot($);
  const links = [];

  root.find('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = normalizeLinkText($(el).text());
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (href.startsWith('#')) return;

    const abs = resolveUrlMaybeRelative(href, baseUrl);
    if (!abs) return;
    const flags = getAreaFlags($, el);

    links.push({
      url: abs,
      text,
      sourceContext: getSourceContext($, el),
      parentHeading: findParentHeading($, el),
      ...flags,
    });
  });

  return links;
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { 
        signal: controller.signal, 
        headers: { 'User-Agent': 'EhimeSubsidyBot/Ultimate' } 
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        if (res.status === 404) {
          const slashFallbackUrl = getTrailingSlashFallbackUrl(url);
          if (slashFallbackUrl) {
            console.log(`  ↪️ 404のため末尾スラッシュ付きで再試行: ${slashFallbackUrl}`);
            const fallbackController = new AbortController();
            const fallbackTimeout = setTimeout(() => fallbackController.abort(), 15000);
            try {
              const fallbackRes = await fetch(slashFallbackUrl, {
                signal: fallbackController.signal,
                headers: { 'User-Agent': 'EhimeSubsidyBot/Ultimate' },
              });
              clearTimeout(fallbackTimeout);
              if (fallbackRes.ok) return fallbackRes;
              if (fallbackRes.status === 429 || fallbackRes.status >= 500) {
                throw new Error(`RETRYABLE_HTTP ${fallbackRes.status}`);
              }
              const fallbackErr = new Error(`HTTP ${fallbackRes.status} NO_RETRY`);
              fallbackErr.statusCode = fallbackRes.status;
              fallbackErr.fetchUrl = slashFallbackUrl;
              fallbackErr.finalUrl = fallbackRes.url || slashFallbackUrl;
              throw fallbackErr;
            } catch (fallbackErr) {
              clearTimeout(fallbackTimeout);
              if (String(fallbackErr.message).includes('NO_RETRY')) throw fallbackErr;
              throw fallbackErr;
            }
          }
        }
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`RETRYABLE_HTTP ${res.status}`);
        }
        const err = new Error(`HTTP ${res.status} NO_RETRY`);
        err.statusCode = res.status;
        err.fetchUrl = url;
        err.finalUrl = res.url || url;
        throw err;
      }

      if (url.includes('j-net21') && res.url && !res.url.match(/\/articles\/\d+/)) {
        throw new Error(`記事が削除されリダイレクトされました (${res.url}) NO_RETRY`);
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      
      if (String(err.message).includes('NO_RETRY')) throw err;
      if (i === retries) throw err;
      
      await sleep(2000 * (i + 1));
    }
  }
}

function getTrailingSlashFallbackUrl(url) {
  try {
    const u = new URL(url);
    if (u.pathname.endsWith('/')) return '';
    const lastSegment = u.pathname.split('/').pop() || '';
    if (/\.[a-z0-9]{2,6}$/i.test(lastSegment)) return '';
    u.pathname = `${u.pathname}/`;
    return u.toString();
  } catch {
    return '';
  }
}

async function collectLinksFromHub(url, domain) {
  try {
    const res = await fetchWithRetry(url);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const links = new Set();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (!href) return;

      try {
        const abs = normalizeFetchUrl(new URL(href, url).toString());
        if (shouldKeepUrl(abs, domain) && looksLikeSubsidyLink(text, abs)) {
          links.add(abs);
        }
      } catch {}
    });

    return [...links];
  } catch (e) {
    console.log(`  ⚠️ ハブ展開エラー (${url}):`, e.message);
    return [];
  }
}

async function fetchPageTextDynamic(url) {
  const res = await fetchWithRetry(url);
  const contentType = res.headers.get('content-type') || '';
  const fetchedUrl = normalizeFetchUrl(res.url || url);
  const statusCode = res.status;
  const isRedirected = Boolean(res.redirected || (res.url && normalizeFetchUrl(res.url) !== normalizeFetchUrl(url)));

  if (contentType.includes('application/pdf') || fetchedUrl.toLowerCase().endsWith('.pdf')) {
    const pdfStats = {
      pdf_checked: 1,
      pdf_text_extracted: 0,
      pdf_ocr_attempted: 0,
    };
    try {
      console.log(`  📄 PDFデータをダウンロード＆解析中...`);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // 1. まずは通常の pdf-parse で高速テキスト抽出
      let cleanText = await parsePdfText(buffer);
      cleanText = cleanText.replace(/\n\s*\n/g, '\n').trim();
      if (cleanText.length > 0) pdfStats.pdf_text_extracted = 1;
      
      // 2. 🔥 OCRフォールバック: テキストが300文字未満なら「スキャン画像」と判定してOCR実行
      if (cleanText.length < 300) {
        console.log(`  ⚠️ スキャン画像PDFの可能性 (抽出文字数: ${cleanText.length}文字)。OCRフォールバックを実行します...`);
        pdfStats.pdf_ocr_attempted = 1;
        
        // PDFを画像(Base64)に変換
        const pdfImages = await convertPdfToImages(buffer);
        const targetImages = pdfImages.slice(0, 5); // 膨大なコストと時間を防ぐため先頭5ページに限定
        
        console.log(`  👁️ Vision AI (gpt-4o-mini) で ${targetImages.length} ページ分の画像を直接読み取ります...`);
        
        // GPT-4o-mini の Vision 機能を使って画像から直接テキストを抽出
        const visionMessages = [
          { 
            role: "system", 
            content: "あなたは優秀なOCRアシスタントです。提供された画像（スキャンされたPDF文書）から、補助金の募集要領などのテキストを正確に文字起こししてください。箇条書きや表のレイアウトも可能な限り維持してください。" 
          },
          { 
            role: "user", 
            content: targetImages.map(b64 => ({
              type: "image_url",
              image_url: { url: `data:image/png;base64,${b64}` }
            }))
          }
        ];
        
        const ocrRes = await openai.chat.completions.create({
          model: "gpt-4o-mini", // コストと速度のバランスで mini を採用
          messages: visionMessages,
          temperature: 0.0
        });
        
        cleanText = ocrRes.choices[0].message.content;
        console.log(`  ✅ OCR抽出完了: 新たに ${cleanText.length} 文字を取得しました！`);
      }

      return {
        text: cleanText,
        extractedOfficialUrl: '',
        isPdf: true,
        pdfUrl: fetchedUrl,
        fetchedUrl,
        statusCode,
        isRedirected,
        title: getUrlBasename(fetchedUrl),
        links: [],
        linkCount: 0,
        subsidyLinkCount: 0,
        pdfStats,
      };
    } catch (err) {
      console.log(`  ⚠️ PDFの解析(OCR含む)に失敗しました: ${err.message}`);
      return {
        text: '',
        extractedOfficialUrl: '',
        isPdf: true,
        pdfUrl: fetchedUrl,
        fetchedUrl,
        statusCode,
        isRedirected,
        title: getUrlBasename(fetchedUrl),
        links: [],
        linkCount: 0,
        subsidyLinkCount: 0,
        pdfStats,
      };
    }
  }

  const rawHtml = await res.text();
  const $ = cheerio.load(rawHtml);
  const title =
    $('h1').first().text().trim() ||
    $('title').first().text().replace(/\s+/g, ' ').trim() ||
    getUrlBasename(fetchedUrl);
  const links = collectCandidateLinksFromDocument($, fetchedUrl);
  const subsidyLinkCount = links.filter((link) => looksLikeSubsidyLink(link.text, link.url)).length;
  
  let extractedOfficialUrl = '';
  let metaDataText = '';

  if (fetchedUrl.includes('j-net21.smrj.go.jp')) {
    const detailHeading = $('h2, h3, h4, h5').filter((_, el) => $(el).text().includes('詳細情報を見る')).first();
    if (detailHeading.length) {
      let node = detailHeading.next();
      while (node.length) {
        if (node.is('h2, h3, h4, h5')) break;
        const link = node.find('a[href^="http"]').filter((_, el) => {
          const href = $(el).attr('href') || '';
          return !href.includes('j-net21.smrj.go.jp') && !href.includes('facebook') && !href.includes('twitter');
        }).first();
        if (link.length) { extractedOfficialUrl = link.attr('href'); break; }
        node = node.next();
      }
    }
    $('tr').each((i, el) => {
      const th = $(el).find('th').text().trim();
      const td = $(el).find('td').text().trim();
      if (th && td && ['分野', '業種', '地域', '実施機関'].includes(th)) {
        metaDataText += `【J-Net21公式指定 ${th}】 ${td}\n`;
      }
    });
  } else {
    const link = $('a[href^="http"]').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('詳細') || text.includes('要領') || text.includes('公式') || text.includes('こちら');
    }).first();
    if (link.length) extractedOfficialUrl = link.attr('href');
  }

  const contentRoot = pickContentRoot($).clone();
  contentRoot.find(`script, style, noscript, svg, iframe, ${EXCLUDED_LINK_AREA_SELECTOR}`).remove();
  const mainText = contentRoot.text().trim() || $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
  let cleanText = mainText.replace(/\n\s*\n/g, '\n').trim();
  
  return {
    text: `${metaDataText}\n\n${cleanText}`,
    extractedOfficialUrl,
    isPdf: false,
    fetchedUrl,
    statusCode,
    isRedirected,
    title,
    links,
    linkCount: links.length,
    subsidyLinkCount,
    pdfStats: {
      pdf_checked: 0,
      pdf_text_extracted: 0,
      pdf_ocr_attempted: 0,
    },
  };
}

async function convertPdfToImages(buffer) {
  try {
    const pdf2img = require('pdf-img-convert');
    return pdf2img.convert(buffer, { base64: true });
  } catch (err) {
    throw new Error(
      `OCR用PDF画像変換ライブラリの読み込みに失敗しました: ${err.message}`
    );
  }
}

async function parsePdfText(buffer) {
  if (typeof pdfParseModule === 'function') {
    const pdfData = await pdfParseModule(buffer);
    return pdfData?.text || '';
  }

  const { PDFParse } = pdfParseModule;

  if (!PDFParse) {
    throw new Error('pdf-parse の PDFParse export が見つかりません');
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result?.text || '';
  } finally {
    await parser.destroy();
  }
}

async function extractFullWithAI(text, sourceUrl) {
  const systemPrompt = `本日は【${todayStr}】です。提供された記事（またはPDF抽出テキスト）から、愛媛県内で活用可能な補助金・助成金・給付金・支援制度を抽出し、指定されたJSON構造で返してください。

【対象】
事業者向け、個人向け、世帯向け、子育て世帯向け、移住者向け、住宅所有者向け、地域団体向けを含む。

【🚨 厳格な判定ルール】
- 対象地域が「愛媛県」または愛媛県内市町村、もしくは「全国」の制度は is_subsidy: true
- 愛媛県以外の特定自治体・都道府県限定の制度は is_subsidy: false
- 単なる制度紹介、相談窓口、セミナー案内、貸付のみの融資制度は is_subsidy: false
- 記事内に募集要領、対象者、補助額、申請期限のいずれかがある場合を優先して補助制度と判定

【抽出・正規化ルール（重要）】
1. application_status: 記事から読み取れる公募状況を「公募中」「受付終了」「予告」「不明」等で出力。
2. official_url: 記事内に記載されている公式な公募ページや詳細ページのURL。見つからなければ空文字。
3. amount_max_yen: 金額の上限が分かる場合は「半角数字のみ」で出力（例: 50万円 -> 500000）。不明なら 0。
4. application_start_date / application_end_date: 判明している場合は YYYY-MM-DD 形式。不明なら空文字 "" にすること。
5. purposes / industries / tags: [既存リスト]にない場合はテキストから具体的なキーワードを抽出し、要素ごとの文字列配列 ["単語1", "単語2"] にすること。
6. target_entities_arr / target_expenses_arr: 箇条書きや文章から対象となる「事業者/個人」や「経費名」を抽出し、配列 ["法人", "個人事業主"] のようにすること。
7. prefecture / municipality: 愛媛県の市町村名が分かれば municipality に「松山市」等を入れ、prefecture は「愛媛県」。全国の場合は prefecture「全国」。
8. データが存在しない場合は "不明" または空文字 ""、配列の場合は [] を使用すること。

[既存のpurposesリスト]: 経営改善・経営強化, 地域活性・まちづくり, 設備投資, 人材育成・雇用, 生産性向上・業務効率化, 起業・創業・ベンチャー, 販路開拓・販路拡大, ものづくり・新商品開発, デジタル, 省エネ, 環境, 再エネ・蓄エネ, 研究・実証実験・産学連携, 防犯・防災・BCP, 海外展開, 観光・インバウンド, 新規事業・第二創業, 空き家利用, 省力化・省人化, 事業承継
[既存のindustriesリスト]: 業種指定無し, サービス業, 農業, 医療・福祉, 製造業, 運輸業, 介護, 飲食業, 小売業, 宿泊業, 卸売業, 情報通信業, 漁業, 建設業, 林業, 食品製造業, 畜産業`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `取得元URL: ${sourceUrl}\n\n記事本文:\n${text.slice(0, 10000)}` }],
    response_format: { 
      type: "json_schema", 
      json_schema: { 
        name: "subsidy_extraction", 
        strict: true, 
        schema: { 
          type: "object", 
          properties: { 
            is_subsidy: { type: "boolean" }, 
            title: { type: "string" }, 
            organization: { type: "string" }, 
            region_text: { type: "string" }, 
            prefecture: { type: "string" }, 
            municipality: { type: "string" }, 
            application_status: { type: "string" },
            application_period_text: { type: "string" }, 
            application_start_date: { type: "string" }, 
            application_end_date: { type: "string" }, 
            amount_text: { type: "string" }, 
            amount_max_yen: { type: "integer" }, 
            subsidy_rate_text: { type: "string" }, 
            target_expenses_arr: { type: "array", items: { type: "string" } }, 
            target_entities_arr: { type: "array", items: { type: "string" } }, 
            purposes: { type: "array", items: { type: "string" } },
            industries: { type: "array", items: { type: "string" } }, 
            tags: { type: "array", items: { type: "string" } }, 
            official_url: { type: "string" }, 
            fiscal_year: { type: "string" }, 
            summary: { type: "string" },
            raw_excerpt: { type: "string" }, 
            confidence: { type: "integer" }
          }, 
          required: ["is_subsidy", "title", "organization", "region_text", "prefecture", "municipality", "application_status", "application_period_text", "application_start_date", "application_end_date", "amount_text", "amount_max_yen", "subsidy_rate_text", "target_expenses_arr", "target_entities_arr", "purposes", "industries", "tags", "official_url", "fiscal_year", "summary", "raw_excerpt", "confidence"], 
          additionalProperties: false 
        } 
      } 
    }
  });
  return JSON.parse(res.choices[0].message.content);
}

function loadSeedObjects() {
  const seedPath = path.join(__dirname, 'seed_urls.json');
  try {
    const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    return normalizeSeeds(raw).filter((seed) => seed.enabled);
  } catch (err) {
    console.warn(`⚠️ seed_urls.json の読み込みに失敗しました。内蔵seedを使用します: ${err.message}`);
    return normalizeSeeds(SEED_URLS).filter((seed) => seed.enabled);
  }
}

function buildSeedsFromConfig() {
  if (CONFIG.seedUrls.length === 0) return loadSeedObjects();
  return normalizeSeeds({ 指定URL: CONFIG.seedUrls }).filter((seed) => seed.enabled);
}

function todayCompact() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function writeCandidateLog(entries) {
  if (!CONFIG.logCandidates || entries.length === 0) return;
  const logDir = path.join(__dirname, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `candidates_${todayCompact()}.json`);
  fs.writeFileSync(logPath, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`📝 candidate log: ${logPath}`);
}

function createQueueEntry({ url, seed, discoveredFromUrl = '', depth = 0 }) {
  const originalUrl = url;
  const fetchUrl = normalizeFetchUrl(url);
  return {
    url: fetchUrl,
    original_url: originalUrl,
    fetch_url: fetchUrl,
    normalized_key: normalizeUrlKey(fetchUrl),
    seed,
    seed_url: seed?.url || fetchUrl,
    discovered_from_url: discoveredFromUrl,
    depth,
  };
}

function isBadApplicationPeriod(value, parsedData = {}) {
  const text = String(value || '').trim();
  if (!text) return false;
  const title = String(parsedData.title || '').trim();
  if (title && text === title) return true;
  if (title && text.includes(title) && text.length <= title.length + 20) return true;
  if (/^(申請期間|受付期間|募集期間|対象者|対象経費|補助率|上限金額)$/.test(text)) return true;
  if (text.length <= 8 && /期間|対象|概要|詳細/.test(text)) return true;
  if (
    /補助金・助成金一覧|事業者向け支援制度|支援制度一覧|更新日|お知らせ|忘れない|児童手当|対象児童|対象となる支出|支出が対象|対象経費|申請方法|交付要綱/.test(text)
  ) {
    return true;
  }
  if (/^受付終了$|^募集終了$|^終了しました$/.test(text)) return true;
  if (/補助金|助成金|支援事業/.test(text) && !/\d{4}|令和|平成|月|日|随時|終了/.test(text)) {
    return true;
  }
  if (!isApplicationPeriodLike(text)) return true;
  return false;
}

function isApplicationPeriodLike(value) {
  const text = String(value || '').trim();
  if (!text || text === '不明') return false;
  return /(\d{4}年|\d{4}[-/]\d{1,2}|令和\d+年|平成\d+年|[一二三四五六七八九十元0-9]+月[0-9一二三四五六七八九十]+日|随時募集|随時受付|予算(?:額)?に達|予算上限|受付期間|募集期間|申請期限|締切|まで|通年)/.test(
    text
  );
}

function sanitizeApplicationPeriodText(value, parsedData = {}) {
  if (isBadApplicationPeriod(value, parsedData)) {
    return '公式ページをご確認ください';
  }
  return String(value || '').trim();
}

function japaneseEraFiscalYearToWestern(era, yearText) {
  const year = yearText === '元' ? 1 : Number(yearText);
  if (!Number.isFinite(year) || year <= 0) return null;
  if (era === '令和') return 2018 + year;
  if (era === '平成') return 1988 + year;
  return null;
}

function extractFiscalYears(text = '') {
  const value = String(text || '');
  const years = new Set();

  for (const match of value.matchAll(/(令和|平成)(元|\d{1,2})年度/g)) {
    const western = japaneseEraFiscalYearToWestern(match[1], match[2]);
    if (western) years.add(western);
  }

  for (const match of value.matchAll(/(20\d{2})年度/g)) {
    years.add(Number(match[1]));
  }

  return [...years].filter((year) => Number.isFinite(year));
}

function analyzeOldClosedFiscalYear(parsedData = {}, pageText = '') {
  const title = String(parsedData.title || '');
  const applicationStatus = String(parsedData.application_status || '');
  const periodText = String(parsedData.application_period_text || '');
  const fiscalYearText = String(parsedData.fiscal_year || '');
  const summary = String(parsedData.summary || '');
  const excerpt = String(parsedData.raw_excerpt || '');
  const focusedHaystack = `${title}\n${periodText}\n${fiscalYearText}\n${summary}\n${excerpt}`;
  const pageHaystack = `${focusedHaystack}\n${String(pageText || '').slice(0, 5000)}`;
  const fiscalYears = extractFiscalYears(focusedHaystack);
  const currentFiscalYear = currentMonth >= 4 ? currentYear : currentYear - 1;
  const oldestFiscalYear = fiscalYears.length > 0 ? Math.min(...fiscalYears) : null;
  const hasOldFiscalYear = fiscalYears.some((year) => currentFiscalYear - year >= 2);
  const isClosed =
    /受付終了|募集終了|終了しました|終了いたしました|公募終了|申請受付を終了/.test(pageHaystack) ||
    /受付終了|募集終了|終了/.test(applicationStatus);
  const hasCurrentSignal =
    /現在募集中|随時募集|随時受付|受付中|募集中/.test(focusedHaystack) ||
    fiscalYears.some((year) => year >= currentFiscalYear);
  const shouldSkip = Boolean(hasOldFiscalYear && isClosed && !hasCurrentSignal);

  return {
    shouldSkip,
    fiscal_years: fiscalYears,
    current_fiscal_year: currentFiscalYear,
    oldest_fiscal_year: oldestFiscalYear,
    is_closed: isClosed,
    has_current_signal: hasCurrentSignal,
    reason: shouldSkip ? 'old_closed_fiscal_year' : '',
  };
}

function pickKnownSubsidyColumns(row) {
  const allowedKeys = [
    'title',
    'organization',
    'region_text',
    'prefecture',
    'municipality',
    'application_status',
    'application_period_text',
    'application_start_date',
    'application_end_date',
    'amount_text',
    'amount_max_yen',
    'subsidy_rate_text',
    'target_expenses_arr',
    'target_entities_arr',
    'purposes',
    'industries',
    'tags',
    'official_url',
    'summary',
    'crawl_status',
    'is_active',
    'source_url',
    'source_type',
    'source_external_id',
    'dedupe_key',
  ];

  return allowedKeys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(row, key)) acc[key] = row[key];
    return acc;
  }, {});
}

function normalizeDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function buildCandidateLog({
  entry,
  pageType = 'unknown',
  title = '',
  text = '',
  parentHeading = '',
  reasons = [],
  penalties = [],
  score = 0,
  action = '',
  reason = '',
  officialUrlDecision = '',
  skippedReason = '',
  extractedLinksCount = 0,
  sourceType = '',
  sourceExternalId = '',
  normalizedOfficialUrl = '',
  oldFiscalYearCheck = null,
}) {
  return {
    seed_url: entry?.seed_url || '',
    original_url: entry?.original_url || entry?.url || '',
    fetch_url: entry?.fetch_url || entry?.url || '',
    final_url: entry?.final_url || '',
    status_code: entry?.status_code || '',
    is_redirected: Boolean(entry?.is_redirected),
    discovered_from_url: entry?.discovered_from_url || '',
    candidate_url: entry?.url || '',
    text,
    parentHeading,
    page_type: pageType,
    title,
    score,
    reasons,
    penalties,
    action,
    reason,
    official_url_decision: officialUrlDecision,
    skipped_reason: skippedReason,
    extracted_links_count: extractedLinksCount,
    source_type: sourceType,
    source_external_id: sourceExternalId,
    normalized_official_url: normalizedOfficialUrl,
    old_fiscal_year_check: oldFiscalYearCheck,
    is_jgrants_url: isJgrantsUrl(entry?.url || ''),
  };
}

function createRunStats() {
  return {
    publish: 0,
    wouldPublish: 0,
    reject: 0,
    review: 0,
    noise: 0,
    errors: 0,
    parsed_pdf: 0,
    extracted_links: 0,
    attempted_urls: 0,
    skipped_urls: 0,
    error_urls: 0,
    already_existing_urls: 0,
    save_candidates: 0,
    inserted: 0,
    updated: 0,
    not_found_urls: 0,
    external_candidates: 0,
    pdf_checked: 0,
    pdf_text_extracted: 0,
    pdf_ocr_attempted: 0,
    pdf_skipped_as_form: 0,
  };
}

function createSeedStats(seedUrl) {
  return {
    seed_url: seedUrl,
    original_url: seedUrl,
    fetch_url: seedUrl,
    final_url: '',
    status_code: '',
    is_redirected: false,
    attempted_urls: 0,
    skipped_urls: 0,
    error_urls: 0,
    already_existing_urls: 0,
    not_found_urls: 0,
    save_candidates: 0,
    inserted: 0,
    updated: 0,
    extracted_links: 0,
    external_candidates: 0,
  };
}

function getSeedStats(seedStats, seedUrl) {
  if (!seedStats.has(seedUrl)) {
    seedStats.set(seedUrl, createSeedStats(seedUrl));
  }
  return seedStats.get(seedUrl);
}

// ==============================================
// 🚀 最強のメインエンジン起動
// ==============================================
async function runUltimateAutoPilot() {
  console.log(`\n👑 愛媛補助金クローラー [公式seed入口・個別制度抽出版] 起動...\n`);
  const queue = [];
  const queuedUrls = new Set();
  const candidateLogs = [];
  const stats = createRunStats();
  const seedStats = new Map();

  console.log(
    `設定: DRY_RUN=${CONFIG.dryRun ? 'ON' : 'OFF'} / MAX_URLS=${CONFIG.maxUrls || 'なし'} / MAX_INSERTS=${CONFIG.maxInserts || 'なし'} / MAX_DEPTH=${CONFIG.maxDepth || 'seed既定'} / URL事前重複チェック=${CONFIG.prefilterRegisteredUrls ? 'ON' : 'OFF'} / SEED_ONLY=${CONFIG.seedOnly ? 'ON' : 'OFF'} / DETAIL_ONLY=${CONFIG.detailOnly ? 'ON' : 'OFF'}`
  );

  const enqueue = (entry, reason = '') => {
    const fetchUrl = entry.fetch_url || normalizeFetchUrl(entry.url);
    const normalized = entry.normalized_key || normalizeUrlKey(fetchUrl);
    if (!normalized || queuedUrls.has(normalized)) return false;
    const normalizedEntry = {
      ...entry,
      url: fetchUrl,
      fetch_url: fetchUrl,
      normalized_key: normalized,
      seed_url: entry.seed_url || entry.seed?.url || fetchUrl,
    };
    if (isJgrantsUrl(fetchUrl) || isJgrantsUrl(normalized)) {
      const row = getSeedStats(seedStats, normalizedEntry.seed_url || normalized);
      candidateLogs.push(
        buildCandidateLog({
          entry: normalizedEntry,
          pageType: 'jgrants_page',
          action: 'skip',
          reason,
          skippedReason: 'JグランツURLは通常クローラー対象外',
        })
      );
      stats.reject++;
      stats.skipped_urls++;
      row.skipped_urls++;
      return false;
    }
    queuedUrls.add(normalized);
    queue.push(normalizedEntry);
    return true;
  };

  const seeds = buildSeedsFromConfig();
  seeds.forEach((seed) => enqueue(createQueueEntry({ url: seed.url, seed }), 'seed_url'));
  console.log(`📌 seed URL: ${seeds.length} 件 / 初期キュー: ${queue.length} 件`);

  let processedCount = 0;

  while (queue.length > 0) {
    const entry = queue.shift();
    const url = entry.url;

    if (CONFIG.maxUrls && processedCount >= CONFIG.maxUrls) {
      console.log(`🛑 SCRAPER_MAX_URLS=${CONFIG.maxUrls} に達したため終了します。`);
      break;
    }

    if (CONFIG.maxInserts && (stats.publish + stats.wouldPublish) >= CONFIG.maxInserts) {
      console.log(`🛑 SCRAPER_MAX_INSERTS=${CONFIG.maxInserts} に達したため終了します。`);
      break;
    }

    console.log(`▶ 処理中: ${url}`);
    processedCount++;
    stats.attempted_urls++;
    const currentSeedStats = getSeedStats(seedStats, entry.seed_url || url);
    if (entry.depth === 0) {
      currentSeedStats.original_url = entry.original_url || currentSeedStats.original_url || url;
      currentSeedStats.fetch_url = entry.fetch_url || url;
    }
    currentSeedStats.attempted_urls++;
    
    try {
      const normalizedCandidateUrl = normalizeUrl(url);
      const {
        text: rawText,
        extractedOfficialUrl,
        isPdf,
        fetchedUrl,
        title,
        links,
        linkCount,
        subsidyLinkCount,
        pdfStats,
        statusCode,
        isRedirected,
      } = await fetchPageTextDynamic(url);
      const canonicalUrl = fetchedUrl || normalizeFetchUrl(url);
      entry.fetch_url = entry.fetch_url || url;
      entry.original_url = entry.original_url || entry.fetch_url;
      entry.final_url = canonicalUrl;
      entry.status_code = statusCode;
      entry.is_redirected = isRedirected;
      if (entry.depth === 0) {
        currentSeedStats.final_url = canonicalUrl;
        currentSeedStats.status_code = statusCode || '';
        currentSeedStats.is_redirected = Boolean(isRedirected);
      }

      if (isPdf) {
        stats.parsed_pdf++;
      }
      stats.pdf_checked += pdfStats?.pdf_checked || 0;
      stats.pdf_text_extracted += pdfStats?.pdf_text_extracted || 0;
      stats.pdf_ocr_attempted += pdfStats?.pdf_ocr_attempted || 0;

      const pageType = classifyPage({
        url: canonicalUrl,
        title,
        text: rawText,
        linkCount,
        subsidyLinkCount,
        isPdf,
      });
      const score = scoreCandidate({
        url: canonicalUrl,
        title,
        text: rawText,
        linkCount,
        pageType,
      });
      const maxDepth = CONFIG.maxDepth || entry.seed?.max_depth || 2;

      if (pageType === 'municipal_index' || pageType === 'category_index' || isLikelyIndexPage({
        url: canonicalUrl,
        title,
        text: rawText,
        linkCount,
        subsidyLinkCount,
      })) {
        const rankedLinks = extractCandidateLinksFromIndexPage({ links, seed: entry.seed });
        const childLinks = rankedLinks.filter((link) => link.shouldCrawl);
        const externalLinks = rankedLinks.filter((link) => !link.isSameDomain && (link.score >= 5 || link.isPdf));
        stats.extracted_links += childLinks.length;
        stats.external_candidates += externalLinks.length;
        currentSeedStats.extracted_links += childLinks.length;
        currentSeedStats.external_candidates += externalLinks.length;
        console.log(`  🧭 index判定: ${pageType} / 候補リンク ${rankedLinks.length} 件 / クロール対象 ${childLinks.length} 件`);
        if (externalLinks.length > 0) {
          console.log(`  🌐 allowed_domains外の候補: ${externalLinks.length} 件（ログのみ、クロールしません）`);
        }

        if (rankedLinks.length > 0) {
          console.log('  候補リンク TOP 10:');
          rankedLinks.slice(0, 10).forEach((link) => {
            const actionLabel = link.shouldCrawl ? 'crawl' : 'skip';
            console.log(`    [score ${link.score}] ${link.text || '(no text)'} - ${actionLabel} - ${link.url}`);
          });
        }

        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title,
            score,
            action: 'extract_links',
            reason: '一覧・カテゴリページのため保存せず子リンクを探索',
            officialUrlDecision: 'indexページはofficial_urlにしない',
            extractedLinksCount: rankedLinks.length,
          })
        );

        rankedLinks.slice(0, 80).forEach((link) => {
          candidateLogs.push(
            buildCandidateLog({
              entry: {
                ...entry,
                url: link.url,
                discovered_from_url: canonicalUrl,
              },
              pageType: 'candidate_link',
              title: link.text,
              text: link.text,
              parentHeading: link.parentHeading,
              score: link.score,
              reasons: link.reasons,
              penalties: link.penalties,
              action: !link.isSameDomain ? 'external_candidate' : (link.shouldCrawl ? 'enqueue' : 'skip'),
              skippedReason: link.shouldCrawl ? '' : 'score < 8 または除外キーワード',
              officialUrlDecision: 'candidate link; official_url未決定',
            })
          );
        });

        if (!CONFIG.seedOnly && !CONFIG.detailOnly && entry.depth < maxDepth) {
          childLinks.forEach((link) => {
            enqueue(
              createQueueEntry({
                url: link.url,
                seed: entry.seed,
                discoveredFromUrl: canonicalUrl,
                depth: entry.depth + 1,
              }),
              'index_child_candidate'
            );
          });
        }

        stats.reject++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      if (pageType === 'jgrants_page') {
        console.log(`  ⏭️ JグランツURLのため通常クローラーでは除外`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title,
            score,
            action: 'skip',
            skippedReason: 'Jグランツは import-jgrants.js 側で処理',
          })
        );
        stats.reject++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      if (pageType === 'application_form' || isApplicationFormPage({ url: canonicalUrl, title, text: rawText })) {
        console.log(`  ⏭️ 申請書・様式ページのため除外`);
        if (isPdf) {
          stats.pdf_skipped_as_form++;
        }
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType: 'application_form',
            title,
            score,
            action: 'skip',
            skippedReason: '申請書・様式・記入例のみ',
          })
        );
        stats.reject++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      if (pageType === 'noise_page') {
        console.log(`  ⏭️ ノイズページのため除外`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title,
            score,
            action: 'skip',
            skippedReason: '補助金個別制度ではないページ',
          })
        );
        stats.noise++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      if (!rawText || rawText.length < 100) { 
        console.log(`  ⏭️ テキスト取得失敗スキップ (または短すぎます)`); 
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title,
            score,
            action: 'skip',
            skippedReason: '本文が短すぎる',
          })
        );
        stats.reject++; 
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue; 
      }

      if (score <= 2) {
        console.log(`  ⏭️ score=${score} のため除外`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title,
            score,
            action: 'skip',
            skippedReason: 'score <= 2',
          })
        );
        stats.reject++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      if (score < 8) {
        console.log(`  👀 review_candidate: score=${score} のため保存せずログのみ`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title,
            score,
            action: 'review_candidate',
            reason: 'score 3〜7 は手動確認候補',
            skippedReason: '保存保留',
          })
        );
        stats.review++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      if (CONFIG.prefilterRegisteredUrls) {
        const { data: existingRows, error: existingErr } = await supabase
          .from('subsidies')
          .select('id')
          .eq('source_url', canonicalUrl)
          .limit(1);

        if (existingErr) throw new Error(`source_url確認エラー: ${existingErr.message}`);

        if (existingRows && existingRows.length > 0) { 
          console.log(`  ⏭️ URL登録済みスキップ`); 
          candidateLogs.push(
            buildCandidateLog({
              entry,
              pageType,
              title,
              score,
              action: 'skip',
              skippedReason: 'source_url登録済み',
            })
          );
          stats.reject++; 
          stats.skipped_urls++;
          stats.already_existing_urls++;
          currentSeedStats.skipped_urls++;
          currentSeedStats.already_existing_urls++;
          continue; 
        }
      }

      let parsedData = await extractFullWithAI(rawText, canonicalUrl);
      const isOtherPrefecture = isOtherPrefectureRegion(parsedData.region_text || parsedData.prefecture);

      if (!parsedData.is_subsidy || isOtherPrefecture) { 
        console.log(`  ⏭️ 非補助金 または 他県データスキップ`); 
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title,
            score,
            action: 'skip',
            skippedReason: isOtherPrefecture ? '他県データ' : 'AI判定で非補助金',
          })
        );
        stats.reject++; 
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue; 
      }

      const noiseReason = isNoisySubsidyCandidate({
        ...parsedData,
        sourceUrl: canonicalUrl,
      });

      if (noiseReason) {
        console.log(`  ⏭️ ノイズ除外: ${noiseReason}`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title: parsedData.title || title,
            score,
            action: 'skip',
            skippedReason: noiseReason,
          })
        );
        stats.noise++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      if (isGenericIndexTitle(parsedData.title)) {
        console.log(`  ⏭️ 汎用一覧タイトルのため保存しません: ${parsedData.title}`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title: parsedData.title || title,
            score,
            action: 'skip',
            skippedReason: '汎用的な一覧・支援制度タイトル',
          })
        );
        stats.reject++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      const oldFiscalYearCheck = analyzeOldClosedFiscalYear(parsedData, rawText);
      if (oldFiscalYearCheck.shouldSkip) {
        console.log(`  ⏭️ 古い年度の受付終了ページのため保存しません`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title: parsedData.title || title,
            score,
            action: 'skip',
            skippedReason: oldFiscalYearCheck.reason,
            oldFiscalYearCheck,
          })
        );
        stats.reject++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      const sanitizedApplicationPeriodText = sanitizeApplicationPeriodText(
        parsedData.application_period_text,
        parsedData
      );
      if (sanitizedApplicationPeriodText !== parsedData.application_period_text) {
        console.log(`  🧹 申請期間を安全化: ${sanitizedApplicationPeriodText}`);
        parsedData = {
          ...parsedData,
          application_period_text: sanitizedApplicationPeriodText,
        };
      }

      const officialDecision = decideOfficialUrl({
        pageType,
        sourceUrl: canonicalUrl,
        extractedOfficialUrl,
      });
      const safeOfficialUrl = officialDecision.officialUrl;
      const sourceIdentity = createOfficialSiteSourceExternalId(safeOfficialUrl, canonicalUrl);

      if (
        !safeOfficialUrl ||
        isJgrantsUrl(safeOfficialUrl) ||
        isLikelyIndexPage({ url: safeOfficialUrl }) ||
        isApplicationFormPage({ url: safeOfficialUrl, title: getUrlBasename(safeOfficialUrl) })
      ) {
        console.log(`  ⏭️ official_url不適合のため保存しません: ${officialDecision.reason}`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title: parsedData.title || title,
            score,
            action: 'skip',
            officialUrlDecision: officialDecision.reason,
            skippedReason: 'official_url が個別制度ページではない',
            sourceType: sourceIdentity.sourceType,
            sourceExternalId: sourceIdentity.sourceExternalId,
            normalizedOfficialUrl: sourceIdentity.normalizedOfficialUrl,
            oldFiscalYearCheck,
          })
        );
        stats.reject++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      if (sourceIdentity.sourceExternalId) {
        const { data: existingBySourceRows, error: sourceIdErr } = await supabase
          .from('subsidies')
          .select('id')
          .eq('source_type', sourceIdentity.sourceType)
          .eq('source_external_id', sourceIdentity.sourceExternalId)
          .limit(1);

        if (sourceIdErr) throw new Error(`source_external_id確認エラー: ${sourceIdErr.message}`);

        if (existingBySourceRows && existingBySourceRows.length > 0) {
          console.log(`  ⏭️ source_external_id登録済みスキップ`);
          candidateLogs.push(
            buildCandidateLog({
              entry,
              pageType,
              title: parsedData.title || title,
              score,
              action: 'skip',
              officialUrlDecision: officialDecision.reason,
              skippedReason: 'source_external_id登録済み',
              sourceType: sourceIdentity.sourceType,
              sourceExternalId: sourceIdentity.sourceExternalId,
              normalizedOfficialUrl: sourceIdentity.normalizedOfficialUrl,
              oldFiscalYearCheck,
            })
          );
          stats.reject++;
          stats.skipped_urls++;
          stats.already_existing_urls++;
          currentSeedStats.skipped_urls++;
          currentSeedStats.already_existing_urls++;
          continue;
        }
      }

      const { data: existingByOfficialUrlRows, error: officialUrlErr } = await supabase
        .from('subsidies')
        .select('id')
        .eq('official_url', safeOfficialUrl)
        .limit(1);

      if (officialUrlErr) throw new Error(`official_url確認エラー: ${officialUrlErr.message}`);

      if (existingByOfficialUrlRows && existingByOfficialUrlRows.length > 0) {
        console.log(`  ⏭️ official_url登録済みスキップ`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title: parsedData.title || title,
            score,
            action: 'skip',
            officialUrlDecision: officialDecision.reason,
            skippedReason: 'official_url登録済み',
            sourceType: sourceIdentity.sourceType,
            sourceExternalId: sourceIdentity.sourceExternalId,
            normalizedOfficialUrl: sourceIdentity.normalizedOfficialUrl,
            oldFiscalYearCheck,
          })
        );
        stats.reject++;
        stats.skipped_urls++;
        stats.already_existing_urls++;
        currentSeedStats.skipped_urls++;
        currentSeedStats.already_existing_urls++;
        continue;
      }

      const dedupeKey = makeSubsidyKey(parsedData);
      
      const { data: existingByKeyRows, error: dedupeErr } = await supabase
        .from('subsidies')
        .select('id')
        .eq('dedupe_key', dedupeKey)
        .limit(1);

      if (dedupeErr) throw new Error(`dedupe_key確認エラー: ${dedupeErr.message}`);

      if (existingByKeyRows && existingByKeyRows.length > 0) {
        console.log(`  ⏭️ 制度重複スキップ (同内容の制度が既に存在します)`);
        candidateLogs.push(
          buildCandidateLog({
            entry,
            pageType,
            title: parsedData.title || title,
            score,
            action: 'skip',
            officialUrlDecision: officialDecision.reason,
            skippedReason: 'dedupe_key登録済み',
            sourceType: sourceIdentity.sourceType,
            sourceExternalId: sourceIdentity.sourceExternalId,
            normalizedOfficialUrl: sourceIdentity.normalizedOfficialUrl,
            oldFiscalYearCheck,
          })
        );
        stats.reject++;
        stats.skipped_urls++;
        currentSeedStats.skipped_urls++;
        continue;
      }

      console.log(`  ✨ 結果: ${parsedData.title} (ステータス:${parsedData.application_status})`);
      if (sourceIdentity.sourceExternalId) {
        console.log(`  🧾 source: ${sourceIdentity.sourceType} / ${sourceIdentity.sourceExternalId}`);
      }

      const { is_subsidy, confidence, raw_excerpt, official_url, fiscal_year, ...dbData } = parsedData;

      const normalizedDbData = {
        ...dbData,
        application_start_date: normalizeDate(dbData.application_start_date),
        application_end_date: normalizeDate(dbData.application_end_date),
      };
      
      const insertPayload = { 
        ...normalizedDbData, 
        official_url: safeOfficialUrl, 
        dedupe_key: dedupeKey,
        crawl_status: 'draft', 
        is_active: false, 
        source_url: canonicalUrl,
      };

      if (sourceIdentity.sourceType && sourceIdentity.sourceExternalId) {
        insertPayload.source_type = sourceIdentity.sourceType;
        insertPayload.source_external_id = sourceIdentity.sourceExternalId;
      }

      const insertRow = sanitizeSubsidyRow(pickKnownSubsidyColumns(insertPayload));

      candidateLogs.push(
        buildCandidateLog({
          entry,
          pageType,
          title: parsedData.title || title,
          score,
          action: CONFIG.dryRun ? 'dry_run_save_candidate' : 'save',
          officialUrlDecision: officialDecision.reason,
          sourceType: sourceIdentity.sourceType,
          sourceExternalId: sourceIdentity.sourceExternalId,
          normalizedOfficialUrl: sourceIdentity.normalizedOfficialUrl,
          oldFiscalYearCheck,
        })
      );

      if (CONFIG.dryRun) {
        console.log('  🧪 DRY_RUNのため保存しません');
        stats.wouldPublish++;
        stats.save_candidates++;
        currentSeedStats.save_candidates++;
        continue;
      }

      const { error: pErr } = await supabase.from('subsidies').insert([insertRow]);

      if (pErr) { 
        console.log(`  ❌ 保存エラー: ${pErr.message}`); 
        stats.errors++; 
      } else { 
        stats.publish++; 
        stats.inserted++;
        currentSeedStats.inserted++;
      }

    } catch (err) { 
      if (err.statusCode) {
        entry.status_code = err.statusCode;
        entry.fetch_url = err.fetchUrl || entry.fetch_url || entry.url;
        entry.final_url = err.finalUrl || '';
        entry.is_redirected = Boolean(entry.final_url && normalizeFetchUrl(entry.final_url) !== normalizeFetchUrl(entry.fetch_url));
        if (entry.depth === 0) {
          currentSeedStats.fetch_url = entry.fetch_url;
          currentSeedStats.final_url = entry.final_url;
          currentSeedStats.status_code = entry.status_code;
          currentSeedStats.is_redirected = entry.is_redirected;
        }
      }
      if (String(err.message).includes('NO_RETRY')) {
         console.log(`  ⏭️ スキップ: ${err.message}`);
         candidateLogs.push(
           buildCandidateLog({
             entry,
             pageType: String(err.message).includes('HTTP 404') ? 'not_found' : 'unknown',
             action: 'skip',
             skippedReason: err.message,
           })
         );
         stats.reject++;
         stats.skipped_urls++;
         currentSeedStats.skipped_urls++;
         if (String(err.message).includes('HTTP 404')) {
           stats.not_found_urls++;
           currentSeedStats.not_found_urls++;
         }
      } else if (err.message.includes('リダイレクト')) {
         console.log(`  ⏭️ 削除済みスキップ`);
         stats.reject++;
         stats.skipped_urls++;
         currentSeedStats.skipped_urls++;
      } else {
         console.log(`  ❌ エラー: ${err.message}`);
         candidateLogs.push(
           buildCandidateLog({
             entry,
             pageType: 'unknown',
             action: 'error',
             skippedReason: err.message,
           })
         );
         stats.errors++;
         stats.error_urls++;
         currentSeedStats.errors = (currentSeedStats.errors || 0) + 1;
         currentSeedStats.error_urls++;
      }
    }
    await sleep(2000); 
  }

  console.log(`\n🏆 究極クローラー完了！`);
  writeCandidateLog(candidateLogs);
  console.log(
    `✅ 追加: ${stats.publish}件 | 🧪 保存候補(DRY_RUN): ${stats.wouldPublish}件 | 👀 要確認: ${stats.review}件 | ⏭️ スキップ: ${stats.reject}件 | 🧹 ノイズ除外: ${stats.noise}件 | ❌ エラー: ${stats.errors}件 | 📄 PDF解析済: ${stats.parsed_pdf}件 | 🔗 抽出リンク: ${stats.extracted_links}件`
  );
  console.log(
    `📊 URL summary: attempted=${stats.attempted_urls} / skipped=${stats.skipped_urls} / errors=${stats.error_urls} / 404=${stats.not_found_urls} / already_existing=${stats.already_existing_urls} / save_candidates=${stats.save_candidates} / inserted=${stats.inserted} / updated=${stats.updated} / external_candidates=${stats.external_candidates}`
  );
  console.log(
    `📄 PDF summary: pdf_checked=${stats.pdf_checked} / pdf_text_extracted=${stats.pdf_text_extracted} / pdf_ocr_attempted=${stats.pdf_ocr_attempted} / pdf_skipped_as_form=${stats.pdf_skipped_as_form}`
  );
  if (seedStats.size > 0) {
    console.log('🌱 Seed summary:');
    for (const row of seedStats.values()) {
      console.log(
        `  - ${row.seed_url}: original_url=${row.original_url}, fetch_url=${row.fetch_url}, final_url=${row.final_url || '-'}, status_code=${row.status_code || '-'}, is_redirected=${row.is_redirected}, attempted=${row.attempted_urls}, skipped=${row.skipped_urls}, errors=${row.error_urls}, 404=${row.not_found_urls}, already_existing=${row.already_existing_urls}, save_candidates=${row.save_candidates}, inserted=${row.inserted}, updated=${row.updated}, extracted_links=${row.extracted_links}, external_candidates=${row.external_candidates}`
      );
    }
  }
}

runUltimateAutoPilot();
