import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  const footerLinks = [
    { label: 'トップ', page: 'top' },
    { label: '補助金を探す', page: 'search' },
    { label: '特集から探す', page: 'features' },
    { label: '専門家を探す', page: 'experts' },
    { label: 'シミュレーター', page: 'simulator' },
    { label: 'お役立ちコラム', page: 'columns' },
    { label: 'はじめての方へ', page: 'beginners' },
  ];

  const handleNavigation = (page) => {
    window.scrollTo(0, 0);

    if (page === 'top' || page === 'home') {
      navigate('/');
      return;
    }

    navigate(`/${page}`);
  };

  return (
    <footer
      style={{
        backgroundColor: '#303030',
        borderTop: '14px solid #f0df00',
        color: 'white',
        padding: '56px 40px 20px',
        marginTop: 'auto',
      }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid rgba(255,255,255,0.14)',
            paddingBottom: '40px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '32px',
          }}
        >
          {/* 左側：ロゴと説明 */}
          <div>
            <div
              onClick={() => handleNavigation('top')}
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#ffffff',
                fontFamily:
                  '"Hiragino Maru Gothic ProN", "ヒラギノ丸ゴ ProN W4", "Zen Maru Gothic", "Arial Rounded MT Bold", sans-serif',
                marginBottom: '16px',
                cursor: 'pointer',
                letterSpacing: '1px',
              }}
            >
              えひめの補助金
            </div>

            <div
              style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.86)',
                lineHeight: '1.6',
              }}
            >
              愛媛県の事業者を応援する
              <br />
              補助金・助成金の検索・相談サポートサイト
            </div>
          </div>

          {/* 右側：ナビゲーション */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.9)',
              flexWrap: 'wrap',
              maxWidth: '620px',
              justifyContent: 'flex-end',
            }}
          >
            {footerLinks.map((link) => (
              <button
                key={link.page}
                type="button"
                onClick={() => handleNavigation(link.page)}
                style={{
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  color: 'rgba(255, 255, 255, 0.9)',
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  font: 'inherit',
                  lineHeight: '1.6',
                  whiteSpace: 'nowrap',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                }}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        {/* 下部：コピーライトと免責事項 */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.72)',
            lineHeight: '1.8',
          }}
        >
          ※掲載情報はAIにより収集・整理されています。ご利用の際は必ず公式ページをご確認ください。
          <br />
          &copy; 2026 愛媛の補助金ポータル All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
