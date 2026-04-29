import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import {
  isItemClosed,
  getPurposeTagList,
  getItemRegionCategories,
} from './portalHelpers';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const isValidHttpUrl = (url) => {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url.trim());
};

const getOfficialLink = (subsidy) => {
  if (isValidHttpUrl(subsidy?.official_url)) {
    return subsidy.official_url.trim();
  }

  if (isValidHttpUrl(subsidy?.source_url)) {
    return subsidy.source_url.trim();
  }

  return '';
};

const getApplicationStatusLabel = (subsidy, isClosed) => {
  const status = subsidy?.application_status || '';

  if (isClosed || status === '受付終了') {
    return '受付終了';
  }

  if (status === '予告') {
    return '予告';
  }

  if (status === '公募中') {
    return '公募中';
  }

  return '要確認';
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

const getPeriodText = (subsidy) => {
  return (
    subsidy?.application_period_text ||
    subsidy?.deadline ||
    '随時募集（または要確認）'
  );
};

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

  if (!subsidy) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
        }}
      >
        <Helmet>
          <title>補助金情報が見つかりません | 愛媛の補助金ポータル</title>
          <meta
            name="description"
            content="指定された補助金情報は見つかりませんでした。公開終了、または非公開になっている可能性があります。"
          />
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>

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

  const isClosed = isItemClosed(subsidy);
  const statusLabel = getApplicationStatusLabel(subsidy, isClosed);
  const statusStyle = getStatusStyle(statusLabel);
  const periodText = getPeriodText(subsidy);
  const officialLink = getOfficialLink(subsidy);

  const purposeTags = getPurposeTagList(subsidy);
  const regionTags = getItemRegionCategories(subsidy);
  const tags = [...new Set([...purposeTags, ...regionTags])].filter(Boolean);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily:
          '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
      }}
    >
      <Helmet>
        <title>{subsidy.title} | 愛媛の補助金ポータル</title>
        <meta
          name="description"
          content={
            subsidy.summary ||
            '愛媛県内の補助金・助成金の詳細情報です。対象者や申請期限を確認できます。'
          }
        />
        <meta
          property="og:title"
          content={`${subsidy.title} | 愛媛の補助金ポータル`}
        />
        <meta
          property="og:description"
          content={
            subsidy.summary ||
            '愛媛県内の補助金・助成金の詳細情報です。'
          }
        />
      </Helmet>

      <Header />

      <main style={{ flex: 1, paddingBottom: '80px' }}>
        <div
          style={{
            maxWidth: '800px',
            margin: '40px auto',
            padding: '0 24px',
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <button
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
          </div>

          <article
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ padding: '40px 48px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    ...statusStyle,
                    fontSize: '13px',
                    fontWeight: 'bold',
                    padding: '4px 12px',
                    borderRadius: '4px',
                  }}
                >
                  {statusLabel}
                </span>

                <span
                  style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: 'bold',
                  }}
                >
                  📍 {subsidy.organization ? `${subsidy.organization} / ` : ''}
                  {subsidy.region_text || subsidy.region || '愛媛県'}
                </span>
              </div>

              <h1
                style={{
                  fontSize: '28px',
                  color: '#111827',
                  margin: '0 0 24px 0',
                  lineHeight: '1.4',
                  fontWeight: '800',
                }}
              >
                {subsidy.title}
              </h1>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '24px',
                  marginBottom: '32px',
                }}
              >
                <div
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
                  style={{
                    fontSize: '20px',
                    color: '#0f7b6c',
                    fontWeight: '800',
                    lineHeight: '1.4',
                  }}
                >
                  {subsidy.amount_text ||
                    subsidy.amount ||
                    '公式ページをご確認ください'}
                </div>

                {subsidy.subsidy_rate_text || subsidy.subsidy_rate ? (
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#475569',
                      marginTop: '8px',
                      lineHeight: '1.6',
                    }}
                  >
                    補助率：{subsidy.subsidy_rate_text || subsidy.subsidy_rate}
                  </div>
                ) : null}
              </div>

              <div style={{ marginBottom: '32px' }}>
                <h3
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
                  style={{
                    fontSize: '15px',
                    color: '#4b5563',
                    lineHeight: '1.8',
                  }}
                >
                  {subsidy.summary || '詳細は公式ページをご確認ください。'}
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '24px',
                  marginBottom: '40px',
                }}
              >
                <div>
                  <h4
                    style={{
                      fontSize: '15px',
                      color: '#64748b',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🎯</span> 対象事業者
                  </h4>

                  <div
                    style={{
                      fontSize: '15px',
                      color: '#1f2937',
                      backgroundColor: '#f9fafb',
                      padding: '16px',
                      borderRadius: '8px',
                      lineHeight: '1.6',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    {subsidy.target_entities ||
                      '詳細は公式ページをご確認ください。'}
                  </div>
                </div>

                <div>
                  <h4
                    style={{
                      fontSize: '15px',
                      color: '#64748b',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🏢</span> 対象となる経費・取り組み
                  </h4>

                  <div
                    style={{
                      fontSize: '15px',
                      color: '#1f2937',
                      backgroundColor: '#f9fafb',
                      padding: '16px',
                      borderRadius: '8px',
                      lineHeight: '1.6',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    {subsidy.target_expenses ||
                      '詳細は公式ページをご確認ください。'}
                  </div>
                </div>

                <div>
                  <h4
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
                    style={{
                      fontSize: '15px',
                      color:
                        statusLabel === '受付終了'
                          ? '#6b7280'
                          : statusLabel === '予告'
                            ? '#92400e'
                            : '#dc2626',
                      fontWeight: 'bold',
                      backgroundColor:
                        statusLabel === '受付終了'
                          ? '#f3f4f6'
                          : statusLabel === '予告'
                            ? '#fffbeb'
                            : '#fef2f2',
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${
                        statusLabel === '受付終了'
                          ? '#e5e7eb'
                          : statusLabel === '予告'
                            ? '#fde68a'
                            : '#fecaca'
                      }`,
                      lineHeight: '1.6',
                    }}
                  >
                    {periodText}
                  </div>
                </div>
              </div>

              {tags.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                  <h4
                    style={{
                      fontSize: '14px',
                      color: '#64748b',
                      marginBottom: '12px',
                    }}
                  >
                    🏷 関連キーワード
                  </h4>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {tags.map((tag) => (
                      <span
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

              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                {officialLink ? (
                  <a
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
                style={{
                  padding: '32px',
                  backgroundColor: '#f4f6f5',
                  borderRadius: '12px',
                  border: '1px solid #e4e7e5',
                }}
              >
                <h3
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
                  style={{
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
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