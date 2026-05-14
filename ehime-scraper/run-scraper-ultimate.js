require('dotenv').config();

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

const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, TAVILY_API_KEY } = process.env;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TAVILY_API_KEY) {
  throw new Error('❌ 環境変数が不足しています。.envファイルを確認してください。');
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
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, '');
  } catch (e) { return rawUrl; }
}

function resolveUrlMaybeRelative(rawUrl, baseUrl) {
  if (!rawUrl) return '';
  try {
    return normalizeUrl(new URL(rawUrl, baseUrl).toString());
  } catch {
    return normalizeUrl(rawUrl);
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
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`RETRYABLE_HTTP ${res.status}`);
        }
        throw new Error(`HTTP ${res.status} NO_RETRY`);
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
        const abs = normalizeUrl(new URL(href, url).toString());
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
  const fetchedUrl = normalizeUrl(res.url || url);

  if (contentType.includes('application/pdf') || fetchedUrl.toLowerCase().endsWith('.pdf')) {
    try {
      console.log(`  📄 PDFデータをダウンロード＆解析中...`);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // 1. まずは通常の pdf-parse で高速テキスト抽出
      let cleanText = await parsePdfText(buffer);
      cleanText = cleanText.replace(/\n\s*\n/g, '\n').trim();
      
      // 2. 🔥 OCRフォールバック: テキストが300文字未満なら「スキャン画像」と判定してOCR実行
      if (cleanText.length < 300) {
        console.log(`  ⚠️ スキャン画像PDFの可能性 (抽出文字数: ${cleanText.length}文字)。OCRフォールバックを実行します...`);
        
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

      return { text: cleanText, extractedOfficialUrl: '', isPdf: true, pdfUrl: fetchedUrl, fetchedUrl };
    } catch (err) {
      console.log(`  ⚠️ PDFの解析(OCR含む)に失敗しました: ${err.message}`);
      return { text: '', extractedOfficialUrl: '', isPdf: true, pdfUrl: fetchedUrl, fetchedUrl };
    }
  }

  const rawHtml = await res.text();
  const $ = cheerio.load(rawHtml);
  
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

  $('script, style, noscript, svg, header, footer, nav, aside, iframe').remove();
  const mainText = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
  let cleanText = mainText.replace(/\n\s*\n/g, '\n').trim();
  
  return { text: `${metaDataText}\n\n${cleanText}`, extractedOfficialUrl, isPdf: false, fetchedUrl };
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

// ==============================================
// 🚀 最強のメインエンジン起動
// ==============================================
async function runUltimateAutoPilot() {
  console.log(`\n👑 愛媛補助金クローラー [究極UI・PDF OCR完全統合版] 起動...\n`);
  const targetUrls = new Set();
  const pdfQueue = new Set(); 
  const stats = { publish: 0, wouldPublish: 0, reject: 0, noise: 0, errors: 0, parsed_pdf: 0 }; 

  console.log(
    `設定: DRY_RUN=${CONFIG.dryRun ? 'ON' : 'OFF'} / MAX_URLS=${CONFIG.maxUrls || 'なし'} / MAX_INSERTS=${CONFIG.maxInserts || 'なし'} / URL事前重複チェック=${CONFIG.prefilterRegisteredUrls ? 'ON' : 'OFF'}`
  );

  if (CONFIG.seedUrls.length > 0) {
    CONFIG.seedUrls.forEach((url) => targetUrls.add(normalizeUrl(url)));
    console.log(`📌 SCRAPER_URLS指定のため探索を省略します: ${targetUrls.size} 件`);
  } else {
  
    console.log('📡 [フェーズ0] シードURLから子リンクを展開します...');
    for (const strategy of EHIME_STRATEGIES) {
      const seeds = SEED_URLS[strategy.name] || [];
      for (const seed of seeds) {
        targetUrls.add(normalizeUrl(seed));
        const childLinks = await collectLinksFromHub(seed, strategy.domain);
        childLinks.forEach(link => targetUrls.add(link));
        await sleep(1000);
      }
    }
    console.log(`  ➔ 初期URL総数: ${targetUrls.size} 件`);

    console.log('\n📡 [フェーズ1] J-Net21のデータベースを徹底検索します...');
    for (const area of EHIME_AREAS) {
      let queries = [];
      if (area === '全国') {
        queries = [
          `site:j-net21.smrj.go.jp/snavi2/articles/ "地域" "全国" ${BASE_SUBSIDY_WORDS} ${EXCLUDE_WORDS}`,
          `site:j-net21.smrj.go.jp/snavi2/articles/ ("【全国】" OR "〖全国〗") ${BASE_SUBSIDY_WORDS} ${EXCLUDE_WORDS}`
        ];
      } else {
        queries = [
          `site:j-net21.smrj.go.jp/snavi2/articles/ "${area}" ${BASE_SUBSIDY_WORDS} ${EXCLUDE_WORDS}`,
          `site:j-net21.smrj.go.jp/snavi2/articles/ ("実施機関" "${area}" OR "〖${area}〗") ${BASE_SUBSIDY_WORDS} ${EXCLUDE_WORDS}`
        ];
      }

      for (let i = 0; i < queries.length; i++) {
        try {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: TAVILY_API_KEY, query: queries[i], search_depth: "basic", max_results: (area === '全国' ? 20 : 10) }) 
          });
        
          if (!res.ok) { 
            if (res.status === 429 || res.status >= 500) {
              console.log(`    ⚠️ API制限/サーバーエラー (${res.status}): 10秒待機して再トライします...`);
              await sleep(10000); 
              i--; 
              continue; 
            } else {
              console.error(`    ❌ 予期せぬAPIエラー (${res.status}): スキップします。`);
              break;
            }
          }

          const data = await res.json();
          if (data.results) {
            data.results.forEach(r => {
              const nUrl = normalizeUrl(r.url);
              if (nUrl.match(/\/articles\/\d+/) && !targetUrls.has(nUrl)) targetUrls.add(nUrl);
            });
          }
        } catch (e) {
          console.log(`    ⚠️ Tavily検索例外 (フェーズ1): ${e.message}`);
        }
        await sleep(2500); 
      }
    }

    console.log('\n📡 [フェーズ2] 秘伝の書に基づく各自治体の公式HP直撃検索を開始します...');
    for (const strategy of EHIME_STRATEGIES) {
      const localQueries = [
        `site:${strategy.domain} ${BASE_SUBSIDY_WORDS} ${EXCLUDE_WORDS}`,
        `site:${strategy.domain} (${strategy.keywords}) ${BASE_SUBSIDY_WORDS} ${EXCLUDE_WORDS}`
      ];

      for (let i = 0; i < localQueries.length; i++) {
        try {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: TAVILY_API_KEY, query: localQueries[i], search_depth: "advanced", max_results: 15 }) 
          });
        
          if (!res.ok) { 
            if (res.status === 429 || res.status >= 500) {
              console.log(`    ⚠️ API制限/サーバーエラー (${res.status}): 10秒待機して再トライします...`);
              await sleep(10000); 
              i--; 
              continue; 
            } else {
              console.error(`    ❌ 予期せぬAPIエラー (${res.status}): スキップします。`);
              break;
            }
          }

          const data = await res.json();
          if (data.results) {
            data.results.forEach(r => {
              const nUrl = normalizeUrl(r.url);
              const hint = `${r.title || ''} ${r.content || ''}`;
              if (shouldKeepUrl(nUrl, strategy.domain) && looksLikeSubsidyLink(hint, nUrl) && !targetUrls.has(nUrl)) {
                targetUrls.add(nUrl);
              }
            });
          }
        } catch (e) {
          console.log(`    ⚠️ Tavily検索例外 (フェーズ2): ${e.message}`);
        }
        await sleep(3000); 
      }
    }
  }

  const finalUrls = Array.from(targetUrls).slice(0, CONFIG.maxUrls || undefined);
  console.log(`\n🤖 解析対象: 合計 ${finalUrls.length} 件のURLを処理します...\n`);

  for (const url of finalUrls) {
    if (CONFIG.maxInserts && (stats.publish + stats.wouldPublish) >= CONFIG.maxInserts) {
      console.log(`🛑 SCRAPER_MAX_INSERTS=${CONFIG.maxInserts} に達したため終了します。`);
      break;
    }

    console.log(`▶ 処理中: ${url}`);
    
    try {
      const normalizedCandidateUrl = normalizeUrl(url);

      if (CONFIG.prefilterRegisteredUrls) {
        const { data: registeredRows, error: registeredErr } = await supabase
          .from('subsidies')
          .select('id')
          .eq('source_url', normalizedCandidateUrl)
          .limit(1);

        if (registeredErr) throw new Error(`source_url事前確認エラー: ${registeredErr.message}`);

        if (registeredRows && registeredRows.length > 0) {
          console.log(`  ⏭️ URL登録済みスキップ`);
          stats.reject++;
          continue;
        }
      }

      const { text: rawText, extractedOfficialUrl, isPdf, fetchedUrl } = await fetchPageTextDynamic(url);
      const canonicalUrl = fetchedUrl || normalizeUrl(url);

      if (isPdf) {
        stats.parsed_pdf++;
      }
      
      if (url.includes('j-net21.smrj.go.jp') && extractedOfficialUrl?.startsWith('http')) {
        const officialUrl = normalizeUrl(extractedOfficialUrl);
        if (!targetUrls.has(officialUrl)) {
          targetUrls.add(officialUrl);
          finalUrls.push(officialUrl); 
        }
        console.log(`  🔁 J-Net21から公式URLへ引き継ぎ: ${officialUrl}`);
        stats.reject++; 
        continue;
      }

      if (!rawText || rawText.length < 100) { 
        console.log(`  ⏭️ テキスト取得失敗スキップ (または短すぎます)`); 
        stats.reject++; 
        continue; 
      }

      const { data: existingRows, error: existingErr } = await supabase
        .from('subsidies')
        .select('id')
        .eq('source_url', canonicalUrl)
        .limit(1);

      if (existingErr) throw new Error(`source_url確認エラー: ${existingErr.message}`);

      if (existingRows && existingRows.length > 0) { 
        console.log(`  ⏭️ URL登録済みスキップ`); 
        stats.reject++; 
        continue; 
      }

      let parsedData = await extractFullWithAI(rawText, canonicalUrl);
      const isOtherPrefecture = isOtherPrefectureRegion(parsedData.region_text || parsedData.prefecture);

      if (!parsedData.is_subsidy || isOtherPrefecture) { 
        console.log(`  ⏭️ 非補助金 または 他県データスキップ`); 
        stats.reject++; 
        continue; 
      }

      const noiseReason = isNoisySubsidyCandidate({
        ...parsedData,
        sourceUrl: canonicalUrl,
      });

      if (noiseReason) {
        console.log(`  ⏭️ ノイズ除外: ${noiseReason}`);
        stats.noise++;
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
        stats.reject++;
        continue;
      }

      console.log(`  ✨ 結果: ${parsedData.title} (ステータス:${parsedData.application_status})`);

      const safeOfficialUrl = resolveUrlMaybeRelative(
        (parsedData.official_url && parsedData.official_url !== '不明') 
          ? parsedData.official_url.trim() 
          : (extractedOfficialUrl ? extractedOfficialUrl.trim() : canonicalUrl),
        canonicalUrl
      );

      const { is_subsidy, confidence, raw_excerpt, official_url, ...dbData } = parsedData;
      
      const normalizeDate = (v) => {
        if (!v) return null;
        const s = String(v).trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
      };

      const normalizedDbData = {
        ...dbData,
        application_start_date: normalizeDate(dbData.application_start_date),
        application_end_date: normalizeDate(dbData.application_end_date),
      };
      
      const insertRow = sanitizeSubsidyRow({ 
        ...normalizedDbData, 
        official_url: safeOfficialUrl, 
        dedupe_key: dedupeKey,
        crawl_status: 'draft', 
        is_active: false, 
        source_url: canonicalUrl 
      });

      if (CONFIG.dryRun) {
        console.log('  🧪 DRY_RUNのため保存しません');
        stats.wouldPublish++;
        continue;
      }

      const { error: pErr } = await supabase.from('subsidies').insert([insertRow]);

      if (pErr) { 
        console.log(`  ❌ 保存エラー: ${pErr.message}`); 
        stats.errors++; 
      } else { 
        stats.publish++; 
      }

    } catch (err) { 
      if (String(err.message).includes('NO_RETRY')) {
         console.log(`  ⏭️ スキップ: ${err.message}`); stats.reject++;
      } else if (err.message.includes('リダイレクト')) {
         console.log(`  ⏭️ 削除済みスキップ`); stats.reject++;
      } else {
         console.log(`  ❌ エラー: ${err.message}`); stats.errors++; 
      }
    }
    await sleep(2000); 
  }

  console.log(`\n🏆 究極クローラー完了！`);
  console.log(`✅ 追加: ${stats.publish}件 | 🧪 保存候補(DRY_RUN): ${stats.wouldPublish}件 | ⏭️ スキップ: ${stats.reject}件 | 🧹 ノイズ除外: ${stats.noise}件 | ❌ エラー: ${stats.errors}件 | 📄 PDF解析済: ${stats.parsed_pdf}件`);
}

runUltimateAutoPilot();
