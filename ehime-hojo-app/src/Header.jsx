import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function HeaderNavIcon({ type }) {
  const commonProps = {
    width: '32',
    height: '32',
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '4',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (type === 'search') {
    return (
      <svg {...commonProps}>
        <circle cx="20" cy="20" r="12" />
        <path d="M29 29L40 40" />
      </svg>
    );
  }

  if (type === 'expert') {
    return (
      <svg {...commonProps}>
        <path d="M24 8c5 0 8 3.6 8 8.2 0 5.2-3.4 9.8-8 9.8s-8-4.6-8-9.8C16 11.6 19 8 24 8Z" />
        <path d="M10 40c2.4-7.2 7.8-11 14-11s11.6 3.8 14 11" />
        <path d="M18 31l6 6 6-6" />
      </svg>
    );
  }

  if (type === 'document') {
    return (
      <svg {...commonProps}>
        <path d="M14 6h16l8 8v24H14V6Z" />
        <path d="M30 6v10h8" />
        <path d="M20 22h10" />
        <path d="M20 30h6" />
        <circle cx="32" cy="31" r="5" />
        <path d="M36 35l5 5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M24 8l12 6v12c0 8-5.2 13.2-12 16-6.8-2.8-12-8-12-16V14l12-6Z" />
      <path d="M18 22l6 6 8-10" />
    </svg>
  );
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const colors = {
    primary: '#111111',
    textMain: '#111111',
    textSub: '#111111',
    accentRed: '#19aeb8',
    border: '#eef0f2',
  };

  const navItems = [
    { id: 'search', label: '補助金を探す', path: '/search', iconSrc: '/02.svg' },
    { id: 'experts', label: '専門家を探す', path: '/experts', iconSrc: '/03.svg' },
    { id: 'simulator', label: 'シミュレーター', path: '/simulator', iconSrc: '/05.svg' },
    { id: 'beginners', label: 'はじめての方へ', path: '/beginners', iconSrc: '/04.svg' },
  ];

  const getActivePage = () => {
    const currentPath = location.pathname;

    if (currentPath === '/') return 'top';
    if (currentPath.startsWith('/search')) return 'search';
    if (currentPath.startsWith('/simulator')) return 'simulator';
    if (currentPath.startsWith('/experts')) return 'experts';
    if (currentPath.startsWith('/columns')) return 'columns';
    if (currentPath.startsWith('/column/')) return 'columns';
    if (currentPath.startsWith('/beginners')) return 'beginners';

    return 'top';
  };

  const activePage = getActivePage();

  const handleNavClick = (id) => {
    setIsMenuOpen(false);
    window.scrollTo(0, 0);

    if (id === 'top' || id === 'home') {
      navigate('/');
      return;
    }

    const item = navItems.find((nav) => nav.id === id);

    if (item) {
      navigate(item.path);
      return;
    }

    navigate('/');
  };

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  const navButtonBaseStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: '12.5px',
    fontWeight: 800,
    transition: 'color 0.2s',
    position: 'relative',
    fontFamily: 'inherit',
    color: colors.textMain,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    lineHeight: 1.2,
  };

  const mobileButtonBaseStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: '22px',
    fontWeight: 'bold',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  return (
    <>
      <header
        className="site-header"
        style={{
          backgroundColor: 'white',
          borderBottom: 'none',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        <div
          className="header-inner"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            maxWidth: '1760px',
            margin: '0 auto',
            minHeight: '82px',
          }}
        >
          <div
            className="header-brand-area"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '38px',
            }}
          >
            <button
              type="button"
              className="hamburger-btn header-menu-button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                width: '38px',
                height: '30px',
                zIndex: 1001,
              }}
              aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
              aria-expanded={isMenuOpen}
            >
              <span
                className="header-menu-lines"
                style={{
                  width: '38px',
                  height: '4px',
                  backgroundColor: isMenuOpen ? 'transparent' : colors.textMain,
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  display: 'block',
                }}
              >
                <span
                  style={{
                    width: '38px',
                    height: '4px',
                    backgroundColor: colors.textMain,
                    position: 'absolute',
                    left: 0,
                    top: isMenuOpen ? '0' : '-11px',
                    transform: isMenuOpen ? 'rotate(45deg)' : 'none',
                    transition: 'all 0.3s ease',
                    display: 'block',
                  }}
                />

                <span
                  style={{
                    width: '38px',
                    height: '4px',
                    backgroundColor: colors.textMain,
                    position: 'absolute',
                    left: 0,
                    top: isMenuOpen ? '0' : '11px',
                    transform: isMenuOpen ? 'rotate(-45deg)' : 'none',
                    transition: 'all 0.3s ease',
                    display: 'block',
                  }}
                />
              </span>
            </button>

            <button
              type="button"
              className="header-wordmark-button"
              onClick={() => handleNavClick('top')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                zIndex: 1001,
              }}
              aria-label="トップページへ移動"
            >
              <img
                className="header-logo-mark"
                src="/01.svg"
                alt="EHIME HOJO"
                style={{
                  display: 'block',
                  width: 'clamp(150px, 14vw, 205px)',
                  height: 'auto',
                }}
              />
            </button>
          </div>

          <nav
            className="desktop-nav"
            style={{
              display: 'flex',
              gap: '40px',
              alignItems: 'center',
            }}
            aria-label="メインナビゲーション"
          >
            {navItems.map((item) => {
              const isActive = activePage === item.id;

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  style={{
                    ...navButtonBaseStyle,
                    color: isActive ? colors.accentRed : colors.textMain,
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = colors.accentRed;
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = colors.textMain;
                    }
                  }}
                >
                  {item.iconSrc ? (
                    <img
                      src={item.iconSrc}
                      alt=""
                      aria-hidden="true"
                      style={{
                        width: '32px',
                        height: '32px',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <HeaderNavIcon type={item.icon} />
                  )}
                  <span>{item.label}</span>

                  {item.isNew && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-12px',
                        right: '-20px',
                        backgroundColor: colors.accentRed,
                        color: 'white',
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontWeight: 'bold',
                      }}
                    >
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div
        className={`mobile-menu-overlay ${isMenuOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '32px',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease',
        }}
      >
        <button
          type="button"
          onClick={() => handleNavClick('top')}
          style={{
            ...mobileButtonBaseStyle,
            color: activePage === 'top' ? colors.primary : colors.textMain,
            marginBottom: '16px',
          }}
        >
          ホーム
        </button>

        {navItems.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            style={{
              ...mobileButtonBaseStyle,
              color: activePage === item.id ? colors.primary : colors.textMain,
            }}
          >
            {item.label}

            {item.isNew && (
              <span
                style={{
                  backgroundColor: colors.accentRed,
                  color: 'white',
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                }}
              >
                NEW
              </span>
            )}
          </button>
        ))}
      </div>

      <style>{`
        .header-inner {
          padding: 16px clamp(30px, 5.6vw, 82px);
          width: 100%;
          box-sizing: border-box;
        }

        .header-wordmark {
          display: flex;
          align-items: baseline;
          gap: 14px;
          color: #000000;
          font-family: "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif;
          font-size: clamp(34px, 3vw, 52px);
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 1;
          white-space: nowrap;
        }

        .header-wordmark-red {
          color: ${colors.accentRed};
        }

        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }

          .header-inner {
            min-height: 78px !important;
            padding: 18px 22px !important;
          }

          .header-brand-area {
            width: 100%;
            justify-content: space-between;
            gap: 20px !important;
          }

          .header-menu-button {
            order: 2;
            width: 36px !important;
            height: 30px !important;
          }

          .header-menu-lines,
          .header-menu-lines > span {
            width: 36px !important;
            height: 4px !important;
          }

          .header-menu-lines > span:first-child {
            top: ${isMenuOpen ? '0' : '-11px'} !important;
          }

          .header-menu-lines > span:last-child {
            top: ${isMenuOpen ? '0' : '11px'} !important;
          }

          .header-wordmark {
            font-size: clamp(28px, 8vw, 40px);
            gap: 8px;
          }

          .header-logo-mark {
            width: clamp(158px, 46vw, 210px) !important;
          }
        }

        .mobile-menu-overlay.open {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </>
  );
}
