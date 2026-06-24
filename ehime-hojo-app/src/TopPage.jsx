import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTopFeaturePages } from './featurePages';
import FeatureIcon from './components/FeatureIcon';
import { supabase } from './lib/supabaseClient';

const colors = {
  primary: '#19aeb8',
  primaryLight: '#e8fbfc',
  textMain: '#4b5550',
  textSub: '#8b9690',
  border: '#e4e7e5',
  accentOrange: '#e76305',
  buttonColor: '#084a55',
};

const BANNERS = [
  '/banner4.png',
  '/banner5.png',
  '/banner6.png',
  '/banner-adobe-designer-subsidy.png',
];

const MOBILE_BANNERS = [
  '/m_banner1.png',
  '/m_banner2.png',
  '/m_banner3.png',
  '/m_banner-adobe-designer-subsidy.png',
];

const BANNER_LINKS = [
  '',
  '',
  '',
  '/column/adobe-creative-cloud-pro-hojokin-designer',
];

const BANNER_OVERLAYS = [
  null,
  null,
  null,
  {
    label: 'デザイナー向け特集',
    title: 'Creative Cloud Proに補助金は使える？',
    description: 'Adobe公式で買う前に、対象ITツールと支援事業者を確認。',
    cta: '記事を読む',
  },
];

const DESIGNER_COLUMN_BANNER = {
  path: '/column/adobe-creative-cloud-pro-hojokin-designer',
  image: '/images/columns/adobe-creative-cloud-pro-hojokin-designer.jpg',
  label: 'デザイナー向け特集',
  title: 'Creative Cloud Proに補助金は使える？',
  description:
    '個人事業主のデザイナーが、Adobe公式で買う前に確認したいIT導入支援事業者・対象ツール・申請順序を整理しました。',
};

const getFeatureCardIcon = (feature) => {
  const text = `${feature?.title || ''} ${feature?.category || ''}`;

  if (text.includes('建設') || text.includes('建築')) return '🏗️';
  if (text.includes('飲食') || text.includes('小売') || text.includes('店舗')) return '🍽️';
  if (text.includes('創業') || text.includes('起業')) return '🚀';
  if (text.includes('IT') || text.includes('DX') || text.includes('デジタル')) return '💻';
  if (text.includes('農業') || text.includes('林業') || text.includes('水産')) return '🌱';
  if (text.includes('設備') || text.includes('省エネ')) return '⚙️';

  return '⭐';
};

// カテゴリ名に応じて自動で色を振り分ける関数
const getCategoryColor = (category) => {
  if (!category) return '#3b82f6';
  if (category.includes('基礎') || category.includes('用語')) return '#f59e0b';
  if (category.includes('農業') || category.includes('林業') || category.includes('水産')) return '#10b981';
  if (category.includes('IT') || category.includes('デジタル')) return '#0ea5e9';
  if (category.includes('設備') || category.includes('投資')) return '#8b5cf6';
  if (category.includes('販路') || category.includes('売上')) return '#f43f5e';
  if (category.includes('新規事業') || category.includes('第二創業')) return '#64748b';
  if (category.includes('創業') || category.includes('起業')) return '#4f766f';
  if (category.includes('承継') || category.includes('人材')) return '#64748b';

  return '#64748b';
};

const getExpertLabel = (expert) => {
  if (!expert) return '';
  return [expert.name, expert.qualification].filter(Boolean).join(' / ');
};

const getExpertArticleExcerpt = (article) => {
  return (
    article?.summary ||
    article?.lead_text ||
    '補助金・助成金の活用について、専門家目線でわかりやすく解説します。'
  );
};

