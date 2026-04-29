const crypto = require('crypto');

const {
  toIsoOrNull,
  toDateOnly,
  buildApplicationPeriodText,
  forceApplicationStatusByPeriod,
} = require('./statusRules');

const {
  normalizeText,
  asString,
  stripHtmlForExtraction,
  pick,
  parseMoneyYen,
  formatAmountText,
  extractAmountFromText,
  normalizeRateValue,
  extractRateFromText,
  splitExpenseText,
  extractTargetExpensesFromText,
  splitTags,
} = require('./jgrantsExtractors');

const {
  detectMunicipality,
  containsEhimeOrShikoku,
  isEhimeSearchKeyword,
  shouldKeepForEhimePortal,
} = require('./jgrantsRegionRules');

const { getSubsidyId } = require('./jgrantsApi');

function shortHash(value) {
  return crypto
    .createHash('sha1')
    .update(String(value || ''))
    .digest('hex')
    .slice(0, 12);
}

function makeDedupeKey(row) {
  return [
    normalizeText(row.organization),
    normalizeText(row.title),
    normalizeText(row.fiscal_year),
    normalizeText(row.application_start_date),
    normalizeText(row.application_end_date),
  ].join('::');
}

function buildJgrantsFrontUrl(id) {
  return `https://www.jgrants-portal.go.jp/subsidy/${encodeURIComponent(id)}`;
}

function deepSanitize(value, depth = 0) {
  if (depth > 5) return '[omitted: depth limit]';

  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length > 3000) return `${value.slice(0, 3000)}...[omitted]`;
    return value;
  }

  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => deepSanitize(item, depth + 1));
  }

  const out = {};

  for (const [key, val] of Object.entries(value)) {
    if (/base64|data|binary|content_bytes|file_body|body_base64/i.test(key)) {
      out[key] = '[omitted: binary/base64]';
      continue;
    }

    out[key] = deepSanitize(val, depth + 1);
  }

  return out;
}

