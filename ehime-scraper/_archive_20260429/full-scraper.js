require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const axios = require('axios');

// ==========================================
// 1. 設定
// ==========================================
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// 🔥 巡回先リスト（今治ドメインも修正済み）
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
// 2. 抽出ロジック (提示いただいたプロンプトを完全踏襲)
// ==========================================
async function extractSubsidyInfo(text, url) {
  const systemPrompt = `
  あなたは愛媛県の補助金情報を解析する優秀な専門アシスタントです。
  提供されたWebページのテキストを読み解き、ルールに従って必ずJSON形式で出力してください。
  
  【ルール】
  1. 該当情報がない場合は "未記載" とすること。
  2. 愛媛県以外の情報は無視すること。
  3. purposes（利用目的）と industries（業種）は、以下の【許可リスト】から該当するものを推測し、配列で出力すること。リストにない言葉は絶対に使わないこと。
  
  【許可リスト：purposes】
  経営改善・経営強化, 地域活性・まちづくり, 設備投資, 人材育成・雇用, 生産性向上・業務効率化, 起業・創業・ベンチャー, 販路開拓・販路拡大, ものづくり・新商品開発, デジタル, 省エネ, 環境, 再エネ・蓄エネ, 研究・実証実験・産学連携, 防犯・防災・BCP, 海外展開, 観光・インバウンド, 新規事業・第二創業, 空き家利用, 省力化・省人化, 事業承継
  
  【許可リスト：industries】
  サービス業, 農業, 医療・福祉, 製造業, 運輸業, 介護, 飲食業, 小売業, 宿泊業, 卸売業, 情報通信業, 漁業, 建设業, 林業, 食品製造業, 畜産業
  `;

  const safeText = text ? text.substring(0, 10000) : "テキスト取得不可";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", 
    response_format: { type: "json_object" },
    temperature: 0.0, 
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `※ source_url には必ず ${url} を入れてください。\n\n【対象テキスト】\n${safeText}` }
    ]
  });

  return JSON.parse(response.choices[0].message.content);
}

// ==========================================
// 3. メインループ処理 (止まらない版)
// ==========================================
async function main() {
  console.log("🚀 愛媛県全域フルオート・スクレイピングを開始します...\n");
  let totalSaved = 0;

  for (const target of TARGET_LIST) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📍 調査対象: ${target.name}`);

    try {
      // Tavily検索 (include_raw_content を使用)
      const searchResponse = await axios.post('https://api.tavily.com/search', {
        api_key: TAVILY_API_KEY,
        query: `site:${target.domain} 事業者向け 補助金 令和8年`,
        search_depth: "advanced",
        include_raw_content: true,
        max_results: 2 // 1箇所につき2件ずつ精査
      });

      const results = searchResponse.data.results || [];
      if (results.length === 0) {
        console.log("  💨 新着情報なし。");
        continue;
      }

      for (const res of results) {
        // 重複チェック
        const { data: existing } = await supabase.from('subsidies').select('id').eq('source_url', res.url).single();
        if (existing) {
          console.log(`  ⏭ スキップ (登録済): ${res.url}`);
          continue;
        }

        // 解析
        const extractedData = await extractSubsidyInfo(res.raw_content, res.url);
        
        if (extractedData.title && extractedData.title !== "未記載") {
          extractedData.status = 'draft';
          extractedData.is_active = true;

          // 保存
          const { error } = await supabase.from('subsidies').insert([extractedData]);
          if (!error) {
            console.log(`  ✅ 保存成功: ${extractedData.title}`);
            totalSaved++;
          } else {
            console.error(`  ❌ DB保存失敗: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error(`  🚨 ${target.name} の処理中にエラーが発生しましたが、続行します。`);
    }

    // 負荷軽減の待機
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎉 完走！ 合計 ${totalSaved} 件のデータを「承認待ち」に追加しました。`);
}

main();