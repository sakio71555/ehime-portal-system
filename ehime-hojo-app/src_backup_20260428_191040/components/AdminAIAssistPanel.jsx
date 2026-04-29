import React from 'react';

export default function AdminAIAssistPanel({
  step,
  setStep,
  aiSourceUrl,
  setAiSourceUrl,
  aiRawText,
  setAiRawText,
  extractedText,
  setExtractedText,
  resolvedUrl,
  isLoading,
  handleFetchText,
  handleRunAI,
}) {
  return (
    <div
      style={{
        backgroundColor: '#f5f3ff',
        border: '1px solid #c4b5fd',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', color: '#5b21b6' }}>
        🤖 AI自動入力 ＆ タグ付けアシスト
      </h3>

      {step === 1 && (
        <>
          <p style={{ color: '#6d28d9', fontSize: '13px' }}>
            <strong>【STEP 1】</strong>
            解析したいページのURLか、PDFのテキストを入力して「本文を取得」を押してください。
          </p>

          <input
            type="text"
            placeholder="🌐 読み込ませたい公式ページのURL"
            value={aiSourceUrl}
            onChange={(e) => setAiSourceUrl(e.target.value)}
            style={inputBase}
          />

          <textarea
            placeholder="📄 または、PDFの文章などをここに直接コピペしてください"
            value={aiRawText}
            onChange={(e) => setAiRawText(e.target.value)}
            style={{ ...inputBase, minHeight: '80px', marginTop: '12px' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleFetchText}
              disabled={isLoading}
              style={{
                ...buttonStyle.purple,
                marginTop: '12px',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? '🔄 取得中...' : '📝 STEP 1: 本文を取得する'}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p
            style={{
              fontSize: '13px',
              color: '#b91c1c',
              backgroundColor: '#fee2e2',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #fca5a5',
              lineHeight: 1.6,
            }}
          >
            <strong>【STEP 2: プレビュー確認】</strong>
            以下のテキストをAIに送信します。
            <br />
            不要なヘッダー、フッター、別制度の案内などが含まれていると精度が低下します。
            <br />
            抽出元: {resolvedUrl} ({extractedText.length}文字)
          </p>

          <textarea
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            style={{
              ...inputBase,
              minHeight: '200px',
              fontFamily: 'monospace',
              backgroundColor: '#fff5f5',
              borderColor: '#f87171',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '12px',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <button onClick={() => setStep(1)} style={buttonStyle.white}>
              🔙 やり直す
            </button>

            <button
              onClick={handleRunAI}
              disabled={isLoading}
              style={{
                ...buttonStyle.pink,
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading
                ? '🤖 データを解析・抽出中...'
                : '✨ STEP 2: この本文でAI解析を実行する'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const inputBase = {
  width: '100%',
  padding: '12px',
  borderRadius: '6px',
  border: '1px solid #ddd6fe',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const baseButton = {
  padding: '10px 16px',
  borderRadius: '8px',
  fontWeight: 'bold',
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
    cursor: 'pointer',
  },
  purple: {
    ...baseButton,
    backgroundColor: '#8b5cf6',
    color: 'white',
  },
  pink: {
    ...baseButton,
    backgroundColor: '#ec4899',
    color: 'white',
  },
};