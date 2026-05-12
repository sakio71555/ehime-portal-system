import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const colors = {
    primary: '#526b5d',
    textMain: '#4b5550',
    textSub: '#8b9690',
    accentRed: '#ef4444',
    border: '#e4e7e5',
  };

  const navItems = [
    { id: 'search', label: '補助金を探す', path: '/search' },
    { id: 'simulator', label: 'シミュレーター', path: '/simulator' },
    { id: 'experts', label: '専門家を探す', path: '/experts' },
    { id: 'columns', label: 'お役立ちコラム', path: '/columns' },
    { id: 'beginners', label: 'はじめての方へ', path: '/beginners' },
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
    fontSize: '15px',
    fontWeight: 'bold',
    transition: 'color 0.2s',
    position: 'relative',
    fontFamily: 'inherit',
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
        style={{
          backgroundColor: 'white',
          borderBottom: `1px solid ${colors.border}`,
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
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <button
            type="button"
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
              src="/logo.png"
              alt="愛媛の補助金"
              style={{
                height: '40px',
                display: 'block',
              }}
            />
          </button>

          <nav
            className="desktop-nav"
            style={{
              display: 'flex',
              gap: '32px',
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
                    color: isActive ? colors.primary : colors.textSub,
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = colors.textMain;
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = colors.textSub;
                    }
                  }}
                >
                  {item.label}

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

          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '32px',
              height: '32px',
              zIndex: 1001,
            }}
            aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            aria-expanded={isMenuOpen}
          >
            <div
              style={{
                width: '24px',
                height: '2px',
                backgroundColor: isMenuOpen ? 'transparent' : colors.textMain,
                transition: 'all 0.3s ease',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '2px',
                  backgroundColor: colors.textMain,
                  position: 'absolute',
                  top: isMenuOpen ? '0' : '-8px',
                  transform: isMenuOpen ? 'rotate(45deg)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              />

              <div
                style={{
                  width: '24px',
                  height: '2px',
                  backgroundColor: colors.textMain,
                  position: 'absolute',
                  top: isMenuOpen ? '0' : '8px',
                  transform: isMenuOpen ? 'rotate(-45deg)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            </div>
          </button>
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
          padding: 20px 40px;
          width: 100%;
          box-sizing: border-box;
        }

        .hamburger-btn {
          display: none;
        }

        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }

          .hamburger-btn {
            display: flex !important;
          }

          .header-inner {
            padding: 16px 20px;
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
