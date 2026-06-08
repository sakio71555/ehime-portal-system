import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import SEO from './components/SEO';
import SubsidySEO from './components/SubsidySEO';
import './SubsidyDetail.css';
import {
  getPurposeTagList,
  getItemRegionCategories,
} from './portalHelpers';
import { supabase } from './lib/supabaseClient';
import { buildDisplaySubsidy } from './utils/subsidyDetailFormatter';

const isValidHttpUrl = (url) => {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url.trim());
};

const getStatusStyle = (statusLabel) => {
  if (statusLabel === '受付終了') {
    return {
      backgroundColor: '#9ca3af',
      color: 'white',
    };
  }

  if (statusLabel === '予告') {
    return {
      backgroundColor: '#f59e0b',
      color: 'white',
    };
  }

  if (statusLabel === '公募中') {
    return {
      backgroundColor: '#0f7b6c',
      color: 'white',
    };
  }

  return {
    backgroundColor: '#64748b',
    color: 'white',
  };
};

const getPeriodStyle = (statusLabel) => {
  if (statusLabel === '受付終了') {
    return {
      color: '#6b7280',
      backgroundColor: '#f3f4f6',
      borderColor: '#e5e7eb',
    };
  }

  if (statusLabel === '予告') {
    return {
      color: '#92400e',
      backgroundColor: '#fffbeb',
      borderColor: '#fde68a',
    };
  }

  return {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  };
};

const hasDisplayValue = (value) => {
  const text = String(value || '').trim();

  if (!text) return false;
  if (text === '不明') return false;
  if (text === '公式ページをご確認ください。') return true;

  return true;
};

const normalizeDisplayText = (value) => String(value || '').trim();

const getFirstDisplayValue = (obj, keys = []) => {
  for (const key of keys) {
    const value = normalizeDisplayText(obj?.[key]);
    if (value && !['不明', '未確認', 'null', 'undefined'].includes(value)) {
      return value;
    }
  }

  return '';
};

const formatDateForDetail = (value) => {
  const text = normalizeDisplayText(value);
  if (!text) return '';

  const date = new Date(text);
  if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return text;
};

