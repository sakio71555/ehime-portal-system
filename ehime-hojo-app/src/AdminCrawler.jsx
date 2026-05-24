import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabaseClient';

const API_BASE =
  import.meta.env.VITE_CRAWLER_ADMIN_API_BASE || '/api/admin/crawler';

const TARGETS = [
  {
    id: 'all',
    label: '全体クロール開始',
    description: '通常クローラー → Jグランツ取込の順に実行します。',
    color: '#2563eb',
  },
  {
    id: 'official',
    label: '通常クローラー開始',
    description: '自治体・支援機関公式ページをクロールします。',
    color: '#0f766e',
  },
  {
    id: 'jgrants',
    label: 'Jグランツ取込開始',
    description: 'Jグランツ由来の補助金データを取り込みます。',
    color: '#7c3aed',
  },
];

const navLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  color: '#9ca3af',
  textDecoration: 'none',
  fontSize: '15px',
  borderBottom: '3px solid transparent',
  whiteSpace: 'nowrap',
};

function formatDateTime(value) {
  if (!value) return '未実行';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未実行';

  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status) {
  if (status === 'success') return '成功';
  if (status === 'failed') return '失敗';
  if (status === 'running') return '実行中';
  return '未実行';
}

function statusColor(status) {
  if (status === 'success') return '#059669';
  if (status === 'failed') return '#dc2626';
  if (status === 'running') return '#2563eb';
  return '#6b7280';
}

function SummaryPill({ label, value }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 9px',
        borderRadius: '999px',
        backgroundColor: '#f8fafc',
        border: '1px solid #e5e7eb',
        color: '#374151',
        fontSize: '12px',
        fontWeight: '700',
      }}
    >
      {label}: {value ?? '-'}
    </span>
  );
}

function RunStatusCard({ title, run }) {
  const summary = run?.summary || {};

  return (
    <div
      style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '18px',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>{title}</h3>
        <span style={{ color: statusColor(run?.status), fontSize: '13px', fontWeight: '800' }}>
          {statusLabel(run?.status)}
        </span>
      </div>
      <p style={{ margin: '0 0 6px', color: '#4b5563', fontSize: '13px' }}>
        前回実行: {formatDateTime(run?.finishedAt || run?.startedAt)}
      </p>
      <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '12px', wordBreak: 'break-all' }}>
        ログ: {run?.logFile || 'なし'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <SummaryPill label="inserted" value={summary.inserted} />
        <SummaryPill label="updated" value={summary.updated} />
        <SummaryPill label="skipped" value={summary.skipped} />
        <SummaryPill label="errors" value={summary.errors} />
      </div>
      {run?.error && (
        <p style={{ margin: '12px 0 0', color: '#b91c1c', fontSize: '12px', lineHeight: 1.6 }}>
          {run.error}
        </p>
      )}
    </div>
  );
}

