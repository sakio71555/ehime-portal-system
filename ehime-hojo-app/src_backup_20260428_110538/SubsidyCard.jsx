import React from 'react';
// 🔥 ここから parseAmount を削除しました
import { isItemClosed, getPurposeTagList, getItemRegionCategories } from './portalHelpers';

export default function SubsidyCard({ item }) {
  const isClosed = isItemClosed(item);

  // カードをクリックしたときに詳細ページへ移動
  const handleCardClick = () => {
    window.location.href = `/subsidy/${item.id}`;
  };

  const purposeTags = getPurposeTagList(item);
  const regionTags = getItemRegionCategories(item);
  const tags = [...new Set([...purposeTags, ...regionTags])].filter(Boolean);

  return (
    <div 
      onClick={handleCardClick}
      style={{ 
        backgroundColor: 'white', 
        borderRadius: '16px', 
        border: '1px solid #e2e8f0', 
        padding: '24px', 
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        position: 'relative',
        height: '100%',
        boxSizing: 'border-box'
      }}
      onMouseOver={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
         <span style={{ 
           backgroundColor: isClosed ? '#9ca3af' : '#0f7b6c', 
           color: 'white', 
           padding: '4px 12px', 
           borderRadius: '4px', 
           fontSize: '12px', 
           fontWeight: 'bold',
           whiteSpace: 'nowrap'
         }}>
           {isClosed ? '受付終了' : '公募中'}
         </span>
      </div>

      <h3 style={{ margin: 0, fontSize: '18px', color: '#111827', lineHeight: '1.4', fontWeight: 'bold' }}>
        {item.organization ? `${item.organization}：` : ''}「{item.title}」
      </h3>

      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          📍 {item.region_text || '愛媛県'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          📅 申請期間: {item.deadline || '随時募集'}
        </span>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
         <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>上限金額</div>
         <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', lineHeight: '1.4' }}>
           {item.amount_text || item.amount || '公式ページをご確認ください'}
         </div>
      </div>

      <p style={{ margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {item.summary}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 'auto' }}>
        {tags.slice(0, 5).map((tag, idx) => (
          <span key={idx} style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', border: '1px solid #a7f3d0' }}>
            {tag}
          </span>
        ))}
      </div>

      {/* 下部のボタンエリア */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0' }}>
        <span style={{ color: '#0f7b6c', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          詳細ページを見る <span>→</span>
        </span>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '10px', color: '#9ca3af', width: '120px', lineHeight: '1.2', textAlign: 'right' }}>
            文章等に誤りがある場合がありますので必ず公式サイトでご確認ください。
          </span>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              window.open(item.official_url || item.source_url, '_blank'); 
            }}
            style={{ backgroundColor: '#e76305', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            公式サイトへ
          </button>
        </div>
      </div>

    </div>
  );
}