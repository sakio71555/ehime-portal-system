const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'src', 'AdminEditForm.jsx');

if (!fs.existsSync(targetPath)) {
  console.error('❌ src/AdminEditForm.jsx が見つかりません。');
  process.exit(1);
}

const original = fs.readFileSync(targetPath, 'utf8');

const backupPath = `${targetPath}.backup_${new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, '')
  .slice(0, 14)}`;

fs.writeFileSync(backupPath, original, 'utf8');

let src = original;

const helperBlock = `
const toHalfWidthNumberForStatus = (value = '') => {
  return String(value).replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
};

const warekiToWesternTextForStatus = (value = '') => {
  let text = toHalfWidthNumberForStatus(value);

  text = text.replace(/令和(元|\\d+)年/g, (_, y) => {
    const year = y === '元' ? 2019 : 2018 + Number(y);
    return \`\${year}年\`;
  });

  text = text.replace(/平成(元|\\d+)年/g, (_, y) => {
    const year = y === '元' ? 1989 : 1988 + Number(y);
    return \`\${year}年\`;
  });

  return text;
};

const parseIsoDateFromJapaneseTextForStatus = (value = '') => {
  const text = warekiToWesternTextForStatus(value);
  const match = text.match(/(20\\d{2})年\\s*(\\d{1,2})月\\s*(\\d{1,2})日?/);

  if (!match) return null;

  return \`\${match[1]}-\${String(Number(match[2])).padStart(2, '0')}-\${String(
    Number(match[3])
  ).padStart(2, '0')}\`;
};

const parsePeriodDatesForStatus = (periodText = '') => {
  const text = warekiToWesternTextForStatus(periodText);

  const openEnded =
    /(助成枠に達するまで|予算に達するまで|予算額に達するまで|予算枠に達し次第|予算上限に達し次第|定員に達し次第|達し次第|なくなり次第|随時|通年|常時)/.test(
      text
    );

  if (openEnded) {
    return {
      startDate: parseIsoDateFromJapaneseTextForStatus(text),
      endDate: null,
      isOpenEnded: true,
    };
  }

  const rangeMatch = text.match(
    /(20\\d{2})年\\s*(\\d{1,2})月\\s*(\\d{1,2})日?.{0,30}(?:から|より|～|〜|-).{0,30}(?:(20\\d{2})年\\s*)?(\\d{1,2})月\\s*(\\d{1,2})日?/
  );

  if (rangeMatch) {
    const startDate = \`\${rangeMatch[1]}-\${String(Number(rangeMatch[2])).padStart(
      2,
      '0'
    )}-\${String(Number(rangeMatch[3])).padStart(2, '0')}\`;

    const endYear = rangeMatch[4] || rangeMatch[1];

    const endDate = \`\${endYear}-\${String(Number(rangeMatch[5])).padStart(
      2,
      '0'
    )}-\${String(Number(rangeMatch[6])).padStart(2, '0')}\`;

    return {
      startDate,
      endDate,
      isOpenEnded: false,
    };
  }

  const allDates = [
    ...text.matchAll(/(20\\d{2})年\\s*(\\d{1,2})月\\s*(\\d{1,2})日?/g),
  ];

  if (allDates.length > 0) {
    const last = allDates[allDates.length - 1];

    return {
      startDate: null,
      endDate: \`\${last[1]}-\${String(Number(last[2])).padStart(2, '0')}-\${String(
        Number(last[3])
      ).padStart(2, '0')}\`,
      isOpenEnded: false,
    };
  }

  return {
    startDate: null,
    endDate: null,
    isOpenEnded: false,
  };
};

const todayJstIsoForStatus = () => {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const forceApplicationStatusByPeriod = (data = {}) => {
  const periodText = String(
    data.application_period_text ||
      data.application_period ||
      data.applicationPeriod ||
      ''
  ).trim();

  if (!periodText) {
    return data;
  }

  const closedText =
    /(受付終了|募集終了|公募終了|終了しました|募集は終了|受付は終了|申請受付を終了|終了いたしました)/.test(
      periodText
    );

  if (closedText) {
    return {
      ...data,
      application_status: '受付終了',
    };
  }

  const badPeriodText =
    /(対象児童|出生|新生児|児童手当|住民登録|給付対象者|支給対象者|から今|から現在|より今|より現在|更新|更新日|お知らせ|一覧)/.test(
      periodText
    );

  if (badPeriodText) {
    return {
      ...data,
      application_status:
        data.application_status === '受付終了' ? '受付終了' : data.application_status || '不明',
    };
  }

  const { startDate, endDate, isOpenEnded } = parsePeriodDatesForStatus(periodText);
  const today = todayJstIsoForStatus();

  if (endDate && endDate < today) {
    return {
      ...data,
      application_start_date: startDate || data.application_start_date || null,
      application_end_date: endDate,
      application_status: '受付終了',
    };
  }

  if (startDate && today < startDate) {
    return {
      ...data,
      application_start_date: startDate,
      application_end_date: endDate || data.application_end_date || null,
      application_status: '予告',
    };
  }

  if (isOpenEnded) {
    return {
      ...data,
      application_start_date: startDate || data.application_start_date || null,
      application_end_date: null,
      application_status: '公募中',
    };
  }

  if (startDate && endDate && startDate <= today && today <= endDate) {
    return {
      ...data,
      application_start_date: startDate,
      application_end_date: endDate,
      application_status: '公募中',
    };
  }

  return data;
};
`;