function ExpertArticlePreviewCard({ article, expert, navigate }) {
  const expertLabel = getExpertLabel(expert);

  return (
    <button
      type="button"
      className="top-expert-article-card"
      onClick={() => navigate(`/expert-articles/${article.slug}`)}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '88px minmax(0, 1fr)',
        gap: '14px',
        alignItems: 'center',
        textAlign: 'left',
        backgroundColor: '#ffffff',
        border: '1px solid #dbe7e4',
        borderRadius: '12px',
        padding: '14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        minWidth: 0,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 14px 26px rgba(15, 123, 108, 0.12)';
        e.currentTarget.style.borderColor = '#0f7b6c';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.04)';
        e.currentTarget.style.borderColor = '#dbe7e4';
      }}
    >
      <div
        style={{
          width: '88px',
          aspectRatio: '4 / 3',
          borderRadius: '10px',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #ecfdf5 0%, #f8fafc 70%, #eef2f7 100%)',
          display: 'grid',
          placeItems: 'center',
          color: '#0f7b6c',
          fontSize: '11px',
          fontWeight: 900,
          letterSpacing: '0.08em',
        }}
      >
        {article.main_image_url ? (
          <img
            src={article.main_image_url}
            alt=""
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <span>Q&A</span>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        {expertLabel && (
          <div
            style={{
              color: '#64748b',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '5px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {expertLabel}
          </div>
        )}

        <h4
          style={{
            margin: '0 0 6px',
            color: '#0f172a',
            fontSize: '15px',
            lineHeight: 1.45,
            fontWeight: 800,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {article.title}
        </h4>

        <p
          style={{
            margin: 0,
            color: '#64748b',
            fontSize: '12px',
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {getExpertArticleExcerpt(article)}
        </p>
      </div>
    </button>
  );
}

function ExpertArticlesEntrySection({ articles, experts, loading, navigate }) {
  const hasArticles = articles.length > 0;

  return (
    <section className="top-expert-qa-section" style={{ marginBottom: '56px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '20px',
          alignItems: 'stretch',
          backgroundColor: '#f8fafc',
          border: '1px solid #dbe7e4',
          borderRadius: '18px',
          padding: 'clamp(20px, 4vw, 34px)',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
          boxSizing: 'border-box',
          minWidth: 0,
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            minWidth: 0,
          }}
        >
          <div
            style={{
              color: '#0f7b6c',
              fontSize: '12px',
              fontWeight: 900,
              letterSpacing: '0.12em',
              marginBottom: '12px',
            }}
          >
            EXPERT Q&A
          </div>

          <h3
            style={{
              margin: '0 0 14px',
              color: '#0f172a',
              fontSize: 'clamp(22px, 3vw, 30px)',
              lineHeight: 1.35,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            専門家に聞く、補助金Q&A
          </h3>

          <p
            style={{
              margin: '0 0 22px',
              color: '#475569',
              fontSize: '15px',
              lineHeight: 1.8,
            }}
          >
            補助金申請のよくある疑問や準備のポイントを、専門家目線のQ&A記事でわかりやすく解説します。
          </p>

          <button
            type="button"
            onClick={() => navigate('/expert-articles')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#0f7b6c',
              border: 'none',
              borderRadius: '999px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 800,
              padding: '12px 20px',
              cursor: 'pointer',
              boxShadow: '0 10px 20px rgba(15, 123, 108, 0.18)',
            }}
          >
            専門家Q&A記事を見る <span aria-hidden="true">→</span>
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '12px',
            alignContent: hasArticles ? 'start' : 'center',
            minWidth: 0,
          }}
        >
          {hasArticles ? (
            articles.map((article) => (
              <ExpertArticlePreviewCard
                key={article.id}
                article={article}
                expert={experts[article.expert_id]}
                navigate={navigate}
              />
            ))
          ) : (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px dashed #bdd8d2',
                borderRadius: '14px',
                padding: '22px',
                color: '#64748b',
                fontSize: '14px',
                lineHeight: 1.7,
              }}
            >
              {loading
                ? '最新の専門家Q&A記事を確認しています。'
                : '公開中の専門家Q&A記事を準備中です。記事一覧ページから公開後の記事を確認できます。'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DesignerColumnBanner() {
  return (
    <Link
      to={DESIGNER_COLUMN_BANNER.path}
      className="top-designer-column-banner"
      aria-label="デザイナー向け補助金特集"
      style={{
        margin: '-28px 0 56px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '22px',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '22px',
        backgroundColor: '#ffffff',
        border: '1px solid #dbe7e4',
        borderRadius: '12px',
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        minWidth: 0,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 18px 36px rgba(15, 123, 108, 0.13)';
        e.currentTarget.style.borderColor = '#0f7b6c';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 12px 28px rgba(15, 23, 42, 0.06)';
        e.currentTarget.style.borderColor = '#dbe7e4';
      }}
    >
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            color: '#0f7b6c',
            fontSize: '12px',
            lineHeight: 1.4,
            fontWeight: 900,
            letterSpacing: '0.08em',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '999px',
              backgroundColor: '#ecfdf5',
              color: '#0f7b6c',
              fontSize: '15px',
            }}
          >
            ✍
          </span>
          {DESIGNER_COLUMN_BANNER.label}
        </div>

        <h2
          style={{
            margin: '0 0 8px',
            color: '#0f172a',
            fontSize: 'clamp(19px, 2.4vw, 24px)',
            lineHeight: 1.4,
            fontWeight: 900,
            letterSpacing: 0,
            overflowWrap: 'break-word',
          }}
        >
          {DESIGNER_COLUMN_BANNER.title}
        </h2>

        <p
          style={{
            margin: '0 0 16px',
            color: '#475569',
            fontSize: '14px',
            lineHeight: 1.75,
            overflowWrap: 'break-word',
          }}
        >
          {DESIGNER_COLUMN_BANNER.description}
        </p>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '36px',
            padding: '0 14px',
            borderRadius: '8px',
            backgroundColor: '#084a55',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 900,
          }}
        >
          記事を読む →
        </span>
      </div>

      <div
        className="top-designer-column-image"
        style={{
          flex: '0 1 184px',
          width: '184px',
          maxWidth: '100%',
          aspectRatio: '4 / 3',
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: '#f1f5f9',
          border: '1px solid #e5e7eb',
        }}
      >
        <img
          src={DESIGNER_COLUMN_BANNER.image}
          alt=""
          loading="lazy"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
          }}
        />
      </div>
    </Link>
  );
}

function FeatureHighlightsSection({ featureCards, navigate, colors }) {
  return (
    <section className="top-feature-section" style={{ marginBottom: '64px' }}>
      <div
        className="top-section-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          borderBottom: '1px dashed #94a3b8',
          marginBottom: '24px',
        }}
      >
        <h3
          className="top-section-title top-section-title-ja"
          style={{
            margin: '0',
            fontSize: '22px',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '800',
            letterSpacing: '1px',
          }}
        >
          <span style={{ color: '#19aeb8' }}>🔎</span> 人気の特集から探す
        </h3>

        <button
          type="button"
          className="top-section-action"
          onClick={() => navigate('/features')}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #19aeb8',
            borderRadius: '20px',
            color: '#19aeb8',
            fontSize: '13px',
            fontWeight: 'bold',
            padding: '6px 18px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#19aeb8';
            e.currentTarget.style.color = 'white';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#19aeb8';
          }}
        >
          すべての特集を見る
        </button>
      </div>

      <div
        className="top-feature-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: '12px',
        }}
      >
        {featureCards.map((feature) => (
          <button
            key={feature.id || feature.path}
            type="button"
            className="top-feature-card"
            onClick={() => navigate(feature.path)}
            style={{
              backgroundColor: 'white',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '22px 14px 18px',
              textAlign: 'left',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
              fontFamily: 'inherit',
              minHeight: '262px',
              display: 'flex',
              flexDirection: 'column',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 10px 22px rgba(25, 174, 184, 0.14)';
              e.currentTarget.style.borderColor = colors.primary;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            {feature.thumbnailUrl ? (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  backgroundColor: '#f1f5f9',
                  marginBottom: '14px',
                }}
              >
                <img
                  src={feature.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            ) : (
              <div
                className="top-feature-icon"
                style={{
                  height: '82px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}
              >
                <FeatureIcon slug={feature.id} color="#0f5f68" size={72} strokeWidth={2.5} />
              </div>
            )}

            <h4
              className="top-feature-card-title"
              style={{
                margin: '0 0 10px',
                color: '#0f172a',
                fontSize: '14px',
                lineHeight: 1.55,
                fontWeight: '800',
                minHeight: '66px',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {feature.title}
            </h4>

            <p
              className="top-feature-card-description"
              style={{
                margin: 0,
                color: colors.textSub,
                fontSize: '12px',
                lineHeight: 1.7,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                minHeight: '82px',
              }}
            >
              {feature.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function TopPage({ recentSubsidies, latestColumns, featureColumns }) {
  const navigate = useNavigate();
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [expertArticles, setExpertArticles] = useState([]);
  const [expertArticleExperts, setExpertArticleExperts] = useState({});
  const [expertArticlesLoading, setExpertArticlesLoading] = useState(true);

  const featureCards = useMemo(() => {
    return getTopFeaturePages(6).map((feature) => ({
      id: feature.slug,
      icon: feature.icon || getFeatureCardIcon(feature),
      title: feature.title,
      description: feature.description,
      path: feature.path,
      color: feature.color,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchExpertArticles = async () => {
      if (!supabase) {
        setExpertArticlesLoading(false);
        return;
      }

      setExpertArticlesLoading(true);

      const { data, error } = await supabase
        .from('expert_articles')
        .select('id, expert_id, title, slug, summary, lead_text, main_image_url, published_at')
        .eq('status', 'published')
        .eq('is_active', true)
        .not('slug', 'is', null)
        .neq('slug', '')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(3);

      if (error) {
        console.warn('専門家Q&A記事取得エラー:', error.message || error);
        if (!cancelled) {
          setExpertArticles([]);
          setExpertArticleExperts({});
          setExpertArticlesLoading(false);
        }
        return;
      }

      const rows = data || [];
      const expertIds = [...new Set(rows.map((item) => item.expert_id).filter(Boolean))];
      const nextExperts = {};

      if (expertIds.length > 0) {
        const { data: expertRows, error: expertError } = await supabase
          .from('experts')
          .select('id, name, qualification')
          .in('id', expertIds);

        if (expertError) {
          console.warn('専門家情報取得エラー:', expertError.message || expertError);
        } else {
          (expertRows || []).forEach((expert) => {
            nextExperts[expert.id] = expert;
          });
        }
      }

      if (!cancelled) {
        setExpertArticles(rows);
        setExpertArticleExperts(nextExperts);
        setExpertArticlesLoading(false);
      }
    };

    fetchExpertArticles();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (BANNERS.length <= 1) return undefined;

    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % BANNERS.length);
    }, 5200);

    return () => clearInterval(timer);
  }, []);

  const goToPrevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + BANNERS.length) % BANNERS.length);
  };

  const goToNextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % BANNERS.length);
  };

  return (
    <>
      {/* ファーストビュー：ブランド感を出すターコイズ帯＋中央バナー */}
      <section
        className="top-visual-hero"
        style={{
          position: 'relative',
          width: '100vw',
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          backgroundColor: '#ffffff',
          padding: '0 0 34px',
          marginBottom: '38px',
          overflow: 'hidden',
        }}
      >
        <div
          className="top-visual-band"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100vw',
            height: 'clamp(112px, 15vw, 206px)',
            backgroundColor: '#19aeb8',
          }}
        />
        <div
          className="top-visual-banner-frame"
          style={{
            position: 'relative',
            zIndex: 1,
            width: 'min(84vw, 1480px)',
            aspectRatio: '2048 / 768',
            margin: '42px auto 0',
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <div
            className="top-visual-carousel-track"
            style={{
              display: 'flex',
              width: `${BANNERS.length * 100}%`,
              height: '100%',
              transform: `translateX(-${currentBannerIndex * (100 / BANNERS.length)}%)`,
              transition: 'transform 0.78s cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
            }}
          >
            {BANNERS.map((banner, index) => {
              const link = BANNER_LINKS[index];
              const overlay = BANNER_OVERLAYS[index];
              const slideInner = (
                <>
                  <picture
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'block',
                    }}
                  >
                    <source
                      media="(max-width: 768px)"
                      srcSet={MOBILE_BANNERS[index] || banner}
                    />
                    <img
                      src={banner}
                      alt={
                        overlay
                          ? 'デザイナー向けCreative Cloud Pro補助金特集バナー'
                          : `愛媛県の補助金・助成金ポータルのプロモーションバナー ${index + 1}`
                      }
                      draggable="false"
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        objectFit: 'cover',
                        objectPosition: 'center center',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  </picture>

                  {overlay && (
                    <div
                      className="top-visual-slide-overlay"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        padding: 'clamp(24px, 5vw, 72px)',
                        pointerEvents: 'none',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '520px',
                          color: '#0f172a',
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            minHeight: '28px',
                            padding: '0 10px',
                            borderRadius: '999px',
                            backgroundColor: '#ecfdf5',
                            color: '#0f7b6c',
                            fontSize: '12px',
                            lineHeight: 1.4,
                            fontWeight: 900,
                            letterSpacing: '0.08em',
                            marginBottom: '12px',
                          }}
                        >
                          {overlay.label}
                        </div>

                        <h2
                          style={{
                            margin: '0 0 10px',
                            fontSize: 'clamp(23px, 3.2vw, 42px)',
                            lineHeight: 1.25,
                            fontWeight: 900,
                            letterSpacing: 0,
                            color: '#0f172a',
                          }}
                        >
                          {overlay.title}
                        </h2>

                        <p
                          style={{
                            margin: '0 0 18px',
                            color: '#334155',
                            fontSize: 'clamp(13px, 1.4vw, 17px)',
                            lineHeight: 1.75,
                            fontWeight: 700,
                          }}
                        >
                          {overlay.description}
                        </p>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '40px',
                            padding: '0 18px',
                            borderRadius: '8px',
                            backgroundColor: '#084a55',
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: 900,
                            boxShadow: '0 8px 18px rgba(8, 74, 85, 0.2)',
                          }}
                        >
                          {overlay.cta} →
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );

              return (
                <div
                  key={banner}
                  className="top-visual-slide"
                  style={{
                    width: `${100 / BANNERS.length}%`,
                    flex: `0 0 ${100 / BANNERS.length}%`,
                    height: '100%',
                    backgroundColor: '#ffffff',
                    position: 'relative',
                  }}
                >
                  {link ? (
                    <Link
                      to={link}
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        textDecoration: 'none',
                      }}
                    >
                      {slideInner}
                    </Link>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                      }}
                    >
                      {slideInner}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {BANNERS.length > 1 && (
            <>
              <button
                type="button"
                className="top-visual-arrow top-visual-arrow-prev"
                onClick={goToPrevBanner}
                aria-label="前のバナーへ"
              >
                &lt;
              </button>

              <button
                type="button"
                className="top-visual-arrow top-visual-arrow-next"
                onClick={goToNextBanner}
                aria-label="次のバナーへ"
              >
                &gt;
              </button>

              <div className="top-visual-dots" aria-label="バナー切り替え">
                {BANNERS.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`top-visual-dot ${
                      currentBannerIndex === index ? 'is-active' : ''
                    }`}
                    onClick={() => setCurrentBannerIndex(index)}
                    aria-label={`バナー ${index + 1} へ移動`}
                    aria-current={currentBannerIndex === index}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <div
        className="top-page-content"
        style={{
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '0 24px 80px',
          backgroundColor: '#ffffff',
        }}
      >
        {/* 3つの大きなボタン */}
        <div
          className="top-action-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            marginBottom: '80px',
          }}
        >
          <div
            onClick={() => navigate('/search')}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: `2px solid ${colors.border}`,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 18px rgba(25, 174, 184, 0.18)';
              e.currentTarget.style.borderColor = colors.buttonColor;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.buttonColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <h3
              style={{
                margin: '0 0 12px 0',
                color: colors.buttonColor,
                fontSize: '20px',
                fontWeight: 'bold',
              }}
            >
              補助金を探す
            </h3>

            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: colors.textMain,
                lineHeight: '1.5',
              }}
            >
              愛媛県内の最新の補助金・助成金を検索できます。
            </p>
          </div>

          <div
            onClick={() => navigate('/experts')}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: `2px solid ${colors.border}`,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 18px rgba(25, 174, 184, 0.18)';
              e.currentTarget.style.borderColor = colors.buttonColor;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.buttonColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            <h3
              style={{
                margin: '0 0 12px 0',
                color: colors.buttonColor,
                fontSize: '20px',
                fontWeight: 'bold',
              }}
            >
              専門家を探す
            </h3>

            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: colors.textMain,
                lineHeight: '1.5',
              }}
            >
              申請をサポートしてくれる地元の専門家を探せます。
            </p>
          </div>

          <div
            onClick={() => navigate('/beginners')}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: `2px solid ${colors.border}`,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 18px rgba(25, 174, 184, 0.18)';
              e.currentTarget.style.borderColor = colors.buttonColor;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.buttonColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
            </div>

            <h3
              style={{
                margin: '0 0 12px 0',
                color: colors.buttonColor,
                fontSize: '20px',
                fontWeight: 'bold',
              }}
            >
              はじめての方へ
            </h3>

            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: colors.textMain,
                lineHeight: '1.5',
              }}
            >
              補助金の基礎知識や申請の流れを解説します。
            </p>
          </div>
        </div>

        <section
          style={{
            margin: '-42px 0 56px',
            padding: '22px 24px',
            backgroundColor: '#f8fafc',
            border: '1px solid #dbe7e4',
            borderRadius: '8px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <h2
              style={{
                margin: '0 0 6px',
                color: '#2d3b33',
                fontSize: '18px',
                lineHeight: 1.45,
                fontWeight: 800,
              }}
            >
              愛媛県内の制度をまとめて確認
            </h2>
            <p
              style={{
                margin: 0,
                color: colors.textMain,
                fontSize: '14px',
                lineHeight: 1.7,
              }}
            >
              個人向け、事業者向け、市町村別、目的別に補助金・助成金・給付金を探せます。
            </p>
          </div>

          <Link
            to="/ehime-subsidy/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              padding: '0 18px',
              borderRadius: '8px',
              backgroundColor: colors.buttonColor,
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 800,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            愛媛県の補助金一覧を見る
          </Link>
        </section>

        <DesignerColumnBanner />

        <ExpertArticlesEntrySection
          articles={expertArticles}
          experts={expertArticleExperts}
          loading={expertArticlesLoading}
          navigate={navigate}
        />

        {/* 新着情報セクション */}
        <div style={{ marginBottom: '48px' }}>
          <div
            className="top-section-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '16px',
              borderBottom: '1px dashed #94a3b8',
            }}
          >
            <h3
              className="top-section-title"
              style={{
                margin: 0,
                fontSize: '22px',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '800',
                letterSpacing: '1px',
              }}
            >
              <span style={{ color: '#19aeb8' }}>✨</span> NEWS
            </h3>

            <button
              className="top-section-action"
              onClick={() => navigate('/search')}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #19aeb8',
                borderRadius: '20px',
                color: '#19aeb8',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '6px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#19aeb8';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#19aeb8';
              }}
            >
              お知らせ一覧へ
            </button>
          </div>

          <div
            className="top-list"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}
          >
            {!recentSubsidies || recentSubsidies.length === 0 ? (
              <p
                style={{
                  color: colors.textSub,
                  fontSize: '14px',
                  textAlign: 'center',
                  padding: '32px 0',
                }}
              >
                現在、新着情報はありません。
              </p>
            ) : (
              recentSubsidies.map((item, idx) => {
                const dateObj = item.fetched_at ? new Date(item.fetched_at) : new Date();

                const dateStr = `${dateObj.getFullYear()}.${String(
                  dateObj.getMonth() + 1
                ).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;

                return (
                  <div
                    className="top-list-item"
                    key={item.id || idx}
                    onClick={() => navigate(`/subsidy/${item.id}`)}
                    style={{
                      display: 'flex',
                      gap: '24px',
                      padding: '20px 24px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #edf2f3',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      alignItems: 'center',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3fcfd';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <div
                      className="top-list-date"
                      style={{
                        fontSize: '14px',
                        color: '#64748b',
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                      }}
                    >
                      {dateStr}
                    </div>

                    <div className="top-list-badge-wrap" style={{ flexShrink: 0 }}>
                      <span
                        className="top-list-badge"
                        style={{
                          backgroundColor: '#19aeb8',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        お知らせ
                      </span>
                    </div>

                    <div className="top-list-text" style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        className="top-list-title"
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          color: '#1e293b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: '500',
                        }}
                      >
                        {item.organization ? `【${item.organization}】` : ''}
                        {item.title}
                      </h4>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 新着コラムセクション */}
        <div style={{ marginBottom: '48px' }}>
          <div
            className="top-section-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '16px',
              borderBottom: '1px dashed #94a3b8',
            }}
          >
            <h3
              className="top-section-title top-section-title-ja"
              style={{
                margin: '0',
                fontSize: '22px',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '800',
                letterSpacing: '1px',
              }}
            >
              <span style={{ color: '#19aeb8' }}>📘</span> 今、確認しておきたい愛媛の補助金
            </h3>

            <button
              className="top-section-action"
              onClick={() => navigate('/columns')}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #19aeb8',
                borderRadius: '20px',
                color: '#19aeb8',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '6px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#19aeb8';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#19aeb8';
              }}
            >
              コラム一覧へ
            </button>
          </div>

          <div
            className="top-list"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}
          >
            {!latestColumns || latestColumns.length === 0 ? (
              <p
                style={{
                  color: colors.textSub,
                  fontSize: '14px',
                  textAlign: 'center',
                  padding: '32px 0',
                }}
              >
                現在公開中のコラムはありません。
              </p>
            ) : (
              latestColumns.map((col, idx) => {
                const dateObj = new Date(col.published_at || col.created_at);

                const dateStr = `${dateObj.getFullYear()}.${String(
                  dateObj.getMonth() + 1
                ).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;

                const tagColor = getCategoryColor(col.category);

                return (
                  <a
                    className="top-list-item"
                    key={col.id || idx}
                    href={`/column/${col.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/column/${col.slug}`);
                    }}
                    style={{
                      display: 'flex',
                      gap: '24px',
                      padding: '20px 24px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #edf2f3',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      alignItems: 'center',
                      textDecoration: 'none',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3fcfd';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <div
                      className="top-list-date"
                      style={{
                        fontSize: '14px',
                        color: '#64748b',
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                      }}
                    >
                      {dateStr}
                    </div>

                    <div className="top-list-badge-wrap" style={{ flexShrink: 0 }}>
                      <span
                        className="top-list-badge"
                        style={{
                          backgroundColor: tagColor,
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          display: 'inline-block',
                          textAlign: 'center',
                          minWidth: '60px',
                        }}
                      >
                        {col.category || 'コラム'}
                      </span>
                    </div>

                    <div className="top-list-text" style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        className="top-list-title"
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          color: '#1e293b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: '500',
                        }}
                      >
                        {col.title}
                      </h4>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>

        <FeatureHighlightsSection
          featureCards={featureCards}
          navigate={navigate}
          colors={colors}
        />

        {/* シミュレーター起動バナー */}
        <div
          className="simulator-banner"
          onClick={() => navigate('/simulator')}
          style={{
            backgroundColor: '#31515d',
            border: 'none',
            borderRadius: '16px',
            padding: '32px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            gap: '24px',
            flexWrap: 'wrap',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(49, 81, 93, 0.22)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-block',
                backgroundColor: '#facc15',
                color: '#000',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 'bold',
                marginBottom: '12px',
              }}
            >
              新機能
            </div>

            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '24px',
                fontWeight: '800',
                color: 'white',
              }}
            >
              💻 IT導入補助金シミュレーター
            </h2>

            <p style={{ margin: 0, color: 'white', fontSize: '15px' }}>
              自社の条件を選ぶだけで、受け取れる補助金の目安が
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>30秒</span>
              でわかります。
            </p>
          </div>

          <div
            style={{
              flexShrink: 0,
              backgroundColor: 'white',
              color: '#000',
              padding: '16px 32px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            今すぐ診断する <span style={{ fontSize: '18px' }}>→</span>
          </div>
        </div>
      </div>
    </>
  );
}
