import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabaseClient';

const colors = {
  primary: '#0f7b6c',
  primaryDark: '#084a55',
  border: '#e5e7eb',
  muted: '#6b7280',
  surface: '#ffffff',
  background: '#f3f4f6',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
};

const generationModes = [
  { value: 'manual', label: '自由入力' },
  { value: 'ai_interview', label: 'AIインタビュー生成' },
];

const verificationStatuses = [
  { value: 'operator_created', label: '運営作成' },
  { value: 'ai_generated', label: 'AI生成含む' },
  { value: 'expert_reviewed', label: '専門家確認済み' },
  { value: 'expert_supervised', label: '専門家監修' },
];

const articleStatuses = [
  { value: 'draft', label: '下書き' },
  { value: 'published', label: '公開' },
  { value: 'archived', label: 'アーカイブ' },
];

const emptyQa = () => ({ question: '', answer: '' });

const createEmptyForm = () => ({
  id: null,
  title: '',
  slug: '',
  expert_id: '',
  generation_mode: 'manual',
  verification_status: 'operator_created',
  status: 'draft',
  summary: '',
  lead_text: '',
  content_html: '',
  closing_text: '',
  main_image_url: '',
  meta_title: '',
  meta_description: '',
  published_at: '',
  qa: [emptyQa()],
});

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

