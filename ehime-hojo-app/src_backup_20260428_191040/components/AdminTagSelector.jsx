import React from 'react';
import { PURPOSE_TAGS, INDUSTRY_TAGS } from '../subsidyTags';

export default function AdminTagSelector({ editForm, handleCheckboxChange }) {
  return (
    <>
      <hr
        style={{
          border: 0,
          borderTop: '1px dashed #d1d5db',
          marginBottom: '24px',
        }}
      />

      <div style={{ marginBottom: '24px' }}>
        <label
          style={{
            display: 'block',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: '#374151',
            fontSize: '16px',
          }}
        >
          🏷 利用目的タグ
        </label>

        <div style={tagGrid}>
          {PURPOSE_TAGS.map((tag) => (
            <label key={tag} style={tagLabel}>
              <input
                type="checkbox"
                checked={(editForm.purposes || []).includes(tag)}
                onChange={() => handleCheckboxChange('purposes', tag)}
              />
              {tag}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'block',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: '#374151',
            fontSize: '16px',
          }}
        >
          🏢 業種タグ
        </label>

        <div style={tagGrid}>
          {INDUSTRY_TAGS.map((tag) => (
            <label key={tag} style={tagLabel}>
              <input
                type="checkbox"
                checked={(editForm.industries || []).includes(tag)}
                onChange={() => handleCheckboxChange('industries', tag)}
              />
              {tag}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

const tagGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '10px',
};

const tagLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  cursor: 'pointer',
  color: '#4b5563',
};