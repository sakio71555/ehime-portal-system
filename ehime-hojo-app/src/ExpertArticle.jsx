import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { supabase } from './lib/supabaseClient';

const colors = {
  primary: '#0f7b6c',
  primaryDark: '#084a55',
  ink: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  soft: '#f8fafc',
  warning: '#fffbeb',
};

const ALLOWED_TAGS = new Set(['H2', 'H3', 'P', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'BR', 'A']);
const ALLOWED_ATTRIBUTES = { A: ['href', 'target', 'rel'] };

function sanitizeHtml(html) {
  if (!html || typeof window === 'undefined') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;

  if (!root) return '';

  const cleanNode = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;

      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }

      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(doc.createTextNode(child.textContent || ''));
        return;
      }

      Array.from(child.attributes).forEach((attr) => {
        const attrName = attr.name.toLowerCase();
        const allowed = ALLOWED_ATTRIBUTES[child.tagName] || [];

        if (attrName.startsWith('on') || !allowed.includes(attrName)) {
          child.removeAttribute(attr.name);
          return;
        }

        if (child.tagName === 'A' && attrName === 'href' && !/^https?:\/\//i.test(attr.value.trim())) {
          child.removeAttribute('href');
        }
      });

      if (child.tagName === 'A') {
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }

      cleanNode(child);
    });
  };

  cleanNode(root);
  return root.innerHTML;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ja-JP');
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQa(article) {
  const content = article?.content_json || {};
  return Array.isArray(content.qa)
    ? content.qa.filter((item) => item?.question || item?.answer)
    : [];
}

function getExpertLabel(expert) {
  if (!expert) return 'えひめ補助金ポータル編集部';
  return [expert.name, expert.qualification].filter(Boolean).join(' / ');
}

function TextParagraphs({ value }) {
  const paragraphs = String(value || '')
    .split(/\n{2,}|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!paragraphs.length) return null;

  return paragraphs.map((paragraph, index) => (
    <p key={`${paragraph.slice(0, 24)}-${index}`} style={{ margin: index === 0 ? 0 : '14px 0 0' }}>
      {paragraph}
    </p>
  ));
}

function ArticleHeroImage({ url }) {
  return (
    <div
      className="expert-article-hero-image"
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        maxHeight: '420px',
        overflow: 'hidden',
        borderRadius: '14px',
        margin: '0 0 34px',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f8fafc 58%, #eef2f7 100%)',
        border: `1px solid ${colors.border}`,
        display: 'grid',
        placeItems: 'center',
        color: colors.primary,
        fontSize: '14px',
        fontWeight: 900,
        letterSpacing: '0.16em',
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <span>EXPERT Q&A</span>
      )}
    </div>
  );
}

function getStatusLabel(item) {
  if (item?.crawl_status === 'archived') return '受付終了';
  return '公募中';
}

function SubsidyMiniCard({ subsidy, note }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        padding: '18px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '5px 10px',
          borderRadius: '999px',
          background: '#e7f6f2',
          color: colors.primaryDark,
          fontSize: '12px',
          fontWeight: 900,
          marginBottom: '10px',
        }}
      >
        {getStatusLabel(subsidy)}
      </div>

      <h3
        style={{
          margin: '0 0 10px',
          fontSize: '18px',
          lineHeight: 1.45,
          color: colors.ink,
          overflowWrap: 'anywhere',
        }}
      >
        {subsidy.title}
      </h3>

      <div style={{ display: 'grid', gap: '6px', color: '#4b5563', fontSize: '13px', lineHeight: 1.7 }}>
        <div>💰 {cleanText(subsidy.amount_text) || '金額は公式情報をご確認ください'}</div>
        <div>📍 {cleanText(subsidy.region_text) || '対象地域は公式情報をご確認ください'}</div>
        <div>🗓 {cleanText(subsidy.application_period_text) || '申請期間は公式情報をご確認ください'}</div>
      </div>

      {note && (
        <p style={{ margin: '12px 0 0', color: colors.muted, fontSize: '13px', lineHeight: 1.7 }}>
          {note}
        </p>
      )}

      <Link
        to={`/subsidy/${subsidy.id}`}
        style={{
          display: 'inline-flex',
          marginTop: '14px',
          color: colors.primary,
          fontSize: '14px',
          fontWeight: 900,
          textDecoration: 'none',
        }}
      >
        詳細ページを見る →
      </Link>
    </div>
  );
}

