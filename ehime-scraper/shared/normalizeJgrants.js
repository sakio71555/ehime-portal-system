cat > shared/normalizeJgrants.js <<'EOF'
const crypto = require('crypto');
const {
  toDateOnly,
  buildApplicationPeriodText,
  forceApplicationStatusByPeriod,
} = require('./statusRules');

function splitTags(value) {
  if (!value) return [];
  return String(value)
    .split('/')
    .map((v) => v.trim())
    .filter(Boolean);
}

function includesEhimeOrNationwide(value) {
  const text = String(value || '');
  return (
    text.includes('愛媛県') ||
    text.includes('四国地方') ||
    text.includes('全国')
  );
}

function makeDedupeKey(row) {
  const norm = (s) => String(s || '').replace(/\s+/g, '').trim();

  return [
    norm(row.organization),
    norm(row.title),
    norm(row.fiscal_year || ''),
    norm(row.application_start_date || ''),
    norm(row.application_end_date || ''),
  ].join('::');
}

function shortHash(input) {
  return crypto.createHash('sha1').update(String(input || '')).digest('hex').slice(0, 12);
}

function normalizeJgrantsDetailToRows(detail) {
  const base = detail || {};
  const workflows = Array.isArray(base.workflow) && base.workflow.length > 0
    ? base.workflow
    : [null];

  const rows = [];

  workflows.forEach((workflow, index) => {
    const wf = workflow || {};

    const workflowId = wf.id || wf.workflow_id || wf.fiscal_year_round || `workflow-${index + 1}`;
    const externalId = `${base.id}:${workflowId}`;

    const startRaw = wf.acceptance_start_datetime || base.acceptance_start_datetime || null;
    const endRaw = wf.acceptance_end_datetime || base.acceptance_end_datetime || null;
    const projectEndRaw = wf.project_end_deadline || base.project_end_deadline || null;

    const targetAreaSearch = wf.target_area_search || base.target_area_search || '';
    const targetAreaDetail = wf.target_area_detail || base.target_area_detail || '';
    const areaText = [targetAreaSearch, targetAreaDetail].filter(Boolean).join(' / ');

    if (!includesEhimeOrNationwide(areaText)) {
      return;
    }

    const fiscalYear = wf.fiscal_year_round || base.fiscal_year || '';
    const applicationPeriodText = buildApplicationPeriodText(startRaw, endRaw);
    const applicationStatus = forceApplicationStatusByPeriod({
      start: startRaw,
      end: endRaw,
      periodText: applicationPeriodText,
    });

    const titleSuffix = fiscalYear ? `（${fiscalYear}）` : '';
    const title = `${base.title || '名称不明'}${titleSuffix}`;

    const purposes = splitTags(base.use_purpose);
    const industries = splitTags(base.industry);

    const normalized = {
      title,
      organization: base.institution_name || '',
      region_text: areaText || '全国',
      prefecture: areaText.includes('愛媛県') || areaText.includes('四国地方') ? '愛媛県' : '全国',
      municipality: '',
      application_status: applicationStatus,
      application_period_text: applicationPeriodText,
      application_start_date: toDateOnly(startRaw),
      application_end_date: toDateOnly(endRaw),
      amount_text: base.subsidy_max_limit ? `上限 ${Number(base.subsidy_max_limit).toLocaleString()}円` : '不明',
      amount_max_yen: Number(base.subsidy_max_limit || 0),
      subsidy_rate_text: base.subsidy_rate || '',
      target_expenses_arr: [],
      target_entities_arr: [
        base.target_number_of_employees ? `従業員数：${base.target_number_of_employees}` : '',
      ].filter(Boolean),
      purposes,
      industries: industries.length ? industries : ['業種指定無し'],
      tags: [...new Set([...purposes, ...industries])],
      official_url: base.front_subsidy_detail_page_url || `https://www.jgrants-portal.go.jp/grants/view/${base.id}`,
      fiscal_year: fiscalYear,
      summary: base.detail || base.subsidy_catch_phrase || '',
      dedupe_key: '',
      crawl_status: 'draft',
      is_active: false,
      source_url: base.front_subsidy_detail_page_url || `https://www.jgrants-portal.go.jp/grants/view/${base.id}`,
      source_type: 'jgrants',
      source_external_id: externalId,
      source_payload: {
        subsidy: base,
        workflow: wf,
      },
      application_start_at: startRaw,
      application_end_at: endRaw,
      project_end_deadline: projectEndRaw,
    };

    normalized.dedupe_key = makeDedupeKey(normalized) || shortHash(externalId);
    rows.push(normalized);
  });

  return rows;
}

module.exports = {
  normalizeJgrantsDetailToRows,
};
EOF