require('dotenv').config();

const { createSupabaseClient, getSupabaseEnv, upsertSubsidyBySource } = require('./shared/supabase');
const { searchJgrants, fetchDetailV2, getSubsidyId, sleep } = require('./shared/jgrantsApi');
const { normalizeJgrantsDetailToRows } = require('./shared/jgrantsNormalize');
const { asString, stripHtmlForExtraction, pick } = require('./shared/jgrantsExtractors');

/**
 * JグランツAPI取り込みスクリプト
 *
 * 保存しないテスト:
 *   npm run jgrants
 *
 * 保存せず5件だけ確認:
 *   JGRANTS_LIMIT=5 npm run jgrants
 *
 * 5件だけ保存:
 *   JGRANTS_LIMIT=5 JGRANTS_DRY_RUN=0 npm run jgrants
 */

const DRY_RUN = process.env.JGRANTS_DRY_RUN !== '0';
const LIMIT = Number(process.env.JGRANTS_LIMIT || 30);

if (!global.fetch) {
  throw new Error('❌ Node.js 18以上で実行してください。global.fetch が使えません。');
}

const SEARCH_TARGETS = [
  { label: '愛媛 補助金', keyword: '愛媛 補助金', fallbackArea: '愛媛県' },
  { label: '愛媛 助成金', keyword: '愛媛 助成金', fallbackArea: '愛媛県' },
  { label: '愛媛 事業', keyword: '愛媛 事業', fallbackArea: '愛媛県' },
  { label: '愛媛 創業', keyword: '愛媛 創業', fallbackArea: '愛媛県' },
  { label: '愛媛 設備', keyword: '愛媛 設備', fallbackArea: '愛媛県' },
  { label: '松山市 補助金', keyword: '松山市 補助金', fallbackArea: '愛媛県' },
  { label: '今治市 補助金', keyword: '今治市 補助金', fallbackArea: '愛媛県' },
  { label: '西予市 補助金', keyword: '西予市 補助金', fallbackArea: '愛媛県' },
  { label: '宇和島市 補助金', keyword: '宇和島市 補助金', fallbackArea: '愛媛県' },
  { label: '四国中央市 補助金', keyword: '四国中央市 補助金', fallbackArea: '愛媛県' },
  { label: '全国 補助金', keyword: '補助金', fallbackArea: '全国' },
  { label: '全国 事業者', keyword: '事業者', fallbackArea: '全国' },
];

function uniqueBy(items, keyFn) {
  const map = new Map();

  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, item);
  }

  return [...map.values()];
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = getSupabaseEnv();
  const supabase = createSupabaseClient({ requireServiceKey: !DRY_RUN });

  console.log('\n🚀 Jグランツ取込を開始します');
  console.log(`DRY_RUN: ${DRY_RUN ? 'ON（保存しない）' : 'OFF（Supabaseへ保存）'}`);
  console.log(`LIMIT: ${LIMIT}`);

  if (DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
    console.log('ℹ️ DRY_RUNのため、Supabaseキーが未設定でも処理を続行します。');
  }

  console.log('==============================\n');

  const allSearchResults = [];

  for (const target of SEARCH_TARGETS) {
    console.log(`🔎 検索: ${target.label}`);

    try {
      const rows = await searchJgrants(target.keyword);

      const enrichedRows = rows.map((row) => ({
        ...row,
        __search_area: target.fallbackArea,
        __search_keyword: target.keyword,
        __search_label: target.label,
      }));

      console.log(`  → 採用候補: ${rows.length} 件`);

      allSearchResults.push(...enrichedRows);
    } catch (err) {
      console.log(`  ❌ 検索エラー: ${err.message}`);
    }

    await sleep(800);
  }

  const uniqueSubsidies = uniqueBy(allSearchResults, getSubsidyId).slice(0, LIMIT);

  console.log('\n==============================');
  console.log(`📦 詳細取得対象: ${uniqueSubsidies.length} 件`);
  console.log('==============================\n');

  const stats = {
    searched: allSearchResults.length,
    unique: uniqueSubsidies.length,
    normalized: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const item of uniqueSubsidies) {
    const id = getSubsidyId(item);
    const listTitle = stripHtmlForExtraction(
      asString(pick(item, ['title', 'name', 'subsidy_name'], id))
    );

    console.log(`▶ 詳細取得: ${listTitle}`);

    try {
      if (!id) {
        console.log('  ⏭️ IDなしのためスキップ');
        stats.skipped++;
        continue;
      }

      const detail = await fetchDetailV2(id);

      if (!detail) {
        console.log('  ⏭️ 詳細データなし');
        stats.skipped++;
        continue;
      }

      const normalizedRows = normalizeJgrantsDetailToRows(detail, item);

      if (normalizedRows.length === 0) {
        console.log('  ⏭️ 採用条件に合わないためスキップ');
        stats.skipped++;
        continue;
      }

      for (const row of normalizedRows) {
        stats.normalized++;

        console.log(`  ✅ ${row.title}`);
        console.log(`     実施機関: ${row.organization || '不明'}`);
        console.log(`     地域: ${row.region_text}`);
        console.log(`     期間: ${row.application_period_text}`);
        console.log(`     状態: ${row.application_status}`);
        console.log(`     上限: ${row.amount_text}`);
        console.log(`     補助率: ${row.subsidy_rate_text || '不明'}`);
        console.log(`     対象経費: ${row.target_expenses_arr.length ? row.target_expenses_arr.join(' / ') : '不明'}`);
        console.log(`     URL: ${row.official_url}`);

        if (DRY_RUN) {
          console.log('     🧪 DRY_RUNのため保存しません');
          continue;
        }

        const result = await upsertSubsidyBySource(supabase, row);

        if (result === 'inserted') stats.inserted++;
        if (result === 'updated') stats.updated++;

        console.log(`     💾 ${result}`);
      }
    } catch (err) {
      stats.errors++;
      console.log(`  ❌ エラー: ${err.message}`);
    }

    await sleep(1000);
  }

  console.log('\n==============================');
  console.log('🎉 Jグランツ取込完了');
  console.log(stats);
  console.log('==============================\n');

  if (DRY_RUN) {
    console.log('保存する場合は次を実行してください：');
    console.log('JGRANTS_DRY_RUN=0 npm run jgrants');
    console.log('');
    console.log('5件だけ保存テストする場合：');
    console.log('JGRANTS_LIMIT=5 JGRANTS_DRY_RUN=0 npm run jgrants');
  }
}

main().catch((err) => {
  console.error('❌ 致命的エラー:', err);
  process.exit(1);
});
