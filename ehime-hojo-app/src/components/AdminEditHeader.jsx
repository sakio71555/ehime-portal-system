import React from 'react';

export default function AdminEditHeader({
  editForm,
  onBack,
  handleDelete,
  handleSave,
  handleTogglePublish,
}) {
  const isPublished = editForm?.crawl_status === 'published';

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(4px)',
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
      }}
    >
      <h2 style={{ fontSize: '18px', margin: 0, color: '#1f2937' }}>
        ✏️ データ編集・タグ付け
      </h2>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={buttonStyle.white}>
          🔙 戻る
        </button>

        <button onClick={handleDelete} style={buttonStyle.danger}>
          🗑 削除
        </button>

        <button onClick={handleSave} style={buttonStyle.primary}>
          💾 保存
        </button>

        <button
          onClick={handleTogglePublish}
          style={isPublished ? buttonStyle.gray : buttonStyle.green}
        >
          {isPublished ? '📝 承認待ちに戻す' : '✅ 公開する'}
        </button>
      </div>
    </div>
  );
}

const baseButton = {
  padding: '10px 16px',
  borderRadius: '8px',
  fontWeight: 'bold',
  cursor: 'pointer',
  border: 'none',
  fontSize: '14px',
  whiteSpace: 'nowrap',
};

const buttonStyle = {
  white: {
    ...baseButton,
    backgroundColor: 'white',
    color: '#4b5563',
    border: '1px solid #d1d5db',
  },
  danger: {
    ...baseButton,
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  primary: {
    ...baseButton,
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  green: {
    ...baseButton,
    backgroundColor: '#059669',
    color: 'white',
  },
  gray: {
    ...baseButton,
    backgroundColor: '#6b7280',
    color: 'white',
  },
};