function normalizeJgrantsDetailToRows(detail, listItem = {}) {
  const id = getSubsidyId(detail) || getSubsidyId(listItem);

  if (!detail || !id) return [];

  const workflowsRaw =
    detail.workflow ||
    detail.workflows ||
    detail.workflow_list ||
    detail.workflowList ||
    [];

  const workflows =
    Array.isArray(workflowsRaw) && workflowsRaw.length > 0
      ? workflowsRaw
      : [null];

  const rows = [];

  for (let index = 0; index < workflows.length; index++) {
    const workflow = workflows[index] || {};

    const targetAreaSearch = asString(
      pick(
        workflow,
        ['target_area_search', 'targetAreaSearch', 'target_area'],
        pick(detail, ['target_area_search', 'targetAreaSearch', 'target_area'], '')
      )
    );

    const targetAreaDetail = asString(
      pick(
        workflow,
        ['target_area_detail', 'targetAreaDetail'],
        pick(detail, ['target_area_detail', 'targetAreaDetail'], '')
      )
    );

    const fallbackArea = asString(listItem.__search_area || '');
    const fallbackKeyword = asString(listItem.__search_keyword || '');

    const rawRegionText =
      [targetAreaSearch, targetAreaDetail].filter(Boolean).join(' / ') ||
      fallbackArea ||
      '不明';

    const workflowId =
      pick(workflow, ['id', 'workflow_id', 'workflowId', 'fiscal_year_round'], '') ||
      `workflow-${index + 1}`;

    const sourceExternalId = `${id}:${workflowId}`;

    const title = stripHtmlForExtraction(
      asString(pick(detail, ['title', 'name', 'subsidy_name', 'subsidyName'], '名称不明'))
    );

    const organization = stripHtmlForExtraction(
      asString(pick(detail, ['institution_name', 'institutionName', 'organization', 'agency'], ''))
    );

    const keepDecision = shouldKeepForEhimePortal({
      regionText: rawRegionText,
      title,
      organization,
      keyword: fallbackKeyword,
    });

    if (!keepDecision.keep) {
      console.log(`  ⏭️ 除外: ${keepDecision.reason} / 地域: ${rawRegionText}`);
      continue;
    }

    const startRaw =
      pick(
        workflow,
        ['acceptance_start_datetime', 'acceptanceStartDatetime', 'start_datetime'],
        pick(detail, ['acceptance_start_datetime', 'acceptanceStartDatetime', 'start_datetime'], null)
      ) || null;

    const endRaw =
      pick(
        workflow,
        ['acceptance_end_datetime', 'acceptanceEndDatetime', 'end_datetime'],
        pick(detail, ['acceptance_end_datetime', 'acceptanceEndDatetime', 'end_datetime'], null)
      ) || null;

    const projectEndRaw =
      pick(
        workflow,
        ['project_end_deadline', 'projectEndDeadline'],
        pick(detail, ['project_end_deadline', 'projectEndDeadline'], null)
      ) || null;

    const fiscalYear = stripHtmlForExtraction(
      asString(
        pick(
          workflow,
          ['fiscal_year_round', 'fiscalYearRound', 'fiscal_year'],
          pick(detail, ['fiscal_year', 'fiscalYear'], '')
        )
      )
    );

    const applicationPeriodText = buildApplicationPeriodText(startRaw, endRaw);

    const applicationStatus = forceApplicationStatusByPeriod({
      start: startRaw,
      end: endRaw,
      periodText: applicationPeriodText,
    });

    const titleWithYear =
      fiscalYear && !title.includes(fiscalYear)
        ? `${title}（${fiscalYear}）`
        : title;

    const summaryForExtraction = stripHtmlForExtraction(
      [
        title,
        organization,
        rawRegionText,
        pick(detail, ['subsidy_catch_phrase', 'subsidyCatchPhrase'], ''),
        pick(detail, ['detail', 'summary', 'description'], ''),
        pick(workflow, ['detail', 'summary', 'description'], ''),
        pick(detail, ['target_expense', 'targetExpense', 'target_expenses'], ''),
        pick(workflow, ['target_expense', 'targetExpense', 'target_expenses'], ''),
        pick(detail, ['subsidy_rate', 'subsidyRate'], ''),
        pick(workflow, ['subsidy_rate', 'subsidyRate'], ''),
        pick(detail, ['subsidy_max_limit', 'subsidyMaxLimit', 'max_limit', 'amount_max_yen'], ''),
        pick(workflow, ['subsidy_max_limit', 'subsidyMaxLimit', 'max_limit', 'amount_max_yen'], ''),
      ]
        .map(asString)
        .filter(Boolean)
        .join('\n')
    );

    const maxLimitRaw =
      pick(
        workflow,
        ['subsidy_max_limit', 'subsidyMaxLimit', 'max_limit', 'amount_max_yen'],
        ''
      ) ||
      pick(
        detail,
        ['subsidy_max_limit', 'subsidyMaxLimit', 'max_limit', 'amount_max_yen'],
        ''
      );

    const amountMaxYen =
      parseMoneyYen(maxLimitRaw) ||
      extractAmountFromText(summaryForExtraction);

    const rawSubsidyRateText =
      pick(workflow, ['subsidy_rate', 'subsidyRate'], '') ||
      pick(detail, ['subsidy_rate', 'subsidyRate'], '');

    const subsidyRateText =
      normalizeRateValue(rawSubsidyRateText) ||
      extractRateFromText(summaryForExtraction);

    const rawTargetExpenses =
      pick(workflow, ['target_expense', 'targetExpense', 'target_expenses'], '') ||
      pick(detail, ['target_expense', 'targetExpense', 'target_expenses'], '');

    const targetExpensesArr = rawTargetExpenses
      ? splitExpenseText(rawTargetExpenses)
      : extractTargetExpensesFromText(summaryForExtraction);

    const purposes = splitTags(
      pick(detail, ['use_purpose', 'usePurpose', 'purpose'], '')
    );

    const industries = splitTags(
      pick(detail, ['industry', 'industries'], '')
    );

    const frontUrl = asString(
      pick(detail, ['front_subsidy_detail_page_url', 'frontSubsidyDetailPageUrl', 'url'], '')
    );

    const officialUrl = frontUrl || buildJgrantsFrontUrl(id);

    const municipality = detectMunicipality(rawRegionText);

    const normalizedRegionText =
      rawRegionText === '不明' && isEhimeSearchKeyword(fallbackKeyword)
        ? '愛媛県'
        : rawRegionText;

    const summary = stripHtmlForExtraction(
      asString(
        pick(detail, ['detail', 'summary', 'subsidy_catch_phrase', 'subsidyCatchPhrase'], '')
      )
    );

    const row = {
      title: titleWithYear,
      organization,

      region_text: normalizedRegionText,
      prefecture:
        containsEhimeOrShikoku(normalizedRegionText) ||
        municipality ||
        isEhimeSearchKeyword(fallbackKeyword)
          ? '愛媛県'
          : '全国',
      municipality,

      application_status: applicationStatus,
      application_period_text: applicationPeriodText,
      application_start_date: toDateOnly(startRaw),
      application_end_date: toDateOnly(endRaw),

      amount_text: amountMaxYen ? formatAmountText(amountMaxYen) : '不明',
      amount_max_yen: amountMaxYen,

      subsidy_rate_text: subsidyRateText,

      target_expenses_arr: [...new Set(targetExpensesArr)].slice(0, 8),
      target_entities_arr: [
        asString(
          pick(detail, ['target_number_of_employees', 'targetNumberOfEmployees'], '')
        )
          ? `対象従業員数：${stripHtmlForExtraction(
              asString(pick(detail, ['target_number_of_employees', 'targetNumberOfEmployees'], ''))
            )}`
          : '',
      ].filter(Boolean),

      purposes,
      industries: industries.length ? industries : ['業種指定無し'],
      tags: [
        ...new Set([
          ...purposes,
          ...(industries.length ? industries : ['業種指定無し']),
        ]),
      ],

      official_url: officialUrl,
      fiscal_year: fiscalYear,

      summary,

      crawl_status: 'draft',
      is_active: false,

      source_url: officialUrl,
      source_type: 'jgrants',
      source_external_id: sourceExternalId,
      source_payload: deepSanitize({
        list_item: listItem,
        detail,
        workflow,
        keep_reason: keepDecision.reason,
        amount_extract_source: amountMaxYen ? summaryForExtraction : '',
        rate_extract_source: subsidyRateText ? summaryForExtraction : '',
        expenses_extract_source: targetExpensesArr.length ? summaryForExtraction : '',
      }),

      application_start_at: toIsoOrNull(startRaw),
      application_end_at: toIsoOrNull(endRaw),
      project_end_deadline: toIsoOrNull(projectEndRaw),
    };

    row.dedupe_key = makeDedupeKey(row) || shortHash(sourceExternalId);

    rows.push(row);
  }

  return rows;
}

module.exports = {
  normalizeJgrantsDetailToRows,
};
