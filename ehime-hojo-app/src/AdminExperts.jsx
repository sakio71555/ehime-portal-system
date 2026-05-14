import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

const colors = { primary: '#526b5d', border: '#e4e7e5', danger: '#dc2626' };
const QUALIFICATION_OPTIONS = ['中小企業診断士', '税理士', '社会保険労務士', '行政書士', '公認会計士', '認定支援機関'];
const SPECIALTY_OPTIONS = ['IT導入', '創業支援', '事業承継', '設備投資', '販路開拓', '人材育成', '資金繰り'];

export default function AdminExperts() {
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null);

  const [formData, setFormData] = useState({
    name: '', qualifications: [], qualificationText: '', area: '', specialties: [], specialtyText: '', website_url: '', description: ''
  });

  const fetchExperts = async () => {
    const { data, error } = await supabase.from('experts').select('*').order('created_at', { ascending: false });
    if (!error) setExperts(data || []);
  };

  useEffect(() => { fetchExperts(); }, []);

  const handleCheck = (field, value) => {
    setFormData(prev => {
      const current = prev[field];
      if (current.includes(value)) return { ...prev, [field]: current.filter(v => v !== value) };
      return { ...prev, [field]: [...current, value] };
    });
  };

  const resetForm = () => {
    setFormData({ name: '', qualifications: [], qualificationText: '', area: '', specialties: [], specialtyText: '', website_url: '', description: '' });
    setAvatarFile(null);
    setEditingId(null);
    setCurrentAvatarUrl(null);
  };

  const handleEditExpert = (exp) => {
    const qualArray = exp.qualification ? exp.qualification.split(' / ').map(s => s.trim()) : [];
    const matchedQuals = qualArray.filter(q => QUALIFICATION_OPTIONS.includes(q));
    const otherQuals = qualArray.filter(q => !QUALIFICATION_OPTIONS.includes(q)).join(', ');

    const specArray = exp.specialties || [];
    const matchedSpecs = specArray.filter(s => SPECIALTY_OPTIONS.includes(s));
    const otherSpecs = specArray.filter(s => !SPECIALTY_OPTIONS.includes(s)).join(', ');

    setFormData({
      name: exp.name || '',
      qualifications: matchedQuals,
      qualificationText: otherQuals,
      area: exp.area || '',
      specialties: matchedSpecs,
      specialtyText: otherSpecs,
      website_url: exp.website_url || '',
      description: exp.description || ''
    });

    setEditingId(exp.id);
    setCurrentAvatarUrl(exp.avatar_url);
    setAvatarFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let final_avatar_url = currentAvatarUrl;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('expert-avatars').upload(fileName, avatarFile);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('expert-avatars').getPublicUrl(fileName);
        final_avatar_url = publicUrlData.publicUrl;

        if (currentAvatarUrl) {
          const oldFileName = currentAvatarUrl.split('/').pop();
          await supabase.storage.from('expert-avatars').remove([oldFileName]);
        }
      }

      const finalSpecialties = [...formData.specialties, ...formData.specialtyText.split(/[、,]/).map(s => s.trim()).filter(Boolean)];
      const finalQualifications = [...formData.qualifications, ...formData.qualificationText.split(/[、,]/).map(s => s.trim()).filter(Boolean)];

      const payload = {
        name: formData.name, qualification: finalQualifications.join(' / '), area: formData.area,
        specialties: finalSpecialties, website_url: formData.website_url, description: formData.description, avatar_url: final_avatar_url
      };

      if (editingId) {
        const { error } = await supabase.from('experts').update(payload).eq('id', editingId);
        if (error) throw error;
        alert('情報を更新しました！');
      } else {
        const { error } = await supabase.from('experts').insert([payload]);
        if (error) throw error;
        alert('登録しました！');
      }

      resetForm();
      fetchExperts();
    } catch (error) {
      alert('保存に失敗しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpert = async (id, name, avatar_url) => {
    if (!window.confirm(`「${name}」先生のデータを削除してもよろしいですか？`)) return;
    setLoading(true);
    try {
      if (avatar_url) {
        const fileName = avatar_url.split('/').pop();
        await supabase.storage.from('expert-avatars').remove([fileName]);
      }
      const { error } = await supabase.from('experts').delete().eq('id', id);
      if (error) throw error;
      if (editingId === id) resetForm();
      fetchExperts();
    } catch (error) {
      alert('削除に失敗しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpertVisibility = async (expert) => {
    const isCurrentlyVisible = expert.is_active !== false;
    const nextIsActive = !isCurrentlyVisible;
    const actionLabel = nextIsActive ? '再表示' : '非表示';

    if (!window.confirm(`「${expert.name}」先生を${actionLabel}にしますか？`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('experts')
        .update({ is_active: nextIsActive })
        .eq('id', expert.id);

      if (error) throw error;

      setExperts((prev) =>
        prev.map((item) =>
          item.id === expert.id ? { ...item, is_active: nextIsActive } : item
        )
      );

      if (editingId === expert.id && !nextIsActive) resetForm();
    } catch (error) {
      alert(
        '表示状態の変更に失敗しました: ' +
          error.message +
          '\n\nSupabase SQL Editorで以下を実行してください。\n' +
          'alter table public.experts add column if not exists is_active boolean not null default true;'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: 'white', fontSize: '15px', fontWeight: 'bold', borderBottom: '3px solid #526b5d', backgroundColor: '#1f2937' }}>
              🤝 専門家管理
            </div>
            <a href="/admin?tab=columns" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#9ca3af', textDecoration: 'none', fontSize: '15px', borderBottom: '3px solid transparent' }}>
              📝 コラム管理
            </a>
          </nav>
        </div>
        <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
          ログアウト
        </button>
      </header>

      <div style={{ maxWidth: '1000px', margin: '32px auto', padding: '0 24px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '32px', borderTop: editingId ? `6px solid ${colors.primary}` : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, color: '#111827', fontSize: '20px' }}>{editingId ? '✏️ 専門家の情報を編集' : '🤝 専門家の新規登録'}</h2>
            {editingId && <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>編集中</span>}
          </div>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: `1px dashed #cbd5e1` }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {avatarFile ? <img src={URL.createObjectURL(avatarFile)} alt="プレビュー" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : currentAvatarUrl ? <img src={currentAvatarUrl} alt="現在登録中の画像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '32px' }}>👤</span>}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>プロフィール写真 ({editingId ? '変更する場合のみ選択' : '任意'})</label>
                  <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} style={{ fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>名前（必須）</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="例: 伊予 太郎" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', color: '#1f2937', marginBottom: '8px', fontWeight: 'bold' }}>保有資格（複数選択可）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                {QUALIFICATION_OPTIONS.map(q => (
                  <label key={q} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}><input type="checkbox" checked={formData.qualifications.includes(q)} onChange={() => handleCheck('qualifications', q)} style={{ width: '16px', height: '16px', accentColor: colors.primary }} />{q}</label>
                ))}
              </div>
              <input type="text" value={formData.qualificationText} onChange={e => setFormData({...formData, qualificationText: e.target.value})} placeholder="その他の資格があれば入力（カンマ区切り）" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: '#1f2937', marginBottom: '8px', fontWeight: 'bold' }}>得意分野（複数選択可）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                {SPECIALTY_OPTIONS.map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}><input type="checkbox" checked={formData.specialties.includes(s)} onChange={() => handleCheck('specialties', s)} style={{ width: '16px', height: '16px', accentColor: colors.primary }} />{s}</label>
                ))}
              </div>
              <input type="text" value={formData.specialtyText} onChange={e => setFormData({...formData, specialtyText: e.target.value})} placeholder="その他の得意分野があれば入力（カンマ区切り）" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '13px' }} />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>対応エリア（必須）</label><input type="text" required value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} placeholder="例: 愛媛県全域" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></div>
              <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>公式HP・事務所URL</label><input type="url" value={formData.website_url} onChange={e => setFormData({...formData, website_url: e.target.value})} placeholder="https://..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></div>
            </div>

            <div><label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>自己紹介・アピールポイント</label><textarea rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }} /></div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {editingId && <button type="button" onClick={resetForm} disabled={loading} style={{ backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', flex: 1 }}>キャンセル</button>}
              <button type="submit" disabled={loading} style={{ backgroundColor: editingId ? '#0284c7' : colors.primary, color: 'white', border: 'none', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', flex: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                {loading ? '保存中...' : editingId ? '💾 変更を保存する' : '＋ 新規専門家を登録する'}
              </button>
            </div>
          </form>
        </div>

        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#334155' }}>📋 登録済みの専門家 ({experts.length}名)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {experts.map(exp => {
            const isVisible = exp.is_active !== false;

            return (
            <div key={exp.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: isVisible ? 'white' : '#f8fafc', opacity: editingId === exp.id ? 0.5 : isVisible ? 1 : 0.72 }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                {exp.avatar_url ? <img src={exp.avatar_url} alt={exp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>👤</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ backgroundColor: isVisible ? '#dcfce7' : '#e5e7eb', color: isVisible ? '#166534' : '#6b7280', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 'bold' }}>
                    {isVisible ? '表示中' : '非表示'}
                  </span>
                  <span style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>{exp.qualification}</span>
                  <strong style={{ fontSize: '16px', color: '#1e293b' }}>{exp.name}</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>📍 {exp.area} | 🏷 {exp.specialties?.join(' / ')}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEditExpert(exp)} disabled={loading || editingId === exp.id} style={{ backgroundColor: 'white', color: colors.primary, border: `1px solid ${colors.primary}`, padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: (loading || editingId === exp.id) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>編集</button>
                <button onClick={() => handleToggleExpertVisibility(exp)} disabled={loading || editingId === exp.id} style={{ backgroundColor: isVisible ? '#f8fafc' : '#ecfdf5', color: isVisible ? '#475569' : '#047857', border: isVisible ? '1px solid #cbd5e1' : '1px solid #10b981', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: (loading || editingId === exp.id) ? 'not-allowed' : 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  {isVisible ? '非表示' : '再表示'}
                </button>
                <button onClick={() => handleDeleteExpert(exp.id, exp.name, exp.avatar_url)} disabled={loading} style={{ backgroundColor: '#fee2e2', color: colors.danger, border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>削除</button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
