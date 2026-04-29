import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const colors = { primary: '#526b5d', primaryLight: '#f4f6f5', textMain: '#4b5550', textSub: '#8b9690', border: '#e4e7e5' };

export default function ExpertsPage() {
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExperts() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.from('experts').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setExperts(data || []);
      } catch (err) {
        console.error('専門家データの取得エラー:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchExperts();
  }, []);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 24px 80px' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{ fontSize: '28px', color: '#111827', marginBottom: '16px', fontWeight: '800' }}>🤝 専門家を探す</h2>
        <p style={{ color: colors.textSub, fontSize: '15px', lineHeight: '1.6' }}>
          補助金・助成金の申請をサポートしてくれる愛媛県内の専門家一覧です。<br />
          気になる専門家がいれば、直接お問い合わせしてみてください。
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textSub, fontSize: '15px' }}>⏳ 専門家のデータを読み込んでいます...</div>
      ) : experts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', backgroundColor: 'white', borderRadius: '16px', border: `1px solid ${colors.border}`, color: colors.textSub }}>現在、登録されている専門家はいません。</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {experts.map((expert) => (
            <div key={expert.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '24px', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: colors.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: `1px solid ${colors.border}` }}>
                  {expert.avatar_url ? <img src={expert.avatar_url} alt={expert.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '28px' }}>👤</span>}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: colors.primary, marginBottom: '4px', lineHeight: '1.3' }}>{expert.qualification}</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>{expert.name}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px dashed ${colors.border}` }}>
                <div style={{ fontSize: '13px', color: colors.textMain, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ flexShrink: 0 }}>📍</span><span>{expert.area}</span>
                </div>
                <div style={{ fontSize: '13px', color: colors.textMain, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ flexShrink: 0 }}>🏷</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {expert.specialties && expert.specialties.length > 0 ? expert.specialties.map((spec, i) => (
                      <span key={i} style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{spec}</span>
                    )) : <span>-</span>}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: colors.textSub, marginBottom: '8px' }}>メッセージ・強み</div>
                <p style={{ margin: 0, fontSize: '13px', color: colors.textMain, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{expert.description || 'よろしくお願いいたします。'}</p>
              </div>

              <div style={{ marginTop: '24px' }}>
                {expert.website_url ? (
                  <button onClick={() => window.open(expert.website_url, '_blank')} style={{ width: '100%', padding: '12px', backgroundColor: 'white', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} onMouseOver={e => {e.currentTarget.style.backgroundColor = colors.primary; e.currentTarget.style.color = 'white';}} onMouseOut={e => {e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = colors.primary;}}>
                    公式HPから相談する ↗
                  </button>
                ) : (
                  <button disabled style={{ width: '100%', padding: '12px', backgroundColor: '#f9fafb', color: '#9ca3af', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'not-allowed' }}>
                    連絡先 準備中
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}