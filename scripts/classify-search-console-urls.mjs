#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const URL_COLUMN_CANDIDATES = ['URL', 'url', 'Page', 'ページ', '対象URL'];

const STATIC_ASSET_EXTENSIONS = [
  '.avif',
  '.css',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.map',
  '.png',
  '.svg',
  '.webmanifest',
  '.webp',
  '.xml',
];

const LIKELY_MISSING_PATTERNS = [
  'not-found',
  'does-not-exist',
  'should-not-exist',
  '999999999',
  'test-codex',
];

const ROUTE_PREFIXES = [
  ['subsidy', '/subsidy/'],
  ['column', '/column/'],
  ['expert-articles', '/expert-articles/'],
  ['area', '/area/'],
  ['purpose', '/purpose/'],
  ['feature', '/feature/'],
  ['search', '/search'],
  ['admin', '/admin'],
  ['login', '/login'],
  ['dashboard', '/dashboard'],
];

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.inputPath) {
  printUsage(args.help ? 0 : 1);
}

if (!fs.existsSync(args.inputPath)) {
  console.error(`CSV file not found: ${args.inputPath}`);
  process.exit(1);
}

const csvText = fs.readFileSync(args.inputPath, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCsv(csvText);

if (rows.length === 0) {
  console.error(`CSV file is empty: ${args.inputPath}`);
  process.exit(1);
}

const headers = rows[0];
const urlColumnIndex = findUrlColumnIndex(headers);

if (urlColumnIndex === -1) {
  console.error('URL column not found.');
  console.error(`Expected one of: ${URL_COLUMN_CANDIDATES.join(', ')}`);
  console.error(`Actual columns: ${headers.join(', ')}`);
  process.exit(1);
}

const details = rows
  .slice(1)
  .map((row, index) => ({
    rowNumber: index + 2,
    rawUrl: (row[urlColumnIndex] || '').trim(),
  }))
  .filter((row) => row.rawUrl.length > 0)
  .map(({ rowNumber, rawUrl }) => classifyUrl(rawUrl, rowNumber));

const summary = summarize(details);

printSummary(summary, details, args.inputPath, headers[urlColumnIndex]);

if (args.outPath) {
  writeDetails(args.outPath, args.format, summary, details);
}

function parseArgs(rawArgs) {
  const parsed = {
    inputPath: '',
    outPath: '',
    format: '',
    help: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--out') {
      parsed.outPath = rawArgs[index + 1] || '';
      index += 1;
    } else if (arg === '--format') {
      parsed.format = rawArgs[index + 1] || '';
      index += 1;
    } else if (!parsed.inputPath) {
      parsed.inputPath = arg;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage(1);
    }
  }

  return parsed;
}

function printUsage(exitCode) {
  console.log(`Usage:
  node scripts/classify-search-console-urls.mjs <search-console.csv>
  node scripts/classify-search-console-urls.mjs <search-console.csv> --out classified.json
  node scripts/classify-search-console-urls.mjs <search-console.csv> --out classified.csv --format csv

URL columns accepted:
  ${URL_COLUMN_CANDIDATES.join(', ')}
`);
  process.exit(exitCode);
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      if (next !== '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((value) => value.trim().length > 0));
}

function findUrlColumnIndex(headers) {
  const normalizedCandidates = new Set(URL_COLUMN_CANDIDATES.map(normalizeHeader));
  const normalizedHeaders = headers.map(normalizeHeader);
  const exactIndex = normalizedHeaders.findIndex((header) => normalizedCandidates.has(header));

  if (exactIndex !== -1) {
    return exactIndex;
  }

  return normalizedHeaders.findIndex(
    (header) => header.includes('url') || header.includes('ページ'),
  );
}

function normalizeHeader(header) {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function classifyUrl(rawUrl, rowNumber) {
  let parsedUrl;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return {
      rowNumber,
      url: rawUrl,
      category: 'invalid-url',
      pattern: 'invalid-url',
      hasTrailingSlash: false,
      isHttp: false,
      isWww: false,
      isIndexHtml: false,
      hasDoubleSlash: false,
      hasQuery: false,
      isLikelyMissing: false,
      isStaticAsset: false,
    };
  }

  const pathname = parsedUrl.pathname || '/';
  const lowerPath = pathname.toLowerCase();
  const lowerRawUrl = rawUrl.toLowerCase();
  const isStaticAsset = isStaticAssetPath(lowerPath);
  const category = getCategory(lowerPath, isStaticAsset);

  return {
    rowNumber,
    url: rawUrl,
    category,
    pattern: getPattern(lowerPath, category),
    hasTrailingSlash: pathname !== '/' && pathname.endsWith('/'),
    isHttp: parsedUrl.protocol === 'http:',
    isWww: parsedUrl.hostname.toLowerCase().startsWith('www.'),
    isIndexHtml: lowerPath.endsWith('/index.html') || lowerPath === '/index.html',
    hasDoubleSlash: hasPathDoubleSlash(rawUrl, pathname),
    hasQuery: parsedUrl.search.length > 0,
    isLikelyMissing: LIKELY_MISSING_PATTERNS.some((pattern) => lowerRawUrl.includes(pattern)),
    isStaticAsset,
  };
}

function isStaticAssetPath(lowerPath) {
  const extension = path.extname(lowerPath);
  return (
    lowerPath.startsWith('/assets/')
    || lowerPath.startsWith('/static/')
    || STATIC_ASSET_EXTENSIONS.includes(extension)
  );
}

function getCategory(lowerPath, isStaticAsset) {
  if (isStaticAsset) {
    return 'static-asset';
  }

  if (lowerPath === '/') {
    return 'top';
  }

  const matchedRoute = ROUTE_PREFIXES.find(([, prefix]) => lowerPath.startsWith(prefix));
  return matchedRoute ? matchedRoute[0] : 'unknown';
}

function getPattern(lowerPath, category) {
  if (category === 'invalid-url') {
    return 'invalid-url';
  }

  if (category === 'top') {
    return '/';
  }

  if (category === 'static-asset') {
    return 'static-asset';
  }

  if (['subsidy', 'column', 'expert-articles', 'area', 'purpose', 'feature'].includes(category)) {
    return `/${category}/:slug`;
  }

  if (['search', 'admin', 'login', 'dashboard'].includes(category)) {
    return `/${category}`;
  }

  const segments = lowerPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return '/';
  }

  return `/${segments[0]}/...`;
}

