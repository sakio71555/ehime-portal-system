import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase as defaultSupabase } from './lib/supabaseClient';

const extractUrls = (text) => {
  return Array.from(
    new Set(
      String(text || '')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/[、,。)）]+$/g, ''))
        .filter((line) => /^https?:\/\/[^\s]+$/i.test(line))
    )
  );
};

const getLogColor = (type) => {
  if (type === 'success') return '#10b981';
  if (type === 'error') return '#ef4444';
  if (type === 'warning') return '#f59e0b';
  return '#cbd5e1';
};

const detectLogType = (message) => {
  if (/❌|エラー|失敗/.test(message)) return 'error';
  if (/⏭|スキップ|⚠️|警告/.test(message)) return 'warning';
  if (/✨|✅|成功|追加/.test(message)) return 'success';
  return 'info';
};

const makeLog = (msg, type = 'info') => ({
  msg,
  type,
  time: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
});

export default function AdminBatchScraperModal({
  supabase,
  onClose,
  onRefresh,
}) {
  const client = supabase || defaultSupabase;

  const [urlText, setUrlText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    added: 0,
    skipped: 0,
    errors: 0,
  });

  const logEndRef = useRef(null);

  const urls = useMemo(() => extractUrls(urlText), [urlText]);

  useEffect(() => {
    requestAnimationFrame(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [logs]);

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [...prev, makeLog(msg, type)]);
  };

  const resetState = () => {
    setLogs([]);
    setResults([]);
    setProgress({
      current: 0,
      total: urls.length,
      added: 0,
      skipped: 0,
      errors: 0,
    });
  };

  const handleStart = async () => {
    if (!client) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    if (urls.length === 0) {
      alert('URLを1件以上入力してください。');
      return;
    }

    const ok = window.confirm(
      `${urls.length}件のURLを一括収集します。\n\nEdge Function側で本文取得 → AI解析 → 承認待ちデータ保存まで実行します。\nよろしいですか？`
    );

    if (!ok) return;

    resetState();
    setIsProcessing(true);

    addLog(`🚀 ${urls.length}件のURL一括収集を開始します！`, 'info');

    try {
      const { data, error } = await client.functions.invoke('process-batch-url', {
        body: {
          urls,
          organization: '愛媛県',
          maxUrls: urls.length,
        },
      });

      if (error) {
        throw new Error(`Edge Function通信エラー: ${error.message}`);
      }

      if (!data) {
        throw new Error('Edge Functionからレスポンスが返ってきませんでした。');
      }

      if (data.error && !data.success) {
        throw new Error(data.error);
      }

      const returnedLogs = Array.isArray(data.logs) ? data.logs : [];
      const returnedResults = Array.isArray(data.results) ? data.results : [];

      if (returnedLogs.length > 0) {
        setLogs(
          returnedLogs.map((msg) =>
            makeLog(String(msg), detectLogType(String(msg)))
          )
        );
      } else {
        returnedResults.forEach((item, index) => {
          if (item.status === 'added') {
            addLog(
              `✨ 成功: ${item.title || item.url || `URL ${index + 1}`}`,
              'success'
            );
          } else if (item.status === 'skipped') {
            addLog(
              `⏭ スキップ: ${item.title || item.reason || item.url || `URL ${index + 1}`}`,
              'warning'
            );
          } else {
            addLog(
              `❌ エラー: ${item.reason || item.url || `URL ${index + 1}`}`,
              'error'
            );
          }
        });
      }

      const added =
        Number(data.added) ||
        returnedResults.filter((item) => item.status === 'added').length;

      const skipped =
        Number(data.skipped) ||
        returnedResults.filter((item) => item.status === 'skipped').length;

      const errors =
        Number(data.errors) ||
        returnedResults.filter((item) => item.status === 'error').length;

      setResults(returnedResults);

      setProgress({
        current: urls.length,
        total: urls.length,
        added,
        skipped,
        errors,
      });

      if (added > 0 && typeof onRefresh === 'function') {
        onRefresh();
      }

      if (returnedLogs.length === 0) {
        addLog(
          `🏆 全処理完了！ [追加: ${added}件 | スキップ: ${skipped}件 | エラー: ${errors}件]`,
          errors > 0 ? 'warning' : 'success'
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '不明なエラーが発生しました。';

      addLog(`❌ エラー: ${message}`, 'error');

      setProgress((prev) => ({
        ...prev,
        current: urls.length,
        total: urls.length,
        errors: prev.errors + 1,
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: 'min(1080px, 96vw)',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: 'white',
          borderRadius: '18px',
          padding: '28px',
          boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '20px',
            alignItems: 'flex-start',
            marginBottom: '22px',
          }}
        >
          <div>
            <h2
              style={{
                margin: '0 0 10px',
                fontSize: '24px',
                fontWeight: '800',
                color: '#111827',
              }}
            >
              🔗 URL一括データ収集（セキュア版）
            </h2>

            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: '#4b5563',
                lineHeight: '1.8',
              }}
            >
              取得したいページのURLを改行で区切って入力してください。
              AIが順番にアクセスし、内容を解析して承認待ちデータとして追加します。
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              minWidth: '96px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 18px',
              fontWeight: 'bold',
              fontSize: '15px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.6 : 1,
            }}
          >
            ✕ 閉じる
          </button>
        </div>

        <textarea
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          disabled={isProcessing}
          placeholder="https://www.pref.ehime.jp/..."
          style={{
            width: '100%',
            minHeight: '180px',
            resize: 'vertical',
            boxSizing: 'border-box',
            border: '1px solid #d1d5db',
            borderRadius: '12px',
            padding: '18px',
            fontSize: '15px',
            lineHeight: '1.7',
            color: '#111827',
            outline: 'none',
            backgroundColor: isProcessing ? '#f9fafb' : 'white',
          }}
        />

        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              color: '#374151',
              fontWeight: 'bold',
              fontSize: '15px',
            }}
          >
            進捗: {progress.current || urls.length} / {progress.total || urls.length}
          </div>

          <button
            onClick={handleStart}
            disabled={isProcessing || urls.length === 0}
            style={{
              backgroundColor:
                isProcessing || urls.length === 0 ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 30px',
              fontSize: '16px',
              fontWeight: '800',
              cursor:
                isProcessing || urls.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow:
                isProcessing || urls.length === 0
                  ? 'none'
                  : '0 8px 20px rgba(37, 99, 235, 0.25)',
            }}
          >
            {isProcessing ? '🔄 一括収集中...' : '🚀 一括収集をスタート'}
          </button>
        </div>

        <div
          style={{
            marginTop: '22px',
            backgroundColor: '#0f172a',
            color: '#cbd5e1',
            borderRadius: '10px',
            padding: '18px',
            minHeight: '260px',
            maxHeight: '340px',
            overflowY: 'auto',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '13px',
            lineHeight: '1.7',
            border: '1px solid #334155',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#64748b' }}>
              ここに処理ログが表示されます。
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={`${log.time}-${index}`}
                style={{
                  color: getLogColor(log.type),
                  marginBottom: '4px',
                }}
              >
                <span style={{ color: '#64748b', marginRight: '8px' }}>
                  [{log.time}]
                </span>
                {log.msg}
              </div>
            ))
          )}

          <div ref={logEndRef} />
        </div>

        {results.length > 0 && (
          <div
            style={{
              marginTop: '18px',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                backgroundColor: '#f9fafb',
                padding: '12px 16px',
                fontWeight: 'bold',
                color: '#374151',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              処理結果
            </div>

            <div>
              {results.map((item, index) => {
                const bg =
                  item.status === 'added'
                    ? '#ecfdf5'
                    : item.status === 'skipped'
                      ? '#fffbeb'
                      : '#fef2f2';

                const color =
                  item.status === 'added'
                    ? '#047857'
                    : item.status === 'skipped'
                      ? '#92400e'
                      : '#b91c1c';

                return (
                  <div
                    key={`${item.url}-${index}`}
                    style={{
                      padding: '12px 16px',
                      borderBottom:
                        index === results.length - 1
                          ? 'none'
                          : '1px solid #e5e7eb',
                      backgroundColor: bg,
                      color,
                      fontSize: '13px',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong>
                      {item.status === 'added'
                        ? '追加'
                        : item.status === 'skipped'
                          ? 'スキップ'
                          : 'エラー'}
                    </strong>
                    ：{item.title || item.reason || item.url}
                    {item.url && (
                      <div
                        style={{
                          color: '#6b7280',
                          wordBreak: 'break-all',
                          marginTop: '4px',
                        }}
                      >
                        {item.url}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: '18px',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            fontSize: '13px',
            color: '#6b7280',
          }}
        >
          <span>追加: {progress.added}件</span>
          <span>スキップ: {progress.skipped}件</span>
          <span>エラー: {progress.errors}件</span>
        </div>
      </div>
    </div>
  );
}