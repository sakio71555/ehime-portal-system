import React from 'react';
import { isMissingValue } from '../subsidyTags';

export default function AdminBasicFields({
  editForm,
  updateEditForm,
  setEditForm,
  currentApplicationStatus,
  onOpenItemById,
}) {
  const applicationPeriodValue =
    editForm.application_period_text || editForm.deadline || '';
  const hasTitle = Boolean(String(editForm.title || '').trim());
  const shouldShowAskAiButton =
    hasTitle && isMissingValue(applicationPeriodValue);

  const handleAskAiAboutApplicationPeriod = async (e) => {
    e.preventDefault();

    const prompt = buildApplicationPeriodPrompt(editForm);

    try {
      await copyTextToClipboard(prompt);
    } catch (err) {
      console.warn('申請期間確認プロンプトのコピーに失敗しました:', err);
    }

    window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
  };

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
          <div style={rowBetween}>
            <label style={labelStyle}>申請期間</label>

            {shouldShowAskAiButton && (
              <button
                onClick={handleAskAiAboutApplicationPeriod}
                style={smallPurpleButton}
                title="申請期間確認用のプロンプトをコピーしてChatGPTを開きます。開いたら貼り付けてください。"
              >
                🤖 AIに聞く
              </button>
            )}
          </div>

          <input
            type="text"
            value={applicationPeriodValue}
            onChange={(e) =>
              updateEditForm({
                application_period_text: e.target.value,
                deadline: e.target.value,
              })
            }
            style={getDynamicInputStyle(applicationPeriodValue)}
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

      <div style={adminNoteSection}>
        <div style={{ marginBottom: '12px' }}>
          <div style={adminNoteTitle}>⚠ 管理メモ・非公開理由</div>
          <div style={adminNoteHelp}>
            重複・非公開理由など、公開判断で見落としたくない運用メモを残します。ユーザー画面には表示されません。
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>管理メモ</label>
          <textarea
            value={editForm.admin_note || ''}
            onChange={(e) => updateEditForm({ admin_note: e.target.value })}
            rows={3}
            placeholder="例：重複候補。正データはID 1570。1570を優先。"
            style={textareaStyle}
          />
        </div>

        <div style={twoColumnGridNoMargin}>
          <div>
            <div style={rowBetween}>
              <label style={labelStyle}>重複元ID</label>
              {editForm.duplicate_of_id && onOpenItemById && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenItemById(editForm.duplicate_of_id);
                  }}
                  style={smallTextLinkButton}
                >
                  正データID {editForm.duplicate_of_id} を開く
                </button>
              )}
            </div>
            <input
              type="number"
              min="1"
              value={editForm.duplicate_of_id || ''}
              onChange={(e) =>
                updateEditForm({ duplicate_of_id: e.target.value })
              }
              placeholder="例：1570"
              style={plainInputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>重複理由</label>
            <input
              type="text"
              value={editForm.duplicate_reason || ''}
              onChange={(e) =>
                updateEditForm({ duplicate_reason: e.target.value })
              }
              placeholder="例：公式URLがトップページ寄りのため"
              style={plainInputStyle}
            />
          </div>
        </div>
      </div>
    </>
  );
}

const getPromptValue = (value) => {
  const text = String(value || '').trim();
  return text || '未記載';
};

const buildApplicationPeriodPrompt = (form) => {
  const title = getPromptValue(form.title);
  const organization = getPromptValue(form.organization);
  const region = getPromptValue(form.region_text || form.region);

  return `以下の補助金・助成金について、申請期間を公式情報ベースで確認してください。

補助金名：${title}
実施機関：${organization}
地域・場所：${region}

検索するときは、公式URLや取得元URLを前提にしないでください。
公式URLが別制度や古いページを指している可能性があります。
次のようなキーワードを優先して、自治体・実施機関などの公式情報を探してください。

検索キーワード例：
${title} ${region} 申請期間
${title} ${organization} 申請期間

確認してほしいこと：
・申請期間
・受付開始日
・受付終了日
・随時募集かどうか
・募集終了済みかどうか

回答形式：
申請期間：
公募ステータス：
根拠URL：
補足：

不明な場合は「申請期間不明」と明記してください。
推測で日付を作らないでください。`;
};

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};

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

const twoColumnGridNoMargin = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '20px',
};

const adminNoteSection = {
  backgroundColor: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '20px',
};

const adminNoteTitle = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: 'bold',
};

const adminNoteHelp = {
  color: '#92400e',
  fontSize: '12px',
  lineHeight: 1.6,
  marginTop: '4px',
};

const plainInputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  color: '#1f2937',
  fontSize: '14px',
  boxSizing: 'border-box',
  backgroundColor: 'white',
};

const textareaStyle = {
  ...plainInputStyle,
  minHeight: '84px',
  lineHeight: 1.6,
  resize: 'vertical',
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

const smallTextLinkButton = {
  backgroundColor: 'transparent',
  border: 'none',
  color: '#2563eb',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 'bold',
  padding: '0',
  textDecoration: 'underline',
};

const smallPurpleButton = {
  fontSize: '12px',
  color: '#7c3aed',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 10px',
  backgroundColor: '#f5f3ff',
  borderRadius: '4px',
  border: '1px solid #ddd6fe',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
