import React, { useMemo, useState } from 'react';

const colors = {
  primary: '#526b5d',
  primaryLight: '#f4f6f5',
  textMain: '#4b5550',
  textSub: '#8b9690',
  border: '#e2e8f0',
  accentOrange: '#e76305',
  blue: '#3b82f6'
};

const FRAMES = {
  NORMAL: '通常枠',
  INVOICE: 'インボイス対応類型',
  ELECTRONIC: '電子取引類型'
};

const PROCESS_OPTIONS = {
  LOW: '1〜3プロセス',
  HIGH: '4プロセス以上'
};

const INVOICE_FEATURES = {
  ONE: '1機能',
  TWO_OR_MORE: '2機能以上'
};

function yen(value) {
  return Math.floor(value || 0).toLocaleString();
}

export default function Simulator({ setActivePage }) {
  const [step, setStep] = useState(1);

  const [frame, setFrame] = useState('');
  const [bizType, setBizType] = useState('中小企業');
  const [costs, setCosts] = useState({
    soft: '',
    cloud: '',
    support: '',
    pc: '',
    regi: ''
  });

  const [process, setProcess] = useState(PROCESS_OPTIONS.LOW);

  // 通常枠：最低賃金近傍の事業者として2/3を適用するか
  const [useSpecialRate, setUseSpecialRate] = useState(false);

  // インボイス対応類型：会計・受発注・決済の機能数
  const [invoiceFeatures, setInvoiceFeatures] = useState(INVOICE_FEATURES.ONE);

  const [showBizDetails, setShowBizDetails] = useState(false);
  const [showProcessDetails, setShowProcessDetails] = useState(false);
  const [showCostDetails, setShowCostDetails] = useState(false);

  const frameOptions = [
    FRAMES.NORMAL,
    FRAMES.INVOICE,
    FRAMES.ELECTRONIC
  ];

  const bizTypeOptions =
    frame === FRAMES.ELECTRONIC
      ? ['中小企業', '小規模事業者', 'その他事業者']
      : ['中小企業', '小規模事業者'];

  const scrollTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFrameChange = (newFrame) => {
    setFrame(newFrame);

    // 電子取引類型以外では「その他事業者」を残さない
    if (newFrame !== FRAMES.ELECTRONIC && bizType === 'その他事業者') {
      setBizType('中小企業');
    }

    // 通常枠以外では2/3特例チェックを外す
    if (newFrame !== FRAMES.NORMAL) {
      setUseSpecialRate(false);
    }
  };

  const handleCostChange = (e) => {
    const { name, value } = e.target;

    // マイナス入力対策
    if (Number(value) < 0) return;

    setCosts((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const nextStep = () => {
    scrollTop();
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    scrollTop();
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const result = useMemo(() => {
    const softCost = (Number(costs.soft) || 0) * 10000;
    const cloudCost = (Number(costs.cloud) || 0) * 10000;
    const supportCost = (Number(costs.support) || 0) * 10000;
    const pcCostRaw = (Number(costs.pc) || 0) * 10000;
    const regiCostRaw = (Number(costs.regi) || 0) * 10000;

    const totalSoft = softCost + cloudCost + supportCost;

    const isInvoice = frame === FRAMES.INVOICE;

    // ハードウェアはインボイス対応類型のみ対象
    const eligiblePcCost = isInvoice ? pcCostRaw : 0;
    const eligibleRegiCost = isInvoice ? regiCostRaw : 0;

    const totalCost = totalSoft + eligiblePcCost + eligibleRegiCost;

    let subsidySoft = 0;
    let subsidyPc = 0;
    let subsidyRegi = 0;

    let isUnderLimit = false;
    let warningMessage = '';
    let rateLabel = '';
    let detailMessage = '';

    const effectiveBizType =
      frame !== FRAMES.ELECTRONIC && bizType === 'その他事業者'
        ? '中小企業'
        : bizType;

    if (frame === FRAMES.NORMAL) {
      const normalRate = useSpecialRate ? 2 / 3 : 0.5;
      rateLabel = useSpecialRate ? '2/3以内' : '1/2以内';

      subsidySoft = totalSoft * normalRate;

      if (subsidySoft > 0 && subsidySoft < 50000) {
        isUnderLimit = true;
        warningMessage =
          '補助額が下限（5万円）を下回るため、対象外となる可能性があります。';
      } else if (
        process === PROCESS_OPTIONS.HIGH &&
        subsidySoft > 0 &&
        subsidySoft < 1500000
      ) {
        isUnderLimit = true;
        warningMessage =
          '4プロセス以上の区分は補助額150万円以上が目安です。条件を満たさない場合、「1〜3プロセス」区分での申請となる可能性があります。';
      }

      const upperLimit =
        process === PROCESS_OPTIONS.LOW
          ? 1499999
          : 4500000;

      if (subsidySoft > upperLimit) {
        subsidySoft = upperLimit;
      }

      detailMessage =
        process === PROCESS_OPTIONS.LOW
          ? '1プロセス以上：5万円以上150万円未満の区分で概算しています。'
          : '4プロセス以上：150万円以上450万円以下の区分で概算しています。';
    }

    if (frame === FRAMES.INVOICE) {
      rateLabel =
        effectiveBizType === '小規模事業者'
          ? '4/5以内・一部2/3以内'
          : '3/4以内・一部2/3以内';

      if (effectiveBizType === '小規模事業者') {
        // 50万円補助に到達する経費：625,000円
        if (totalSoft <= 625000) {
          subsidySoft = totalSoft * 0.8;
        } else {
          subsidySoft = 500000 + (totalSoft - 625000) * (2 / 3);
        }
      } else {
        // 50万円補助に到達する経費：約666,666円
        if (totalSoft <= 666666) {
          subsidySoft = totalSoft * 0.75;
        } else {
          subsidySoft = 500000 + (totalSoft - 666666) * (2 / 3);
        }
      }

      const maxSoftSubsidy =
        invoiceFeatures === INVOICE_FEATURES.ONE
          ? 500000
          : 3500000;

      if (subsidySoft > maxSoftSubsidy) {
        subsidySoft = maxSoftSubsidy;
      }

      subsidyPc = eligiblePcCost * 0.5;
      if (subsidyPc > 100000) {
        subsidyPc = 100000;
      }

      subsidyRegi = eligibleRegiCost * 0.5;
      if (subsidyRegi > 200000) {
        subsidyRegi = 200000;
      }

      detailMessage =
        invoiceFeatures === INVOICE_FEATURES.ONE
          ? '1機能の場合、ソフトウェア部分の補助額上限は50万円として概算しています。'
          : '2機能以上の場合、ソフトウェア部分の補助額上限は350万円として概算しています。';
    }

    if (frame === FRAMES.ELECTRONIC) {
      const rate =
        effectiveBizType === '中小企業' ||
        effectiveBizType === '小規模事業者'
          ? 2 / 3
          : 0.5;

      rateLabel = rate === 2 / 3 ? '2/3以内' : '1/2以内';

      subsidySoft = totalSoft * rate;

      if (subsidySoft > 3500000) {
        subsidySoft = 3500000;
      }

      detailMessage =
        '電子取引類型は、インボイス制度に対応した受発注ソフト等の導入費用を中心とした概算です。';
    }

    const totalSubsidy = Math.floor(subsidySoft + subsidyPc + subsidyRegi);
    const selfPay = Math.max(totalCost - totalSubsidy, 0);

    return {
      totalCost,
      totalSubsidy,
      selfPay,
      subsidySoft: Math.floor(subsidySoft),
      subsidyPc: Math.floor(subsidyPc),
      subsidyRegi: Math.floor(subsidyRegi),
      isUnderLimit,
      warningMessage,
      rateLabel,
      detailMessage
    };
  }, [
    frame,
    bizType,
    costs,
    process,
    useSpecialRate,
    invoiceFeatures
  ]);

  return (
    <div
      className="simulator-page"
      style={{
        maxWidth: '800px',
        margin: '40px auto',
        padding: '0 24px',
        fontFamily: '"Helvetica Neue", Arial, sans-serif'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2
          style={{
            fontSize: '28px',
            color: '#0f172a',
            margin: '0 0 12px 0',
            fontWeight: '900',
            letterSpacing: '-0.5px'
          }}
        >
          💻 IT導入補助金シミュレーター
        </h2>

        <p
          style={{
            margin: '0 auto',
            color: '#64748b',
            fontSize: '14px',
            lineHeight: '1.7',
            maxWidth: '620px'
          }}
        >
          導入予定のITツール費用を入力すると、想定補助額と自己負担額の目安を確認できます。
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '24px'
          }}
        >
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              style={{
                height: '6px',
                width: '60px',
                borderRadius: '3px',
                backgroundColor: step >= num ? colors.primary : '#e2e8f0',
                transition: 'background-color 0.3s'
              }}
            />
          ))}
        </div>
      </div>

      <div
        className="simulator-card"
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.08)',
          marginBottom: '40px',
          border: `1px solid ${colors.border}`
        }}
      >
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <h3
              style={{
                fontSize: '22px',
                fontWeight: 'bold',
                color: '#1e293b',
                marginBottom: '24px',
                textAlign: 'center'
              }}
            >
              Q1. 申請する枠（類型）を選択してください
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginBottom: '32px'
              }}
            >
              {frameOptions.map((f) => (
                <label
                  key={f}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border:
                      frame === f
                        ? `2px solid ${colors.primary}`
                        : `2px solid ${colors.border}`,
                    backgroundColor: frame === f ? '#f0fdf4' : 'white',
                    boxShadow:
                      frame === f
                        ? '0 4px 12px rgba(0,0,0,0.05)'
                        : 'none'
                  }}
                >
                  <input
                    type="radio"
                    name="frame"
                    value={f}
                    checked={frame === f}
                    onChange={() => handleFrameChange(f)}
                    style={{ display: 'none' }}
                  />

                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border:
                        frame === f
                          ? `7px solid ${colors.primary}`
                          : `2px solid #cbd5e1`,
                      marginRight: '16px',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                  />

                  <div>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: frame === f ? '#064e3b' : '#334155'
                      }}
                    >
                      {f}
                    </span>

                    <span
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        color: '#64748b',
                        marginTop: '4px',
                        lineHeight: '1.5'
                      }}
                    >
                      {f === FRAMES.NORMAL &&
                        '幅広い業務効率化・生産性向上を目的としたITツール導入向け'}
                      {f === FRAMES.INVOICE &&
                        '会計・受発注・決済など、インボイス制度対応に必要なツール導入向け'}
                      {f === FRAMES.ELECTRONIC &&
                        'インボイス制度に対応した受発注ソフトなどの電子取引環境向け'}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #e2e8f0'
              }}
            >
              <h4
                style={{
                  margin: '0 0 16px 0',
                  color: '#0f172a',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>💡</span> 枠の違いについて
              </h4>

              <div className="simulator-table-wrapper" style={{ overflowX: 'auto', marginBottom: '4px' }}>
                <table
                  style={{
                    width: '100%',
                    minWidth: '720px',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                    backgroundColor: 'white'
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>特徴</th>
                      <th style={thStyle}>通常枠</th>
                      <th style={thStyle}>インボイス対応類型</th>
                      <th style={thStyle}>電子取引類型</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={tdHeadStyle}>目的</td>
                      <td style={tdStyle}>労働生産性の向上・業務効率化</td>
                      <td style={tdStyle}>インボイス制度対応の推進</td>
                      <td style={tdStyle}>電子取引環境の構築</td>
                    </tr>
                    <tr>
                      <td style={tdHeadStyle}>対象ソフト</td>
                      <td style={tdStyle}>
                        会計・顧客対応・人事労務・在庫管理など
                      </td>
                      <td style={tdStyle}>会計・受発注・決済</td>
                      <td style={tdStyle}>
                        インボイス制度に対応した受発注ソフト等
                      </td>
                    </tr>
                    <tr>
                      <td style={tdHeadStyle}>ハードウェア</td>
                      <td style={{ ...tdStyle, color: '#ef4444' }}>対象外</td>
                      <td
                        style={{
                          ...tdStyle,
                          color: '#10b981',
                          fontWeight: 'bold'
                        }}
                      >
                        PC・タブレット・レジ・券売機等が対象になる場合あり
                      </td>
                      <td style={{ ...tdStyle, color: '#ef4444' }}>対象外</td>
                    </tr>
                    <tr>
                      <td style={tdHeadStyle}>補助率</td>
                      <td style={tdStyle}>1/2以内、条件により2/3以内</td>
                      <td style={tdStyle}>
                        中小企業3/4以内、小規模事業者4/5以内等
                      </td>
                      <td style={tdStyle}>
                        中小・小規模2/3以内、その他1/2以内
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <button
                onClick={nextStep}
                disabled={!frame}
                style={{
                  padding: '16px 48px',
                  backgroundColor: frame ? colors.primary : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: frame ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s',
                  boxShadow: frame
                    ? '0 4px 12px rgba(82, 107, 93, 0.3)'
                    : 'none'
                }}
              >
                次へ進む
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <h3
              style={{
                fontSize: '22px',
                fontWeight: 'bold',
                color: '#1e293b',
                marginBottom: '32px',
                textAlign: 'center'
              }}
            >
              Q2. 該当する条件を選んでください
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: 'bold',
                  color: '#334155',
                  marginBottom: '12px'
                }}
              >
                事業者区分
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                {bizTypeOptions.map((b) => (
                  <label
                    key={b}
                    style={{
                      flex: 1,
                      minWidth: '160px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border:
                        bizType === b
                          ? `2px solid ${colors.primary}`
                          : `2px solid ${colors.border}`,
                      backgroundColor: bizType === b ? '#f0fdf4' : 'white'
                    }}
                  >
                    <input
                      type="radio"
                      name="bizType"
                      value={b}
                      checked={bizType === b}
                      onChange={(e) => setBizType(e.target.value)}
                      style={{ display: 'none' }}
                    />

                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border:
                          bizType === b
                            ? `6px solid ${colors.primary}`
                            : `2px solid #cbd5e1`,
                        marginRight: '12px',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box'
                      }}
                    />

                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: bizType === b ? 'bold' : '500',
                        color: bizType === b ? '#064e3b' : '#475569'
                      }}
                    >
                      {b}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '40px',
                overflow: 'hidden'
              }}
            >
              <div
                onClick={() => setShowBizDetails(!showBizDetails)}
                style={{
                  padding: '16px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: showBizDetails ? '#f1f5f9' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    color: '#334155',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>🏢</span> 事業者区分の詳しい基準について
                </div>

                <div
                  style={{
                    color: colors.primary,
                    fontWeight: 'bold',
                    fontSize: '18px',
                    transform: showBizDetails
                      ? 'rotate(180deg)'
                      : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}
                >
                  ▼
                </div>
              </div>

              {showBizDetails && (
                <div
                  style={{
                    padding: '24px',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    fontSize: '13px',
                    color: '#475569',
                    lineHeight: '1.6'
                  }}
                >
                  <h5 style={detailTitleStyle}>■ 中小企業の基準</h5>
                  <p style={{ marginBottom: '12px' }}>
                    資本金または従業員の一方が、下記の数字以下であれば対象となります。
                  </p>

                  <div className="simulator-table-wrapper" style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        minWidth: '560px',
                        borderCollapse: 'collapse',
                        border: '1px solid #cbd5e1',
                        marginBottom: '24px'
                      }}
                    >
                      <thead style={{ backgroundColor: '#f1f5f9' }}>
                        <tr>
                          <th style={smallThStyle}>業種分類</th>
                          <th style={smallThStyle}>資本金</th>
                          <th style={smallThStyle}>従業員規模</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={smallTdStyle}>製造業、建設業、運輸業</td>
                          <td style={smallTdStyle}>3億円以下</td>
                          <td style={smallTdStyle}>300人以下</td>
                        </tr>
                        <tr>
                          <td style={smallTdStyle}>卸売業</td>
                          <td style={smallTdStyle}>1億円以下</td>
                          <td style={smallTdStyle}>100人以下</td>
                        </tr>
                        <tr>
                          <td style={smallTdStyle}>サービス業（一部除く）</td>
                          <td style={smallTdStyle}>5,000万円以下</td>
                          <td style={smallTdStyle}>100人以下</td>
                        </tr>
                        <tr>
                          <td style={smallTdStyle}>小売業</td>
                          <td style={smallTdStyle}>5,000万円以下</td>
                          <td style={smallTdStyle}>50人以下</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h5 style={detailTitleStyle}>■ 小規模事業者の基準</h5>
                  <p style={{ marginBottom: '12px' }}>
                    従業員が下記の数字以下であれば対象となります。
                  </p>

                  <div className="simulator-table-wrapper" style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        minWidth: '480px',
                        borderCollapse: 'collapse',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      <thead style={{ backgroundColor: '#f1f5f9' }}>
                        <tr>
                          <th style={smallThStyle}>業種・組織形態</th>
                          <th style={smallThStyle}>従業員規模</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={smallTdStyle}>
                            商業・サービス業（宿泊・娯楽除く）
                          </td>
                          <td style={smallTdStyle}>5人以下</td>
                        </tr>
                        <tr>
                          <td style={smallTdStyle}>
                            サービス業のうち宿泊業・娯楽業
                          </td>
                          <td style={smallTdStyle}>20人以下</td>
                        </tr>
                        <tr>
                          <td style={smallTdStyle}>製造業その他</td>
                          <td style={smallTdStyle}>20人以下</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {frame === FRAMES.NORMAL && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      color: '#334155',
                      marginBottom: '12px'
                    }}
                  >
                    機能・プロセス数
                  </label>

                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {Object.values(PROCESS_OPTIONS).map((p) => (
                      <label
                        key={p}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '16px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border:
                            process === p
                              ? `2px solid ${colors.primary}`
                              : `2px solid ${colors.border}`,
                          backgroundColor: process === p ? '#f0fdf4' : 'white'
                        }}
                      >
                        <input
                          type="radio"
                          name="process"
                          value={p}
                          checked={process === p}
                          onChange={(e) => setProcess(e.target.value)}
                          style={{ display: 'none' }}
                        />

                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border:
                              process === p
                                ? `6px solid ${colors.primary}`
                                : `2px solid #cbd5e1`,
                            marginRight: '12px',
                            transition: 'all 0.2s',
                            boxSizing: 'border-box'
                          }}
                        />

                        <span
                          style={{
                            fontSize: '16px',
                            fontWeight: process === p ? 'bold' : '500',
                            color: process === p ? '#064e3b' : '#475569'
                          }}
                        >
                          {p}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '24px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    onClick={() => setShowProcessDetails(!showProcessDetails)}
                    style={{
                      padding: '16px 24px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      backgroundColor: showProcessDetails
                        ? '#f1f5f9'
                        : 'transparent',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 'bold',
                        color: '#334155',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>⚙️</span> 「プロセス数」の数え方について
                    </div>

                    <div
                      style={{
                        color: colors.primary,
                        fontWeight: 'bold',
                        fontSize: '18px',
                        transform: showProcessDetails
                          ? 'rotate(180deg)'
                          : 'rotate(0deg)',
                        transition: 'transform 0.3s'
                      }}
                    >
                      ▼
                    </div>
                  </div>

                  {showProcessDetails && (
                    <div
                      style={{
                        padding: '24px',
                        borderTop: '1px solid #e2e8f0',
                        backgroundColor: 'white',
                        fontSize: '13px',
                        color: '#475569',
                        lineHeight: '1.6'
                      }}
                    >
                      <p style={{ marginBottom: '12px' }}>
                        IT導入補助金における「プロセス数」とは、そのITツールがカバーする
                        <strong>業務領域</strong>の数を指します。
                      </p>

                      <ul
                        style={{
                          margin: '0 0 24px 0',
                          paddingLeft: '20px',
                          lineHeight: '1.8'
                        }}
                      >
                        <li>顧客対応・販売支援</li>
                        <li>決済・債権債務・資金管理</li>
                        <li>調達・供給・在庫管理</li>
                        <li>業務固有プロセス</li>
                        <li>会計・財務・経営</li>
                        <li>総務・人事・給与・労務・教育訓練</li>
                      </ul>

                      <div
                        style={{
                          backgroundColor: '#fffbeb',
                          padding: '16px',
                          borderRadius: '8px',
                          border: '1px solid #fde68a'
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 'bold',
                            color: '#b45309',
                            marginBottom: '8px'
                          }}
                        >
                          💡 重要ポイント
                        </div>

                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: '20px',
                            color: '#92400e',
                            lineHeight: '1.6'
                          }}
                        >
                          <li>
                            「機能数」ではなく、業務領域としての「プロセス数」で考えます。
                          </li>
                          <li>
                            複数ソフトを組み合わせてプロセス数を満たす場合もあります。
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '40px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '20px',
                      backgroundColor: useSpecialRate ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${
                        useSpecialRate ? '#bbf7d0' : '#e2e8f0'
                      }`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={useSpecialRate}
                      onChange={(e) => setUseSpecialRate(e.target.checked)}
                      style={{
                        marginTop: '4px',
                        width: '20px',
                        height: '20px',
                        accentColor: colors.primary,
                        cursor: 'pointer'
                      }}
                    />

                    <div>
                      <div
                        style={{
                          fontWeight: 'bold',
                          color: '#0f172a',
                          fontSize: '15px',
                          marginBottom: '4px'
                        }}
                      >
                        最低賃金近傍の事業者として、通常枠の補助率2/3を適用する
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          color: '#64748b',
                          lineHeight: '1.6'
                        }}
                      >
                        一定期間において、地域別最低賃金未満で雇用している従業員が一定割合以上いるなど、公式要件を満たす場合に補助率が1/2から2/3に引き上げられるケースがあります。
                      </div>
                    </div>
                  </label>
                </div>
              </>
            )}

            {frame === FRAMES.INVOICE && (
              <div style={{ marginBottom: '40px' }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 'bold',
                    color: '#334155',
                    marginBottom: '12px'
                  }}
                >
                  「会計・受発注・決済」のうち、いくつの機能を導入しますか？
                  <br />
                  <span
                    style={{
                      fontSize: '13px',
                      color: '#ef4444',
                      fontWeight: 'normal'
                    }}
                  >
                    ※1機能のみの場合、ソフトウェア部分の補助額上限は50万円として計算します。
                  </span>
                </label>

                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  {Object.values(INVOICE_FEATURES).map((f) => (
                    <label
                      key={f}
                      style={{
                        flex: 1,
                        minWidth: '200px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '16px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border:
                          invoiceFeatures === f
                            ? `2px solid ${colors.primary}`
                            : `2px solid ${colors.border}`,
                        backgroundColor:
                          invoiceFeatures === f ? '#f0fdf4' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        name="invoiceFeatures"
                        value={f}
                        checked={invoiceFeatures === f}
                        onChange={(e) => setInvoiceFeatures(e.target.value)}
                        style={{ display: 'none' }}
                      />

                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border:
                            invoiceFeatures === f
                              ? `6px solid ${colors.primary}`
                              : `2px solid #cbd5e1`,
                          marginRight: '12px',
                          transition: 'all 0.2s',
                          boxSizing: 'border-box'
                        }}
                      />

                      <span
                        style={{
                          fontSize: '16px',
                          fontWeight: invoiceFeatures === f ? 'bold' : '500',
                          color:
                            invoiceFeatures === f ? '#064e3b' : '#475569'
                        }}
                      >
                        {f}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {frame === FRAMES.ELECTRONIC && (
              <div
                style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  borderRadius: '12px',
                  padding: '18px',
                  marginBottom: '40px',
                  fontSize: '14px',
                  lineHeight: '1.7'
                }}
              >
                <strong>電子取引類型について</strong>
                <br />
                電子取引類型は、インボイス制度に対応した受発注ソフト等の導入を想定した類型です。
                通常枠のようなプロセス数による上限区分はありません。
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}
            >
              <button onClick={prevStep} style={secondaryButtonStyle}>
                戻る
              </button>

              <button onClick={nextStep} style={primaryButtonStyle}>
                次へ進む
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <h3
              style={{
                fontSize: '22px',
                fontWeight: 'bold',
                color: '#1e293b',
                marginBottom: '32px',
                textAlign: 'center'
              }}
            >
              Q3. 導入予定の費用を入力してください
              <br />
              <span
                style={{
                  fontSize: '14px',
                  color: '#64748b',
                  fontWeight: 'normal'
                }}
              >
                （単位：万円 / 税抜）
              </span>
            </h3>

            <div
              className="simulator-cost-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}
            >
              {[
                { id: 'soft', label: 'ソフトウェア費用' },
                { id: 'cloud', label: 'クラウド利用料' },
                { id: 'support', label: '導入支援費' },
                {
                  id: 'pc',
                  label: 'PC・タブレット費用',
                  note:
                    frame !== FRAMES.INVOICE
                      ? '※インボイス枠のみ対象'
                      : null
                },
                {
                  id: 'regi',
                  label: 'レジ・券売機費用',
                  note:
                    frame !== FRAMES.INVOICE
                      ? '※インボイス枠のみ対象'
                      : null
                }
              ].map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    borderRadius: '8px',
                    border: `1px solid ${
                      item.note ? '#e2e8f0' : '#cbd5e1'
                    }`,
                    overflow: 'hidden',
                    backgroundColor: item.note ? '#f8fafc' : 'white'
                  }}
                >
                  <div
                    style={{
                      backgroundColor: item.note ? '#f1f5f9' : '#f8fafc',
                      padding: '16px',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRight: `1px solid ${
                        item.note ? '#e2e8f0' : '#cbd5e1'
                      }`,
                      gap: '8px'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        color: item.note ? '#94a3b8' : '#334155',
                        fontWeight: 'bold'
                      }}
                    >
                      {item.label}
                    </span>

                    {item.note && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#ef4444',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.note}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'white',
                      width: '120px'
                    }}
                  >
                    <input
                      type="number"
                      name={item.id}
                      value={costs[item.id]}
                      onChange={handleCostChange}
                      disabled={!!item.note}
                      placeholder="0"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '16px 8px',
                        border: 'none',
                        textAlign: 'right',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: item.note ? '#cbd5e1' : '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />

                    <span
                      style={{
                        padding: '0 16px 0 4px',
                        fontSize: '14px',
                        color: item.note ? '#cbd5e1' : '#64748b',
                        fontWeight: 'bold'
                      }}
                    >
                      万円
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '40px',
                overflow: 'hidden'
              }}
            >
              <div
                onClick={() => setShowCostDetails(!showCostDetails)}
                style={{
                  padding: '16px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: showCostDetails ? '#f1f5f9' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    color: '#334155',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>💰</span> 補助金額・補助率の目安
                </div>

                <div
                  style={{
                    color: colors.primary,
                    fontWeight: 'bold',
                    fontSize: '18px',
                    transform: showCostDetails
                      ? 'rotate(180deg)'
                      : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}
                >
                  ▼
                </div>
              </div>

              {showCostDetails && (
                <div
                  style={{
                    padding: '24px',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    fontSize: '13px',
                    color: '#475569',
                    lineHeight: '1.6'
                  }}
                >
                  <p style={{ marginBottom: '16px' }}>
                    枠組みによって異なりますが、一般的な目安は以下の通りです。
                  </p>

                  <div
                    className="simulator-info-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      marginBottom: '24px'
                    }}
                  >
                    <div style={infoCardStyle}>
                      <div
                        style={{
                          fontWeight: 'bold',
                          color: colors.primary,
                          marginBottom: '8px',
                          fontSize: '15px'
                        }}
                      >
                        ■ 通常枠
                      </div>

                      <div style={{ marginBottom: '4px' }}>
                        <strong>補助額：</strong> 5万円〜450万円以下
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginBottom: '8px'
                        }}
                      >
                        ・1プロセス以上：5万円以上150万円未満
                        <br />
                        ・4プロセス以上：150万円以上450万円以下
                      </div>

                      <div>
                        <strong>補助率：</strong> 1/2以内
                        <br />
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          ※条件により2/3以内
                        </span>
                      </div>
                    </div>

                    <div style={infoCardStyle}>
                      <div
                        style={{
                          fontWeight: 'bold',
                          color: colors.accentOrange,
                          marginBottom: '8px',
                          fontSize: '15px'
                        }}
                      >
                        ■ インボイス対応類型
                      </div>

                      <div style={{ marginBottom: '4px' }}>
                        <strong>補助額：</strong> 〜350万円
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginBottom: '8px'
                        }}
                      >
                        ・1機能：上限50万円
                        <br />
                        ・2機能以上：上限350万円
                      </div>

                      <div>
                        <strong>補助率：</strong> 中小企業3/4以内、小規模4/5以内
                        <br />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          ※50万円以下の部分
                        </span>
                      </div>
                    </div>

                    <div style={infoCardStyle}>
                      <div
                        style={{
                          fontWeight: 'bold',
                          color: colors.blue,
                          marginBottom: '8px',
                          fontSize: '15px'
                        }}
                      >
                        ■ 電子取引類型
                      </div>

                      <div style={{ marginBottom: '4px' }}>
                        <strong>補助額：</strong> 〜350万円以下
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginBottom: '8px'
                        }}
                      >
                        ※受発注ソフト等の導入費用を中心とした概算です。
                      </div>

                      <div>
                        <strong>補助率：</strong> 中小・小規模2/3以内、その他1/2以内
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0'
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 'bold',
                        color: '#166534',
                        marginBottom: '4px',
                        fontSize: '14px'
                      }}
                    >
                      ✨ 注意
                    </div>

                    <div style={{ color: '#166534' }}>
                      実際の補助対象経費・補助率・補助上限額・申請可否は、制度内容や申請条件によって変わります。申請前には必ず公式情報をご確認ください。
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}
            >
              <button onClick={prevStep} style={secondaryButtonStyle}>
                戻る
              </button>

              <button
                onClick={nextStep}
                style={{
                  ...primaryButtonStyle,
                  backgroundColor: colors.accentOrange,
                  boxShadow: '0 4px 12px rgba(231, 99, 5, 0.3)'
                }}
              >
                結果を見る！
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <div
              style={{
                background:
                  'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '40px 32px',
                color: 'white',
                textAlign: 'center',
                boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.5)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <h3
                style={{
                  margin: '0 0 32px 0',
                  fontSize: '20px',
                  color: '#cbd5e1',
                  fontWeight: 'normal',
                  lineHeight: '1.7'
                }}
              >
                あなたの場合、
                <span
                  style={{
                    color: '#fbbf24',
                    fontWeight: '900',
                    fontSize: '24px',
                    borderBottom: '2px solid #fbbf24',
                    paddingBottom: '4px',
                    margin: '0 8px'
                  }}
                >
                  {frame}
                </span>
                で申請できる可能性があります
              </h3>

              {result.isUnderLimit && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    color: '#fca5a5',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    lineHeight: '1.7'
                  }}
                >
                  ⚠️ {result.warningMessage}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '32px',
                  flexWrap: 'wrap',
                  marginBottom: '32px'
                }}
              >
                <div style={resultCardStyle}>
                  <div style={resultLabelStyle}>想定補助額</div>

                  <div
                    style={{
                      fontSize: '48px',
                      fontWeight: '900',
                      color: '#10b981',
                      lineHeight: '1',
                      textShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    {yen(result.totalSubsidy)}
                    <span style={resultUnitStyle}>円</span>
                  </div>
                </div>

                <div style={resultCardStyle}>
                  <div style={resultLabelStyle}>想定自己負担額</div>

                  <div
                    style={{
                      fontSize: '48px',
                      fontWeight: '900',
                      color: 'white',
                      lineHeight: '1'
                    }}
                  >
                    {yen(result.selfPay)}
                    <span style={resultUnitStyle}>円</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '24px',
                  textAlign: 'left'
                }}
              >
                <h4
                  style={{
                    margin: '0 0 12px 0',
                    color: '#e2e8f0',
                    fontSize: '15px'
                  }}
                >
                  試算内容
                </h4>

                <div
                  className="simulator-result-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    fontSize: '13px',
                    color: '#cbd5e1',
                    lineHeight: '1.6'
                  }}
                >
                  <div>
                    <strong>対象経費合計：</strong>
                    <br />
                    {yen(result.totalCost)}円
                  </div>

                  <div>
                    <strong>適用補助率：</strong>
                    <br />
                    {result.rateLabel || '-'}
                  </div>

                  <div>
                    <strong>ソフト等補助額：</strong>
                    <br />
                    {yen(result.subsidySoft)}円
                  </div>

                  {frame === FRAMES.INVOICE && (
                    <>
                      <div>
                        <strong>PC・タブレット補助額：</strong>
                        <br />
                        {yen(result.subsidyPc)}円
                      </div>

                      <div>
                        <strong>レジ・券売機補助額：</strong>
                        <br />
                        {yen(result.subsidyRegi)}円
                      </div>
                    </>
                  )}
                </div>

                {result.detailMessage && (
                  <div
                    style={{
                      marginTop: '14px',
                      paddingTop: '14px',
                      borderTop: '1px solid rgba(255,255,255,0.12)',
                      color: '#94a3b8',
                      fontSize: '13px',
                      lineHeight: '1.7'
                    }}
                  >
                    {result.detailMessage}
                  </div>
                )}
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '16px',
                  padding: '24px',
                  textAlign: 'left',
                  marginBottom: '32px'
                }}
              >
                <h4
                  style={{
                    color: '#cbd5e1',
                    fontSize: '16px',
                    margin: '0 0 16px 0',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                    paddingBottom: '8px'
                  }}
                >
                  ⚠️ 申請に関する追加費用・注意点
                </h4>

                <p
                  style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                    marginBottom: '16px',
                    lineHeight: '1.7'
                  }}
                >
                  ITツールの導入費用以外に、以下のコストや準備が発生する可能性があります。
                </p>

                <ul
                  style={{
                    margin: '0 0 20px 0',
                    paddingLeft: '20px',
                    color: '#e2e8f0',
                    fontSize: '14px',
                    lineHeight: '1.8'
                  }}
                >
                  <li>
                    <strong>申請代行・コンサルティング費用</strong>
                    <br />
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                      着手金・成功報酬などが発生する場合があります。
                    </span>
                  </li>

                  <li style={{ marginTop: '8px' }}>
                    <strong>gBizIDプライムのアカウント取得</strong>
                    <br />
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                      発行自体は無料ですが、申請準備や書類確認が必要です。
                    </span>
                  </li>
                </ul>

                <div
                  style={{
                    backgroundColor: 'rgba(234, 88, 12, 0.15)',
                    borderLeft: '4px solid #ea580c',
                    padding: '16px',
                    borderRadius: '0 8px 8px 0'
                  }}
                >
                  <div
                    style={{
                      color: '#fcd34d',
                      fontWeight: 'bold',
                      fontSize: '15px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>💡</span> 重要：補助金は「後払い」です。
                  </div>

                  <div
                    style={{
                      color: '#e2e8f0',
                      fontSize: '13px',
                      lineHeight: '1.6'
                    }}
                  >
                    導入時には一度全額を自社で支払う必要があるため、事前のキャッシュフロー計画が不可欠です。
                    <br />
                    ※本シミュレーションは公開情報をもとにした概算です。正確な条件等は専門家または公式情報をご確認ください。
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (typeof setActivePage === 'function') {
                    setActivePage('experts');
                  }
                }}
                style={{
                  width: '100%',
                  maxWidth: '480px',
                  backgroundColor: '#ea580c',
                  color: 'white',
                  border: 'none',
                  padding: '24px',
                  borderRadius: '50px',
                  fontSize: '20px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: '0 8px 25px rgba(234, 88, 12, 0.4)',
                  transition: 'transform 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  margin: '0 auto'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                専門家に相談して準備を始める <span>🚀</span>
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '14px',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                最初からやり直す
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
        }

        .simulator-page,
        .simulator-page * {
          box-sizing: border-box;
          min-width: 0;
        }

        .simulator-table-wrapper {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .simulator-table-wrapper table {
          max-width: none;
        }

        .simulator-page a,
        .simulator-page p,
        .simulator-page li,
        .simulator-page span,
        .simulator-page div {
          overflow-wrap: break-word;
          word-break: break-word;
        }

        @media (max-width: 640px) {
          .simulator-page {
            width: 100%;
            max-width: 100%;
            margin: 24px auto !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            overflow-x: clip;
          }

          .simulator-card {
            width: 100%;
            max-width: 100%;
            padding: 24px 18px !important;
            border-radius: 16px !important;
            overflow: hidden;
          }

          .simulator-cost-grid,
          .simulator-info-grid,
          .simulator-result-grid {
            grid-template-columns: 1fr !important;
          }

          .simulator-table-wrapper {
            margin-left: 0;
            margin-right: 0;
          }

          .simulator-table-wrapper table {
            width: max-content !important;
          }

          h2 {
            font-size: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}

const thStyle = {
  border: '1px solid #cbd5e1',
  padding: '12px',
  backgroundColor: '#f1f5f9',
  color: '#334155',
  textAlign: 'left',
  fontWeight: 'bold'
};

const tdStyle = {
  border: '1px solid #cbd5e1',
  padding: '12px',
  color: '#334155',
  verticalAlign: 'top',
  lineHeight: '1.6'
};

const tdHeadStyle = {
  ...tdStyle,
  fontWeight: 'bold',
  backgroundColor: '#f8fafc',
  color: '#0f172a'
};

const smallThStyle = {
  border: '1px solid #cbd5e1',
  padding: '8px',
  color: '#334155',
  textAlign: 'left'
};

const smallTdStyle = {
  border: '1px solid #cbd5e1',
  padding: '8px',
  color: '#475569'
};

const detailTitleStyle = {
  color: colors.primary,
  fontSize: '15px',
  margin: '0 0 12px 0'
};

const primaryButtonStyle = {
  padding: '16px 48px',
  backgroundColor: colors.primary,
  color: 'white',
  border: 'none',
  borderRadius: '50px',
  fontSize: '18px',
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(82, 107, 93, 0.3)'
};

const secondaryButtonStyle = {
  padding: '16px 32px',
  backgroundColor: 'white',
  color: '#64748b',
  border: '1px solid #cbd5e1',
  borderRadius: '50px',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer'
};

const infoCardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px',
  backgroundColor: 'white'
};

const resultCardStyle = {
  flex: 1,
  minWidth: '240px',
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: '16px',
  padding: '24px',
  border: '1px solid rgba(255,255,255,0.1)'
};

const resultLabelStyle = {
  fontSize: '15px',
  color: '#94a3b8',
  marginBottom: '12px',
  fontWeight: 'bold'
};

const resultUnitStyle = {
  fontSize: '20px',
  marginLeft: '4px',
  color: '#cbd5e1',
  fontWeight: 'normal'
};
