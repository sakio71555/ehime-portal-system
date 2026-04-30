import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const colors = {
  primary: '#526b5d',
  primaryLight: '#f4f6f5',
  textMain: '#4b5550',
  textSub: '#8b9690',
  border: '#e4e7e5',
  accentOrange: '#e76305',
  buttonColor: '#084a55',
};

const BANNERS = [
  '/banner1.jpg',
  '/banner2.jpg',
  '/banner3.jpg',
];

const getCarouselSlideWidth = () => {
  if (typeof window === 'undefined') return 1100;

  const width = window.innerWidth;

  if (width < 480) return Math.max(width - 28, 300);
  if (width < 768) return Math.max(width - 44, 420);
  if (width < 1024) return Math.max(width - 96, 680);
  if (width < 1440) return Math.round(width * 0.72);

  return Math.min(1320, Math.round(width * 0.68));
};

const getCarouselGap = () => {
  if (typeof window === 'undefined') return 48;

  const width = window.innerWidth;

  if (width < 640) return 16;
  if (width < 1024) return 24;

  return 64;
};

// カテゴリ名に応じて自動で色を振り分ける関数
const getCategoryColor = (category) => {
  if (!category) return '#3b82f6';
  if (category.includes('基礎') || category.includes('用語')) return '#f59e0b';
  if (category.includes('農業') || category.includes('林業') || category.includes('水産')) return '#10b981';
  if (category.includes('IT') || category.includes('デジタル')) return '#0ea5e9';
  if (category.includes('設備') || category.includes('投資')) return '#8b5cf6';
  if (category.includes('販路') || category.includes('売上')) return '#f43f5e';
  if (category.includes('創業') || category.includes('起業')) return '#14b8a6';
  if (category.includes('承継') || category.includes('人材')) return '#64748b';

  return '#3b82f6';
};

