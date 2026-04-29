import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabaseの接続設定を追加
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const colors = { primary: '#526b5d', primaryLight: '#f4f6f5', textMain: '#4b5550', textSub: '#8b9690', border: '#e4e7e5' };

const STEPS = [
  { title: '情報収集・制度の理解', desc: '自社の目的に合った補助金を探し、公募要領（ルールブック）をしっかり読み込みます。' },
  { title: '事業計画書の作成', desc: '「なぜその事業が必要か」「どうやって売上を上げるか」を論理的に説明する書類を作成します。専門家に相談するのもおすすめです。' },
  { title: '電子申請', desc: '現在、多くの補助金が「jGrants」などのシステムを使った電子申請になっています。事前に「GビズIDプライムアカウント」の取得が必要です。' },
  { title: '審査・採択', desc: '提出した計画書が審査され、合格（採択）すると通知が届きます。※この時点ではまだお金はもらえません！' },
  { title: '事業の実施・報告', desc: '交付決定後に発注や支払いを行い、事業が終わったら「実績報告書」を提出します。その後、ようやく補助金が振り込まれます。' }
];

const FAQS = [
  { q: '補助金と助成金はどう違うの？', a: '一般的に、「補助金」は予算の上限や審査があり、要件を満たしても必ずもらえるとは限りません。「助成金（主に厚労省系）」は、要件を満たしていれば原則として受給可能です。' },
  { q: '申請すればすぐにお金がもらえるの？', a: 'いいえ。原則として「後払い」です。事業を実施して経費を全額自分で支払った後、実績報告をしてから振り込まれます。そのため、事前の資金繰りが重要になります。' },
  { q: '申請は自分一人でできる？', a: '可能ですが、専門的な知識や事業計画の作成スキルが求められることが多いため、初めての場合は専門家（認定支援機関など）のサポートを受けることをお勧めします。' }
];

export default function BeginnersPage() {
  const [openFaq, setOpenFaq] = useState(null);
  
  // 🔥 新規追加：辞書記事を保存するステート
  const [dictionaryArticles, setDictionaryArticles] = useState([]);
  const [loadingDict, setLoadingDict] = useState(true);

  // 🔥 新規追加：データベースから「基礎知識」または「用語解説」のコラムを自動取得
  useEffect(() => {
    async function fetchDictionary() {
      if (!supabase) {
        setLoadingDict(false);
        return;
      }
      const { data, error } = await supabase
        .from('columns')
        .select('title, slug, category')
        .eq('is_published', true)
        .in('category', ['基礎知識', '用語解説']) // カテゴリがこれのものを取得
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDictionaryArticles(data);
      }
      setLoadingDict(false);
    }
    fetchDictionary();
  }, []);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 24px 80px' }}>
      
      <div style={{ textAlign: 'center', fontSize: '15px', color: '#374151', marginBottom: '32px', lineHeight: '1.8' }}>
        掲載している情報は、AIを活用して収集・整理したデータをもとに作成しております。そのため、内容に誤りや最新情報との相違が含まれる可能性がございます。<br />
        ご利用の際は、必ず各制度・事業の公式ページにて最新かつ正確な情報をご確認くださいますようお願いいたします。
      </div>

      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{ fontSize: '28px', color: '#111827', marginBottom: '16px', fontWeight: '800' }}>🔰 はじめての方へ</h2>
        <p style={{ color: colors.textSub, fontSize: '15px', lineHeight: '1.6' }}>補助金・助成金の基本知識から、申請から受給までの流れを分かりやすく解説します。</p>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: `1px solid ${colors.border}`, marginBottom: '32px', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '20px', color: colors.primary, marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💡</span> 補助金とは？融資との違い
          </h3>
          <p style={{ fontSize: '15px', color: colors.textMain, lineHeight: '1.8', margin: 0 }}>
            補助金は、国や自治体が事業者の「新たな挑戦」や「課題解決」をサポートするために支給する資金です。<br/><br/>
            銀行からの融資（借金）とは異なり、要件を満たして正しく事業を実施すれば、<strong style={{ color: '#dc2626' }}>原則として返済の必要がありません。</strong>ただし、審査があるため全員がもらえるわけではなく、事前のしっかりとした事業計画づくりが鍵となります。
          </p>
        </section>

        <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: `1px solid ${colors.border}`, marginBottom: '32px', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '20px', color: colors.primary, marginTop: 0, marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🚀</span> 申請から受給までの流れ
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {STEPS.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: colors.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 1 }}>
                    {idx + 1}
                  </div>
                  {idx !== STEPS.length - 1 && <div style={{ width: '2px', flex: 1, backgroundColor: colors.border, marginTop: '8px' }} />}
                </div>
                <div style={{ paddingBottom: idx !== STEPS.length - 1 ? '24px' : '0' }}>
                  <h4 style={{ margin: '4px 0 8px 0', fontSize: '16px', color: '#111827' }}>{step.title}</h4>
                  <p style={{ margin: 0, fontSize: '14px', color: colors.textMain, lineHeight: '1.6' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: `1px solid ${colors.border}`, marginBottom: '32px', boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '20px', color: colors.primary, marginTop: 0, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>❓</span> よくある質問
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FAQS.map((faq, idx) => (
              <div key={idx} style={{ border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  style={{ width: '100%', padding: '16px', textAlign: 'left', backgroundColor: openFaq === idx ? colors.primaryLight : 'white', border: 'none', fontSize: '15px', fontWeight: 'bold', color: '#111827', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span><span style={{ color: colors.primary, marginRight: '8px' }}>Q.</span>{faq.q}</span>
                  <span>{openFaq === idx ? '▲' : '▼'}</span>
                </button>
                {openFaq === idx && (
                  <div style={{ padding: '16px', backgroundColor: 'white', borderTop: `1px solid ${colors.border}`, fontSize: '14px', color: colors.textMain, lineHeight: '1.6' }}>
                    <span style={{ color: '#dc2626', fontWeight: 'bold', marginRight: '8px' }}>A.</span>{faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 🔥 ここを全自動化しました！ */}
        <section style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', border: `1px solid ${colors.border}`, boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '20px', color: colors.primary, marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📖</span> 補助金の用語辞典
          </h3>
          <p style={{ fontSize: '14px', color: colors.textMain, marginBottom: '24px', lineHeight: '1.6' }}>
            公募要領でよく見かける専門用語を、初心者向けにわかりやすく解説しています。
          </p>
          
          {loadingDict ? (
            <div style={{ color: colors.textSub, fontSize: '14px', textAlign: 'center', padding: '20px' }}>⏳ 用語辞典を読み込み中...</div>
          ) : dictionaryArticles.length === 0 ? (
            <div style={{ color: colors.textSub, fontSize: '14px', textAlign: 'center', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>現在、登録されている用語解説はありません。</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {dictionaryArticles.map((article) => (
                <a key={article.slug} href={`/column/${article.slug}`} style={{ display: 'block', padding: '16px', backgroundColor: colors.primaryLight, borderRadius: '8px', textDecoration: 'none', color: '#111827', fontWeight: 'bold', border: `1px solid ${colors.border}`, transition: 'all 0.2s', lineHeight: '1.4' }} onMouseOver={e => e.currentTarget.style.borderColor = colors.primary} onMouseOut={e => e.currentTarget.style.borderColor = colors.border}>
                  🔰 {article.title}
                </a>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}