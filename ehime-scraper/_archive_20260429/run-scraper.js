require('dotenv').config();

// ==========================================
// 🌟 NEW: PDF解析ライブラリの不要な警告を非表示にする設定
// ==========================================
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning: TODO:')) return;
  originalWarn(...args);
};

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const PDFParser = require('pdf2json');
const Parser = require('rss-parser');

const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, TAVILY_API_KEY } = process.env;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('❌ 環境変数が不足しています。.envファイルを確認してください。');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const rssParser = new Parser();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const reiwaYear = currentYear - 2018; 
const todayStr = `${currentYear}年（令和${reiwaYear}年）${currentMonth}月${new Date().getDate()}日`;

// 🎯 全13箇所の巡回リスト
const TARGET_LIST = [
  { name: "えひめ産業振興財団", domain: "ehime-iinet.or.jp" },
  { name: "松山市", domain: "city.matsuyama.ehime.jp" },
  { name: "今治市", domain: "city.imabari.ehime.jp" },
  { name: "宇和島市", domain: "city.uwajima.ehime.jp" },
  { name: "八幡浜市", domain: "city.yawatahama.ehime.jp" },
  { name: "新居浜市", domain: "city.niihama.ehime.jp" },
  { name: "西条市", domain: "city.saijo.ehime.jp" },
  { name: "大洲市", domain: "city.ozu.ehime.jp" },
  { name: "伊予市", domain: "city.iyo.lg.jp" },
  { name: "四国中央市", domain: "city.shikokuchuo.ehime.jp" },
  { name: "西予市", domain: "city.seiyo.ehime.jp" },
  { name: "東温市", domain: "city.toon.ehime.jp" },
  { name: "今治商工会議所", domain: "imabaricci.or.jp" } 
];

// ==========================================
// 1. ユーティリティ
// ==========================================
function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, '');
  } catch (e) { return rawUrl; }
}

function isLikelyHubPage(url) {
  return (/\/site\/madoguchi\/?$/.test(url) || /\/site\/madoguchi\/list/i.test(url));
}

function isLikelyDetailPage(url) {
  return (/\/site\/madoguchi\/\d+\.html$/i.test(url) || /\/page\/\d+\.html$/i.test(url) || /\.pdf(\?|$)/i.test(url));
}

function scoreUrl(url) {
  let score = 0;
  // 🔥 J-Net21とミラサポを最優先で処理するようにスコアを爆上げ
  if (url.includes('mirasapo-plus.go.jp') || url.includes('j-net21.smrj.go.jp')) score += 1000;

  if (isLikelyDetailPage(url)) score += 5;
  if (/\.pdf(\?|$)/i.test(url)) score += 3;
  if (/hojo|josei|shien|boshu|koubo|補助|助成|支援|募集|公募/i.test(url)) score += 3;
  
  const targetDomains = /ehime-iinet|matsuyama|imabari|uwajima|yawatahama|niihama|saijo|ozu|iyo|shikokuchuo|seiyo|toon|imabaricci|pref\.ehime/;
  if (targetDomains.test(url)) score += 2;
  
  return score;
}

function extractRelevantWindow(text) {
  // 🔥 UPDATE: AIは長文が読めるので、ページ下部の「詳細情報を見る」が切れないように10000文字まで許容
  if (text.length <= 10000) return text;
  
  const keywords = ['公式リンク候補', '詳細情報を見る', '補助金', '助成金', '補助率', '上限', '対象者', '締切', '募集期間'];
  const idx = keywords.map(k => text.indexOf(k)).filter(i => i >= 0).sort((a, b) => a - b)[0];
  if (idx === undefined) return text.slice(0, 10000);
  return text.slice(Math.max(0, idx - 1000), Math.min(text.length, idx + 8000));
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EhimeAutoPilot/Production' } });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (i === retries) throw err;
      await sleep(2000 * (i + 1));
    }
  }
}

