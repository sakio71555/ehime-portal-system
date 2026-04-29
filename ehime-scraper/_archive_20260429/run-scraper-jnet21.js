require('dotenv').config();

const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning: TODO:')) return;
  originalWarn(...args);
};

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, TAVILY_API_KEY } = process.env;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TAVILY_API_KEY) {
  throw new Error('❌ 環境変数が不足しています。.envファイルを確認してください。');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const reiwaYear = currentYear - 2018; 
const todayStr = `${currentYear}年（令和${reiwaYear}年）${currentMonth}月${new Date().getDate()}日`;

const EHIME_AREAS = [
  '全国',
  '愛媛県', '松山市', '今治市', '宇和島市', '八幡浜市', '新居浜市', '西条市', '大洲市', '伊予市',
  '四国中央市', '西予市', '東温市', '上島町', '久万高原町', '松前町', '砥部町', '内子町',
  '伊方町', '松野町', '鬼北町', '愛南町'
];

function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, '');
  } catch (e) { return rawUrl; }
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EhimeSubsidyBot/JNet21-Ultimate' } });
      clearTimeout(timeout);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (res.url && !res.url.match(/\/articles\/\d+/)) {
        throw new Error(`記事が削除され、トップページ等にリダイレクトされました (${res.url})`);
      }

      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (i === retries) throw err;
      await sleep(2000 * (i + 1));
    }
  }
}

function extractOfficialUrlFromJNet21($) {
  const detailHeading = $('h2, h3, h4, h5').filter((_, el) =>
    $(el).text().includes('詳細情報を見る')
  ).first();

  if (!detailHeading.length) return '';

  let node = detailHeading.next();

  while (node.length) {
    if (node.is('h2, h3, h4, h5')) break;

    const link = node.find('a[href^="http"]').filter((_, el) => {
      const href = $(el).attr('href') || '';
      return !href.includes('j-net21.smrj.go.jp')
        && !href.includes('facebook')
        && !href.includes('twitter')
        && !href.includes('x.com')
        && !href.includes('line.me')
        && !href.includes('service.smrj.go.jp');
    }).first();

    if (link.length) return link.attr('href') || '';

    if (/上記の情報は|掲載日：/.test(node.text())) break;
    node = node.next();
  }

  return '';
}

async function fetchJNet21Text(url) {
  const res = await fetchWithRetry(url);
  const rawHtml = await res.text();
  const $ = cheerio.load(rawHtml);
  
  const extractedOfficialUrl = extractOfficialUrlFromJNet21($);
  
  let metaDataText = "";
  $('tr').each((i, el) => {
    const th = $(el).find('th').text().trim();
    const td = $(el).find('td').text().trim();
    if (th && td) {
      // 🔥 UPDATE: 分野・業種だけでなく、「地域」と「実施機関」も抽出してAIに渡す！
      if (['分野', '業種', '地域', '実施機関'].includes(th)) {
        metaDataText += `【J-Net21公式指定 ${th}】 ${td}\n`;
      }
    }
  });
  
  $('script, style, noscript, svg, header, footer, nav, aside').remove();
  const mainText = $('main').text().trim() || $('body').text().trim();
  let cleanText = mainText.replace(/\n\s*\n/g, '\n').trim();
  
  return { text: `${metaDataText}\n\n${cleanText}`, extractedOfficialUrl };
}