if (!src.includes('const forceApplicationStatusByPeriod =')) {
  const importRegex = /^import\\s+.*?;\\s*$/gm;
  const imports = [...src.matchAll(importRegex)];

  if (imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    const insertPos = lastImport.index + lastImport[0].length;
    src = `${src.slice(0, insertPos)}\n${helperBlock}\n${src.slice(insertPos)}`;
  } else {
    src = `${helperBlock}\n${src}`;
  }

  console.log('✅ ステータス補正ヘルパーを追加しました。');
} else {
  console.log('ℹ️ ステータス補正ヘルパーは既に存在します。');
}

let factsPatchCount = 0;

src = src.replace(
  /^([ \t]*)(const|let)\s+facts\s*=\s*([^;\n]*?\bfacts\b[^;\n]*);/gm,
  (match, indent, decl, expr) => {
    if (match.includes('forceApplicationStatusByPeriod')) return match;
    if (expr.includes('forceApplicationStatusByPeriod')) return match;

    factsPatchCount += 1;
    const rawName = `rawFactsForStatus${factsPatchCount}`;

    return `${indent}${decl} ${rawName} = ${expr};\n${indent}${decl} facts = forceApplicationStatusByPeriod(${rawName});`;
  }
);

let directStatusPatchCount = 0;

src = src.replace(
  /(application_status\s*:\s*)([^,\n}]+)/g,
  (match, prefix, expr) => {
    if (match.includes('forceApplicationStatusByPeriod')) return match;

    const expression = expr.trim();

    if (
      expression.includes('facts.application_status') ||
      expression.includes('data.facts') ||
      expression.includes('rawFactsForStatus')
    ) {
      directStatusPatchCount += 1;
      return `${prefix}${expression}`;
    }

    return match;
  }
);

let savePatchCount = 0;

src = src.replace(
  /(\.\.\.)(formData)(\s*,)/g,
  (match, spread, name, comma) => {
    // 画面表示用の state 更新まで全部変えると副作用が出るため、
    // 保存payload内で使われるケースだけ後段の保存直前補正に任せる。
    return match;
  }
);

if (!src.includes('const normalizeBeforeSave = (data) => forceApplicationStatusByPeriod(data);')) {
  const marker = 'const forceApplicationStatusByPeriod = (data = {}) => {';
  const markerIndex = src.indexOf(marker);

  if (markerIndex >= 0) {
    const endIndex = src.indexOf('\n};', markerIndex);

    if (endIndex >= 0) {
      const insertAfter = endIndex + 4;
      const saveHelper = `

const normalizeBeforeSave = (data) => forceApplicationStatusByPeriod(data);
`;
      src = `${src.slice(0, insertAfter)}${saveHelper}${src.slice(insertAfter)}`;
      console.log('✅ 保存前補正ヘルパーを追加しました。');
    }
  }
}

const savePatterns = [
  {
    re: /const\s+payload\s*=\s*{\s*\n\s*\.\.\.formData,/g,
    replacement:
      'const fixedFormData = normalizeBeforeSave(formData);\\n    const payload = {\\n      ...fixedFormData,',
  },
  {
    re: /const\s+saveData\s*=\s*{\s*\n\s*\.\.\.formData,/g,
    replacement:
      'const fixedFormData = normalizeBeforeSave(formData);\\n    const saveData = {\\n      ...fixedFormData,',
  },
  {
    re: /const\s+updateData\s*=\s*{\s*\n\s*\.\.\.formData,/g,
    replacement:
      'const fixedFormData = normalizeBeforeSave(formData);\\n    const updateData = {\\n      ...fixedFormData,',
  },
];

for (const item of savePatterns) {
  src = src.replace(item.re, () => {
    savePatchCount += 1;
    return item.replacement;
  });
}

fs.writeFileSync(targetPath, src, 'utf8');

console.log('');
console.log('✅ AdminEditForm.jsx の補正が完了しました。');
console.log(`📦 バックアップ: ${backupPath}`);
console.log(`🔧 facts補正置換: ${factsPatchCount}件`);
console.log(`🔧 保存payload補正: ${savePatchCount}件`);
console.log('');
console.log('次に実行してください:');
console.log('npm run dev');
console.log('');
console.log('確認コマンド:');
console.log('grep -n "forceApplicationStatusByPeriod\\|rawFactsForStatus\\|normalizeBeforeSave" src/AdminEditForm.jsx');