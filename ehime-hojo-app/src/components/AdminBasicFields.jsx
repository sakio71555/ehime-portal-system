import React from 'react';
import { isMissingValue } from '../subsidyTags';

export default function AdminBasicFields({
  editForm,
  updateEditForm,
  setEditForm,
  currentApplicationStatus,
}) {
  return (
    <>
      <div style={{ marginBottom: '20px' }}>
        <div style={rowBetween}>
          <label style={labelStyle}>タイトル</label>

          {editForm.title && (
            <button
              onClick={(e) => {
                e.preventDefault();
                window.open(
                  `https://www.google.com/search?q=${encodeURIComponent(editForm.title)}`,
                  '_blank'
                );
              }}
              style={smallBlueButton}
            >
              🔍 Google検索
            </button>
          )}
        </div>

        <input
          type="text"
          value={editForm.title || ''}
          onChange={(e) => updateEditForm({ title: e.target.value })}
          style={getDynamicInputStyle(editForm.title)}
        />
      </div>

      <div style={twoColumnGrid}>
        <div>
          <label style={labelStyle}>地域</label>
          <input
            type="text"
            value={editForm.region_text || editForm.region || ''}
            onChange={(e) => updateEditForm({ region_text: e.target.value })}
            style={getDynamicInputStyle(editForm.region_text || editForm.region)}
          />
        </div>

        <div>
          <label style={labelStyle}>実施機関</label>
          <input
            type="text"
            value={editForm.organization || ''}
            onChange={(e) => updateEditForm({ organization: e.target.value })}
            style={getDynamicInputStyle(editForm.organization)}
          />
        </div>

        <div>
          <label style={labelStyle}>公募ステータス</label>
          <select
            value={currentApplicationStatus}
            onChange={(e) => {
              setEditForm({
                ...editForm,
                application_status: e.target.value,
              });
            }}
            style={getDynamicInputStyle(currentApplicationStatus)}
          >
            <option value="公募中">🟢 公募中</option>
            <option value="予告">🟡 予告 (開始前)</option>
            <option value="受付終了">🔴 受付終了</option>
            <option value="不明">⚪️ 不明</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>申請期間</label>
          <input
            type="text"
            value={editForm.application_period_text || editForm.deadline || ''}
            onChange={(e) =>
              updateEditForm({
                application_period_text: e.target.value,
                deadline: e.target.value,
              })
            }
            style={getDynamicInputStyle(
              editForm.application_period_text || editForm.deadline
            )}
          />
        </div>
      </div>

      <div style={twoColumnGrid}>
        <div>
          <div style={rowBetween}>
            <label style={labelStyle}>✨ 公式公募ページ (ユーザー向け)</label>

            {editForm.official_url && editForm.official_url.startsWith('http') && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  window.open(editForm.official_url, '_blank');
                }}
                style={smallBlueButton}
              >
                ↗ 開く
              </button>
            )}
          </div>

          <input
            type="text"
            value={editForm.official_url || ''}
            onChange={(e) => updateEditForm({ official_url: e.target.value })}
            style={getDynamicInputStyle(editForm.official_url)}
          />
        </div>

        <div
          style={{
            backgroundColor: '#f9fafb',
            padding: '12px',
            borderRadius: '8px',
            border: '1px dashed #d1d5db',
          }}
        >
          <div style={rowBetween}>
            <label
              style={{
                fontWeight: 'bold',
                color: '#6b7280',
                fontSize: '12px',
              }}
            >
              🔗 取得元URL (システム管理・追跡用)
            </label>

            {editForm.source_url && editForm.source_url.startsWith('http') && (
              <a
                href={editForm.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: '#6b7280' }}
              >
                元ページを確認
              </a>
            )}
          </div>

          <div
            style={{
              fontSize: '13px',
              color: '#9ca3af',
              marginTop: '4px',
              wordBreak: 'break-all',
            }}
          >
            {editForm.source_url || 'なし'}
          </div>
        </div>
      </div>
    </>
  );
}

const labelStyle = {
  display: 'block',
  fontWeight: 'bold',
  marginBottom: '8px',
  color: '#374151',
  fontSize: '14px',
};

const getDynamicInputStyle = (value) => ({
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  color: '#1f2937',
  fontSize: '14px',
  boxSizing: 'border-box',
  backgroundColor: isMissingValue(value) ? '#fee2e2' : 'white',
  borderColor: isMissingValue(value) ? '#fca5a5' : '#d1d5db',
});

const rowBetween = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
  gap: '8px',
};

const twoColumnGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px',
  marginBottom: '20px',
};

const smallBlueButton = {
  fontSize: '12px',
  color: '#2563eb',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 12px',
  backgroundColor: '#eff6ff',
  borderRadius: '4px',
  border: '1px solid #bfdbfe',
  cursor: 'pointer',
};