async function extractFullWithAI(text, sourceUrl) {
  const systemPrompt = `本日は【${todayStr}】です。提供されたJ-Net21（中小企業基盤整備機構）の記事から、愛媛県の事業者が活用可能な補助金情報を抽出せよ。

【🚨 厳格な足切りルール（他県の除外）】
提供されたテキストの「対象地域」や「実施機関」を必ず確認すること。
対象が「愛媛県（県内の市町村含む）」または「全国」のものであれば is_subsidy: true とせよ。
しかし、対象が「北海道」「秋田県」「東京都」「広島県」など、【愛媛県以外の特定の都道府県や市区町村】に限定されている場合は、絶対に抽出してはならない（必ず is_subsidy: false とすること）。

【抽出ルール】
1. region（地域）と organization（実施機関）について：
本文の先頭にある「【J-Net21公式指定 地域】」および「【J-Net21公式指定 実施機関】」の記述を【絶対的な正解】として読み取り、そのまま出力すること。本文中に他県の住所（例：本部の住所が東京都など）があっても、それに惑わされずJ-Net21の公式指定を優先すること。

2. purposes（分野/利用目的）とindustries（業種）について：
本文の先頭にある「【J-Net21公式指定 分野】」および「【J-Net21公式指定 業種】」の記述を最優先で読み取ること。
以下の[既存タグリスト]の中に該当するものがあればそれを使用し、もし該当する言葉がない場合は、無理に既存のタグに当てはめるのではなく、J-Net21が指定している新しい言葉をそのまま配列に独立したタグとして追加して出力すること。
[既存のpurposesリスト]: 経営改善・経営強化, 地域活性・まちづくり, 設備投資, 人材育成・雇用, 生産性向上・業務効率化, 起業・創業・ベンチャー, 販路開拓・販路拡大, ものづくり・新商品開発, デジタル, 省エネ, 環境, 再エネ・蓄エネ, 研究・実証実験・産学連携, 防犯・防災・BCP, 海外展開, 観光・インバウンド, 新規事業・第二創業, 空き家利用, 省力化・省人化, 事業承継
[既存のindustriesリスト]: 業種指定無し, サービス業, 農業, 医療・福祉, 製造業, 運輸業, 介護, 飲食業, 小売業, 宿泊業, 卸売業, 情報通信業, 漁業, 建設業, 林業, 食品製造業, 畜産業

3. deadline（申請期間）は、本文から正確に抜き出せ。見つからない場合は "不明" とせよ。
4. amount（上限金額）は、数字と単位を含めて抜き出せ。見つからない場合は "不明" とせよ。`;

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

async function runAutoPilot() {
  console.log(`🚀 愛媛補助金クローラー [J-Net21 最終調整版] 起動...`);
  const targetUrls = new Set();
  const stats = { publish: 0, reject: 0, errors: 0 };
  
  console.log('📡 [フェーズ1] 全国枠および愛媛県の全21エリアを検索します...');

  for (const area of EHIME_AREAS) {
    console.log(`\n🔍 検索中: [${area}]`);
    
    let queries = [];
    if (area === '全国') {
      queries = [
        `site:j-net21.smrj.go.jp/snavi2/articles/ "地域" "全国" (補助金 OR 助成金)`,
        `site:j-net21.smrj.go.jp/snavi2/articles/ ("【全国】" OR "〖全国〗") (補助金 OR 助成金)`,
        `site:j-net21.smrj.go.jp/snavi2/articles/ "全国公募" (補助金 OR 助成金)`
      ];
    } else if (area === '愛媛県') {
      queries = [
        `site:j-net21.smrj.go.jp/snavi2/articles/ "${area}" (補助金 OR 助成金)`,
        `site:j-net21.smrj.go.jp/snavi2/articles/ ("【${area}】" OR "〖${area}〗")`,
        `site:j-net21.smrj.go.jp/snavi2/articles/ ("実施機関" "${area}" OR "〖${area}〗") (補助金 OR 助成金)`
      ];
    } else {
      queries = [
        `site:j-net21.smrj.go.jp/snavi2/articles/ "${area}" (補助金 OR 助成金)`,
        `site:j-net21.smrj.go.jp/snavi2/articles/ ("【${area}】" OR "〖${area}〗")`,
        `site:j-net21.smrj.go.jp/snavi2/articles/ ("実施機関" "${area}" OR "〖${area}〗" OR "【${area}】") (補助金 OR 助成金)`
      ];
    }

    const maxResultsLimit = (area === '全国') ? 25 : 15;

    for (let i = 0; i < queries.length; i++) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            api_key: TAVILY_API_KEY, 
            query: queries[i], 
            search_depth: "basic", 
            max_results: maxResultsLimit
          }) 
        });

        if (res.status === 432) {
          console.error(`\n❌ 【致命的エラー】Tavily APIの無料クレジットを使い切りました！`);
          process.exit(1); 
        }

        if (!res.ok) {
          console.log(`    ⚠️ API制限アラート (${res.status}): 10秒間深呼吸して再トライします...`);
          await sleep(10000); 
          i--; 
          continue;
        }

        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
          let added = 0;
          data.results.forEach(r => {
            const nUrl = normalizeUrl(r.url);
            
            if (nUrl.match(/\/articles\/\d+/) && !targetUrls.has(nUrl)) {
              targetUrls.add(nUrl);
              added++;
            }
          });
          if (added > 0) {
            console.log(`  ➔ パターン${i + 1}で新規URLを ${added} 件キャッチ`);
          }
        }
      } catch (e) {
        console.log(`  ⚠️ 検索エラー:`, e.message);
      }
      
      await sleep(2500); 
    }
  }

  const finalUrls = Array.from(targetUrls);
  console.log(`\n🤖 解析対象: J-Net21個別の記事ページ 合計 ${finalUrls.length} 件を処理します...\n`);

  for (const url of finalUrls) {
    console.log(`▶ 処理中: ${url}`);
    
    // 【注目】ここで「すでにDBにあるか」をチェックしてスキップしています！
    const { data: existing } = await supabase.from('subsidies').select('id').eq('source_url', url).single();
    if (existing) { console.log(`  ⏭️ すでにダッシュボードに登録済みのためスキップ`); stats.reject++; continue; }

    try {
      const { text: rawText, extractedOfficialUrl } = await fetchJNet21Text(url);
      if (!rawText || rawText.length < 100) { 
        console.log(`  ⏭️ テキスト取得失敗スキップ`); 
        stats.reject++; continue; 
      }

      let parsedData = await extractFullWithAI(rawText, url);
      
      // J-Net21の「地域」タグが完璧に取れるようになったので、プログラム側の他県チェックも緩和（AIの判定を信頼）
      const isOtherPrefecture = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'].some(pref => parsedData.region && parsedData.region === pref); // "includes" ではなく完全一致 "===" に変更して誤爆防止

      if (!parsedData.is_subsidy) { 
        console.log(`  ⏭️ 非補助金（セミナー・融資など）のためスキップ`); 
        stats.reject++; continue; 
      }
      
      if (isOtherPrefecture) {
        console.log(`  ⏭️ 他県専用データのためスキップ`); 
        stats.reject++; continue; 
      }

      let finalUrl = url; 
      
      if (extractedOfficialUrl && extractedOfficialUrl.startsWith('http')) {
        finalUrl = extractedOfficialUrl;
        console.log(`  🔗 [高精度抽出] 公式リンクを確定: ${finalUrl}`);
        
        const { data: existingOfficial } = await supabase.from('subsidies').select('id').eq('source_url', finalUrl).single();
        if (existingOfficial) {
          console.log(`  ⏭️ この公式URLはすでにダッシュボードに登録されているためスキップ`);
          stats.reject++; continue;
        }
      } else {
        console.log(`  ⚠️ 公式リンクが見つからなかったため、J-Net21のURLを使用します。`);
      }

      console.log(`  ✨ 結果: ${parsedData.title} (地域:${parsedData.region} / 締切:${parsedData.deadline})`);

      const { is_subsidy, fiscal_year, confidence, raw_excerpt, official_url, ...dbData } = parsedData;
      
      const { error: pErr } = await supabase.from('subsidies').insert([{ 
        ...dbData, 
        status: 'draft', 
        is_active: false, 
        source_url: finalUrl 
      }]);

      if (pErr) { 
        console.log(`  ❌ 保存エラー: ${pErr.message}`); 
        stats.errors++; 
      } else { 
        console.log(`  🟢 保存完了`); 
        stats.publish++; 
      }

    } catch (err) { 
      if (err.message.includes('リダイレクトされました')) {
         console.log(`  ⏭️ ${err.message} のためスキップ`);
         stats.reject++;
      } else {
         console.log(`  ❌ エラー: ${err.message}`); 
         stats.errors++; 
      }
    }
    await sleep(2000); 
  }

  console.log(`\n🏆 クローラー完了！ 追加: ${stats.publish}件 / スキップ: ${stats.reject}件 / エラー: ${stats.errors}件`);
}

runAutoPilot();