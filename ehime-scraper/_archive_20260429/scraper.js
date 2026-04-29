import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// .env 読み込み
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// 🔥 ターゲットリスト：ここにある全21箇所を順番に自動で回り切ります
const TARGET_LIST = [
  { name: "えひめ産業振興財団", domain: "ehime-iinet.or.jp" },
  { name: "松山商工会議所", domain: "mspc.jp" },
  { name: "今治商工会議所", domain: "imabaricci.or.jp" }, // 修正済み
  { name: "宇和島商工会議所", domain: "uwajima-cci.or.jp" },
  { name: "八幡浜商工会議所", domain: "yawatahama-cci.or.jp" },
  { name: "新居浜商工会議所", domain: "niihama-cci.or.jp" },
  { name: "西条商工会議所", domain: "saijo-cci.or.jp" },
  { name: "大洲商工会議所", domain: "ozu-cci.jp" },
  { name: "伊予商工会議所", domain: "iyocci.jp" },
  { name: "四国中央商工会議所", domain: "shikokuchuo-cci.or.jp" },
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
  { name: "東温市", domain: "city.toon.ehime.jp" }
];

const SYSTEM_PROMPT = `あなたは愛媛県特化の補助金抽出AIです。提供されたテキストから補助金情報を抽出しJSONで返してください。愛媛県外の情報は破棄してください。`;

async function runScraper() {
  console.log("🏎️ [フル巡回開始] 全21ターゲットを順番に調査します...");
  let totalSaved = 0;

  for (const target of TARGET_LIST) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📍 現在の調査地点: ${target.name} (${target.domain})`);

    try {
      // 1. Tavily検索
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: `site:${target.domain} 事業者向け (補助金 OR 助成金) 令和8年`,
          search_depth: "advanced",
          max_results: 3
        })
      });

      const data = await response.json();
      const searchResults = data.results || [];

      if (searchResults.length === 0) {
        console.log(`  💨 新しい情報は見つかりませんでした。次へ進みます。`);
        continue;
      }

      // 2. 見つかった各URLを処理
      for (const result of searchResults) {
        // 重複チェック
        const { data: existing } = await supabase.from('subsidies').select('id').eq('source_url', result.url).single();
        if (existing) {
          console.log(`  ⏭ スキップ (既登録): ${result.url}`);
          continue;
        }

        console.log(`  🧠 AI解析中... ${result.url}`);
        const aiRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: result.content }
          ]
        });

        const extracted = JSON.parse(aiRes.choices[0].message.content);

        if (extracted && extracted.title !== "未記載") {
          // 3. 保存
          const { error } = await supabase.from('subsidies').insert({
            ...extracted,
            status: 'draft',
            is_active: false,
            source_url: result.url
          });

          if (!error) {
            console.log(`  ✅ [保存完了] ${extracted.title}`);
            totalSaved++;
          } else {
            console.error(`  ❌ 保存エラー: ${error.message}`);
          }
        }
      }
    } catch (error) {
      // 🔥 ここが重要！エラーが起きても「次へ進む」ためのキャッチ
      console.error(`  🚨 ${target.name} の処理中にエラーが発生しましたが、無視して続行します:`, error.message);
    }

    // APIレート制限に配慮して1.5秒待機
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎉 巡回完了！ 合計 ${totalSaved} 件を「承認待ち」に追加しました。`);
}

runScraper();