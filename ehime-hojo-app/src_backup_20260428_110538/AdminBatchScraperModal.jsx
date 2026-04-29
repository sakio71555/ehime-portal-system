import React, { useState, useRef, useEffect } from 'react';
import {
  PURPOSE_TAGS,
  INDUSTRY_TAGS,
  normalizeUrl,
  resolveUrlMaybeRelative,
  makeSubsidyKey,
} from './subsidyTags';

export default function AdminBatchScraperModal({ supabase, onClose, onRefresh }) {
  const [urlsText, setUrlsText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        msg,
        type,
        time: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
      },
    ]);
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success':
        return '#059669';
      case 'warning':
        return '#d97706';
      case 'error':
        return '#dc2626';
      default:
        return '#374151';
    }
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeDate = (value) => {
    if (!value) return null;

    const text = String(value).trim();

    if (!text || text === '不明' || text === '未記載' || text === '要確認') {
      return null;
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  };

  const toStringArray = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((v) => String(v || '').trim())
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split(/[、,\n]/)
        .map((v) => v.trim())
        .filter(Boolean);
    }

    return [];
  };

  const buildDbData = (extracted, canonicalUrl) => {
    const safeOfficialUrl = resolveUrlMaybeRelative(
      extracted.official_url && extracted.official_url !== '不明'
        ? extracted.official_url.trim()
        : canonicalUrl,
      canonicalUrl
    );

    const targetExpensesArr = toStringArray(extracted.target_expenses_arr);
    const targetEntitiesArr = toStringArray(extracted.target_entities_arr);
    const purposes = toStringArray(extracted.purposes);
    const industries = toStringArray(extracted.industries);
    const tags = toStringArray(extracted.tags);

    const applicationPeriodText =
      extracted.application_period_text ||
      extracted.deadline ||
      '';

    const amountText =
      extracted.amount_text ||
      extracted.amount ||
      '';

    const subsidyRateText =
      extracted.subsidy_rate_text ||
      extracted.subsidy_rate ||
      '';

    const regionText =
      extracted.region_text ||
      extracted.region ||
      '';

    return {
      title: extracted.title || '',
      organization: extracted.organization || '',
      region: regionText,
      region_text: regionText,
      prefecture: extracted.prefecture || '',
      municipality: extracted.municipality || '',

      application_status: extracted.application_status || '不明',
      application_period_text: applicationPeriodText,
      deadline: applicationPeriodText,
      application_start_date: normalizeDate(extracted.application_start_date),
      application_end_date: normalizeDate(extracted.application_end_date),

      amount: amountText,
      amount_text: amountText,
      amount_max_yen: Number(extracted.amount_max_yen || 0),

      subsidy_rate: subsidyRateText,
      subsidy_rate_text: subsidyRateText,

      target_expenses: targetExpensesArr.join('、'),
      target_expenses_arr: targetExpensesArr,
      target_entities: targetEntitiesArr.join('、'),
      target_entities_arr: targetEntitiesArr,

      purposes,
      industries,
      tags,

      official_url: safeOfficialUrl,
      source_url: canonicalUrl,
      fiscal_year: extracted.fiscal_year || '',
      summary: extracted.summary || '',

      crawl_status: 'draft',
      is_active: false,
    };
  };

  const parseUrls = (text) => {
    const rawUrls = text
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.startsWith('http'));

    const normalizedUrls = rawUrls.map((url) => normalizeUrl(url));

    return Array.from(new Set(normalizedUrls));
  };

  const handleStart = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    const urls = parseUrls(urlsText);

    if (urls.length === 0) {
      alert('有効なURL（httpから始まるもの）が入力されていません。');
      return;
    }

    const ok = window.confirm(
      `${urls.length}件のURLからデータ収集を開始します。よろしいですか？\n（※処理中はブラウザのタブを閉じないでください）`
    );

    if (!ok) return;

    setIsProcessing(true);
    setLogs([]);
    setProgress({ current: 0, total: urls.length });

    addLog(`🚀 ${urls.length}件のURL一括収集を開始します！`, 'info');

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    try {
      for (let i = 0; i < urls.length; i += 1) {
        const canonicalUrl = urls[i];

        setProgress({ current: i + 1, total: urls.length });
        addLog(`▶ [${i + 1}/${urls.length}] 処理中: ${canonicalUrl}`, 'info');

        try {
          const { data: existing, error: existingError } = await supabase
            .from('subsidies')
            .select('id')
            .eq('source_url', canonicalUrl)
            .limit(1);

          if (existingError) {
            throw new Error(`既存URL確認エラー: ${existingError.message}`);
          }

          if (existing && existing.length > 0) {
            addLog('  ⏭️ URL登録済みのためスキップしました', 'warning');
            skipCount += 1;
            continue;
          }

          const { data, error } = await supabase.functions.invoke(
            'process-batch-url',
            {
              body: {
                url: canonicalUrl,
                PURPOSE_TAGS: PURPOSE_TAGS.join(','),
                INDUSTRY_TAGS: INDUSTRY_TAGS.join(','),
              },
            }
          );

          if (error) {
            throw new Error(`サーバー通信エラー: ${error.message}`);
          }

          if (data?.error) {
            throw new Error(data.error);
          }

          const extracted = data?.extracted;

          if (!extracted) {
            throw new Error('Edge Functionから解析結果が返ってきませんでした。');
          }

          if (!extracted.is_subsidy) {
            addLog(
              '  ⏭️ 補助金ではない、または愛媛県向けではないと判定されスキップしました',
              'warning'
            );
            skipCount += 1;
            continue;
          }

          const normalizedDbData = buildDbData(extracted, canonicalUrl);
          const dedupeKey = makeSubsidyKey(normalizedDbData);

          const { data: existingByKey, error: keyError } = await supabase
            .from('subsidies')
            .select('id')
            .eq('dedupe_key', dedupeKey)
            .limit(1);

          if (keyError) {
            throw new Error(`重複キー確認エラー: ${keyError.message}`);
          }

          if (existingByKey && existingByKey.length > 0) {
            addLog(
              '  ⏭️ 制度重複スキップ（同内容の制度が既に存在します）',
              'warning'
            );
            skipCount += 1;
            continue;
          }

          const { error: insertError } = await supabase.from('subsidies').insert([
            {
              ...normalizedDbData,
              dedupe_key: dedupeKey,
            },
          ]);

          if (insertError) {
            throw new Error(`データベース保存エラー: ${insertError.message}`);
          }

          addLog(
            `  ✨ 成功: ${normalizedDbData.title || 'タイトル未取得'}（${normalizedDbData.application_status}）`,
            'success'
          );

          successCount += 1;
        } catch (err) {
          addLog(`  ❌ エラー: ${err.message}`, 'error');
          errorCount += 1;
        }

        if (i < urls.length - 1) {
          await sleep(2000);
        }
      }

      addLog(
        `\n🏆 全処理完了！ [ 追加: ${successCount}件 | スキップ: ${skipCount}件 | エラー: ${errorCount}件 ]`,
        'info'
      );

      if (onRefresh) {
        onRefresh();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🔗</span> URL一括データ収集（セキュア版）
            </h2>

            <p
              style={{
                margin: 0,
                color: '#4b5563',
                fontSize: '13px',
                lineHeight: '1.6',
              }}
            >
              取得したいページのURLを改行で区切って入力してください。
              AIが順番にアクセスし、内容を解読して承認待ちデータとして追加します。
            </p>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              style={{
                backgroundColor: '#f3f4f6',
                color: '#4b5563',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ✕ 閉じる
            </button>
          )}
        </div>

        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          disabled={isProcessing}
          placeholder={`https://example.com/hojo-1
https://example.com/hojo-2
https://example.com/hojo-3`}
          style={{
            width: '100%',
            height: '150px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'monospace',
            resize: 'vertical',
            marginBottom: '16px',
            backgroundColor: isProcessing ? '#f9fafb' : 'white',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#4b5563',
            }}
          >
            進捗: {progress.current} / {progress.total}
          </div>

          <button
            onClick={handleStart}
            disabled={isProcessing || !urlsText.trim()}
            style={{
              backgroundColor: isProcessing ? '#9ca3af' : '#2563eb',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: isProcessing || !urlsText.trim() ? 'not-allowed' : 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isProcessing ? 'none' : '0 4px 6px rgba(37, 99, 235, 0.2)',
            }}
          >
            {isProcessing ? '🔄 安全に処理中...' : '🚀 一括収集をスタート'}
          </button>
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: '#111827',
            borderRadius: '8px',
            padding: '16px',
            overflowY: 'auto',
            minHeight: '200px',
            fontFamily: 'monospace',
            fontSize: '12px',
            border: '1px solid #374151',
          }}
        >
          {logs.length === 0 ? (
            <div
              style={{
                color: '#6b7280',
                textAlign: 'center',
                marginTop: '80px',
              }}
            >
              処理を開始するとここにログが表示されます
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={`${log.time}-${idx}`}
                style={{
                  color: getLogColor(log.type),
                  marginBottom: '6px',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <span style={{ color: '#6b7280', marginRight: '8px' }}>
                  [{log.time}]
                </span>
                {log.msg}
              </div>
            ))
          )}

          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}