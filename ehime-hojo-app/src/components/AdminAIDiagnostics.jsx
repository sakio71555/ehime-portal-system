import { getConfidenceColor, getConfidenceLabel } from '../adminEditHelpers';

export default function AdminAIDiagnostics({ aiDiagnostics }) {
  if (!aiDiagnostics) {
    return null;
  }

  const fieldConfidence = aiDiagnostics.fieldConfidence || {};
  const warnings = Array.isArray(aiDiagnostics.warnings)
    ? aiDiagnostics.warnings
    : [];
  const evidence = aiDiagnostics.evidence || {};

  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '28px',
      }}
    >
      <h3 style={{ margin: '0 0 14px 0', color: '#334155' }}>
        🧪 AI抽出診断
      </h3>

      {warnings.length > 0 && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            color: '#92400e',
            fontSize: '13px',
          }}
        >
          <strong>確認ポイント</strong>
          <ul>
            {warnings.map((warning, idx) => (
              <li key={`${warning}-${idx}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(fieldConfidence).length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '10px',
          }}
        >
          {Object.entries(fieldConfidence).map(([key, value]) => (
            <div
              key={key}
              style={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginBottom: '4px',
                  fontWeight: 'bold',
                }}
              >
                {getConfidenceLabel(key)}
              </div>

              <div
                style={{
                  fontSize: '18px',
                  color: getConfidenceColor(value),
                  fontWeight: '800',
                }}
              >
                {value}%
              </div>
            </div>
          ))}
        </div>
      )}

      {Object.keys(evidence).length > 0 && (
        <details style={{ marginTop: '16px' }}>
          <summary
            style={{
              cursor: 'pointer',
              color: '#2563eb',
              fontWeight: 'bold',
              fontSize: '13px',
            }}
          >
            抽出根拠を見る
          </summary>

          <div
            style={{
              marginTop: '12px',
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: '#475569',
              whiteSpace: 'pre-wrap',
            }}
          >
            {Object.entries(evidence).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '10px' }}>
                <strong>{getConfidenceLabel(key)}：</strong>
                <br />
                {String(value || '')}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}