function createSlug(value) {
  const base = String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[ぁ-んァ-ン一-龥]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return base || `expert-article-${Date.now()}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ja-JP');
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildContentJson(form) {
  return {
    lead: form.lead_text || '',
    qa: (form.qa || [])
      .map((item) => ({
        question: String(item.question || '').trim(),
        answer: String(item.answer || '').trim(),
      }))
      .filter((item) => item.question || item.answer),
    closing: form.closing_text || '',
  };
}

function getArticleQa(article) {
  const content = article?.content_json || {};
  return Array.isArray(content.qa) && content.qa.length ? content.qa : [emptyQa()];
}

function subsidySearchText(item) {
  return [
    item.title,
    item.organization,
    item.region_text,
    item.summary,
    ...(Array.isArray(item.purposes) ? item.purposes : []),
    ...(Array.isArray(item.industries) ? item.industries : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function AdminExpertArticles() {
  const [articles, setArticles] = useState([]);
  const [experts, setExperts] = useState([]);
  const [articleSubsidyCounts, setArticleSubsidyCounts] = useState({});
  const [form, setForm] = useState(createEmptyForm());
  const [selectedSubsidies, setSelectedSubsidies] = useState([]);
  const [subsidyQuery, setSubsidyQuery] = useState('');
  const [subsidyResults, setSubsidyResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [aiForm, setAiForm] = useState({
    theme: '',
    targetReader: '',
    region: '愛媛県',
    industry: '',
    goal: '補助金相談につなげる',
    questionCount: 6,
    tone: 'やさしく、専門用語を少なめに',
  });

  const expertNameById = useMemo(() => {
    const map = new Map();
    experts.forEach((expert) => map.set(String(expert.id), expert.name));
    return map;
  }, [experts]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const loadInitialData = async () => {
    setLoading(true);
    setMessage('');

    try {
      await Promise.all([loadExperts(), loadArticles()]);
    } finally {
      setLoading(false);
    }
  };

  const loadExperts = async () => {
    const { data, error } = await supabase
      .from('experts')
      .select('id, name, qualification, area, avatar_url, is_active')
      .order('id', { ascending: true });

    if (error) {
      setMessage(`専門家取得エラー: ${error.message}`);
      return;
    }

    setExperts(data || []);
  };

  const loadArticles = async () => {
    const { data, error } = await supabase
      .from('expert_articles')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      setMessage(`専門家記事取得エラー: ${error.message}`);
      return;
    }

    const articleRows = data || [];
    setArticles(articleRows);

    if (!articleRows.length) {
      setArticleSubsidyCounts({});
      return;
    }

    const { data: linkRows, error: linkError } = await supabase
      .from('expert_article_subsidies')
      .select('expert_article_id')
      .in('expert_article_id', articleRows.map((item) => item.id));

    if (linkError) {
      setArticleSubsidyCounts({});
      return;
    }

    const counts = {};
    (linkRows || []).forEach((row) => {
      counts[row.expert_article_id] = (counts[row.expert_article_id] || 0) + 1;
    });
    setArticleSubsidyCounts(counts);
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setSelectedSubsidies([]);
    setSubsidyQuery('');
    setSubsidyResults([]);
    setMessage('');
  };

  const editArticle = async (article) => {
    const content = article.content_json || {};

    setForm({
      id: article.id,
      title: article.title || '',
      slug: article.slug || '',
      expert_id: article.expert_id ? String(article.expert_id) : '',
      generation_mode: article.generation_mode || 'manual',
      verification_status: article.verification_status || 'operator_created',
      status: article.status || 'draft',
      summary: article.summary || '',
      lead_text: article.lead_text || content.lead || '',
      content_html: article.content_html || '',
      closing_text: article.closing_text || content.closing || '',
      main_image_url: article.main_image_url || '',
      meta_title: article.meta_title || '',
      meta_description: article.meta_description || '',
      published_at: article.published_at
        ? new Date(article.published_at).toISOString().slice(0, 16)
        : '',
      qa: getArticleQa(article),
    });

    await loadArticleSubsidies(article.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadArticleSubsidies = async (articleId) => {
    const { data: linkRows, error } = await supabase
      .from('expert_article_subsidies')
      .select('subsidy_id, sort_order, note')
      .eq('expert_article_id', articleId)
      .order('sort_order', { ascending: true });

    if (error || !linkRows?.length) {
      setSelectedSubsidies([]);
      return;
    }

    const ids = linkRows.map((row) => row.subsidy_id);
    const { data: subsidies } = await supabase
      .from('subsidies')
      .select('id, title, organization, region_text, application_period_text, amount_text, amount_max_yen, crawl_status, is_active, official_url')
      .in('id', ids);

    const subsidyMap = new Map((subsidies || []).map((item) => [item.id, item]));
    setSelectedSubsidies(
      linkRows
        .map((row) => ({
          ...(subsidyMap.get(row.subsidy_id) || { id: row.subsidy_id, title: `ID ${row.subsidy_id}` }),
          sort_order: row.sort_order,
          note: row.note || '',
        }))
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    );
  };

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateQa = (index, key, value) => {
    setForm((prev) => {
      const qa = [...prev.qa];
      qa[index] = { ...qa[index], [key]: value };
      return { ...prev, qa };
    });
  };

  const addQa = () => {
    setForm((prev) => ({ ...prev, qa: [...prev.qa, emptyQa()] }));
  };

  const removeQa = (index) => {
    setForm((prev) => ({
      ...prev,
      qa: prev.qa.length <= 1 ? [emptyQa()] : prev.qa.filter((_, i) => i !== index),
    }));
  };

  const moveQa = (index, direction) => {
    setForm((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.qa.length) return prev;
      const qa = [...prev.qa];
      [qa[index], qa[nextIndex]] = [qa[nextIndex], qa[index]];
      return { ...prev, qa };
    });
  };

  const searchSubsidies = async () => {
    setSearching(true);
    setMessage('');

    const { data, error } = await supabase
      .from('subsidies')
      .select('id, title, organization, region_text, application_period_text, amount_text, amount_max_yen, purposes, industries, tags, summary, crawl_status, is_active, duplicate_of_id, official_url')
      .eq('is_active', true)
      .eq('crawl_status', 'published')
      .is('duplicate_of_id', null)
      .order('fetched_at', { ascending: false })
      .limit(120);

    setSearching(false);

    if (error) {
      setMessage(`補助金検索エラー: ${error.message}`);
      return;
    }

    const keyword = subsidyQuery.trim().toLowerCase();
    const selectedIds = new Set(selectedSubsidies.map((item) => item.id));
    const results = (data || [])
      .filter((item) => !selectedIds.has(item.id))
      .filter((item) => !keyword || subsidySearchText(item).includes(keyword))
      .slice(0, 30);

    setSubsidyResults(results);
  };

  const addSubsidy = (item) => {
    setSelectedSubsidies((prev) => [
      ...prev,
      {
        ...item,
        sort_order: prev.length,
        note: '',
      },
    ]);
    setSubsidyResults((prev) => prev.filter((result) => result.id !== item.id));
  };

  const removeSubsidy = (id) => {
    setSelectedSubsidies((prev) =>
      prev.filter((item) => item.id !== id).map((item, index) => ({ ...item, sort_order: index }))
    );
  };

  const moveSubsidy = (index, direction) => {
    setSelectedSubsidies((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const items = [...prev];
      [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      return items.map((item, sortIndex) => ({ ...item, sort_order: sortIndex }));
    });
  };

  const updateSubsidyNote = (id, note) => {
    setSelectedSubsidies((prev) =>
      prev.map((item) => (item.id === id ? { ...item, note } : item))
    );
  };

  const handleGenerateAiArticle = async () => {
    if (!aiForm.theme.trim()) {
      alert('AI生成にはテーマが必要です。');
      return;
    }

    setGenerating(true);
    setMessage('');

    const expert = experts.find((item) => String(item.id) === String(form.expert_id));
    const recommendedSubsidies = selectedSubsidies.map((item) => ({
      id: item.id,
      title: item.title,
      organization: item.organization,
      region_text: item.region_text,
      application_period_text: item.application_period_text,
      amount_text: item.amount_text,
    }));

    const { data, error } = await supabase.functions.invoke('auto-expert-article', {
      body: {
        expertId: form.expert_id ? Number(form.expert_id) : null,
        expertName: expert?.name || '',
        ...aiForm,
        recommendedSubsidies,
      },
    });

    setGenerating(false);

    if (error) {
      setMessage(`AI生成通信エラー: ${error.message}`);
      return;
    }

    if (data?.error) {
      setMessage(`AI生成エラー: ${data.error}`);
      return;
    }

    setForm((prev) => ({
      ...prev,
      generation_mode: 'ai_interview',
      verification_status: 'ai_generated',
      title: data.title || prev.title,
      slug: data.slug || prev.slug || createSlug(data.title || aiForm.theme),
      summary: data.summary || prev.summary,
      lead_text: data.leadText || prev.lead_text,
      qa: Array.isArray(data.qa) && data.qa.length ? data.qa : prev.qa,
      closing_text: data.closingText || prev.closing_text,
      meta_title: data.metaTitle || prev.meta_title,
      meta_description: data.metaDescription || prev.meta_description,
    }));

    setMessage('AIインタビュー記事の下書きを生成しました。内容を確認して保存してください。');
  };

  const saveArticle = async (nextStatus = form.status) => {
    if (!form.title.trim()) {
      alert('タイトルを入力してください。');
      return;
    }

    const slug = (form.slug || createSlug(form.title)).trim();
    if (!slug) {
      alert('slugを入力してください。');
      return;
    }

    setSaving(true);
    setMessage('');

    const publishAt =
      nextStatus === 'published'
        ? form.published_at
          ? new Date(form.published_at).toISOString()
          : new Date().toISOString()
        : form.published_at
          ? new Date(form.published_at).toISOString()
          : null;

    const payload = {
      expert_id: toNumberOrNull(form.expert_id),
      title: form.title.trim(),
      slug,
      summary: form.summary.trim() || null,
      lead_text: form.lead_text.trim() || null,
      content_json: buildContentJson(form),
      content_html: form.content_html.trim() || null,
      closing_text: form.closing_text.trim() || null,
      main_image_url: form.main_image_url.trim() || null,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      generation_mode: form.generation_mode,
      verification_status: form.verification_status,
      status: nextStatus,
      is_active: nextStatus !== 'archived',
      published_at: publishAt,
    };

    const query = form.id
      ? supabase.from('expert_articles').update(payload).eq('id', form.id).select('id').single()
      : supabase.from('expert_articles').insert(payload).select('id').single();

    const { data, error } = await query;

    if (error) {
      setSaving(false);
      setMessage(`保存エラー: ${error.message}`);
      return;
    }

    const articleId = form.id || data?.id;

    if (articleId) {
      const { error: deleteError } = await supabase
        .from('expert_article_subsidies')
        .delete()
        .eq('expert_article_id', articleId);

      if (deleteError) {
        setSaving(false);
        setMessage(`おすすめ補助金の更新エラー: ${deleteError.message}`);
        return;
      }

      if (selectedSubsidies.length) {
        const linkPayload = selectedSubsidies.map((item, index) => ({
          expert_article_id: articleId,
          subsidy_id: item.id,
          sort_order: index,
          note: item.note || null,
        }));

        const { error: insertError } = await supabase
          .from('expert_article_subsidies')
          .insert(linkPayload);

        if (insertError) {
          setSaving(false);
          setMessage(`おすすめ補助金の保存エラー: ${insertError.message}`);
          return;
        }
      }
    }

    setSaving(false);
    setMessage('専門家記事を保存しました。');
    resetForm();
    await loadArticles();
  };

  const archiveArticle = async (article) => {
    if (!confirm(`「${article.title}」をアーカイブしますか？`)) return;

    const { error } = await supabase
      .from('expert_articles')
      .update({ status: 'archived', is_active: false })
      .eq('id', article.id);

    if (error) {
      setMessage(`アーカイブエラー: ${error.message}`);
      return;
    }

    await loadArticles();
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#111827', color: 'white', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '64px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', height: '64px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>⚙️ 管理ダッシュボード</h1>
          <nav style={{ display: 'flex', height: '100%' }}>
            <a href="/admin" style={navLinkStyle}>📊 補助金データ更新</a>
            <a href="/admin?tab=experts" style={navLinkStyle}>🤝 専門家管理</a>
            <a href="/admin?tab=expert-articles" style={{ ...navLinkStyle, color: 'white', fontWeight: 'bold', borderBottom: '3px solid #facc15', backgroundColor: '#1f2937' }}>💬 専門家記事</a>
            <a href="/admin?tab=columns" style={navLinkStyle}>📝 コラム管理</a>
            <a href="/admin?tab=features" style={navLinkStyle}>⭐ 特集記事制作</a>
            <a href="/admin?tab=crawler" style={navLinkStyle}>🛠 クローラー管理</a>
          </nav>
        </div>
        <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          ログアウト
        </button>
      </header>

      <main style={{ maxWidth: '1180px', margin: '32px auto', padding: '0 24px' }}>
        <section style={{ background: colors.surface, borderRadius: '14px', padding: '28px', border: `1px solid ${colors.border}`, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#111827' }}>💬 専門家Q&A記事</h2>
              <p style={{ margin: 0, color: colors.muted, fontSize: '14px', lineHeight: 1.7 }}>
                専門家の信頼性を伝えるQ&A記事を作成し、関連補助金と相談導線へつなげます。
              </p>
            </div>
            <button onClick={resetForm} style={{ border: `1px solid ${colors.border}`, background: 'white', borderRadius: '10px', padding: '10px 16px', fontWeight: 'bold', cursor: 'pointer' }}>
              ＋ 新規作成
            </button>
          </div>

          {message && (
            <div style={{ background: colors.warningBg, border: `1px solid ${colors.warningBorder}`, borderRadius: '10px', padding: '12px 14px', color: '#92400e', fontSize: '13px', marginBottom: '18px', whiteSpace: 'pre-wrap' }}>
              {message}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)', gap: '24px' }}>
            <div style={{ minWidth: 0 }}>
              <Field label="タイトル">
                <input value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="例：愛媛県の飲食店が補助金を活用するポイント" style={inputStyle} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '12px' }}>
                <Field label="URL slug">
                  <input value={form.slug} onChange={(e) => updateForm('slug', e.target.value)} placeholder="expert-subsidy-interview" style={inputStyle} />
                </Field>
                <button type="button" onClick={() => updateForm('slug', createSlug(form.title))} style={{ ...secondaryButtonStyle, alignSelf: 'end', height: '44px' }}>
                  slug自動作成
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <Field label="専門家">
                  <select value={form.expert_id} onChange={(e) => updateForm('expert_id', e.target.value)} style={inputStyle}>
                    <option value="">未指定</option>
                    {experts.map((expert) => (
                      <option key={expert.id} value={expert.id}>
                        {expert.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="公開状態">
                  <select value={form.status} onChange={(e) => updateForm('status', e.target.value)} style={inputStyle}>
                    {articleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <Field label="生成モード">
                  <select value={form.generation_mode} onChange={(e) => updateForm('generation_mode', e.target.value)} style={inputStyle}>
                    {generationModes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </Field>
                <Field label="確認状態">
                  <select value={form.verification_status} onChange={(e) => updateForm('verification_status', e.target.value)} style={inputStyle}>
                    {verificationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="一覧用説明">
                <textarea value={form.summary} onChange={(e) => updateForm('summary', e.target.value)} rows={2} style={textareaStyle} />
              </Field>

              <Field label="リード文">
                <textarea value={form.lead_text} onChange={(e) => updateForm('lead_text', e.target.value)} rows={4} style={textareaStyle} />
              </Field>

              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={labelStyle}>Q&Aブロック</label>
                  <button type="button" onClick={addQa} style={secondaryButtonStyle}>＋ Q&A追加</button>
                </div>
                {form.qa.map((item, index) => (
                  <div key={index} style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '14px', marginBottom: '12px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                      <strong style={{ color: '#111827' }}>Q{index + 1}</strong>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => moveQa(index, -1)} style={miniButtonStyle}>↑</button>
                        <button type="button" onClick={() => moveQa(index, 1)} style={miniButtonStyle}>↓</button>
                        <button type="button" onClick={() => removeQa(index)} style={{ ...miniButtonStyle, color: '#dc2626' }}>削除</button>
                      </div>
                    </div>
                    <input value={item.question} onChange={(e) => updateQa(index, 'question', e.target.value)} placeholder="質問" style={{ ...inputStyle, marginBottom: '8px' }} />
                    <textarea value={item.answer} onChange={(e) => updateQa(index, 'answer', e.target.value)} placeholder="回答" rows={4} style={textareaStyle} />
                  </div>
                ))}
              </div>

              <Field label="まとめ">
                <textarea value={form.closing_text} onChange={(e) => updateForm('closing_text', e.target.value)} rows={4} style={textareaStyle} />
              </Field>

              <Field label="本文HTML（任意）">
                <textarea value={form.content_html} onChange={(e) => updateForm('content_html', e.target.value)} rows={5} placeholder="<h2>見出し</h2><p>本文...</p>" style={textareaStyle} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                <Field label="アイキャッチ画像URL">
                  <input value={form.main_image_url} onChange={(e) => updateForm('main_image_url', e.target.value)} style={inputStyle} />
                </Field>
                <Field label="公開日時">
                  <input type="datetime-local" value={form.published_at} onChange={(e) => updateForm('published_at', e.target.value)} style={inputStyle} />
                </Field>
              </div>

              <Field label="meta title">
                <input value={form.meta_title} onChange={(e) => updateForm('meta_title', e.target.value)} style={inputStyle} />
              </Field>

              <Field label="meta description">
                <textarea value={form.meta_description} onChange={(e) => updateForm('meta_description', e.target.value)} rows={2} style={textareaStyle} />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap', borderTop: `1px solid ${colors.border}`, paddingTop: '18px' }}>
                <button disabled={saving} onClick={() => saveArticle('draft')} style={secondaryButtonStyle}>下書き保存</button>
                <button disabled={saving} onClick={() => saveArticle('published')} style={primaryButtonStyle}>公開する</button>
              </div>
            </div>

            <aside style={{ minWidth: 0 }}>
              <section style={sideBoxStyle}>
                <h3 style={sideTitleStyle}>🤖 AIインタビュー生成</h3>
                <Field label="テーマ">
                  <input value={aiForm.theme} onChange={(e) => setAiForm((prev) => ({ ...prev, theme: e.target.value }))} placeholder="愛媛県の飲食店が使える補助金" style={inputStyle} />
                </Field>
                <Field label="対象読者">
                  <input value={aiForm.targetReader} onChange={(e) => setAiForm((prev) => ({ ...prev, targetReader: e.target.value }))} placeholder="愛媛県内の飲食店・小売店" style={inputStyle} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="地域">
                    <input value={aiForm.region} onChange={(e) => setAiForm((prev) => ({ ...prev, region: e.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="業種">
                    <input value={aiForm.industry} onChange={(e) => setAiForm((prev) => ({ ...prev, industry: e.target.value }))} style={inputStyle} />
                  </Field>
                </div>
                <Field label="記事の狙い">
                  <input value={aiForm.goal} onChange={(e) => setAiForm((prev) => ({ ...prev, goal: e.target.value }))} style={inputStyle} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '10px' }}>
                  <Field label="質問数">
                    <input type="number" min="3" max="12" value={aiForm.questionCount} onChange={(e) => setAiForm((prev) => ({ ...prev, questionCount: e.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="口調">
                    <input value={aiForm.tone} onChange={(e) => setAiForm((prev) => ({ ...prev, tone: e.target.value }))} style={inputStyle} />
                  </Field>
                </div>
                <button disabled={generating} onClick={handleGenerateAiArticle} style={{ ...primaryButtonStyle, width: '100%' }}>
                  {generating ? '生成中...' : 'AIでQ&A下書きを生成'}
                </button>
                <p style={{ margin: '12px 0 0', color: colors.muted, fontSize: '12px', lineHeight: 1.6 }}>
                  生成後は必ず内容を確認してください。採択可否や申請条件の断定は避け、公式情報確認の注意書きを残します。
                </p>
              </section>

              <section style={sideBoxStyle}>
                <h3 style={sideTitleStyle}>📌 おすすめ補助金</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input value={subsidyQuery} onChange={(e) => setSubsidyQuery(e.target.value)} placeholder="補助金名・地域・タグで検索" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={searchSubsidies} disabled={searching} style={secondaryButtonStyle}>
                    検索
                  </button>
                </div>

                <div style={{ maxHeight: '220px', overflow: 'auto', border: `1px solid ${colors.border}`, borderRadius: '10px', marginBottom: '16px' }}>
                  {subsidyResults.length ? subsidyResults.map((item) => (
                    <div key={item.id} style={{ padding: '10px', borderBottom: `1px solid ${colors.border}` }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#111827', lineHeight: 1.5 }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: colors.muted, marginTop: '4px' }}>{item.region_text || '-'} / {item.amount_text || '金額不明'}</div>
                      <button onClick={() => addSubsidy(item)} style={{ ...miniButtonStyle, marginTop: '8px', color: colors.primary }}>追加</button>
                    </div>
                  )) : (
                    <div style={{ padding: '14px', color: colors.muted, fontSize: '13px' }}>検索すると候補が表示されます。</div>
                  )}
                </div>

                {selectedSubsidies.length ? selectedSubsidies.map((item, index) => (
                  <div key={item.id} style={{ border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px', marginBottom: '10px', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#111827', lineHeight: 1.5 }}>{item.title}</strong>
                      <button onClick={() => removeSubsidy(item.id)} style={{ ...miniButtonStyle, color: '#dc2626' }}>削除</button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <button onClick={() => moveSubsidy(index, -1)} style={miniButtonStyle}>↑</button>
                      <button onClick={() => moveSubsidy(index, 1)} style={miniButtonStyle}>↓</button>
                    </div>
                    <input value={item.note || ''} onChange={(e) => updateSubsidyNote(item.id, e.target.value)} placeholder="記事内での補足メモ（任意）" style={{ ...inputStyle, marginTop: '8px', fontSize: '12px', padding: '8px' }} />
                  </div>
                )) : (
                  <p style={{ margin: 0, color: colors.muted, fontSize: '13px' }}>おすすめ補助金は未選択です。</p>
                )}
              </section>
            </aside>
          </div>
        </section>

        <section style={{ background: colors.surface, borderRadius: '14px', padding: '24px', border: `1px solid ${colors.border}` }}>
          <h2 style={{ margin: '0 0 16px', color: '#111827', fontSize: '20px' }}>作成済みの専門家記事（{articles.length}件）</h2>
          {loading ? (
            <p style={{ color: colors.muted }}>読み込み中...</p>
          ) : articles.length ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {articles.map((article) => (
                <article key={article.id} style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span style={statusBadgeStyle(article.status)}>{article.status}</span>
                      <span style={badgeStyle}>{generationModes.find((item) => item.value === article.generation_mode)?.label || article.generation_mode}</span>
                      <span style={badgeStyle}>{verificationStatuses.find((item) => item.value === article.verification_status)?.label || article.verification_status}</span>
                    </div>
                    <h3 style={{ margin: '0 0 8px', color: '#111827', fontSize: '17px', lineHeight: 1.5 }}>{article.title}</h3>
                    <p style={{ margin: '0 0 6px', color: colors.muted, fontSize: '13px' }}>
                      ID: {article.id} / slug: {article.slug} / 専門家: {expertNameById.get(String(article.expert_id)) || '未指定'}
                    </p>
                    <p style={{ margin: 0, color: colors.muted, fontSize: '13px' }}>
                      おすすめ補助金: {articleSubsidyCounts[article.id] || 0}件 / 公開日: {formatDate(article.published_at)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={() => editArticle(article)} style={secondaryButtonStyle}>編集</button>
                    {article.status !== 'archived' && (
                      <button onClick={() => archiveArticle(article)} style={{ ...secondaryButtonStyle, color: '#92400e', borderColor: '#fde68a', background: '#fffbeb' }}>
                        アーカイブ
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ color: colors.muted }}>専門家記事はまだありません。</p>
          )}
        </section>
      </main>

      <style>{`
        @media (max-width: 900px) {
          main section > div[style*="grid-template-columns: minmax(0, 1fr) minmax(320px, 420px)"] {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          input, textarea, select, button {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '14px' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function statusBadgeStyle(status) {
  const map = {
    published: { bg: '#dcfce7', color: '#166534', label: '公開' },
    draft: { bg: '#fef3c7', color: '#92400e', label: '下書き' },
    archived: { bg: '#e5e7eb', color: '#374151', label: 'アーカイブ' },
  };
  const item = map[status] || map.draft;
  return {
    display: 'inline-flex',
    background: item.bg,
    color: item.color,
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '4px 10px',
    borderRadius: '999px',
  };
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  color: '#4b5563',
  fontWeight: 'bold',
  marginBottom: '7px',
};

const inputStyle = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  border: '1px solid #d1d5db',
  borderRadius: '9px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#111827',
  background: '#ffffff',
};

const textareaStyle = {
  ...inputStyle,
  lineHeight: 1.7,
  resize: 'vertical',
};

const primaryButtonStyle = {
  background: colors.primary,
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  padding: '12px 18px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  background: '#ffffff',
  color: '#374151',
  border: `1px solid ${colors.border}`,
  borderRadius: '10px',
  padding: '10px 14px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const miniButtonStyle = {
  background: '#ffffff',
  color: '#374151',
  border: `1px solid ${colors.border}`,
  borderRadius: '8px',
  padding: '5px 9px',
  fontSize: '12px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const sideBoxStyle = {
  border: `1px solid ${colors.border}`,
  borderRadius: '14px',
  padding: '18px',
  background: '#f8fafc',
  marginBottom: '18px',
};

const sideTitleStyle = {
  margin: '0 0 14px',
  fontSize: '17px',
  color: '#111827',
};

const badgeStyle = {
  display: 'inline-flex',
  background: '#f3f4f6',
  color: '#374151',
  fontSize: '12px',
  fontWeight: 'bold',
  padding: '4px 10px',
  borderRadius: '999px',
};