function TrustInfoBox({ items }) {
  const visibleItems = items.filter((item) => item.value || item.showEmpty);

  if (visibleItems.length === 0) return null;

  return (
    <section className="subsidy-detail-trust-box" aria-label="公式情報の確認ポイント">
      <div className="subsidy-detail-trust-header">
        <span className="subsidy-detail-trust-icon">✅</span>
        <div>
          <h2 className="subsidy-detail-trust-title">申請前に確認したい公式情報</h2>
          <p className="subsidy-detail-trust-lead">
            掲載情報は制度探しの入口として整理しています。申請条件や必要書類は、必ず公式ページで最新情報をご確認ください。
          </p>
        </div>
      </div>

      <dl className="subsidy-detail-trust-grid">
        {visibleItems.map((item) => (
          <div className="subsidy-detail-trust-item" key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value || '未確認'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function InfoSection({ icon, title, children }) {
  if (!hasDisplayValue(children)) return null;

  return (
    <div className="subsidy-detail-info-section">
      <h4
        className="subsidy-detail-info-heading"
        style={{
          fontSize: '15px',
          color: '#64748b',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>{icon}</span> {title}
      </h4>

      <div
        className="subsidy-detail-info-box"
        style={{
          fontSize: '15px',
          color: '#1f2937',
          backgroundColor: '#f9fafb',
          padding: '16px',
          borderRadius: '8px',
          lineHeight: '1.75',
          border: '1px solid #f1f5f9',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function SubsidyDetail() {
  const { id: subsidyId } = useParams();
  const navigate = useNavigate();

  const [subsidy, setSubsidy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchSubsidy = async () => {
      if (!supabase || !subsidyId) {
        if (!cancelled) {
          setSubsidy(null);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('subsidies')
          .select('*')
          .eq('id', subsidyId)
          .eq('is_active', true)
          .eq('crawl_status', 'published')
          .maybeSingle();

        if (error) {
          console.error('補助金詳細取得エラー:', error);
        }

        if (!cancelled) {
          setSubsidy(data || null);
          setLoading(false);
        }
      } catch (err) {
        console.error('補助金詳細取得エラー:', err);

        if (!cancelled) {
          setSubsidy(null);
          setLoading(false);
        }
      }
    };

    fetchSubsidy();

    return () => {
      cancelled = true;
    };
  }, [subsidyId]);

  const purposeTags = useMemo(() => {
    if (!subsidy) return [];
    return getPurposeTagList(subsidy);
  }, [subsidy]);

  const regionTags = useMemo(() => {
    if (!subsidy) return [];
    return getItemRegionCategories(subsidy);
  }, [subsidy]);

  const display = useMemo(() => {
    if (!subsidy) return null;

    return buildDisplaySubsidy({
      subsidy,
      purposeTags,
      regionTags,
    });
  }, [subsidy, purposeTags, regionTags]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
        }}
      >
        <SEO
          title="補助金情報を読み込み中"
          description="愛媛県内の補助金・助成金情報を読み込んでいます。"
          canonical={`/subsidy/${subsidyId || ''}`}
        />

        <Header />

        <div
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '100px 24px',
            color: '#6b7280',
          }}
        >
          ⏳ 読み込み中...
        </div>

        <Footer />
      </div>
    );
  }

  if (!subsidy || !display) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
        }}
      >
        <SEO
          title="補助金情報が見つかりません"
          description="指定された補助金情報は見つかりませんでした。公開終了、または非公開になっている可能性があります。"
          canonical={`/subsidy/${subsidyId || ''}`}
          noindex
        />

        <Header />

        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
          }}
        >
          <div
            style={{
              maxWidth: '640px',
              width: '100%',
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'center',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>

            <h1
              style={{
                fontSize: '22px',
                color: '#111827',
                margin: '0 0 12px',
              }}
            >
              補助金情報が見つかりませんでした
            </h1>

            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.8',
                margin: '0 0 24px',
              }}
            >
              指定された補助金情報は、公開終了・非公開・削除済みの可能性があります。
              <br />
              最新の補助金情報は一覧ページからご確認ください。
            </p>

            <button
              onClick={() => navigate('/search')}
              style={{
                backgroundColor: '#526b5d',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              補助金一覧へ戻る
            </button>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  const statusStyle = getStatusStyle(display.status);
  const periodStyle = getPeriodStyle(display.status);
  const canonical = `/subsidy/${subsidyId}`;
  const officialLink = isValidHttpUrl(display.officialUrl)
    ? display.officialUrl.trim()
    : '';
  const applicationStart = getFirstDisplayValue(subsidy, [
    'application_start_date',
    'start_date',
    'start_at',
  ]);
  const applicationEnd = getFirstDisplayValue(subsidy, [
    'application_end_date',
    'end_date',
    'end_at',
  ]);
  const subsidyRate =
    getFirstDisplayValue(subsidy, [
      'subsidy_rate_text',
      'subsidy_rate',
      'grant_rate_text',
      'rate_text',
    ]) || display.amountSub.replace(/^補助率[:：]\s*/, '');
  const checkedAt = getFirstDisplayValue(subsidy, [
    'official_checked_at',
    'last_checked_at',
    'checked_at',
    'fetched_at',
    'updated_at',
  ]);
  const trustItems = [
    { label: '公募ステータス', value: display.status },
    { label: '申請期間', value: display.applicationPeriod },
    { label: '受付開始日', value: formatDateForDetail(applicationStart) },
    { label: '受付終了日', value: formatDateForDetail(applicationEnd) },
    { label: '実施機関', value: display.organization },
    { label: '対象地域', value: display.region },
    { label: '対象者', value: display.targetEntities },
    { label: '補助上限額', value: display.amountMain },
    { label: '補助率', value: subsidyRate },
    {
      label: '公式URL',
      value: officialLink ? (
        <a href={officialLink} target="_blank" rel="noopener noreferrer">
          公式ページを開く ↗
        </a>
      ) : (
        ''
      ),
    },
    {
      label: '公式情報確認日',
      value: formatDateForDetail(checkedAt),
      showEmpty: true,
    },
  ];

  return (
    <div
      className="subsidy-detail-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily:
          '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
      }}
    >
      <SubsidySEO subsidy={subsidy} canonical={canonical} />

      <Header />

      <main className="subsidy-detail-main" style={{ flex: 1, paddingBottom: '80px' }}>
        <div
          className="subsidy-detail-shell"
          style={{
            maxWidth: '800px',
            margin: '40px auto',
            padding: '0 24px',
          }}
        >
          <div
            className="subsidy-detail-back-wrap"
            style={{
              marginBottom: '24px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <button
              className="subsidy-detail-back-button"
              onClick={() => navigate('/search')}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ← 一覧へ戻る
            </button>

            <Link
              to="/ehime-subsidy/"
              style={{
                color: '#0f7b6c',
                fontSize: '14px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              愛媛県の補助金一覧へ戻る
            </Link>
          </div>

          <article
            className="subsidy-detail-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            }}
          >
            <div
              className="subsidy-detail-card-inner"
              style={{
                padding: '40px 48px',
              }}
            >
              <div
                className="subsidy-detail-meta-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  className="subsidy-detail-status"
                  style={{
                    ...statusStyle,
                    fontSize: '13px',
                    fontWeight: 'bold',
                    padding: '4px 12px',
                    borderRadius: '4px',
                  }}
                >
                  {display.status}
                </span>

                <span
                  className="subsidy-detail-region"
                  style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: 'bold',
                  }}
                >
                  📍 {display.organization ? `${display.organization} / ` : ''}
                  {display.region || '全国'}
                </span>
              </div>

              <h1
                className="subsidy-detail-title"
                style={{
                  fontSize: '28px',
                  color: '#111827',
                  margin: '0 0 24px 0',
                  lineHeight: '1.4',
                  fontWeight: '800',
                }}
              >
                {display.title}
              </h1>

              <div
                className="subsidy-detail-amount-card"
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '24px',
                  marginBottom: '32px',
                }}
              >
                <div
                  className="subsidy-detail-amount-label"
                  style={{
                    fontSize: '14px',
                    color: '#64748b',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                  }}
                >
                  💰 補助上限額・補助率
                </div>

                <div
                  className="subsidy-detail-amount-value"
                  style={{
                    fontSize: '20px',
                    color: '#0f7b6c',
                    fontWeight: '800',
                    lineHeight: '1.4',
                  }}
                >
                  {display.amountMain}
                </div>

                {display.amountSub ? (
                  <div
                    className="subsidy-detail-amount-sub"
                    style={{
                      fontSize: '14px',
                      color: '#475569',
                      marginTop: '8px',
                      lineHeight: '1.6',
                    }}
                  >
                    {display.amountSub}
                  </div>
                ) : null}
              </div>

              <TrustInfoBox items={trustItems} />

              <div className="subsidy-detail-section" style={{ marginBottom: '32px' }}>
                <h3
                  className="subsidy-detail-section-title"
                  style={{
                    fontSize: '18px',
                    color: '#1f2937',
                    borderBottom: '2px solid #526b5d',
                    paddingBottom: '8px',
                    marginBottom: '16px',
                  }}
                >
                  制度の概要
                </h3>

                <p
                  className="subsidy-detail-overview"
                  style={{
                    fontSize: '15px',
                    color: '#4b5563',
                    lineHeight: '1.8',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {display.overview}
                </p>
              </div>

              <div
                className="subsidy-detail-info-grid"
                style={{
                  display: 'grid',
                  gap: '24px',
                  marginBottom: '40px',
                }}
              >
                <InfoSection icon="🎯" title="対象事業者">
                  {display.targetEntities}
                </InfoSection>

                <InfoSection icon="🏢" title="対象となる経費・取り組み">
                  {display.targetExpenses}
                </InfoSection>

                <div>
                  <h4
                    className="subsidy-detail-info-heading"
                    style={{
                      fontSize: '15px',
                      color: '#64748b',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>📅</span> 申請期間
                  </h4>

                  <div
                    className="subsidy-detail-period-box"
                    style={{
                      fontSize: '15px',
                      color: periodStyle.color,
                      fontWeight: 'bold',
                      backgroundColor: periodStyle.backgroundColor,
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${periodStyle.borderColor}`,
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {display.applicationPeriod}
                  </div>
                </div>
              </div>

              {display.tags.length > 0 && (
                <div className="subsidy-detail-tags-section" style={{ marginBottom: '40px' }}>
                  <h4
                    className="subsidy-detail-tags-heading"
                    style={{
                      fontSize: '14px',
                      color: '#64748b',
                      marginBottom: '12px',
                    }}
                  >
                    🏷 関連キーワード
                  </h4>

                  <div
                    className="subsidy-detail-tags"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {display.tags.map((tag) => (
                      <span
                        className="subsidy-detail-tag"
                        key={tag}
                        style={{
                          backgroundColor: '#ecfdf5',
                          color: '#059669',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          border: '1px solid #a7f3d0',
                          fontWeight: 'bold',
                        }}
                      >
                        # {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="subsidy-detail-official-wrap" style={{ textAlign: 'center', marginBottom: '32px' }}>
                {officialLink ? (
                  <a
                    className="subsidy-detail-official-link"
                    href={officialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#e76305',
                      color: 'white',
                      padding: '16px 32px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      textDecoration: 'none',
                      boxShadow: '0 4px 6px rgba(231, 99, 5, 0.2)',
                    }}
                  >
                    公式ページで詳細を確認する ↗
                  </a>
                ) : (
                  <div
                    className="subsidy-detail-official-empty"
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                      padding: '16px 32px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    公式ページURLは登録されていません
                  </div>
                )}
              </div>

              <div
                className="subsidy-detail-disclaimer"
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  lineHeight: '1.6',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '48px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                }}
              >
                掲載している情報は、AIを活用して収集・整理したデータをもとに作成しております。
                そのため、内容に誤りや最新情報との相違が含まれる可能性がございます。
                ご利用の際は、必ず各制度・事業の公式ページにて最新かつ正確な情報をご確認くださいますようお願いいたします。
              </div>

              <div
                className="subsidy-detail-consult-box"
                style={{
                  padding: '32px',
                  backgroundColor: '#f4f6f5',
                  borderRadius: '12px',
                  border: '1px solid #e4e7e5',
                }}
              >
                <h3
                  className="subsidy-detail-consult-title"
                  style={{
                    fontSize: '18px',
                    color: '#2d3b33',
                    marginTop: 0,
                    marginBottom: '16px',
                    fontWeight: 'bold',
                  }}
                >
                  申請に不安がある・自社で使えるか知りたい方へ
                </h3>

                <p
                  className="subsidy-detail-consult-text"
                  style={{
                    fontSize: '15px',
                    color: '#4b5550',
                    lineHeight: '1.6',
                    marginBottom: '24px',
                  }}
                >
                  この補助金が自社に該当するか、申請に必要な準備がわからない場合は、
                  専門家に相談する方法もあります。
                  <br />
                  愛媛県内の事業者支援に対応できる専門家を探してみましょう。
                </p>

                <div
                  className="subsidy-detail-consult-actions"
                  style={{
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    className="subsidy-detail-consult-button"
                    onClick={() => navigate('/experts')}
                    style={{
                      flex: 1,
                      minWidth: '240px',
                      padding: '16px',
                      backgroundColor: '#526b5d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#3b4d43';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#526b5d';
                    }}
                  >
                    相談できる専門家を探す ↗
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