export default function AdminCrawler() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningTarget, setRunningTarget] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isRunning = Boolean(status?.is_running);
  const lastRuns = status?.lastRuns || {};
  const latestLogTail = status?.latestLog?.tail || '';

  const targetMap = useMemo(
    () => ({
      all: lastRuns.all,
      official: lastRuns.official,
      jgrants: lastRuns.jgrants,
    }),
    [lastRuns]
  );

  const getAuthHeaders = async () => {
    if (!supabase) throw new Error('Supabase接続情報が設定されていません。');

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const accessToken = data?.session?.access_token;
    if (!accessToken) throw new Error('管理者ログイン情報を取得できませんでした。');

    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchStatus = async () => {
    setErrorMessage('');

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/status`, { headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'クローラー状態の取得に失敗しました。');
      }

      setStatus(payload);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = window.setInterval(fetchStatus, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const runCrawler = async (target) => {
    if (isRunning) return;

    setRunningTarget(target);
    setErrorMessage('');

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ target }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'クローラーの開始に失敗しました。');
      }

      await fetchStatus();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setRunningTarget('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#111827', color: 'white', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', height: '100%', minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>⚙️ 管理ダッシュボード</h1>
          <nav style={{ display: 'flex', height: '100%', overflowX: 'auto' }}>
            <a href="/admin" style={navLinkStyle}>📊 補助金データ更新</a>
            <a href="/admin?tab=experts" style={navLinkStyle}>🤝 専門家管理</a>
            <a href="/admin?tab=columns" style={navLinkStyle}>📝 コラム管理</a>
            <a href="/admin?tab=features" style={navLinkStyle}>⭐ 特集記事制作</a>
            <a href="/admin?tab=expert-articles" style={navLinkStyle}>💬 専門家記事</a>
            <div style={{ ...navLinkStyle, color: 'white', fontWeight: 'bold', borderBottom: '3px solid #38bdf8', backgroundColor: '#1f2937' }}>
              🛠 クローラー管理
            </div>
          </nav>
        </div>
        <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', flexShrink: 0 }}>
          ログアウト
        </button>
      </header>

      <main style={{ maxWidth: '1120px', margin: '32px auto', padding: '0 24px' }}>
        <section style={{ backgroundColor: 'white', borderRadius: '14px', padding: '28px', boxShadow: '0 4px 10px rgba(15, 23, 42, 0.06)', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#111827' }}>🛠 クローラー管理</h2>
              <p style={{ margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.7 }}>
                本番VPS上の通常クローラーとJグランツ取込を手動実行します。
                クローラー実行中はブラウザを閉じても処理はサーバー側で継続します。
              </p>
            </div>
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#374151',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              状態を更新
            </button>
          </div>

          {errorMessage && (
            <div style={{ marginTop: '18px', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '13px', lineHeight: 1.6 }}>
              {errorMessage}
            </div>
          )}

          {isRunning && (
            <div style={{ marginTop: '18px', padding: '14px 16px', borderRadius: '10px', border: '1px solid #fde68a', backgroundColor: '#fffbeb', color: '#92400e', fontSize: '14px', lineHeight: 1.7, fontWeight: '700' }}>
              現在クローラーを実行中です。完了までしばらくお待ちください。
              {status?.lock?.logFile ? ` 最新ログ: ${status.lock.logFile}` : ''}
            </div>
          )}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {TARGETS.map((target) => (
            <div key={target.id} style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
              <h3 style={{ margin: '0 0 8px', color: '#111827', fontSize: '17px' }}>{target.label}</h3>
              <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '13px', lineHeight: 1.6 }}>{target.description}</p>
              <button
                type="button"
                onClick={() => runCrawler(target.id)}
                disabled={isRunning || Boolean(runningTarget)}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  backgroundColor: isRunning || runningTarget ? '#94a3b8' : target.color,
                  color: 'white',
                  fontWeight: '800',
                  cursor: isRunning || runningTarget ? 'not-allowed' : 'pointer',
                }}
              >
                {runningTarget === target.id ? '開始中...' : target.label}
              </button>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <RunStatusCard title="前回の全体クロール" run={targetMap.all} />
          <RunStatusCard title="前回の通常クローラー" run={targetMap.official} />
          <RunStatusCard title="前回のJグランツ取込" run={targetMap.jgrants} />
        </section>

        <section style={{ backgroundColor: '#0f172a', color: '#e5e7eb', borderRadius: '12px', padding: '18px', boxShadow: '0 4px 10px rgba(15, 23, 42, 0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'white' }}>最新ログ末尾100行</h3>
            <span style={{ color: '#cbd5e1', fontSize: '12px', wordBreak: 'break-all' }}>
              {status?.latestLog?.file || 'ログなし'}
            </span>
          </div>
          <pre style={{ margin: 0, maxHeight: '520px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, fontSize: '12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
            {latestLogTail || 'まだ表示できるログがありません。'}
          </pre>
        </section>
      </main>
    </div>
  );
}
