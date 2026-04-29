require('dotenv').config();
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const pdf = require('pdf-parse');

const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('❌ 環境変数が不足しています。.envファイルを確認してください。');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 1. ユーティリティ＆ルール判定群
// ==========================================
function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, '');
  } catch (e) { return rawUrl; }
}

function normalizeForMatch(s) {
  return s.replace(/[\s「」（）()［］【】〔〕・,，。、.\-ー―]/g, '').toLowerCase();
}

function isLikelyHubPage(url) {
  return (/\/site\/madoguchi\/?$/.test(url) || /\/site\/madoguchi\/list/i.test(url));
}

function isLikelyDetailPage(url) {
  return (/\/site\/madoguchi\/\d+\.html$/i.test(url) || /\/page\/\d+\.html$/i.test(url) || /\.pdf(\?|$)/i.test(url));
}

function scoreUrl(url) {
  let score = 0;
  if (isLikelyDetailPage(url)) score += 5;
  if (/\.pdf(\?|$)/i.test(url)) score += 3;
  if (/hojo|josei|shien|boshu|koubo|補助|助成|支援|募集|公募/i.test(url)) score += 3;
  if (/pref\.ehime\.jp|city\.matsuyama\.ehime\.jp/.test(url)) score += 2;
  return score;
}

function extractRelevantWindow(text) {
  const keywords = ['補助金', '助成金', '補助率', '上限', '対象者', '締切', '募集期間', '申請期間', '補助対象経費', '補助上限額', '交付申請', '公募要領', '実施要領', '受付期間', '事業概要'];
  const idx = keywords.map(k => text.indexOf(k)).filter(i => i >= 0).sort((a, b) => a - b)[0];
  if (idx === undefined) return text.slice(0, 3000);
  return text.slice(Math.max(0, idx - 800), Math.min(text.length, idx + 2500));
}

function detectStatusRule(text) {
  if (/受付終了|募集終了|公募終了|終了しました|終了した/.test(text)) return 'closed';
  if (/募集中|公募中|受付中|申請受付中/.test(text)) return 'open';
  return 'unknown';
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EhimeAutoPilot/10.0' } });
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
    const pdfData = await pdf(Buffer.from(arrayBuffer));
    return { text: pdfData.text.replace(/\s+/g, ' ').trim(), sourceType: 'pdf' };
  }
  const $ = cheerio.load(await res.text());
  $('script, style, noscript, svg, header, footer, nav, aside, .breadcrumbs, .related-links').remove();
  const mainText = $('main').text().trim() || $('#main').text().trim() || $('article').text().trim() || $('body').text().trim();
  return { text: mainText.replace(/\s+/g, ' ').trim(), sourceType: 'html' };
}

// ==========================================
// 2. 自動スコアリング＆判定エンジン
// ==========================================
function evaluateCandidate({ classification, parsedData, rawText, extractionText, sourceType, url }) {
  let score = 0;
  const reasons = [];

  const isDetailUrl = isLikelyDetailPage(url);
  const normalizedExcerpt = normalizeForMatch(parsedData.raw_excerpt || '');
  const normalizedRaw = normalizeForMatch(rawText || '');
  const excerptExists = normalizedExcerpt.length > 5 && normalizedRaw.includes(normalizedExcerpt);

  let ruleStatus = detectStatusRule(extractionText);
  if (ruleStatus === 'unknown') ruleStatus = detectStatusRule(rawText.slice(0, 5000));

  let finalStatus = parsedData.status;
  if (ruleStatus === 'closed') finalStatus = 'closed';
  else if (ruleStatus === 'open' && finalStatus === 'unknown') finalStatus = 'open';

  // 加点ロジック
  if (classification.page_type === 'detail') score += 25;
  if (parsedData.is_subsidy) score += 20;
  if (finalStatus === 'open') score += 20;
  if (excerptExists) score += 20;
  if ((parsedData.title || '').length >= 5) score += 5;
  if ((parsedData.organization || '').trim().length >= 2) score += 5;
  if ((parsedData.summary || '').trim().length >= 20) score += 5;
  if (parsedData.deadline && parsedData.deadline !== '不明') score += 10;
  if (isDetailUrl) score += 5;
  if (sourceType === 'pdf') score += 5;

  // 減点（リジェクト）理由の収集
  if (!parsedData.is_subsidy) reasons.push('not_subsidy');
  if (finalStatus !== 'open') reasons.push(`status_${finalStatus}`);
  if (!excerptExists) reasons.push('excerpt_not_found');
  if ((parsedData.summary || '').trim().length < 20) reasons.push('summary_too_short');
  if (classification.page_type === 'noise') reasons.push('page_type_noise');

  // トリアージ判定
  let decision = 'reject';
  if (score >= 85) decision = 'publish';
  else if (score >= 60) decision = 'hold';

  // 致命的な理由があれば強制リジェクト
  if (reasons.includes('not_subsidy') || reasons.includes('status_closed') || reasons.includes('page_type_noise')) {
    decision = 'reject';
  }

  return { decision, score, finalStatus, excerptExists, reasons };
}

