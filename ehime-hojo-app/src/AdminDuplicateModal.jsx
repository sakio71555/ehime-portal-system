import React from 'react';

export default function AdminDuplicateModal({ duplicateGroups, onClose, onDraftItem, onNotDuplicate, onOpenItemById }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ marginTop: 0, fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>🧹 重複データの確認</h2>
        <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
          以下のデータが「重複（同じ補助金）」として検出されました。<br/>
          別々の補助金の場合は<span style={{ color: '#059669', fontWeight: 'bold' }}>「✨残す(除外)」</span>を、不要なデータは<span style={{ color: '#92400e', fontWeight: 'bold' }}>「📝非公開にする」</span>を押してください。<br/>
          （※グループの残りデータが1件になると自動でこのリストから消滅します）
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
          {duplicateGroups.map((group, groupIndex) => (
            <div key={groupIndex} style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#f3f4f6', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', borderBottom: '1px solid #d1d5db' }}>
                重複グループ {groupIndex + 1}
              </div>
              
              {group.map((item, itemIndex) => (
                <div key={item.id} style={{ padding: '16px', borderBottom: itemIndex === group.length - 1 ? 'none' : '1px solid #e5e7eb', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
                    <button 
                      onClick={() => onNotDuplicate(groupIndex, item.id)}
                      style={{ backgroundColor: '#10b981', color: 'white', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      ✨ 残す (除外)
                    </button>
                    <button 
                      onClick={() => onDraftItem(groupIndex, item)}
                      style={{ backgroundColor: '#f59e0b', color: '#111827', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      📝 非公開にする
                    </button>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                      {/* 🔥 UPDATE: status ➔ crawl_status に変更 */}
                      ステータス: <span style={{ fontWeight: 'bold' }}>{item.crawl_status === 'published' ? '✅ 公開中' : item.crawl_status === 'archived' ? '📁 募集終了' : '📝 承認待ち'}</span> | 
                      機関: {item.organization || '不明'}
                    </div>
                    {(item.admin_note || item.duplicate_of_id || item.duplicate_reason) && (
                      <div style={adminReviewNoticeStyle}>
                        <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '4px' }}>
                          ⚠ 重複候補・非公開理由あり
                        </div>
                        {item.duplicate_of_id && (
                          <div>
                            正データID:{' '}
                            {onOpenItemById ? (
                              <button
                                type="button"
                                onClick={() => onOpenItemById(item.duplicate_of_id)}
                                style={inlineLinkButton}
                              >
                                {item.duplicate_of_id}を開く
                              </button>
                            ) : (
                              <strong>{item.duplicate_of_id}</strong>
                            )}
                          </div>
                        )}
                        {item.duplicate_reason && <div>理由: {item.duplicate_reason}</div>}
                        {item.admin_note && <div>メモ: {item.admin_note}</div>}
                      </div>
                    )}
                  </div>
                  
                </div>
              ))}
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#4b5563', fontWeight: 'bold', cursor: 'pointer' }}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

const adminReviewNoticeStyle = {
  backgroundColor: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '8px',
  color: '#78350f',
  fontSize: '12px',
  lineHeight: 1.6,
  marginTop: '10px',
  maxHeight: '120px',
  overflowY: 'auto',
  padding: '8px 10px',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
};

const inlineLinkButton = {
  backgroundColor: 'transparent',
  border: 'none',
  color: '#2563eb',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 'bold',
  padding: 0,
  textDecoration: 'underline',
};