async function fetchTextFromUrl(url) {
  const res = await fetchWithRetry(url);
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  
  if (contentType.includes('application/pdf') || /\.pdf(\?|$)/i.test(url)) {
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    try {
      const extractedText = await new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, 1); 
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent()));
        pdfParser.parseBuffer(buffer);
      });
      return { text: extractedText.replace(/\s+/g, ' ').trim(), html: null, sourceType: 'pdf' };
    } catch (e) { throw new Error(`PDF解析エラー: ${e.message}`); }
  }
  
  const rawHtml = await res.text();
  const $ = cheerio.load(rawHtml);
  $('script, style, noscript, svg, header, footer, nav, aside').remove();
  
  // 🔥 UPDATE: HTMLの裏に隠れているURLを、テキストとしてAIに見えるように強制書き出し！
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    // j-net21やミラサポ内での回遊リンクは除外し、外部の自治体リンクのみを抽出
    if (href && href.startsWith('http') && !href.includes('j-net21') && !href.includes('mirasapo')) {
      $(el).append(` 【公式リンク候補: ${href}】 `);
    }
  });

  const mainText = $('main').text().trim() || $('body').text().trim();
  return { text: mainText.replace(/\s+/g, ' ').trim(), html: rawHtml, sourceType: 'html' };
}

// ==========================================
// 2. AI抽出ロジック
// ==========================================
async function extractWithAI(text, title = "") {
  const prompt = `以下の文章から、補助金「${title}」の情報を抽出しJSONで返せ。
注意点:
1. 締切(deadline)は「新規申請の最終締切日」をそのまま文字列で抽出。（例: 令和6年5月31日）
2. 未定・不明は "不明" とすること。\n\n${text.slice(0, 8000)}`;
  
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: 'JSONのみ: {"deadline":"...", "amount":"..."}' }, { role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(res.choices[0].message.content);
}

async function extractFullWithAI(text) {
  // 🔥 UPDATE: 「公式リンク候補」の中から正しいURLを抽出させる命令を強化
  const systemPrompt = `本日は【${todayStr}】です。愛媛県の補助金情報を抽出せよ。
【厳格ルール】
purposesとindustriesは、以下のリストに完全一致する文字列のみを配列で出力せよ。
・purposes許可: 経営改善・経営強化, 地域活性・まちづくり, 設備投資, 人材育成・雇用, 生産性向上・業務効率化, 起業・創業・ベンチャー, 販路開拓・販路拡大, ものづくり・新商品開発, デジタル, 省エネ, 環境, 再エネ・蓄エネ, 研究・実証実験・産学連携, 防犯・防災・BCP, 海外展開, 観光・インバウンド, 新規事業・第二創業, 空き家利用, 省力化・省人化, 事業承継
・industries許可: サービス業, 農業, 医療・福祉, 製造業, 運輸業, 介護, 飲食業, 小売業, 宿泊業, 卸売業, 情報通信業, 漁業, 建設業, 林業, 食品製造業, 畜産業
・official_url: 本文中に記載されている『【公式リンク候補: http...】』などの文字列から、実際の自治体や財団が公開している一次情報（公式公募ページ）のURLを抽出せよ。なければ空文字でよい。`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text }],
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
            region: { type: "string" }, 
            target_entities: { type: "string" }, 
            target_expenses: { type: "string" },
            amount: { type: "string" }, 
            subsidy_rate: { type: "string" },
            deadline: { type: "string" }, 
            summary: { type: "string" }, 
            purposes: { type: "array", items: { type: "string" } },
            industries: { type: "array", items: { type: "string" } },
            fiscal_year: { type: "string" }, 
            confidence: { type: "integer" }, 
            raw_excerpt: { type: "string" },
            official_url: { type: "string" } 
          }, 
          required: ["is_subsidy", "title", "organization", "region", "target_entities", "target_expenses", "amount", "subsidy_rate", "deadline", "summary", "purposes", "industries", "fiscal_year", "confidence", "raw_excerpt", "official_url"], 
          additionalProperties: false 
        } 
      } 
    }
  });
  return JSON.parse(res.choices[0].message.content);
}

async function searchWithTavily(query) {
  if (!TAVILY_API_KEY) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query: query, search_depth: "advanced", include_answer: false, max_results: 3 })
    });
    const data = await res.json();
    return data.results && data.results.length > 0 ? data.results.map(r => `【タイトル】${r.title}\n【内容】${r.content}`).join('\n\n') : null;
  } catch(e) { return null; }
}

