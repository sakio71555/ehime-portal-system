import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SITE_NAME = '愛媛の補助金・助成金ポータル';
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

const DIST_DIR = path.resolve('dist');
const INDEX_PATH = path.join(DIST_DIR, 'index.html');

function normalizeSiteUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
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

function absoluteUrl(pathname = '/') {
  if (/^https?:\/\//i.test(pathname)) return pathname;
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_URL}${normalizedPath}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\u3000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateText(text, max = 155) {
  const value = normalizeText(text).replace(/\s+/g, ' ');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function firstNonEmpty(obj, keys = []) {
  for (const key of keys) {
    const value = obj?.[key];

    if (Array.isArray(value)) {
      const joined = value.map(normalizeText).filter(Boolean).join(' / ');
      if (joined) return joined;
    }

    const text = normalizeText(value);
    if (text && !['不明', '未設定', 'なし', 'null', 'undefined'].includes(text.toLowerCase())) {
      return text;
    }
  }

  return '';
}

function getSubsidyRegion(subsidy) {
  return (
    firstNonEmpty(subsidy, ['municipality', 'region_text', 'region', 'prefecture']) ||
    '愛媛県'
  );
}

function buildSubsidyTitle(subsidy) {
  const title = firstNonEmpty(subsidy, ['title']) || '補助金・助成金情報';
  return `【${getSubsidyRegion(subsidy)}】${title}｜申請期間・上限金額・補助率`;
}

function buildSubsidyDescription(subsidy) {
  const title = firstNonEmpty(subsidy, ['title']) || '補助金・助成金';
  const period = firstNonEmpty(subsidy, [
    'application_period_text',
    'application_period',
    'deadline',
  ]) || '申請期間未確認';
  const amount = firstNonEmpty(subsidy, ['amount_text', 'amount']) || '上限金額未確認';
  const rate = firstNonEmpty(subsidy, ['subsidy_rate_text', 'subsidy_rate']) || '補助率未確認';
  const organization = firstNonEmpty(subsidy, [
    'organization',
    'organization_name',
    'agency_name',
    'implementation_agency',
  ]) || '実施機関未確認';

  return truncateText(
    `${getSubsidyRegion(subsidy)}の「${title}」は、${organization}が実施する補助金・助成金情報です。申請期間：${period}。${amount}。補助率：${rate}。対象者・対象経費・公式公募ページを確認できます。`
  );
}

function buildSubsidyBody(subsidy) {
  const title = firstNonEmpty(subsidy, ['title']) || '補助金・助成金情報';
  const region = getSubsidyRegion(subsidy);
  const organization = firstNonEmpty(subsidy, [
    'organization',
    'organization_name',
    'agency_name',
    'implementation_agency',
  ]);
  const amount = firstNonEmpty(subsidy, ['amount_text', 'amount']);
  const rate = firstNonEmpty(subsidy, ['subsidy_rate_text', 'subsidy_rate']);
  const period = firstNonEmpty(subsidy, [
    'application_period_text',
    'application_period',
    'deadline',
  ]);
  const overview = firstNonEmpty(subsidy, ['summary', 'overview', 'description', 'purpose']);
  const target = firstNonEmpty(subsidy, ['target_entities_arr', 'target_entities', 'target']);
  const expenses = firstNonEmpty(subsidy, ['target_expenses_arr', 'target_expenses']);

  return `
    <main class="seo-prerender">
      <article>
        <p>${escapeHtml(region)}${organization ? ` / ${escapeHtml(organization)}` : ''}</p>
        <h1>${escapeHtml(title)}</h1>
        ${overview ? `<section><h2>制度の概要</h2><p>${escapeHtml(overview)}</p></section>` : ''}
        <section>
          <h2>補助金・助成金の基本情報</h2>
          <dl>
            ${amount ? `<dt>補助上限額・助成額</dt><dd>${escapeHtml(amount)}</dd>` : ''}
            ${rate ? `<dt>補助率</dt><dd>${escapeHtml(rate)}</dd>` : ''}
            ${period ? `<dt>申請期間</dt><dd>${escapeHtml(period)}</dd>` : ''}
            ${target ? `<dt>対象者</dt><dd>${escapeHtml(target)}</dd>` : ''}
            ${expenses ? `<dt>対象経費</dt><dd>${escapeHtml(expenses)}</dd>` : ''}
          </dl>
        </section>
      </article>
    </main>`;
}

function buildSubsidyJsonLd(subsidy, canonicalPath) {
  const organization = firstNonEmpty(subsidy, [
    'organization',
    'organization_name',
    'agency_name',
    'implementation_agency',
  ]) || '実施機関未確認';

  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: firstNonEmpty(subsidy, ['title']) || '補助金・助成金情報',
    description: buildSubsidyDescription(subsidy),
    provider: {
      '@type': 'GovernmentOrganization',
      name: organization,
    },
    areaServed: {
      '@type': 'AdministrativeArea',
      name: getSubsidyRegion(subsidy),
    },
    serviceType: '補助金・助成金情報',
    url: absoluteUrl(canonicalPath),
    mainEntityOfPage: absoluteUrl(canonicalPath),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
    },
  };
}