// ==========================================
// 3. メインクローラー実行（オートパイロット）
// ==========================================
async function runAutoPilot() {
  console.log('🚀 完全自動運用モード（V10: オートパイロット版）を起動します...\n');
  const targetUrls = new Set();
  const stats = { total: 0, publish: 0, hold: 0, reject: 0, errors: 0 };
  
  // URL収集フェーズ
  const fixedUrls = ['https://www.pref.ehime.jp/site/madoguchi/list201-637.html', 'https://www.city.matsuyama.ehime.jp/kurashi/sangyo/chusho/'];
  for (const hubUrl of fixedUrls) {
    try {
      const $ = cheerio.load(await (await fetchWithRetry(hubUrl)).text());
      $('a').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href');
        if (!href) return;
        const absoluteUrl = new URL(href, hubUrl).href;
        if (absoluteUrl.startsWith('http') && !isLikelyHubPage(absoluteUrl) && (/補助|助成|支援|公募|募集|事業|制度|案内|受付/i.test(text) || /subsidy|grant|shien|hojo|boshu|koubo/i.test(absoluteUrl))) {
          targetUrls.add(normalizeUrl(absoluteUrl));
        }
      });
    } catch (e) {}
  }

  try {
    const $ = cheerio.load(await (await fetchWithRetry(`https://search.yahoo.co.jp/search?p=${encodeURIComponent('愛媛県 令和8年度 補助金 募集')}`)).text());
    const allowedDomains = ['pref.ehime.jp', 'city.matsuyama.ehime.jp', 'ehime-iinet.or.jp', 'yorozu-ehime.com'];
    $('a').each((i, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      if (!href || !href.startsWith('http')) return;
      const urlObj = new URL(href);
      if (allowedDomains.some(d => urlObj.hostname.includes(d)) && !urlObj.hostname.includes('yahoo.co.jp') && !isLikelyHubPage(href) && (/補助|助成|公募|募集|交付申請|公募要領/i.test(text) || /subsidy|grant|hojo|boshu|koubo/i.test(urlObj.href))) {
        targetUrls.add(normalizeUrl(href));
      }
    });
  } catch (e) {}

  const finalUrls = Array.from(targetUrls).sort((a, b) => scoreUrl(b) - scoreUrl(a)).slice(0, 15);
  stats.total = finalUrls.length;
  console.log(`\n🤖 ${stats.total} 件のURLを処理します...`);

  // 解析＆トリアージフェーズ
  for (const url of finalUrls) {
    console.log(`\n▶ 処理中: ${url}`);
    try {
      const { text: rawText, sourceType } = await fetchTextFromUrl(url);
      if (!rawText || rawText.length < 50) continue;

      const extractionText = extractRelevantWindow(rawText);
      const classificationText = (rawText.slice(0, 3000) + '\n\n...[関連部分]...\n\n' + extractionText).substring(0, 6000);

      const classifyResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: '与えられたページ本文を判定せよ。\n- detail: 単一の補助金募集ページ\n- list: 一覧・総合案内\n- noise: 詳細ではない\nJSONのみ返す。 {"page_type":"detail|list|noise","reason":"..."}' }, { role: "user", content: classificationText }],
        response_format: { type: "json_object" }
      });
      const classification = JSON.parse(classifyResponse.choices[0].message.content);

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "提供されたテキストから補助金情報を抽出し、スキーマに従ってJSONを出力せよ。" }, { role: "user", content: extractionText }],
        response_format: { type: "json_schema", json_schema: { name: "subsidy_extraction", strict: true, schema: { type: "object", properties: { is_subsidy: { type: "boolean" }, status: { type: "string", enum: ["open", "closed", "unknown"] }, title: { type: "string" }, organization: { type: "string" }, region: { type: "string" }, target: { type: "string" }, amount: { type: "string" }, deadline: { type: "string" }, summary: { type: "string" }, fiscal_year: { type: "string" }, confidence: { type: "integer" }, raw_excerpt: { type: "string" } }, required: ["is_subsidy", "status", "title", "organization", "region", "target", "amount", "deadline", "summary", "fiscal_year", "confidence", "raw_excerpt"], additionalProperties: false } } }
      });
      const parsedData = JSON.parse(aiResponse.choices[0].message.content);

      // 自動評価エンジンの呼び出し
      const evaluation = evaluateCandidate({ classification, parsedData, rawText, extractionText, sourceType, url });

      // 共通データ行の作成
      const commonRow = {
        title: parsedData.title,
        organization: parsedData.organization,
        region: parsedData.region,
        target: parsedData.target,
        amount: parsedData.amount,
        deadline: parsedData.deadline,
        summary: parsedData.summary,
        fiscal_year: parsedData.fiscal_year,
        status: evaluation.finalStatus,
        confidence: parsedData.confidence,
        raw_excerpt: parsedData.raw_excerpt,
        source_type: sourceType,
        source_url: url,
        fetched_at: new Date().toISOString()
      };

      // 1. 監査候補テーブル (subsidy_candidates) に全件保存
      await supabase.from('subsidy_candidates').upsert([{
        ...commonRow,
        page_type: classification.page_type,
        quality_score: evaluation.score,
        decision: evaluation.decision,
        decision_reason: evaluation.reasons.join(',')
      }], { onConflict: 'source_url' });

      // 2. Publish判定なら本番テーブル (subsidies) に保存
      if (evaluation.decision === 'publish') {
        await supabase.from('subsidies').upsert([commonRow], { onConflict: 'source_url' });
        console.log(`  🟢 [PUBLISH] 本番公開 (スコア: ${evaluation.score}) - ${parsedData.title}`);
        stats.publish++;
      } else if (evaluation.decision === 'hold') {
        console.log(`  🟡 [HOLD] 保留 (スコア: ${evaluation.score}) - ${parsedData.title}`);
        stats.hold++;
      } else {
        console.log(`  🔴 [REJECT] 破棄 (スコア: ${evaluation.score}, 理由: ${evaluation.reasons.join('|')})`);
        stats.reject++;
      }

    } catch (err) {
      console.log(`  ❌ エラー: ${err.message}`);
      stats.errors++;
    }
    await sleep(2000);
  }

  // 通知用サマリー出力
  console.log('\n========================================');
  console.log('🏆 自動パトロール完了レポート');
  console.log('========================================');
  console.log(`対象URL総数: ${stats.total} 件`);
  console.log(`🟢 本番公開 (Publish): ${stats.publish} 件`);
  console.log(`🟡 保留確認 (Hold)   : ${stats.hold} 件`);
  console.log(`🔴 破棄除外 (Reject) : ${stats.reject} 件`);
  console.log(`❌ エラー数          : ${stats.errors} 件`);
  console.log('========================================');
}

runAutoPilot();