export default function ExpertArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [expert, setExpert] = useState(null);
  const [subsidies, setSubsidies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchArticle = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('expert_articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('専門家記事取得エラー:', error);
      }

      if (!data) {
        if (!cancelled) {
          setArticle(null);
          setExpert(null);
          setSubsidies([]);
          setLoading(false);
        }
        return;
      }

      let nextExpert = null;
      if (data.expert_id) {
        const { data: expertRow } = await supabase
          .from('experts')
          .select('id, name, qualification, area, avatar_url, website_url, description')
          .eq('id', data.expert_id)
          .maybeSingle();

        nextExpert = expertRow || null;
      }

      let nextSubsidies = [];
      const { data: linkRows, error: linkError } = await supabase
        .from('expert_article_subsidies')
        .select('subsidy_id, sort_order, note')
        .eq('expert_article_id', data.id)
        .order('sort_order', { ascending: true });

      if (!linkError && linkRows?.length) {
        const ids = linkRows.map((item) => item.subsidy_id).filter(Boolean);

        const { data: subsidyRows, error: subsidyError } = await supabase
          .from('subsidies')
          .select('id, title, region_text, application_period_text, amount_text, crawl_status, summary')
          .in('id', ids)
          .eq('is_active', true)
          .eq('crawl_status', 'published')
          .is('duplicate_of_id', null);

        if (!subsidyError) {
          const subsidyMap = new Map((subsidyRows || []).map((item) => [item.id, item]));
          nextSubsidies = linkRows
            .map((link) => {
              const subsidy = subsidyMap.get(link.subsidy_id);
              return subsidy ? { ...subsidy, note: link.note || '' } : null;
            })
            .filter(Boolean);
        }
      }

      if (!cancelled) {
        setArticle(data);
        setExpert(nextExpert);
        setSubsidies(nextSubsidies);
        setLoading(false);
      }
    };

    fetchArticle();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const qaItems = useMemo(() => getQa(article), [article]);
  const sanitizedHtml = useMemo(() => sanitizeHtml(article?.content_html || ''), [article?.content_html]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: colors.soft }}>
        <Header />
        <main style={{ padding: '80px 24px', textAlign: 'center', color: colors.muted }}>
          専門家記事を読み込んでいます...
        </main>
        <Footer />
      </div>
    );
  }

  if (!article) {
    return (
      <div style={{ minHeight: '100vh', background: colors.soft }}>
        <Helmet>
          <title>記事が見つかりません | えひめ補助金ポータル</title>
          <meta name="robots" content="noindex,nofollow" />
          <link rel="canonical" href={`https://ehime-hojokin.jp/expert-articles/${slug || ''}`} />
        </Helmet>
        <Header />
        <main style={{ maxWidth: '860px', margin: '0 auto', padding: '72px 24px' }}>
          <h1 style={{ margin: '0 0 16px', fontSize: '28px' }}>記事が見つかりません</h1>
          <p style={{ color: colors.muted, lineHeight: 1.8 }}>指定された専門家Q&A記事は公開されていないか、削除された可能性があります。</p>
          <Link to="/expert-articles" style={{ color: colors.primary, fontWeight: 900 }}>専門家Q&A記事一覧へ戻る</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const title = article.meta_title || `${article.title}｜専門家Q&A｜えひめ補助金ポータル`;
  const description =
    article.meta_description ||
    article.summary ||
    article.lead_text ||
    '補助金・助成金について専門家視点のQ&A形式で解説します。';

  return (
    <div style={{ minHeight: '100vh', background: colors.soft, color: colors.ink }}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`https://ehime-hojokin.jp/expert-articles/${article.slug}`} />
      </Helmet>

      <Header />

      <main
        className="expert-article-page"
        style={{
          width: '100%',
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '48px 24px 88px',
          boxSizing: 'border-box',
        }}
      >
        <Link to="/expert-articles" style={{ color: colors.primary, fontWeight: 900, textDecoration: 'none' }}>
          ← 専門家Q&A記事一覧へ
        </Link>

        <article
          style={{
            marginTop: '24px',
            background: '#ffffff',
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '42px',
            boxSizing: 'border-box',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
            minWidth: 0,
          }}
        >
          <p
            style={{
              margin: '0 0 10px',
              color: colors.primary,
              fontSize: '13px',
              fontWeight: 900,
              letterSpacing: '0.12em',
            }}
          >
            EXPERT Q&A
          </p>

          <h1
            style={{
              margin: '0 0 18px',
              fontSize: '34px',
              lineHeight: 1.35,
              letterSpacing: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {article.title}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', color: colors.muted, fontSize: '14px', marginBottom: '26px' }}>
            <span>{getExpertLabel(expert)}</span>
            {expert?.area && <span>対応地域: {expert.area}</span>}
            {article.published_at && <span>公開日: {formatDate(article.published_at)}</span>}
          </div>

          <ArticleHeroImage url={article.main_image_url} />

          {(article.lead_text || article.summary) && (
            <p
              style={{
                margin: '0 0 34px',
                color: '#374151',
                fontSize: '17px',
                lineHeight: 1.9,
                overflowWrap: 'anywhere',
              }}
            >
              {article.lead_text || article.summary}
            </p>
          )}

          {qaItems.length > 0 && (
            <section style={{ display: 'grid', gap: '28px', marginBottom: '42px' }}>
              {qaItems.map((item, index) => (
                <div
                  key={`${item.question}-${index}`}
                  className="expert-qa-card"
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: '14px',
                    padding: '24px',
                    background: '#ffffff',
                    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '42px minmax(0, 1fr)',
                      gap: '14px',
                      alignItems: 'start',
                      marginBottom: '18px',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-grid',
                        placeItems: 'center',
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: '#e7f6f2',
                        color: colors.primaryDark,
                        fontWeight: 900,
                      }}
                    >
                      Q
                    </span>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: '22px',
                        lineHeight: 1.55,
                        color: colors.ink,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {index + 1}. {item.question}
                    </h2>
                  </div>
                  <div
                    style={{
                      borderLeft: `3px solid ${colors.primary}`,
                      padding: '18px 20px',
                      color: '#374151',
                      fontSize: '16px',
                      lineHeight: 2,
                      background: '#f8fafc',
                      borderRadius: '0 12px 12px 0',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <TextParagraphs value={item.answer} />
                  </div>
                </div>
              ))}
            </section>
          )}

          {sanitizedHtml && (
            <section
              className="expert-article-html"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              style={{
                color: '#374151',
                fontSize: '16px',
                lineHeight: 1.9,
                overflowWrap: 'anywhere',
              }}
            />
          )}

          {article.closing_text && (
            <section
              style={{
                marginTop: '34px',
                padding: '24px',
                borderRadius: '10px',
                background: '#f0fdfa',
                color: '#134e4a',
                lineHeight: 1.9,
                fontWeight: 700,
              }}
            >
              <TextParagraphs value={article.closing_text} />
            </section>
          )}

          {subsidies.length > 0 && (
            <section style={{ marginTop: '42px' }}>
              <h2 style={{ margin: '0 0 18px', fontSize: '24px' }}>この記事で紹介した補助金</h2>
              <div className="expert-article-subsidies" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
                {subsidies.map((subsidy) => (
                  <SubsidyMiniCard key={subsidy.id} subsidy={subsidy} note={subsidy.note} />
                ))}
              </div>
            </section>
          )}

          <section
            style={{
              marginTop: '42px',
              display: 'grid',
              gap: '12px',
              padding: '20px',
              borderRadius: '10px',
              background: colors.warning,
              border: '1px solid #fde68a',
              color: '#78350f',
              fontSize: '14px',
              lineHeight: 1.8,
            }}
          >
            <p style={{ margin: 0 }}>
              この記事は制度理解のための一般的な情報です。補助金の申請条件・募集期間・対象経費などは変更される場合があります。申請前には必ず公式情報をご確認ください。
            </p>
            {(article.generation_mode === 'ai_interview' || article.verification_status === 'ai_generated') && (
              <p style={{ margin: 0 }}>
                この記事はAI生成を含み、運営側で確認のうえ掲載しています。
              </p>
            )}
          </section>

          <div
            style={{
              marginTop: '36px',
              paddingTop: '28px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ color: colors.muted, lineHeight: 1.7 }}>
              専門家への相談や制度探しも、えひめ補助金ポータルから確認できます。
            </div>
            <Link
              to="/experts"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '999px',
                background: colors.primary,
                color: '#ffffff',
                fontWeight: 900,
                textDecoration: 'none',
              }}
            >
              専門家を探す
            </Link>
          </div>
        </article>
      </main>

      <Footer />

      <style>
        {`
          .expert-article-html h2 {
            margin: 32px 0 12px;
            color: #111827;
            font-size: 24px;
            line-height: 1.5;
          }

          .expert-article-html h3 {
            margin: 24px 0 10px;
            color: #111827;
            font-size: 20px;
            line-height: 1.55;
          }

          .expert-article-html p,
          .expert-article-html li {
            line-height: 1.9;
          }

          .expert-article-html a {
            color: ${colors.primary};
            font-weight: 800;
          }

          @media (max-width: 768px) {
            .expert-article-page {
              padding: 32px 16px 64px !important;
            }

            .expert-article-page article {
              padding: 24px 18px !important;
              border-radius: 10px !important;
            }

            .expert-article-page h1 {
              font-size: 27px !important;
            }

            .expert-article-hero-image {
              border-radius: 10px !important;
              margin-bottom: 26px !important;
            }

            .expert-qa-card {
              padding: 18px !important;
            }

            .expert-article-subsidies {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
}
