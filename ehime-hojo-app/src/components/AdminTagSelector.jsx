import React from 'react';
import { PURPOSE_TAGS, INDUSTRY_TAGS } from '../subsidyTags';

export default function AdminTagSelector({
  editForm,
  handleCheckboxChange,
  handleAutoPurposeTags,
  handleClearPurposeTags,
  handleAutoIndustryTags,
  handleClearIndustryTags,
}) {
  const selectedPurposeCount = Array.isArray(editForm.purposes)
    ? editForm.purposes.length
    : 0;

  const selectedIndustryCount = Array.isArray(editForm.industries)
    ? editForm.industries.length
    : 0;

  return (
    <>
      <hr
        style={{
          border: 0,
          borderTop: '1px dashed #d1d5db',
          marginBottom: '24px',
        }}
      />

      <div style={{ marginBottom: '32px' }}>
        <div style={sectionHeader}>
          <label style={sectionTitle}>
            🏷 利用目的タグ
            <span style={countText}>選択中 {selectedPurposeCount}件</span>
          </label>

          <div style={buttonRow}>
            <button type="button" onClick={handleAutoPurposeTags} style={primaryButton}>
              🤖 利用目的タグを自動選択
            </button>

            <button type="button" onClick={handleClearPurposeTags} style={subButton}>
              クリア
            </button>
          </div>
        </div>

        <div style={noteBox}>
          タイトル・概要・対象経費・対象事業者などから、利用目的タグだけを自動判定します。
          業種タグは変更しません。
        </div>

        <div style={tagGrid}>
          {PURPOSE_TAGS.map((tag) => (
            <label key={tag} style={tagLabel}>
              <input
                type="checkbox"
                checked={(editForm.purposes || []).includes(tag)}
                onChange={() => handleCheckboxChange('purposes', tag)}
                style={checkboxStyle}
              />
              {tag}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={sectionHeader}>
          <label style={sectionTitle}>
            🏢 業種タグ
            <span style={countText}>選択中 {selectedIndustryCount}件</span>
          </label>

          <div style={buttonRow}>
            <button type="button" onClick={handleAutoIndustryTags} style={primaryButton}>
              🤖 業種タグを自動選択
            </button>

            <button type="button" onClick={handleClearIndustryTags} style={subButton}>
              クリア
            </button>
          </div>
        </div>

        <div style={noteBox}>
          タイトル・概要・対象事業者などから、業種タグだけを自動判定します。
          利用目的タグは変更しません。
        </div>

        <div style={tagGrid}>
          {INDUSTRY_TAGS.map((tag) => (
            <label key={tag} style={tagLabel}>
              <input
                type="checkbox"
                checked={(editForm.industries || []).includes(tag)}
                onChange={() => handleCheckboxChange('industries', tag)}
                style={checkboxStyle}
              />
              {tag}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

const sectionHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  marginBottom: '16px',
  flexWrap: 'wrap',
};

const sectionTitle = {
  display: 'block',
  fontWeight: 'bold',
  color: '#374151',
  fontSize: '16px',
};

const countText = {
  marginLeft: '10px',
  fontSize: '12px',
  color: '#6b7280',
  fontWeight: 'normal',
};

const buttonRow = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const primaryButton = {
  border: '1px solid #0f7b6c',
  backgroundColor: '#0f7b6c',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const subButton = {
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#4b5563',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const noteBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '12px 14px',
  marginBottom: '16px',
  fontSize: '12px',
  color: '#6b7280',
  lineHeight: 1.7,
};

const tagGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '14px 20px',
};

const tagLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '14px',
  cursor: 'pointer',
  color: '#4b5563',
  lineHeight: 1.5,
};

const checkboxStyle = {
  width: '18px',
  height: '18px',
  cursor: 'pointer',
};