// ==========================================
// 3. メイン実行
// ==========================================
async function runAutoPilot() {
  console.log(`🚀 えひめ補助金ポータル - データ収集エージェント起動（究極フルスキャンモード）...`);
  const targetUrls = new Set();
  const stats = { collected: 0, analyzed: 0, publish: 0, reject: 0, errors: 0 };
  
  // 🔥 UPDATE: J-Net21 と ミラサポplus を両方とも強力に検索！
  console.log('📡 [フェーズ1] 【最優先】J-Net21・ミラサポplusから愛媛県の公式情報を検索...');
  try {
    const query = `(site:mirasapo-plus.go.jp OR site:j-net21.smrj.go.jp) 愛媛県 (補助金 OR 助成金) 令和8年`;
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query: query, search_depth: "advanced", max_results: 15 }) 
    });
    const data = await res.json();
    if (data.results) {
      data.results.forEach(r => targetUrls.add(normalizeUrl(r.url)));
    }
  } catch (e) {
    console.log('  ⚠️ ポータルサイトの検索に失敗しました。');
  }

  console.log('📡 [フェーズ2] その他の自治体・機関サイトのパトロール中...');
  
  try {
    const feed = await rssParser.parseURL('https://www.city.matsuyama.ehime.jp/rss_news.xml');
    feed.items.forEach(item => {
      if (/補助|助成|支援|公募|募集/.test((item.title + ' ' + (item.contentSnippet || '')).toLowerCase()) && item.link) {
        targetUrls.add(normalizeUrl(item.link)); 
      }
    });
  } catch (e) {}

  const fixedUrls = ['https://www.pref.ehime.jp/site/madoguchi/list201-637.html', 'https://www.city.imabari.ehime.jp/sangyou/', 'https://ehime-sci.jp/'];
  for (const hubUrl of fixedUrls) {
    try {
      const $ = cheerio.load(await (await fetchWithRetry(hubUrl)).text());
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
          const absoluteUrl = new URL(href, hubUrl).href;
          if (absoluteUrl.startsWith('http') && !isLikelyHubPage(absoluteUrl)) targetUrls.add(normalizeUrl(absoluteUrl));
        }
      });
    } catch (e) {}
  }

  try {
    const $ = cheerio.load(await (await fetchWithRetry(`https://search.yahoo.co.jp/search?p=${encodeURIComponent('愛媛県 令和8年度 補助金 募集')}`)).text());
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http') && !href.includes('yahoo.co.jp')) targetUrls.add(normalizeUrl(href));
    });
  } catch (e) {}

  console.log('🎯 追加: 13の自治体・機関をTavilyで網羅検索中...');
  for (const target of TARGET_LIST) {
    try {
      const query = `site:${target.domain} 事業者向け (補助金 OR 助成金) 令和8年`;
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: TAVILY_API_KEY, query: query, search_depth: "basic", max_results: 2 })
      });
      const data = await res.json();
      if (data.results) data.results.forEach(r => targetUrls.add(normalizeUrl(r.url)));
    } catch (e) {}
  }

  const finalUrls = Array.from(targetUrls).sort((a, b) => scoreUrl(b) - scoreUrl(a));
  stats.analyzed = finalUrls.length;
  console.log(`\n🤖 解析対象: 全${stats.analyzed}件...（完了まで15分程度かかります☕️）`);

  for (const url of finalUrls) {
    console.log(`\n▶ 処理中: ${url}`);
    
    const { data: existing } = await supabase.from('subsidies').select('id').eq('source_url', url).single();
    if (existing) {
      console.log(`  ⏭️ スキップ [既にDBに登録済み]`);
      stats.reject++; continue;
    }

    try {
      const { text: rawText, html: rawHtml, sourceType } = await fetchTextFromUrl(url);
      if (!rawText || rawText.length < 50) { stats.reject++; continue; }

      const extractionText = extractRelevantWindow(rawText);
      let parsedData = await extractFullWithAI(extractionText);

      if (!parsedData.is_subsidy) {
        console.log(`  ⏭️ スキップ [補助金ではない]`);
        stats.reject++; continue;
      }

      let needsDeepFetch = (parsedData.deadline === '不明' || parsedData.deadline === '未定' || parsedData.amount === '不明' || parsedData.amount === '未定');
      if (needsDeepFetch && sourceType === 'html' && rawHtml) {
        const $page = cheerio.load(rawHtml);
        const candidateUrls = [];
        const ignoreList = ['public-edia.com', 'readspeaker.com', 'facebook.com', 'twitter.com', 'line.me', 'youtube.com', 'google.com'];

        $page('a').each((i, el) => {
          const href = $page(el).attr('href');
          if (href) {
            const absoluteUrl = new URL(href, url).href;
            if (!ignoreList.some(ignore => absoluteUrl.toLowerCase().includes(ignore))) {
              if (absoluteUrl.toLowerCase().includes('.pdf') || !absoluteUrl.includes('pref.ehime.jp')) candidateUrls.push(absoluteUrl);
            }
          }
        });

        for (const deepUrl of [...new Set(candidateUrls)].slice(0, 3)) {
          if (parsedData.deadline !== '不明' && parsedData.amount !== '不明') break; 
          try {
            const fetchRes = await fetchTextFromUrl(deepUrl);
            if (!fetchRes.text) continue;
            const patchData = await extractWithAI(fetchRes.text, parsedData.title);
            if (patchData.deadline && patchData.deadline !== '不明') parsedData.deadline = patchData.deadline;
            if (patchData.amount && patchData.amount !== '不明') parsedData.amount = patchData.amount;
          } catch (e) {}
        }
      }

      needsDeepFetch = (parsedData.deadline === '不明' || parsedData.deadline === '未定' || parsedData.amount === '不明' || parsedData.amount === '未定');
      if (needsDeepFetch && TAVILY_API_KEY) {
        console.log(`  🌐 [最終兵器] AI自律検索エージェント起動...`);
        let cleanTitle = (parsedData.title || "").replace(/の(公募|お知らせ|募集|案内)|について|令和\d+年度|（.*?）|\(.*?\)/g, '').trim();
        const orgStr = parsedData.organization !== '不明' ? parsedData.organization : '愛媛県';
        const searchContext = await searchWithTavily(`"${cleanTitle}" ${orgStr} 上限 万円 申請期間`);
        
        if (searchContext) {
          const patchData = await extractWithAI(searchContext, parsedData.title);
          if (patchData.deadline && patchData.deadline !== '不明') parsedData.deadline = patchData.deadline;
          if (patchData.amount && patchData.amount !== '不明') parsedData.amount = patchData.amount;
        }
      }

      console.log(`  ✨ 抽出結果: 締切[${parsedData.deadline}], 金額[${parsedData.amount}]`);

      // 🔥 UPDATE: J-Net21等から「本当の公式URL」が抽出されていれば、それを絶対的な source_url に上書き！
      let finalUrl = url;
      if (parsedData.official_url && parsedData.official_url.startsWith('http')) {
        finalUrl = parsedData.official_url;
        console.log(`  🔗 公式リンクを検出して上書き: ${finalUrl}`);
      }

      const { is_subsidy, fiscal_year, confidence, raw_excerpt, official_url, ...dbData } = parsedData;
      const commonRow = { 
        ...dbData, 
        status: 'draft',       
        is_active: false,      
        source_url: finalUrl // 上書きした公式URLをDBに保存
      };

      const { error: pErr } = await supabase.from('subsidies').insert([commonRow]);
      if (pErr) { 
        console.log(`  ❌ 保存エラー: ${pErr.message}`); 
        stats.errors++; 
      } else { 
        console.log(`  🟢 [承認待ちへ保存完了] - ${parsedData.title}`); 
        stats.publish++; 
      }

    } catch (err) { 
      console.log(`  ❌ エラー: ${err.message}`); 
      stats.errors++; 
    }
    await sleep(2000);
  }

  console.log('\n========================================');
  console.log(`🏆 収集完了！ 承認待ち追加: ${stats.publish}件 / 却下・重複: ${stats.reject}件 / エラー: ${stats.errors}件`);
  console.log(`管理画面（http://localhost:5173/admin）を確認してください！`);
  console.log('========================================');
}

runAutoPilot();