function stripHtml(html) {
  return normalizeText(html).replace(/\s+/g, ' ');
}

function buildColumnDescription(column) {
  return truncateText(
    column?.description ||
      column?.excerpt ||
      stripHtml(column?.content) ||
      `${column?.title || 'コラム'}に関する記事です。`
  );
}

function buildColumnBody(column) {
  const title = column?.title || 'お役立ちコラム';
  const content = stripHtml(column?.content);

  return `
    <main class="seo-prerender">
      <article>
        ${column?.category ? `<p>${escapeHtml(column.category)}</p>` : ''}
        <h1>${escapeHtml(title)}</h1>
        ${content ? `<p>${escapeHtml(truncateText(content, 4000))}</p>` : ''}
      </article>
    </main>`;
}

function buildHead({ title, description, canonicalPath, type = 'article', jsonLd }) {
  const pageTitle =
    title.includes(SITE_NAME) || title.includes('愛媛の補助金')
      ? title
      : `${title}｜${SITE_NAME}`;
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl('/logo.png');

  return `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow" />
    <meta name="theme-color" content="#0f766e" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="${escapeHtml(type)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    ${jsonLd ? `<script type="application/ld+json">${escapeJsonLd(jsonLd)}</script>` : ''}`;
}

function getPreservedHeadTags(template) {
  const headMatch = template.match(/<head>([\s\S]*?)<\/head>/);
  const originalHead = headMatch?.[1] || '';
  const preservedTags = originalHead.match(
    /<(script|link)[^>]*(?:rel="(?:stylesheet|icon|apple-touch-icon)"|type="module"|src=)[^>]*(?:><\/script>|>)/gi
  );

  return (preservedTags || []).join('\n    ');
}

function renderHtml(template, head, body) {
  const preservedHeadTags = getPreservedHeadTags(template);

  return template
    .replace(
      /<head>[\s\S]*?<\/head>/,
      `<head>${head}\n    ${preservedHeadTags}\n  </head>`
    )
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

function writeRouteHtml(routePath, html) {
  const normalized = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
  const outputDir = path.join(DIST_DIR, normalized);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
}

async function fetchAll(supabase, table, select, filters = []) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;
    let query = supabase.from(table).select(select).range(from, to);

    for (const filter of filters) {
      query = query[filter.method](...filter.args);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`${table}取得エラー: ${error.message}`);
    }

    const chunk = data || [];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  console.log('🚀 SEOプリレンダーを開始します');

  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error('dist/index.html が見つかりません。vite build 後に実行してください。');
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'VITE_SUPABASE_URL または VITE_SUPABASE_ANON_KEY が見つかりません。.env.production を確認してください。'
    );
  }

  const template = fs.readFileSync(INDEX_PATH, 'utf8');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const subsidies = await fetchAll(supabase, 'subsidies', '*', [
    { method: 'eq', args: ['is_active', true] },
    { method: 'eq', args: ['crawl_status', 'published'] },
  ]);

  for (const subsidy of subsidies) {
    if (!subsidy?.id) continue;

    const canonicalPath = `/subsidy/${subsidy.id}/`;
    const html = renderHtml(
      template,
      buildHead({
        title: buildSubsidyTitle(subsidy),
        description: buildSubsidyDescription(subsidy),
        canonicalPath,
        jsonLd: buildSubsidyJsonLd(subsidy, canonicalPath),
      }),
      buildSubsidyBody(subsidy)
    );

    writeRouteHtml(canonicalPath, html);
  }

  const columns = await fetchAll(supabase, 'columns', '*', [
    { method: 'eq', args: ['is_published', true] },
    { method: 'not', args: ['slug', 'is', null] },
    { method: 'neq', args: ['slug', ''] },
  ]);

  for (const column of columns) {
    if (!column?.slug) continue;

    const canonicalPath = `/column/${encodeURIComponent(column.slug)}/`;
    const description = buildColumnDescription(column);
    const html = renderHtml(
      template,
      buildHead({
        title: column.title || 'お役立ちコラム',
        description,
        canonicalPath,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: column.title || 'お役立ちコラム',
          description,
          datePublished: column.published_at || column.created_at || undefined,
          mainEntityOfPage: absoluteUrl(canonicalPath),
          url: absoluteUrl(canonicalPath),
          isPartOf: {
            '@type': 'WebSite',
            name: SITE_NAME,
            url: `${SITE_URL}/`,
          },
        },
      }),
      buildColumnBody(column)
    );

    writeRouteHtml(canonicalPath, html);
  }

  console.log('==============================');
  console.log('✅ SEOプリレンダー完了');
  console.log(`補助金詳細: ${subsidies.length} 件`);
  console.log(`コラム詳細: ${columns.length} 件`);
  console.log('==============================');
}

main().catch((err) => {
  console.error('❌ SEOプリレンダーエラー:', err.message);
  process.exit(1);
});
