import React from 'react';
import { isMissingValue } from '../subsidyTags';
import { parseAmountMaxYen } from '../adminEditHelpers';

export default function AdminDetailFields({ editForm, updateEditForm }) {
  return (
    <>
      <div
        style={{
          ...twoColumnGrid,
          backgroundColor: '#f8fafc',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
        }}
      >
        <div>
          <label style={labelStyle}>上限金額・助成額</label>
          <input
            type="text"
            value={editForm.amount_text || editForm.amount || ''}
            onChange={(e) => {
              const val = e.target.value;

              updateEditForm({
                amount_text: val,
                amount: val,
                amount_max_yen: parseAmountMaxYen(val),
              });
            }}
            style={getDynamicInputStyle(editForm.amount_text || editForm.amount)}
          />
        </div>

        <div>
          <label style={labelStyle}>補助率</label>
          <input
            type="text"
            value={editForm.subsidy_rate_text || editForm.subsidy_rate || ''}
            onChange={(e) =>
              updateEditForm({
                subsidy_rate_text: e.target.value,
                subsidy_rate: e.target.value,
              })
            }
            style={getDynamicInputStyle(
              editForm.subsidy_rate_text || editForm.subsidy_rate
            )}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>対象経費</label>
        <input
          type="text"
          value={
            editForm.target_expenses_arr?.length
              ? editForm.target_expenses_arr.join(' / ')
              : editForm.target_expenses || ''
          }
          onChange={(e) => {
            const val = e.target.value;

            updateEditForm({
              target_expenses: val,
              target_expenses_arr: val
                .split('/')
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          style={getDynamicInputStyle(
            editForm.target_expenses_arr?.length ? 'OK' : editForm.target_expenses
          )}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>対象事業者</label>
        <input
          type="text"
          value={
            editForm.target_entities_arr?.length
              ? editForm.target_entities_arr.join(' / ')
              : editForm.target_entities || ''
          }
          onChange={(e) => {
            const val = e.target.value;

            updateEditForm({
              target_entities: val,
              target_entities_arr: val
                .split('/')
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          style={getDynamicInputStyle(
            editForm.target_entities_arr?.length ? 'OK' : editForm.target_entities
          )}
        />
      </div>

      <div style={{ marginBottom: '32px' }}>
        <label style={labelStyle}>概要 (目的など)</label>
        <textarea
          value={editForm.summary || ''}
          onChange={(e) => updateEditForm({ summary: e.target.value })}
          style={{
            ...getDynamicInputStyle(editForm.summary),
            minHeight: '80px',
          }}
        />
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

const twoColumnGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px',
  marginBottom: '20px',
};