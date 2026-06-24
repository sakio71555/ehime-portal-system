import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from './Header';
import Footer from './Footer';
import { supabase } from './lib/supabaseClient';
import { getStaticSeoColumnBySlug } from './staticSeoColumns';

const ALLOWED_TAGS = new Set([
  'H2',
  'H3',
  'P',
  'UL',
  'OL',
  'LI',
  'STRONG',
  'B',
  'EM',
  'BR',
  'A',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
  'CAPTION',
]);

const ALLOWED_ATTRIBUTES = {
  A: ['href', 'target', 'rel'],
};

const sanitizeHtml = (html) => {
  if (!html || typeof window === 'undefined') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;

  if (!root) return '';

  const cleanNode = (node) => {
    const children = Array.from(node.childNodes);

    children.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;

      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }

      const tagName = child.tagName;

      if (!ALLOWED_TAGS.has(tagName)) {
        const text = doc.createTextNode(child.textContent || '');
        child.replaceWith(text);
        return;
      }

      Array.from(child.attributes).forEach((attr) => {
        const attrName = attr.name.toLowerCase();
        const allowedForTag = ALLOWED_ATTRIBUTES[tagName] || [];

        if (attrName.startsWith('on')) {
          child.removeAttribute(attr.name);
          return;
        }

        if (!allowedForTag.includes(attrName)) {
          child.removeAttribute(attr.name);
          return;
        }

        if (tagName === 'A' && attrName === 'href') {
          const href = attr.value.trim();

          if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) {
            child.removeAttribute('href');
          }
        }
      });

      if (tagName === 'A' && /^https?:\/\//i.test(child.getAttribute('href') || '')) {
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }

      cleanNode(child);
    });
  };

  cleanNode(root);

  return root.innerHTML;
};

const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('ja-JP');
};

