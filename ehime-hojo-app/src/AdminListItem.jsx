import React from 'react';

const EXTERNAL_PORTALS = [
  'hojyokin-portal.jp', 'smart-hojokin.jp', 'subsidy-el.jp', 'biz-supporter.com',
  'tokyo-kosha.or.jp', 'lycorp.co.jp', 'yahoo.co.jp', 'prtimes.jp', 'note.com',
  'j-net21.smrj.go.jp', 'mirasapo-plus.go.jp', 'navinavi', 'shikin-pro',
  'kamome-ops.com', 'financeinjapan.com'
];

const isOfficialDomain = (url) => {
  if (!url) return false;
  return url.includes('.go.jp') || url.includes('.lg.jp') || url.includes('.or.jp') || 
         url.includes('.ehime.jp') || url.includes('city.') || url.includes('pref.') || url.includes('town.');
};

const isExternalPortal = (url) => {
  if (!url) return false;
  return EXTERNAL_PORTALS.some(domain => url.includes(domain)) || 
         (url.includes('hojokin') && !isOfficialDomain(url));
};

const isMissingValue = (val) => {
  if (!val) return true; 
  const s = val.toString();
  return s.includes('未記載') || s.includes('不明') || s.includes('未設定') || s.includes('未具体化') || s.includes('要確認');
};

const getMissingFields = (item) => {
  const missing = [];
  if (isMissingValue(item.amount_text || item.amount)) missing.push('金額');
  if (isMissingValue(item.application_period_text || item.deadline)) missing.push('申請期間');
  if (isMissingValue((item.target_entities_arr || []).join('') || item.target_entities)) missing.push('対象事業者');
  if (isMissingValue((item.target_expenses_arr || []).join('') || item.target_expenses)) missing.push('対象経費');
  if (isMissingValue(item.subsidy_rate_text || item.subsidy_rate)) missing.push('補助率');
  return missing;
};

const hasAdminReviewNote = (item) =>
  Boolean(item?.admin_note || item?.duplicate_of_id || item?.duplicate_reason);

const AdminReviewNotice = ({ item, onOpenDuplicateTarget }) => {
  if (!hasAdminReviewNote(item)) return null;

  return (
    <div style={adminReviewNoticeStyle}>
      <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '4px' }}>
        ⚠ 重複候補・非公開理由あり
      </div>
      {item.duplicate_of_id && (
        <div>
          正データID:{' '}
          {onOpenDuplicateTarget ? (
            <button
              type="button"
              onClick={() => onOpenDuplicateTarget(item.duplicate_of_id)}
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
  );
};

export default function AdminListItem({ item, tab, onEdit, onDelete, onToggleVisibility, onArchive, onRestore, onOpenDuplicateTarget }) {
  const missingFields = getMissingFields(item);
  
  // 🔥 UPDATE: official_url を優先して外部ポータル判定を行う
  const targetUrl = item.official_url || item.source_url;
  const isPortalUrl = isExternalPortal(targetUrl);

  // 承認待ちタブのデザイン
  if (tab === 'drafts') {
    return (
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ flex: 1, paddingRight: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>未確認</span>
            
            <span style={{ backgroundColor: '#e0f2fe', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #bae6fd' }}>
              📍 {item.region_text || item.region || '地域不明'}
            </span>
            
            <span style={{ fontSize: '12px', color: '#6b7280' }}>🏢 {item.organization || '実施機関不明'}</span>
          </div>
          
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1f2937', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span>{item.title}</span>
            {isPortalUrl && <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #fca5a5' }}>⚠️ 外部ポータルURL</span>}
          </h3>
          
          <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '6px' }}>💰 {item.amount_text || item.amount || '不明'} | ⏰ {item.application_period_text || item.deadline || '不明'}</div>
          
          {missingFields.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {missingFields.map(field => (
                <span key={field} style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #fca5a5' }}>⚠️ {field}未記載</span>
              ))}
            </div>
          )}

          <AdminReviewNotice item={item} onOpenDuplicateTarget={onOpenDuplicateTarget} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onDelete} style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}>削除</button>
          <button onClick={onEdit} style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}>確認・編集する</button>
        </div>
      </div>
    );
  }

  // 公開中タブのデザイン
  if (tab === 'published') {
    return (
      <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: item.is_active ? '4px solid #059669' : '4px solid #9ca3af', opacity: item.is_active ? 1 : 0.7 }}>
        <div style={{ flex: 1, paddingRight: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ backgroundColor: '#e0f2fe', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #bae6fd' }}>
              📍 {item.region_text || item.region || '地域不明'}
            </span>
            
            <span style={{ fontSize: '12px', color: '#6b7280' }}>🏢 {item.organization || '実施機関不明'}</span>
          </div>
          
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: item.is_active ? '#1f2937' : '#6b7280', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span>{item.title}</span>
            {isPortalUrl && <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #fca5a5' }}>⚠️ 外部ポータルURL</span>}
          </h3>
          
          <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '6px', display: 'flex', gap: '16px' }}>
            <span>💰 {item.amount_text || item.amount || '不明'}</span>
            <span>⏰ 締切: {item.application_period_text || item.deadline || '不明'}</span>
          </div>

          <AdminReviewNotice
            item={item}
            onOpenDuplicateTarget={onOpenDuplicateTarget}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', marginRight: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: item.is_active ? '#059669' : '#6b7280', minWidth: '60px', textAlign: 'right' }}>{item.is_active ? '🟢 公開中' : '⚫️ 非公開'}</span>
            <div onClick={onToggleVisibility} style={{ width: '44px', height: '24px', backgroundColor: item.is_active ? '#10b981' : '#e5e7eb', borderRadius: '999px', position: 'relative', transition: 'all 0.3s' }}>
              <div style={{ width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: item.is_active ? '23px' : '3px', transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </label>
          <button onClick={onArchive} style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>📁 募集終了にする</button>
          <button onClick={onEdit} style={{ backgroundColor: 'white', color: '#4b5563', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #d1d5db' }}>編集</button>
        </div>
      </div>
    );
  }

  // 募集終了タブのデザイン
  return (
    <div style={{ backgroundColor: '#f9fafb', padding: '20px 24px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e5e7eb', borderLeft: '4px solid #d97706' }}>
      <div style={{ flex: 1, paddingRight: '20px', opacity: 0.7 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ backgroundColor: '#e5e7eb', color: '#4b5563', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>募集終了</span>
          
          <span style={{ backgroundColor: '#e0f2fe', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #bae6fd' }}>
            📍 {item.region_text || item.region || '地域不明'}
          </span>
          
          <span style={{ fontSize: '12px', color: '#6b7280' }}>🏢 {item.organization || '実施機関不明'}</span>
        </div>
        
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#4b5563', textDecoration: 'line-through', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span>{item.title}</span>
          {isPortalUrl && <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #fca5a5' }}>⚠️ 外部ポータルURL</span>}
        </h3>
        
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px', display: 'flex', gap: '16px' }}>
          <span>💰 {item.amount_text || item.amount || '不明'}</span>
          <span>⏰ 元の締切: {item.application_period_text || item.deadline || '不明'}</span>
        </div>

        <AdminReviewNotice item={item} onOpenDuplicateTarget={onOpenDuplicateTarget} />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onRestore} style={{ backgroundColor: 'white', color: '#059669', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #10b981', whiteSpace: 'nowrap' }}>⬆️ 公開に戻す</button>
        <button onClick={onDelete} style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}>削除</button>
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
  marginTop: '12px',
  maxHeight: '120px',
  overflowY: 'auto',
  padding: '10px 12px',
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
