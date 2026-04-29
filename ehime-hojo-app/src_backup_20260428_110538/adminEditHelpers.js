// adminEditHelpers.js
import { EXTERNAL_PORTALS, isOfficialDomain } from './subsidyTags';

// 手入力された金額テキストから最大金額（円）を抽出するパーサー
export const parseAmountMaxYen = (text) => {
  if (!text) return 0;
  let s = String(text).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  s = s.replace(/,/g, '').replace(/\s+/g, '');
  let maxVal = 0;
  const regex = /(\d+(?:\.\d+)?)(万?円)/g;
  let match;
  while ((match = regex.exec(s)) !== null) {
    let num = parseFloat(match[1]);
    if (match[2] === '万円') num *= 10000;
    if (num > maxVal) maxVal = num;
  }
  return Math.round(maxVal);
};

// 日付文字列(YYYY-MM-DD)を綺麗な日本語表示にするヘルパー
export const formatYmdToDisplay = (ymd) => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
};

// 手入力された期間テキストから開始日と終了日を抽出するパーサー
export const parseDatesFromText = (text) => {
  if (!text) return { start: null, end: null };

  let s = String(text).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  s = s.replace(/令和([元0-9]+)年/g, (_, p1) => {
    const y = p1 === '元' ? 2019 : 2018 + parseInt(p1, 10);
    return `${y}年`;
  });
  s = s.replace(/平成([元0-9]+)年/g, (_, p1) => {
    const y = p1 === '元' ? 1989 : 1988 + parseInt(p1, 10);
    return `${y}年`;
  });

  const range = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?\s*(?:〜|～|-|から)\s*(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?/);
  if (range) {
    const y1 = parseInt(range[1], 10);
    const m1 = parseInt(range[2], 10);
    const d1 = parseInt(range[3], 10);
    const y2 = parseInt(range[4] || range[1], 10); 
    const m2 = parseInt(range[5], 10);
    const d2 = parseInt(range[6], 10);
    return {
      start: `${y1}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`,
      end: `${y2}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`
    };
  }

  let dates = [];
  const dateRegex = /(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})日?/g;
  let match;
  while ((match = dateRegex.exec(s)) !== null) {
    dates.push(`${match[1]}-${String(parseInt(match[2], 10)).padStart(2, '0')}-${String(parseInt(match[3], 10)).padStart(2, '0')}`);
  }

  if (dates.length === 0) return { start: null, end: null };
  if (dates.length === 1) {
    if (s.includes('から') || s.includes('より') || s.includes('開始')) {
      if (!s.includes('まで') && !s.includes('締切') && !s.includes('期限')) {
        return { start: dates[0], end: null };
      }
    }
    return { start: null, end: dates[0] };
  }
  return { start: dates[0], end: dates[dates.length - 1] };
};

// 期間候補行の抽出ヘルパー
export const extractPeriodHintLines = (text) => {
  if (!text) return '';
  const lines = String(text)
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

  const hits = lines.filter(l =>
    /(申請期限|締切|締め切り|受付期限|受付期間|申請期間|申請時期|提出期限|提出時期|事前協議時期|募集期間|期限|期間)/.test(l) &&
    !/(更新日|掲載日)/.test(l)
  );

  return hits.slice(0, 10).join('\n');
};

const normalizeJapaneseDateText = (text) => {
  if (!text) return '';
  let s = String(text).replace(/[０-９]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );
  s = s.replace(/令和([元0-9]+)年/g, (_, p1) => {
    const y = p1 === '元' ? 2019 : 2018 + parseInt(p1, 10);
    return `${y}年`;
  });
  return s;
};

// 明示的な締切行（日付あり）を抽出するヘルパー
export const extractExplicitDeadlineLine = (text) => {
  if (!text) return '';
  const s = normalizeJapaneseDateText(text);
  const flat = s.replace(/\s+/g, ' ');
  const regex = /(?:申請期限|締切|締め切り|受付期限|受付期間|申請期間|申請時期|提出期限|提出時期|事前協議時期|募集期間|期限|期間)[^。]{0,60}?(\d{4}年\d{1,2}月\d{1,2}日)/;
  const match = flat.match(regex);
  if (match) {
    const context = flat.substring(Math.max(0, match.index - 20), match.index);
    if (context.includes('更新') || context.includes('掲載')) return '';
    return match[0]; 
  }
  return '';
};

// 随時受付など「日付なし期間行」を抽出するヘルパー
export const extractNonDatePeriodLine = (text) => {
  if (!text) return '';
  const lines = String(text)
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

  return (
    lines.find(l =>
      /(随時|常時|通年|期間の定めなし|予算枠に達し次第|予算上限に達し次第|予算に達し次第)/.test(l) &&
      /(受付|申請|募集|終了)/.test(l)
    ) || ''
  );
};

// 相対期限（契約日から〇ヶ月以内など）を抽出する専用ヘルパー
export const extractRelativePeriodLine = (text) => {
  if (!text) return '';
  const lines = String(text)
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

  return (
    lines.find(l =>
      /(以内|以前|以後|まで|から)/.test(l) &&
      /(提出|申請|受付|協議)/.test(l)
    ) || ''
  );
};

// 期間AIの再探索（フォールバック）が必要か判定する
export const needsPeriodFallback = (facts) => {
  const txt = String(facts.application_period_text || '');
  return (
    !txt ||
    txt.includes('要確認') ||
    (!facts.application_start_date && !facts.application_end_date)
  );
};

// 期間情報に特化して別ページを再検索する関数（今年度を強制）
export const searchPeriodOnly = async ({ title, org, tavilyKey }) => {
  const currentYear = new Date().getFullYear();
  const reiwaYear = currentYear - 2018;
  
  const query = `"${title}" "${org}" (受付期間 OR 申請期間 OR 申請期限 OR 締切 OR 募集期間) (${currentYear} OR 令和${reiwaYear})`;

  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query,
      search_depth: 'advanced',
      include_raw_content: true,
      max_results: 5,
      exclude_domains: EXTERNAL_PORTALS.filter(d => d.includes('.'))
    })
  });

  const data = await tavilyRes.json();
  const results = data.results || [];

  return results.find(r =>
    isOfficialDomain(r.url) &&
    /(受付期間|申請期間|申請期限|締切|募集期間|令和\d+年|20\d{2}年)/.test(
      `${r.title || ''}\n${r.raw_content || r.content || ''}`
    )
  ) || null;
};