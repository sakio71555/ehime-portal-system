const API_V1_BASE = 'https://api.jgrants-portal.go.jp/exp/v1/public';
const API_V2_BASE = 'https://api.jgrants-portal.go.jp/exp/v2/public';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSubsidyId(item) {
  return (
    item?.id ||
    item?.subsidy_id ||
    item?.subsidyId ||
    item?.grant_id ||
    item?.grantId ||
    item?.management_number ||
    ''
  );
}

function resultArray(data) {
  if (!data) return [];

  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.subsidies)) return data.subsidies;

  if (data.result && typeof data.result === 'object') return [data.result];
  if (data.data && typeof data.data === 'object') return [data.data];

  return [];
}

function firstResult(data) {
  const arr = resultArray(data);
  return arr[0] || null;
}

async function getJson(url, params = {}) {
  const requestUrl = new URL(url);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    requestUrl.searchParams.set(key, String(value));
  }

  const res = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'EhimeSubsidyPortal/1.0',
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errorText.slice(0, 500)}`);
  }

  return res.json();
}

async function searchJgrants(keyword) {
  const attempts = [
    {
      name: 'keyword + sort + acceptance',
      params: {
        keyword,
        sort: 'created_date',
        order: 'DESC',
        acceptance: '1',
      },
    },
    {
      name: 'keyword + sort',
      params: {
        keyword,
        sort: 'created_date',
        order: 'DESC',
      },
    },
    {
      name: 'keyword only',
      params: {
        keyword,
      },
    },
    {
      name: 'keyword + acceptance only',
      params: {
        keyword,
        acceptance: '1',
      },
    },
  ];

  let lastError = null;
  let sawValidEmptyResponse = false;

  for (const attempt of attempts) {
    try {
      const data = await getJson(`${API_V1_BASE}/subsidies`, attempt.params);
      const rows = resultArray(data);

      console.log(`    試行: ${attempt.name} → ${rows.length} 件`);

      if (rows.length > 0) {
        return rows;
      }

      sawValidEmptyResponse = true;
    } catch (err) {
      console.log(`    試行失敗: ${attempt.name} / ${err.message}`);
      lastError = err;
    }

    await sleep(300);
  }

  if (sawValidEmptyResponse) return [];
  if (lastError) throw lastError;

  return [];
}

async function fetchDetailV2(id) {
  try {
    const data = await getJson(`${API_V2_BASE}/subsidies/id/${encodeURIComponent(id)}`);
    const detail = firstResult(data);

    if (detail) return detail;

    throw new Error('v2 result is empty');
  } catch (err) {
    console.log(`  ⚠️ v2詳細取得失敗。v1へフォールバック: ${id} / ${err.message}`);

    const data = await getJson(`${API_V1_BASE}/subsidies/id/${encodeURIComponent(id)}`);
    return firstResult(data);
  }
}

module.exports = {
  sleep,
  getSubsidyId,
  resultArray,
  firstResult,
  searchJgrants,
  fetchDetailV2,
};