function hasPathDoubleSlash(rawUrl, pathname) {
  return pathname.includes('//') || /^https?:\/\/[^/]+\/{2,}/i.test(rawUrl);
}

function summarize(details) {
  const categoryCounts = countBy(details, 'category');
  const patternCounts = countBy(details, 'pattern');
  const flagCounts = {
    hasTrailingSlash: details.filter((item) => item.hasTrailingSlash).length,
    isHttp: details.filter((item) => item.isHttp).length,
    isWww: details.filter((item) => item.isWww).length,
    isIndexHtml: details.filter((item) => item.isIndexHtml).length,
    hasDoubleSlash: details.filter((item) => item.hasDoubleSlash).length,
    hasQuery: details.filter((item) => item.hasQuery).length,
    isLikelyMissing: details.filter((item) => item.isLikelyMissing).length,
    isStaticAsset: details.filter((item) => item.isStaticAsset).length,
  };

  return {
    totalUrls: details.length,
    categoryCounts,
    flagCounts,
    topPatterns: Object.entries(patternCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count })),
  };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
    return counts;
  }, {});
}

function printSummary(summary, details, inputPath, urlColumnName) {
  console.log('Search Console URL classification');
  console.log(`Input: ${inputPath}`);
  console.log(`URL column: ${urlColumnName}`);
  console.log(`Total URLs: ${summary.totalUrls}`);
  console.log('');

  console.log('Category counts:');
  printCounts(summary.categoryCounts);
  console.log('');

  console.log('Flag counts:');
  printCounts(summary.flagCounts);
  console.log('');

  console.log('Top URL patterns:');
  summary.topPatterns.forEach(({ pattern, count }) => {
    console.log(`  ${pattern}: ${count}`);
  });
  console.log('');

  const unknownUrls = details.filter((item) => item.category === 'unknown');
  console.log(`Unknown URLs: ${unknownUrls.length}`);
  unknownUrls.forEach((item) => {
    console.log(`  - ${item.url}`);
  });
}

function printCounts(counts) {
  Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });
}

function writeDetails(outPath, requestedFormat, summary, details) {
  const format = requestedFormat || getFormatFromPath(outPath);

  if (format === 'json') {
    fs.writeFileSync(outPath, `${JSON.stringify({ summary, details }, null, 2)}\n`);
    console.log(`\nWrote JSON detail: ${outPath}`);
    return;
  }

  if (format === 'csv') {
    fs.writeFileSync(outPath, toCsv(details));
    console.log(`\nWrote CSV detail: ${outPath}`);
    return;
  }

  console.error(`Unsupported output format: ${format}`);
  process.exit(1);
}

function getFormatFromPath(outPath) {
  const extension = path.extname(outPath).toLowerCase();
  if (extension === '.json') {
    return 'json';
  }
  if (extension === '.csv') {
    return 'csv';
  }
  return 'json';
}

function toCsv(details) {
  const headers = [
    'rowNumber',
    'url',
    'category',
    'pattern',
    'hasTrailingSlash',
    'isHttp',
    'isWww',
    'isIndexHtml',
    'hasDoubleSlash',
    'hasQuery',
    'isLikelyMissing',
    'isStaticAsset',
  ];

  const lines = [
    headers.join(','),
    ...details.map((item) => headers.map((header) => escapeCsvValue(item[header])).join(',')),
  ];

  return `${lines.join('\n')}\n`;
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