export default function TopPage({ recentSubsidies, latestColumns }) {
  const navigate = useNavigate();

  /**
   * 無限ループ用：
   * 実体は [最後の画像, 1枚目, 2枚目, 3枚目, 1枚目] にする。
   * 最初の表示位置は index=1。
   */
  const loopBanners = useMemo(() => {
    if (BANNERS.length <= 1) return BANNERS;

    return [
      BANNERS[BANNERS.length - 1],
      ...BANNERS,
      BANNERS[0],
    ];
  }, []);

  const [slideIndex, setSlideIndex] = useState(1);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [slideWidth, setSlideWidth] = useState(getCarouselSlideWidth);
  const [slideGap, setSlideGap] = useState(getCarouselGap);

  const realSlideIndex = useMemo(() => {
    if (BANNERS.length === 0) return 0;
    return ((slideIndex - 1) % BANNERS.length + BANNERS.length) % BANNERS.length;
  }, [slideIndex]);

  const slideHeight = Math.round(slideWidth * 0.375);
  const trackTranslate = `calc(50vw - ${slideWidth / 2}px - ${
    slideIndex * (slideWidth + slideGap)
  }px)`;

  useEffect(() => {
    const handleResize = () => {
      setSlideWidth(getCarouselSlideWidth());
      setSlideGap(getCarouselGap());
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (BANNERS.length <= 1) return undefined;

    const timer = setInterval(() => {
      setTransitionEnabled(true);
      setSlideIndex((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    if (BANNERS.length <= 1) return;

    setTransitionEnabled(true);
    setSlideIndex((prev) => prev + 1);
  };

  const prevSlide = () => {
    if (BANNERS.length <= 1) return;

    setTransitionEnabled(true);
    setSlideIndex((prev) => prev - 1);
  };

  const goToSlide = (index) => {
    setTransitionEnabled(true);
    setSlideIndex(index + 1);
  };

  const handleTransitionEnd = () => {
    if (BANNERS.length <= 1) return;

    // 左端の複製スライドまで行ったら、本物の3枚目へ瞬間移動
    if (slideIndex === 0) {
      setTransitionEnabled(false);
      setSlideIndex(BANNERS.length);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionEnabled(true);
        });
      });

      return;
    }

    // 右端の複製スライドまで行ったら、本物の1枚目へ瞬間移動
    if (slideIndex === BANNERS.length + 1) {
      setTransitionEnabled(false);
      setSlideIndex(1);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionEnabled(true);
        });
      });
    }
  };

  return (
    <>
      {/* カルーセル：画像を切らずに、左右チラ見せ＋3枚無限ループ */}
      <section
        style={{
          position: 'relative',
          width: '100vw',
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          backgroundColor: '#f7f9f8',
          borderTop: '1px solid #e7ece9',
          borderBottom: '1px solid #e7ece9',
          padding: '40px 0 74px',
          marginBottom: '64px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            onTransitionEnd={handleTransitionEnd}
            style={{
              display: 'flex',
              gap: `${slideGap}px`,
              width: 'max-content',
              transform: `translateX(${trackTranslate})`,
              transition: transitionEnabled
                ? 'transform 0.65s cubic-bezier(0.25, 0.8, 0.25, 1)'
                : 'none',
              alignItems: 'center',
              willChange: 'transform',
            }}
          >
            {loopBanners.map((img, idx) => {
              const isActive = idx === slideIndex;

              return (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => {
                    if (idx === 0) {
                      setTransitionEnabled(true);
                      setSlideIndex(0);
                      return;
                    }

                    if (idx === loopBanners.length - 1) {
                      setTransitionEnabled(true);
                      setSlideIndex(loopBanners.length - 1);
                      return;
                    }

                    setTransitionEnabled(true);
                    setSlideIndex(idx);
                  }}
                  style={{
                    width: `${slideWidth}px`,
                    height: `${slideHeight}px`,
                    flex: `0 0 ${slideWidth}px`,
                    padding: 0,
                    margin: 0,
                    border: '2px solid #d6e0e4',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    opacity: isActive ? 1 : 0.62,
                    transform: isActive ? 'scale(1)' : 'scale(0.96)',
                    transition: 'opacity 0.35s, transform 0.35s, box-shadow 0.35s',
                    boxShadow: isActive
                      ? '0 14px 36px rgba(15, 23, 42, 0.16)'
                      : '0 8px 20px rgba(15, 23, 42, 0.08)',
                  }}
                  aria-label={`プロモーションバナー ${realSlideIndex + 1}`}
                >
                  <img
                    src={img}
                    alt={`プロモーションバナー ${realSlideIndex + 1}`}
                    draggable="false"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'block',
                      objectFit: 'contain',
                      objectPosition: 'center center',
                      backgroundColor: '#ffffff',
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {BANNERS.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              style={{
                position: 'absolute',
                top: `calc(40px + ${slideHeight / 2}px)`,
                left: 'clamp(18px, 7vw, 150px)',
                transform: 'translateY(-50%)',
                width: '58px',
                height: '58px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.94)',
                color: colors.primary,
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(6px)',
                zIndex: 10,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.94)';
              }}
              aria-label="前のバナーへ"
            >
              &lt;
            </button>

            <button
              type="button"
              onClick={nextSlide}
              style={{
                position: 'absolute',
                top: `calc(40px + ${slideHeight / 2}px)`,
                right: 'clamp(18px, 7vw, 150px)',
                transform: 'translateY(-50%)',
                width: '58px',
                height: '58px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.94)',
                color: colors.primary,
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(6px)',
                zIndex: 10,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.94)';
              }}
              aria-label="次のバナーへ"
            >
              &gt;
            </button>
          </>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: '26px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {BANNERS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`スライド ${idx + 1} へ移動`}
              style={{
                width: realSlideIndex === idx ? '34px' : '10px',
                height: '10px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: realSlideIndex === idx ? colors.primary : '#cbd5d1',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                padding: 0,
              }}
            />
          ))}
        </div>
      </section>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px 80px' }}>
        {/* 3つの大きなボタン */}
        <div
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
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(8, 74, 85, 0.15)';
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
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(8, 74, 85, 0.15)';
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
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(8, 74, 85, 0.15)';
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

        {/* 新着情報セクション */}
        <div style={{ marginBottom: '48px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '16px',
              borderBottom: '1px dashed #94a3b8',
            }}
          >
            <h3
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
              <span style={{ color: '#cbd5e1' }}>✨</span> NEWS
            </h3>

            <button
              onClick={() => navigate('/search')}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #334155',
                borderRadius: '20px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '6px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#334155';
              }}
            >
              お知らせ一覧へ
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
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
                    key={item.id || idx}
                    onClick={() => navigate(`/subsidy/${item.id}`)}
                    style={{
                      display: 'flex',
                      gap: '24px',
                      padding: '20px 24px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      alignItems: 'center',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#64748b',
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                      }}
                    >
                      {dateStr}
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <span
                        style={{
                          backgroundColor: '#0f7b6c',
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

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
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
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '16px',
              borderBottom: '1px dashed #94a3b8',
            }}
          >
            <h3
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
              <span style={{ color: '#cbd5e1' }}>📘</span> 今、確認しておきたい愛媛の補助金
            </h3>

            <button
              onClick={() => navigate('/columns')}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #334155',
                borderRadius: '20px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '6px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#334155';
              }}
            >
              コラム一覧へ
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
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
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      alignItems: 'center',
                      textDecoration: 'none',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#64748b',
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                      }}
                    >
                      {dateStr}
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <span
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

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
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

        {/* シミュレーター起動バナー */}
        <div
          onClick={() => navigate('/simulator')}
          style={{
            backgroundColor: '#197b6e',
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
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
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