export default function ColumnArticle() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [column, setColumn] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchColumn = async () => {
      const staticColumn = getStaticSeoColumnBySlug(slug);

      if (staticColumn) {
        if (!cancelled) {
          setColumn(staticColumn);
          setLoading(false);
        }
        return;
      }

      if (!supabase || !slug) {
        if (!cancelled) {
          setColumn(null);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('columns')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .maybeSingle();

        if (error) {
          console.error('コラム取得エラー:', error);
        }

        if (!cancelled) {
          setColumn(data || null);
          setLoading(false);
        }
      } catch (err) {
        console.error('コラム取得エラー:', err);

        if (!cancelled) {
          setColumn(null);
          setLoading(false);
        }
      }
    };

    fetchColumn();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const sanitizedContent = useMemo(() => {
    return sanitizeHtml(column?.content || '');
  }, [column?.content]);

  const handleNavigation = (page) => {
    window.scrollTo(0, 0);

    if (page === 'top' || page === 'home') {
      navigate('/');
      return;
    }

    if (page === 'search') {
      navigate('/search');
      return;
    }

    if (page === 'experts') {
      navigate('/experts');
      return;
    }

    if (page === 'columns') {
      navigate('/columns');
      return;
    }

    if (page === 'beginners') {
      navigate('/beginners');
      return;
    }

    navigate('/');
  };

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
        <Helmet>
          <title>読み込み中 | 愛媛の補助金ポータル</title>
        </Helmet>

        <Header activePage="columns" setActivePage={handleNavigation} />

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

  if (!column) {
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
          <title>コラムが見つかりません | えひめ補助金ポータル</title>
          <meta
            name="description"
            content="指定されたコラム記事は見つかりませんでした。公開終了、または非公開になっている可能性があります。"
          />
          <meta name="robots" content="noindex,nofollow" />
          <link rel="canonical" href={`https://ehime-hojokin.jp/column/${slug || ''}`} />
        </Helmet>

        <Header activePage="columns" setActivePage={handleNavigation} />

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
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📝</div>

            <h1
              style={{
                fontSize: '22px',
                color: '#111827',
                margin: '0 0 12px',
              }}
            >
              コラム記事が見つかりませんでした
            </h1>

            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.8',
                margin: '0 0 24px',
              }}
            >
              指定された記事は、公開終了・非公開・削除済みの可能性があります。
              <br />
              最新の記事はコラム一覧ページからご確認ください。
            </p>

            <button
              onClick={() => navigate('/columns')}
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
              コラム一覧へ戻る
            </button>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  const publishedDate = formatDate(column.published_at || column.created_at);
  const pageTitle = column.append_site_name === false
    ? column.seo_title || column.title
    : `${column.seo_title || column.title} | 愛媛の補助金ポータル`;

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
        <title>{pageTitle}</title>
        <meta
          name="description"
          content={
            column.meta_description ||
            '愛媛県内の事業者向けに、補助金・助成金に関するお役立ち情報をお届けします。'
          }
        />
        <meta
          property="og:title"
          content={`${column.title} | 愛媛の補助金ポータル`}
        />
        <meta
          property="og:description"
          content={
            column.meta_description ||
            '愛媛県内の事業者向けに、補助金・助成金に関するお役立ち情報をお届けします。'
          }
        />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={`https://ehime-hojokin.jp/column/${column.slug || slug || ''}`} />
        {column.thumbnail_url && (
          <meta property="og:image" content={column.thumbnail_url} />
        )}
      </Helmet>

      <Header activePage="columns" setActivePage={handleNavigation} />

      <main className="column-article-main" style={{ flex: 1, paddingBottom: '80px' }}>
        <div
          className="column-article-container"
          style={{
            maxWidth: '800px',
            margin: '40px auto',
            padding: '0 24px',
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={() => navigate('/columns')}
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
              ← コラム一覧へ戻る
            </button>
          </div>

          <article
            className="column-article-card"
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow:
                '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
            }}
          >
            {column.thumbnail_url && (
              <div
                className="column-article-thumbnail"
                style={{
                  width: '100%',
                  height: '350px',
                  backgroundColor: '#e5e7eb',
                }}
              >
                <img
                  src={column.thumbnail_url}
                  alt={column.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}

            <div className="column-article-body" style={{ padding: '40px 48px' }}>
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
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    fontWeight: 'bold',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    maxWidth: '100%',
                  }}
                >
                  {column.category || '補助金情報'}
                </span>

                {publishedDate && (
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#6b7280',
                    }}
                  >
                    {publishedDate}
                  </span>
                )}
              </div>

              <h1
                style={{
                  fontSize: '28px',
                  color: '#111827',
                  margin: '0 0 32px 0',
                  lineHeight: '1.4',
                  fontWeight: '800',
                }}
              >
                {column.title}
              </h1>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '40px',
                  fontSize: '13px',
                  color: '#64748b',
                  lineHeight: '1.6',
                }}
              >
                掲載している情報は、AIを活用して収集・整理したデータをもとに作成しております。
                必ず各制度の公式ページにて最新情報をご確認ください。
              </div>

              {sanitizedContent ? (
                <div
                  className="column-content"
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
              ) : (
                <div
                  style={{
                    color: '#6b7280',
                    fontSize: '15px',
                    lineHeight: '1.8',
                    padding: '24px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  現在、記事本文を準備中です。
                </div>
              )}

              <div
                style={{
                  marginTop: '56px',
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
                  次のステップへ
                </h3>

                <p
                  style={{
                    fontSize: '15px',
                    color: '#4b5550',
                    lineHeight: '1.6',
                    marginBottom: '24px',
                  }}
                >
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
                    onClick={() => handleNavigation('experts')}
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
                      textAlign: 'center',
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

      <style>{`
        .column-article-main,
        .column-article-container,
        .column-article-card,
        .column-article-body {
          box-sizing: border-box;
          min-width: 0;
        }

        .column-content {
          color: #374151;
          font-size: 16px;
          line-height: 1.8;
          max-width: 100%;
          min-width: 0;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .column-content h2 {
          font-size: 22px;
          color: #111827;
          margin: 40px 0 20px 0;
          padding-bottom: 10px;
          border-bottom: 2px solid #526b5d;
        }

        .column-content h3 {
          font-size: 18px;
          color: #1f2937;
          margin: 32px 0 16px 0;
        }

        .column-content p {
          margin-bottom: 20px;
        }

        .column-content ul,
        .column-content ol {
          margin: 0 0 24px 24px;
          padding: 0;
        }

        .column-content li {
          margin-bottom: 8px;
        }

        .column-content a {
          color: #2563eb;
          font-weight: bold;
          text-decoration: underline;
          overflow-wrap: anywhere;
        }

        .column-content img,
        .column-content video,
        .column-content iframe {
          max-width: 100%;
          height: auto;
        }

        .column-content table {
          display: block;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-collapse: collapse;
          margin: 24px 0 32px;
          font-size: 14px;
        }

        .column-content caption {
          text-align: left;
          color: #111827;
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .column-content th,
        .column-content td {
          border: 1px solid #e5e7eb;
          padding: 12px 14px;
          text-align: left;
          vertical-align: top;
          min-width: 150px;
          line-height: 1.7;
        }

        .column-content th {
          background: #f8fafc;
          color: #111827;
          font-weight: 800;
        }

        .column-content td {
          background: #ffffff;
        }

        .column-content pre {
          max-width: 100%;
          overflow-x: auto;
          white-space: pre-wrap;
        }

        .column-content code {
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        @media (max-width: 768px) {
          .column-article-main {
            width: 100%;
            max-width: 100%;
            overflow-x: clip;
          }

          .column-article-container {
            width: 100%;
            max-width: 100%;
            margin: 24px auto !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .column-article-card {
            width: 100%;
            max-width: 100%;
            border-radius: 14px !important;
          }

          .column-article-thumbnail {
            height: 220px !important;
          }

          .column-article-body {
            width: 100%;
            max-width: 100%;
            padding: 24px 18px !important;
          }

          .column-article-body h1 {
            font-size: 22px !important;
            line-height: 1.45 !important;
            overflow-wrap: break-word;
            word-break: break-word;
          }

          .column-content {
            font-size: 15px;
            line-height: 1.75;
          }

          .column-content h2 {
            font-size: 19px;
            line-height: 1.45;
          }

          .column-content h3 {
            font-size: 17px;
            line-height: 1.45;
          }
        }
      `}</style>
    </div>
  );
}
