import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function AdminColumns() {
  const [columns, setColumns] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);
  const [editingColumn, setEditingColumn] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchColumns = useCallback(async () => {
    if (!supabase) {
      setColumns([]);
      return;
    }

    const { data, error } = await supabase
      .from('columns')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setColumns(data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchColumns();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchColumns]);

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

  const base64ToBlob = (base64Image) => {
    const byteCharacters = atob(base64Image);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
  };

  const uploadGeneratedImage = async (base64Image, prefix = 'column') => {
    if (!base64Image) return '';

    const imgBlob = base64ToBlob(base64Image);
    const fileName = `${prefix}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('column-images')
      .upload(fileName, imgBlob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`画像アップロードエラー: ${uploadError.message}`);
    }

    return supabase.storage.from('column-images').getPublicUrl(fileName).data.publicUrl;
  };

  const handleGenerateFromTitle = async () => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');
    if (!editingColumn.title) {
      return alert('まずは「タイトル」を入力してください。（例：「補助率」と「補助上限額」とは？）');
    }

    if (
      !window.confirm(
        `「${editingColumn.title}」というテーマで、記事本文とサムネイル画像をAIで自動生成しますか？\n（※現在入力されている内容は上書きされます。約1分かかります）`
      )
    ) {
      return;
    }

    setIsGeneratingTitle(true);

    try {
      const { data, error } = await supabase.functions.invoke('auto-column', {
        body: {
          title: editingColumn.title,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const articleData = data?.articleData;
      const base64Image = data?.base64Image;

      if (!articleData) {
        throw new Error('Edge Functionから記事データが返ってきませんでした。');
      }

      let finalThumbnailUrl = editingColumn.thumbnail_url || '';

      if (base64Image) {
        finalThumbnailUrl = await uploadGeneratedImage(base64Image, 'column_manual');
      }

      setEditingColumn((prev) => ({
        ...prev,
        title: articleData.title || prev.title,
        slug: articleData.slug || prev.slug,
        seo_title: articleData.seo_title || '',
        meta_description: articleData.meta_description || '',
        content: articleData.content || '',
        category: articleData.category || prev.category || '基礎知識',
        thumbnail_text: articleData.thumbnail_text || '',
        thumbnail_url: finalThumbnailUrl,
        tags: articleData.tags || [],
      }));

      alert('✨ AIによる記事と画像の生成が完了しました！内容を確認して保存してください。');
    } catch (err) {
      alert(`❌ エラー: ${err.message}`);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleStartAutoColumn = async () => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');

    if (
      !window.confirm(
        '現在の「公開中」の補助金データから、AIが最適なものを1件選び、コラムと画像を自動生成します。\nよろしいですか？（約1分かかります）'
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    addLog('🚀 AI編集長を起動しました。データ収集を開始します...', 'info');

    try {
      const { data: existingCols, error: existingError } = await supabase
        .from('columns')
        .select('subsidy_id');

      if (existingError) throw new Error(`既存コラム取得エラー: ${existingError.message}`);

      const existingIds = new Set((existingCols || []).map((c) => c.subsidy_id).filter(Boolean));

      const { data: rawSubsidies, error: dbError } = await supabase
        .from('subsidies')
        .select('*')
        .eq('crawl_status', 'published')
        .order('fetched_at', { ascending: false })
        .limit(100);

      if (dbError || !rawSubsidies) throw new Error('公開中の補助金データが見つかりません。');

      const subsidies = rawSubsidies.filter((s) => !existingIds.has(s.id)).slice(0, 30);

      if (subsidies.length === 0) {
        throw new Error('新しくコラム化できる補助金がありません（すべて記事化済みです）。');
      }

      addLog(`✅ 未記事化の最新データ ${subsidies.length} 件をAIに渡しました。分析中です...`, 'info');

      const dataText = subsidies
        .map(
          (s) =>
            `ID:${s.id} | タイトル:${s.title || ''} | 機関:${s.organization || ''} | 地域:${s.region_text || ''} | 対象:${s.target_entities || ''} | 経費:${s.target_expenses || ''} | 上限:${s.amount_text || s.amount || ''} | 締切:${s.deadline || s.application_period_text || ''} | 公式URL:${s.official_url || s.source_url || 'なし'} | 概要:${s.summary || ''}`
        )
        .join('\n---\n');

      addLog('✍️ AIが最適な補助金を選定し、記事を執筆しています（約30秒〜1分）...', 'info');

      const { data, error } = await supabase.functions.invoke('auto-column', {
        body: {
          subsidiesText: dataText,
        },
      });

      if (error) throw new Error(`サーバー通信エラー: ${error.message}`);
      if (data?.error) throw new Error(data.error);

      const articleData = data?.articleData;
      const base64Image = data?.base64Image;

      if (!articleData) {
        throw new Error('Edge Functionから記事データが返ってきませんでした。');
      }

      addLog(`✨ 執筆完了！タイトル: 「${articleData.title}」`, 'success');

      let finalThumbnailUrl = '';

      if (base64Image) {
        addLog('🎨 アイキャッチ画像を保存しています...', 'info');
        finalThumbnailUrl = await uploadGeneratedImage(base64Image, 'column');
        addLog('🖼 画像が完成しました！データベースに保存しています...', 'success');
      } else {
        addLog('⚠️ 画像データは返ってきませんでした。記事のみ保存します。', 'warning');
      }

      addLog('💾 記事と画像をシステムに登録しています...', 'info');

      const { error: insertError } = await supabase.from('columns').insert([
        {
          subsidy_id: articleData.subsidy_id || null,
          slug: articleData.slug,
          title: articleData.title,
          seo_title: articleData.seo_title,
          meta_description: articleData.meta_description,
          thumbnail_text: articleData.thumbnail_text,
          thumbnail_url: finalThumbnailUrl,
          content: articleData.content,
          category: articleData.category,
          tags: articleData.tags || [],
          is_published: false,
        },
      ]);

      if (insertError) throw new Error(`DB保存エラー: ${insertError.message}`);

      addLog('🎉 全ての処理が完了しました！下書きとして保存されています。', 'success');
      await fetchColumns();
    } catch (err) {
      addLog(`❌ エラー: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteColumn = async (id, title, thumbnailUrl) => {
    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');
    if (!window.confirm(`コラム「${title}」を削除してもよろしいですか？`)) return;

    try {
      if (thumbnailUrl) {
        const fileName = thumbnailUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('column-images').remove([fileName]);
        }
      }

      await supabase.from('columns').delete().eq('id', id);
      await fetchColumns();
    } catch (err) {
      alert('削除エラー: ' + err.message);
    }
  };

  const handleUpdateColumn = async (e) => {
    e.preventDefault();

    if (!supabase) return alert('Supabaseの接続情報が設定されていません。');

    setIsSaving(true);

    try {
      const payload = {
        title: editingColumn.title,
        slug: editingColumn.slug,
        category: editingColumn.category,
        seo_title: editingColumn.seo_title,
        meta_description: editingColumn.meta_description,
        content: editingColumn.content,
        is_published: editingColumn.is_published,
        thumbnail_url: editingColumn.thumbnail_url,
        thumbnail_text: editingColumn.thumbnail_text || '',
        tags: editingColumn.tags || [],
      };

      if (editingColumn.id) {
        const { error } = await supabase.from('columns').update(payload).eq('id', editingColumn.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('columns').insert([payload]);
        if (error) throw error;
      }

      alert('コラムを保存しました！');
      setEditingColumn(null);
      await fetchColumns();
    } catch (err) {
      alert('保存エラー: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    window.location.href = '/';
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#111827', color: 'white', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', height: '100%' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>⚙️ 管理ダッシュボード</h1>

          <nav style={{ display: 'flex', height: '100%' }}>
            <a href="/admin" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              📊 補助金データ更新
            </a>
            <a href="/admin?tab=experts" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              🤝 専門家管理
            </a>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'white', fontSize: '15px', fontWeight: 'bold', borderBottom: '3px solid #10b981', backgroundColor: '#1f2937' }}>
              📝 コラム管理
            </div>
          </nav>
        </div>

        <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
          ログアウト
        </button>
      </header>

      <div style={{ maxWidth: '1000px', margin: '32px auto', padding: '0 24px' }}>
        {editingColumn ? (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                📝 コラムの編集・作成
              </h2>

              <button onClick={() => setEditingColumn(null)} style={{ backgroundColor: '#f3f4f6', color: '#4b5563', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                ← 一覧へ戻る
              </button>
            </div>

            <form onSubmit={handleUpdateColumn} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '120px', height: '80px', borderRadius: '8px', backgroundColor: '#e2e8f0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {editingColumn.thumbnail_url ? (
                    <img src={editingColumn.thumbnail_url} alt="サムネイル" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>No Image</span>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                    公開ステータス
                  </label>

                  <select
                    value={editingColumn.is_published ? 'true' : 'false'}
                    onChange={(e) => setEditingColumn({ ...editingColumn, is_published: e.target.value === 'true' })}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 'bold', color: editingColumn.is_published ? '#059669' : '#4b5563', backgroundColor: editingColumn.is_published ? '#d1fae5' : 'white' }}
                  >
                    <option value="false">📝 下書き（非公開）</option>
                    <option value="true">✅ 公開する</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                    タイトル（テーマ）
                  </label>

                  <input
                    type="text"
                    required
                    placeholder="例：「補助率」と「補助上限額」とは？"
                    value={editingColumn.title || ''}
                    onChange={(e) => setEditingColumn({ ...editingColumn, title: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '15px' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateFromTitle}
                  disabled={isGeneratingTitle}
                  style={{ backgroundColor: isGeneratingTitle ? '#9ca3af' : '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: isGeneratingTitle ? 'not-allowed' : 'pointer', border: 'none', fontSize: '14px', whiteSpace: 'nowrap', transition: 'background-color 0.2s' }}
                >
                  {isGeneratingTitle ? '🔄 AI執筆・画像生成中...' : '🤖 タイトルからAI自動執筆'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                    URLスラッグ（英数字ハイフン）
                  </label>

                  <input
                    type="text"
                    required
                    value={editingColumn.slug || ''}
                    onChange={(e) => setEditingColumn({ ...editingColumn, slug: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                    カテゴリ
                  </label>

                  <input
                    type="text"
                    value={editingColumn.category || ''}
                    onChange={(e) => setEditingColumn({ ...editingColumn, category: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                  SEOタイトル (検索結果用)
                </label>

                <input
                  type="text"
                  value={editingColumn.seo_title || ''}
                  onChange={(e) => setEditingColumn({ ...editingColumn, seo_title: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                  メタディスクリプション (検索結果の説明文)
                </label>

                <textarea
                  rows="2"
                  value={editingColumn.meta_description || ''}
                  onChange={(e) => setEditingColumn({ ...editingColumn, meta_description: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>
                  記事本文 (HTMLタグ使用可)
                </label>

                <textarea
                  rows="15"
                  required
                  value={editingColumn.content || ''}
                  onChange={(e) => setEditingColumn({ ...editingColumn, content: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.6' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setEditingColumn(null)} style={{ padding: '12px 24px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>
                  キャンセル
                </button>

                <button type="submit" disabled={isSaving} style={{ padding: '12px 32px', backgroundColor: '#10b981', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', color: 'white', fontSize: '16px' }}>
                  {isSaving ? '保存中...' : '💾 内容を保存して更新'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '32px', borderTop: '6px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🤖 AI自動コラム生成
                  </h2>

                  <p style={{ margin: 0, color: '#4b5563', fontSize: '14px' }}>
                    現在公開中の補助金データから、AI編集長が今一番アツい制度を1つ選び出し、SEO最適化されたコラム記事とアイキャッチ画像を全自動で生成します。
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() =>
                      setEditingColumn({
                        title: '',
                        slug: `guide-${Date.now()}`,
                        category: '基礎知識',
                        seo_title: '',
                        meta_description: '',
                        content: '',
                        thumbnail_url: '',
                        thumbnail_text: '',
                        tags: [],
                        is_published: false,
                      })
                    }
                    style={{ backgroundColor: 'white', color: '#4b5563', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', whiteSpace: 'nowrap' }}
                  >
                    ✍️ 手動で新規作成
                  </button>

                  <button onClick={handleStartAutoColumn} disabled={isProcessing} style={{ backgroundColor: isProcessing ? '#9ca3af' : '#10b981', color: 'white', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', boxShadow: isProcessing ? 'none' : '0 4px 6px rgba(16, 185, 129, 0.3)', whiteSpace: 'nowrap' }}>
                    {isProcessing ? '🔄 執筆＆描画中...' : '✒️ AIに今週のおすすめ記事を書かせる'}
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: '#111827', borderRadius: '8px', padding: '16px', overflowY: 'auto', height: '180px', fontFamily: 'monospace', fontSize: '13px', border: '1px solid #374151' }}>
                {logs.length === 0 ? (
                  <div style={{ color: '#6b7280', textAlign: 'center', marginTop: '60px' }}>
                    ボタンを押すと、AI編集長の作業ログがここに表示されます
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} style={{ color: getLogColor(log.type), marginBottom: '8px', lineHeight: '1.4' }}>
                      <span style={{ color: '#6b7280', marginRight: '8px' }}>[{log.time}]</span>
                      {log.msg}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#334155' }}>
              📝 作成済みのコラム ({columns.length}件)
            </h3>

            {columns.length === 0 ? (
              <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#6b7280' }}>
                まだ作成されたコラムはありません。
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {columns.map((col) => (
                  <div key={col.id} style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: 'white' }}>
                    <div style={{ width: '120px', height: '80px', borderRadius: '8px', backgroundColor: '#e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                      {col.thumbnail_url ? (
                        <img src={col.thumbnail_url} alt="サムネイル" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                          No Image
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ backgroundColor: col.is_published ? '#d1fae5' : '#f3f4f6', color: col.is_published ? '#059669' : '#4b5563', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {col.is_published ? '✅ 公開中' : '📝 下書き'}
                        </span>

                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {col.category || 'カテゴリ未設定'}
                        </span>
                      </div>

                      <strong style={{ fontSize: '16px', color: '#111827', display: 'block', marginBottom: '4px' }}>
                        {col.title}
                      </strong>

                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        URL: /{col.slug}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditingColumn(col)} style={{ backgroundColor: 'white', color: '#3b82f6', border: '1px solid #3b82f6', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                        編集
                      </button>

                      <button onClick={() => handleDeleteColumn(col.id, col.title, col.thumbnail_url)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}