const { createClient } = require('@supabase/supabase-js');
const { sanitizeSubsidyRow } = require('./subsidySafety');

function getSupabaseEnv() {
  const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';

  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_SECRET ||
    '';

  return {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
  };
}

function createSupabaseClient({ requireServiceKey = false } = {}) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = getSupabaseEnv();

  if (requireServiceKey && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
    throw new Error(
      '❌ Supabaseへ保存するには SUPABASE_URL と SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY が必要です。'
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function upsertSubsidyBySource(supabase, row) {
  const safeRow = sanitizeSubsidyRow(row);

  if (!supabase) {
    throw new Error(
      'Supabaseクライアントが未初期化です。保存するには SUPABASE_URL と SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY が必要です。'
    );
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('subsidies')
    .select('id')
    .eq('source_type', row.source_type)
    .eq('source_external_id', row.source_external_id)
    .limit(1);

  if (existingError) {
    throw new Error(`既存確認エラー: ${existingError.message}`);
  }

  if (existingRows && existingRows.length > 0) {
    const id = existingRows[0].id;

    const { error: updateError } = await supabase
      .from('subsidies')
      .update({
        ...safeRow,
        imported_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      throw new Error(`更新エラー: ${updateError.message}`);
    }

    return 'updated';
  }

  const { error: insertError } = await supabase
    .from('subsidies')
    .insert([
      {
        ...safeRow,
        imported_at: new Date().toISOString(),
      },
    ]);

  if (insertError) {
    throw new Error(`追加エラー: ${insertError.message}`);
  }

  return 'inserted';
}

module.exports = {
  getSupabaseEnv,
  createSupabaseClient,
  upsertSubsidyBySource,
};
