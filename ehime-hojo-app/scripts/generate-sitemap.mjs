import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = normalizeSiteUrl(
  process.env.VITE_SITE_URL ||
    loadEnvValue('VITE_SITE_URL') ||
    'https://ehime-hojokin.jp'
);

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  loadEnvValue('VITE_SUPABASE_URL');

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  loadEnvValue('VITE_SUPABASE_ANON_KEY');

const OUTPUT_PATH = path.resolve('public/sitemap.xml');

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/search', changefreq: 'daily', priority: '0.9' },
  { path: '/simulator', changefreq: 'monthly', priority: '0.7' },
  { path: '/experts', changefreq: 'monthly', priority: '0.7' },
  { path: '/beginners', changefreq: 'monthly', priority: '0.7' },
  { path: '/columns', changefreq: 'weekly', priority: '0.8' },
];

const SEO_SEARCH_KEYWORDS = [
  '松山市',
  '今治市',
  '西予市',
  '宇和島市',
  '四国中央市',
  '新居浜市',
  '西条市',
  '大洲市',
  '創業',
  '設備',
  '省エネ',
  'IT',
  '販路',
  '農業',
  '観光',
  '人材',
];

function normalizeSiteUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);

  return date.toISOString().slice(0, 10);
}

function buildUrl(pathname) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_URL}${normalizedPath}`;
}

function toUrlEntry({ loc, lastmod, changefreq = 'weekly', priority = '0.6' }) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(toIsoDate(lastmod))}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadEnvValue(key) {
  const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
  let value = '';

  for (const envFile of envFiles) {
    const parsed = parseEnvFile(path.resolve(envFile));
    if (parsed[key]) value = parsed[key];
  }

  return value;
}

async function fetchAllPublishedSubsidies(supabase) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('subsidies')
      .select('id, fetched_at')
      .eq('is_active', true)
      .eq('crawl_status', 'published')
      .range(from, to);

    if (error) {
      throw new Error(`subsidies取得エラー: ${error.message}`);
    }

    const chunk = data || [];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchAllPublishedColumns(supabase) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('columns')
      .select('slug, published_at')
      .eq('is_published', true)
      .range(from, to);

    if (error) {
      console.warn(`⚠️ columns取得エラー: ${error.message}`);
      return rows;
    }

    const chunk = data || [];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  console.log('🚀 sitemap.xml 自動生成を開始します');
  console.log(`SITE_URL: ${SITE_URL}`);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'VITE_SUPABASE_URL または VITE_SUPABASE_ANON_KEY が見つかりません。.env.production を確認してください。'
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const staticEntries = STATIC_ROUTES.map((route) =>
    toUrlEntry({
      loc: buildUrl(route.path),
      lastmod: today,
      changefreq: route.changefreq,
      priority: route.priority,
    })
  );

  const seoSearchEntries = SEO_SEARCH_KEYWORDS.map((keyword) =>
    toUrlEntry({
      loc: buildUrl(`/search?keyword=${encodeURIComponent(keyword)}`),
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.75',
    })
  );

  const subsidies = await fetchAllPublishedSubsidies(supabase);

  const subsidyEntries = subsidies
    .filter((item) => item?.id)
    .map((item) =>
      toUrlEntry({
        loc: buildUrl(`/subsidy/${item.id}/`),
        lastmod: item.fetched_at || today,
        changefreq: 'weekly',
        priority: '0.8',
      })
    );

  const columns = await fetchAllPublishedColumns(supabase);

  const columnEntries = columns
    .filter((item) => item?.slug)
    .map((item) =>
      toUrlEntry({
        loc: buildUrl(`/column/${encodeURIComponent(item.slug)}/`),
        lastmod: item.published_at || today,
        changefreq: 'monthly',
        priority: '0.7',
      })
    );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${[...staticEntries, ...seoSearchEntries, ...subsidyEntries, ...columnEntries].join('\n')}
</urlset>
`;

  fs.writeFileSync(OUTPUT_PATH, xml, 'utf8');

  console.log('==============================');
  console.log('✅ sitemap.xml 生成完了');
  console.log(`出力先: ${OUTPUT_PATH}`);
  console.log(`静的ページ: ${staticEntries.length} 件`);
  console.log(`SEO検索ページ: ${seoSearchEntries.length} 件`);
  console.log(`補助金詳細: ${subsidyEntries.length} 件`);
  console.log(`コラム詳細: ${columnEntries.length} 件`);
  console.log(
    `合計: ${
      staticEntries.length +
      seoSearchEntries.length +
      subsidyEntries.length +
      columnEntries.length
    } 件`
  );
  console.log('==============================');
}

main().catch((err) => {
  console.error('❌ sitemap.xml 生成エラー:', err.message);
  process.exit(1);
});
