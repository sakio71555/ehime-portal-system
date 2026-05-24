import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { supabase } from './lib/supabaseClient';

const colors = {
  primary: '#0f7b6c',
  ink: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  surface: '#ffffff',
  page: '#f8fafc',
};

const formatDate = (value) => {
  if (!value) return '公開日未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '公開日未設定';
  return date.toLocaleDateString('ja-JP');
};

function getExpertLabel(expert) {
  if (!expert) return 'えひめ補助金ポータル編集部';
  return [expert.name, expert.qualification].filter(Boolean).join(' / ');
}

function ArticleImage({ url }) {
  return (
    <div
      className="expert-article-card-image"
      style={{
        width: '100%',
        aspectRatio: '4 / 3',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f8fafc 65%, #eef2f7 100%)',
        border: `1px solid ${colors.border}`,
        display: 'grid',
        placeItems: 'center',
        color: colors.primary,
        fontSize: '12px',
        fontWeight: 900,
        letterSpacing: '0.12em',
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

function ArticleCard({ article, expert, subsidyCount }) {
  return (
    <Link
      to={`/expert-articles/${article.slug}`}
      className="expert-article-card"
      style={{
        display: 'grid',
        gridTemplateColumns: '220px minmax(0, 1fr)',
        gap: '24px',
        color: 'inherit',
        textDecoration: 'none',
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        padding: '22px',
        boxSizing: 'border-box',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
        minWidth: 0,
      }}
    >
      <ArticleImage url={article.main_image_url} />

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '12px',
            color: colors.muted,
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          <span>EXPERT Q&A</span>
          <span>・</span>
          <span>{formatDate(article.published_at)}</span>
          <span>・</span>
          <span>{getExpertLabel(expert)}</span>
        </div>

        <h2
          style={{
            margin: '0 0 12px',
            color: colors.ink,
            fontSize: '24px',
            lineHeight: 1.45,
            letterSpacing: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {article.title}
        </h2>

        <p
          style={{
            margin: '0 0 18px',
            color: '#4b5563',
            fontSize: '15px',
            lineHeight: 1.8,
            overflowWrap: 'anywhere',
          }}
        >
          {article.summary || article.lead_text || '補助金・助成金の活用について、専門家視点でわかりやすく解説します。'}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            color: colors.primary,
            fontSize: '14px',
            fontWeight: 800,
          }}
        >
          <span>{subsidyCount || 0}件のおすすめ補助金</span>
          <span>記事を読む →</span>
        </div>
      </div>
    </Link>
  );
}

export default function ExpertArticles() {
  const [articles, setArticles] = useState([]);
  const [experts, setExperts] = useState({});
  const [subsidyCounts, setSubsidyCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchArticles = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('expert_articles')
        .select('id, expert_id, title, slug, summary, lead_text, main_image_url, published_at')
        .eq('status', 'published')
        .eq('is_active', true)
        .not('slug', 'is', null)
        .neq('slug', '')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });

      if (error) {
        console.error('専門家記事取得エラー:', error);
        if (!cancelled) {
          setArticles([]);
          setLoading(false);
        }
        return;
      }

      const rows = data || [];

      const expertIds = [...new Set(rows.map((item) => item.expert_id).filter(Boolean))];
      const nextExperts = {};

      if (expertIds.length) {
        const { data: expertRows, error: expertError } = await supabase
          .from('experts')
          .select('id, name, qualification, area, avatar_url')
          .in('id', expertIds);

        if (!expertError) {
          (expertRows || []).forEach((expert) => {
            nextExperts[expert.id] = expert;
          });
        }
      }

      const nextCounts = {};
      if (rows.length) {
        const { data: linkRows, error: linkError } = await supabase
          .from('expert_article_subsidies')
          .select('expert_article_id')
          .in('expert_article_id', rows.map((item) => item.id));

        if (!linkError) {
          (linkRows || []).forEach((link) => {
            nextCounts[link.expert_article_id] = (nextCounts[link.expert_article_id] || 0) + 1;
          });
        }
      }

      if (!cancelled) {
        setArticles(rows);
        setExperts(nextExperts);
        setSubsidyCounts(nextCounts);
        setLoading(false);
      }
    };

    fetchArticles();

    return () => {
      cancelled = true;
    };
  }, []);

  const title = '専門家Q&A記事｜愛媛県の補助金・助成金相談';
  const description =
    '愛媛県内の補助金・助成金について、専門家視点のQ&A形式でわかりやすく解説します。';

  const hasArticles = useMemo(() => articles.length > 0, [articles]);

  return (
    <div style={{ minHeight: '100vh', background: colors.page, color: colors.ink }}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://ehime-hojokin.jp/expert-articles" />
      </Helmet>

      <Header />

      <main
        className="expert-articles-page"
        style={{
          width: '100%',
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '56px 24px 88px',
          boxSizing: 'border-box',
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
          }}
        >
          専門家Q&A記事
        </h1>
        <p
          style={{
            maxWidth: '760px',
            margin: '0 0 36px',
            color: '#4b5563',
            fontSize: '16px',
            lineHeight: 1.8,
          }}
        >
          補助金・助成金の活用で迷いやすいポイントを、専門家へのインタビュー形式で整理しています。
          申請前の準備や制度選びの考え方を確認できます。
        </p>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: colors.muted }}>
            専門家記事を読み込んでいます...
          </div>
        ) : hasArticles ? (
          <div style={{ display: 'grid', gap: '20px' }}>
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                expert={experts[article.expert_id]}
                subsidyCount={subsidyCounts[article.id]}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              background: '#ffffff',
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              padding: '32px',
              color: colors.muted,
              lineHeight: 1.8,
            }}
          >
            現在、公開中の専門家Q&A記事は準備中です。
          </div>
        )}
      </main>

      <Footer />

      <style>
        {`
          @media (max-width: 768px) {
            .expert-articles-page {
              padding: 36px 16px 64px !important;
            }

            .expert-article-card {
              grid-template-columns: 1fr !important;
              padding: 18px !important;
            }

            .expert-article-card h2 {
              font-size: 21px !important;
            }
          }
        `}
      </style>
    </div>
  );
}
