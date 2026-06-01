import React, { useState, useEffect, useMemo } from 'react';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import TopPage from './TopPage';
import ExpertsPage from './ExpertsPage';
import BeginnersPage from './BeginnersPage';
import SubsidyCard from './SubsidyCard';
import Header from './Header';
import Footer from './Footer';
import PublicColumns from './PublicColumns';
import Simulator from './Simulator';
import SEO from './components/SEO';
import InternalSeoLinks from './components/InternalSeoLinks';
import FeatureIcon from './components/FeatureIcon';
import {
  FEATURE_PAGES,
  FEATURE_PAGE_GROUPS,
  getFeatureKeywords,
  getFeaturePageBySlug,
} from './featurePages';
import './EhimeSubsidyPortal.css';

import {
  EHIME_MUNICIPALITIES,
  getPurposeTagList,
  getItemRegionCategories,
  isItemClosed,
  parseAmount,
  getSortableDateTimestamp,
} from './portalHelpers';
import { supabase } from './lib/supabaseClient';

function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '愛媛の補助金・助成金ポータル',
    url: 'https://ehime-hojokin.jp/',
    inLanguage: 'ja',
    description:
      '愛媛県内の事業者向け補助金・助成金情報を検索できるポータルサイトです。',
  };
}

function buildCollectionJsonLd({ title, description, url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url,
    inLanguage: 'ja',
    isPartOf: {
      '@type': 'WebSite',
      name: '愛媛の補助金・助成金ポータル',
      url: 'https://ehime-hojokin.jp/',
    },
  };
}

function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://ehime-hojokin.jp${item.path}`,
    })),
  };
}

const AREA_LANDING_PAGES = [
  {
    slug: 'matsuyama',
    region: '松山市',
    title: '松山市の補助金・助成金・給付金一覧',
    description:
      '松山市で利用できる補助金・助成金・給付金・支援金をまとめています。創業、設備投資、販路開拓、IT導入、個人向け支援などの制度を確認できます。',
  },
  {
    slug: 'imabari',
    region: '今治市',
    title: '今治市の給付金・補助金・助成金一覧｜2026年・令和8年の支援制度',
    description:
      '今治市で利用できる給付金、補助金、助成金、支援金を2026年・令和8年の最新情報確認に役立つよう整理しています。事業者向け支援、個人向け給付金、子育て支援、商品券関連制度などを公式情報とあわせて確認できます。',
  },
  {
    slug: 'niihama',
    region: '新居浜市',
    title: '新居浜市の補助金・助成金・給付金一覧',
    description:
      '新居浜市の中小企業・個人事業主・個人向け補助金、助成金、給付金、支援制度を探せます。設備投資、創業、雇用、デジタル化などの制度確認に役立ちます。',
  },
  {
    slug: 'uwajima',
    region: '宇和島市',
    title: '宇和島市の補助金・助成金・給付金一覧',
    description:
      '宇和島市で利用できる補助金・助成金・給付金・支援制度を整理しています。事業者向け支援、農業・水産業、移住・定住、個人向け助成を確認できます。',
  },
  {
    slug: 'seiyo',
    region: '西予市',
    title: '西予市の補助金・助成金・給付金一覧',
    description:
      '西予市で利用できる補助金・助成金・給付金・支援制度を掲載しています。創業、設備投資、農業、移住・定住、子育て支援などの制度確認に役立ちます。',
  },
  {
    slug: 'yawatahama',
    region: '八幡浜市',
    title: '八幡浜市の補助金・助成金・給付金一覧',
    description:
      '八幡浜市で利用できる補助金・助成金・給付金・支援制度をまとめています。事業者支援、設備投資、販路開拓、移住・定住、個人向け助成を確認できます。',
  },
  {
    slug: 'saijo',
    region: '西条市',
    title: '西条市の補助金・助成金・給付金一覧',
    description:
      '西条市で利用できる補助金・助成金・給付金・支援制度を探せます。創業、設備投資、省エネ、農業、子育て、住宅関連支援の確認に役立ちます。',
  },
  {
    slug: 'kumakogen',
    region: '久万高原町',
    title: '久万高原町の給付金・商品券・補助金一覧',
    description:
      '久万高原町で利用できる暮らし応援商品券、給付金、補助金、助成金、支援制度を探せます。町の公式情報を確認しながら、個人向け・事業者向けの支援制度を整理できます。',
  },
];

const PURPOSE_LANDING_PAGES = [
  {
    slug: 'startup',
    title: '愛媛県の創業・起業向け補助金',
    description:
      '愛媛県内で創業・起業を検討する事業者向けに、開業準備、店舗整備、販路開拓などに活用できる補助金・助成金をまとめています。',
    keywords: ['創業', '起業', '開業', 'スタートアップ'],
  },
  {
    slug: 'energy-saving',
    title: '愛媛県の省エネ・設備投資向け補助金',
    description:
      '愛媛県内の省エネ設備、機械導入、工場・店舗改修などに活用できる事業者向け補助金・助成金を探せます。',
    keywords: ['省エネ', '省CO2', '脱炭素', '設備', '機械', '改修'],
  },
  {
    slug: 'digital',
    title: '愛媛県のIT導入・デジタル化補助金',
    description:
      '愛媛県内のIT導入、DX、業務効率化、デジタル化に活用できる事業者向け補助金・助成金をまとめています。',
    keywords: ['IT', 'デジタル', 'DX', 'システム', '業務効率化'],
  },
  {
    slug: 'benefits',
    title: '愛媛県の給付金・補助金・助成金｜非課税世帯・商品券・支援金',
    description:
      '愛媛県内で利用できる給付金、補助金、助成金、支援金、商品券関連制度を探せます。非課税世帯向け支援、物価高騰対策、事業者向け支援などを対象地域や申請期間とあわせて確認できます。',
    keywords: ['給付金', '支援金', '補助金', '助成金', '非課税世帯', '商品券', '物価高騰'],
  },
  {
    slug: 'childcare',
    title: '愛媛県の子育て支援金・医療費助成制度',
    description:
      '愛媛県内の子育て世帯、妊娠・出産、子ども医療、ひとり親家庭、医療費助成、不妊治療、通院支援などに関する助成金・支援制度をまとめています。',
    keywords: ['子育て', '子育て支援金', '医療費助成', '子ども医療', 'ひとり親', '不妊治療', '母子保健'],
  },
  {
    slug: 'housing',
    title: '愛媛県の住宅・空き家・移住定住補助金',
    description:
      '愛媛県内の住宅改修、空き家活用、耐震、省エネ改修、移住・定住に関する補助金・助成金を探せます。',
    keywords: ['住宅', '空き家', '移住', '定住', '耐震', 'リフォーム', '住宅改修'],
  },
];

function getSearchableText(item) {
  return [
    item?.title,
    item?.organization,
    item?.summary,
    item?.overview,
    item?.description,
    item?.region_text,
    item?.region,
    item?.prefecture,
    item?.municipality,
    item?.target_entities,
    item?.target_expenses,
    Array.isArray(item?.purposes) ? item.purposes.join(' ') : item?.purposes,
    Array.isArray(item?.tags) ? item.tags.join(' ') : item?.tags,
    Array.isArray(item?.target_entities_arr) ? item.target_entities_arr.join(' ') : '',
    Array.isArray(item?.target_expenses_arr) ? item.target_expenses_arr.join(' ') : '',
    Array.isArray(item?.industries) ? item.industries.join(' ') : item?.industries,
    Array.isArray(item?.industry_tags) ? item.industry_tags.join(' ') : item?.industry_tags,
    getPurposeTagList(item).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function filterItemsForLanding(items, page, type) {
  if (type === 'area') {
    return items.filter((item) => {
      const regions = getItemRegionCategories(item);
      return regions.includes(page.region) || getSearchableText(item).includes(page.region);
    });
  }

  if (type === 'feature') {
    const featureKeywords = getFeatureKeywords(page).map((keyword) =>
      String(keyword).toLowerCase()
    );

    return items.filter((item) => {
      const text = getSearchableText(item);
      const purposeTags = getPurposeTagList(item);
      const industryTags = Array.isArray(item?.industries)
        ? item.industries
        : String(item?.industries || '')
            .split(/[,\s、]+/)
            .filter(Boolean);

      const hasPurposeMatch = (page.purposeTags || []).some((tag) =>
        purposeTags.includes(tag)
      );
      const hasIndustryMatch = (page.industryTags || []).some((tag) =>
        industryTags.includes(tag)
      );
      const hasKeywordMatch = featureKeywords.some((keyword) => text.includes(keyword));

      return hasPurposeMatch || hasIndustryMatch || hasKeywordMatch;
    });
  }

  return items.filter((item) => {
    const text = getSearchableText(item);
    return page.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });
}

function FeatureListPage({ items, loading, colors }) {
  const featureCounts = useMemo(() => {
    return FEATURE_PAGES.reduce((acc, feature) => {
      acc[feature.slug] = filterItemsForLanding(items, feature, 'feature').filter(
        (item) => !isItemClosed(item)
      ).length;
      return acc;
    }, {});
  }, [items]);

  return (
    <>
      <SEO
        title="特集から探す｜愛媛県の補助金・助成金｜えひめ補助金ポータル"
        description="業種・目的・個人向け支援など、特集別に愛媛県内の補助金・助成金・支援制度を探せます。"
        canonical="/features"
        jsonLd={[
          buildCollectionJsonLd({
            title: '特集から補助金・助成金を探す',
            description:
              '業種・目的・個人向け支援など、特集別に愛媛県内の補助金・助成金・支援制度を探せる一覧ページです。',
            url: 'https://ehime-hojokin.jp/features',
          }),
          buildBreadcrumbJsonLd([
            { name: 'ホーム', path: '/' },
            { name: '特集から探す', path: '/features' },
          ]),
        ]}
      />

      <main className="main-wrapper">
        <div className="disclaimer-text">
          掲載情報はAIを活用して収集・整理したデータをもとに作成しています。申請前には必ず各制度の公式ページで最新情報をご確認ください。
        </div>

        <section style={{ textAlign: 'center', marginBottom: '42px' }}>
          <p
            style={{
              margin: '0 0 10px',
              color: colors.primary,
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.14em',
            }}
          >
            FEATURE
          </p>
          <h1
            style={{
              margin: '0 0 14px',
              color: colors.primaryText,
              fontSize: '30px',
              lineHeight: 1.35,
              fontWeight: 800,
            }}
          >
            特集から補助金・助成金を探す
          </h1>
          <p
            style={{
              maxWidth: '760px',
              margin: '0 auto',
              color: colors.textSub,
              fontSize: '15px',
              lineHeight: 1.8,
            }}
          >
            業種別、目的別、個人向け支援など、探したいテーマから愛媛県内の補助金・助成金・支援制度を確認できます。
          </p>
        </section>

        {FEATURE_PAGE_GROUPS.map((group) => (
          <section key={group.title} style={{ marginBottom: '40px' }}>
            <div className="title-section" style={{ marginBottom: '18px' }}>
              <div>
                <h2
                  style={{
                    margin: '0 0 6px',
                    color: colors.primaryText,
                    fontSize: '22px',
                    fontWeight: 800,
                  }}
                >
                  {group.title}
                </h2>
                <p style={{ margin: 0, color: colors.textSub, fontSize: '13px' }}>
                  {group.description}
                </p>
              </div>
            </div>

            <div
              className="feature-list-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gridAutoRows: 'minmax(300px, auto)',
                gap: '16px',
                alignItems: 'stretch',
              }}
            >
              {group.slugs
                .map(getFeaturePageBySlug)
                .filter(Boolean)
                .map((feature) => (
                  <Link
                    key={feature.slug}
                    to={feature.path}
                    className="feature-list-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      minHeight: 0,
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '14px',
                      padding: '22px',
                      textDecoration: 'none',
                      color: 'inherit',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '12px',
                      }}
                    >
                      <FeatureIcon slug={feature.slug} color={feature.color || colors.primary} size={36} />
                      <span
                        style={{
                          fontSize: '12px',
                          color: feature.color,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                        }}
                      >
                        FEATURE
                      </span>
                    </div>
                    <h3
                      style={{
                        margin: '0 0 10px',
                        color: colors.primaryText,
                        fontSize: '17px',
                        lineHeight: 1.5,
                        fontWeight: 800,
                        minHeight: '76px',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      style={{
                        margin: '0 0 14px',
                        color: colors.textSub,
                        fontSize: '13px',
                        lineHeight: 1.75,
                        minHeight: '92px',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {feature.description}
                    </p>
                    <span
                      style={{
                        color: colors.primary,
                        fontSize: '13px',
                        fontWeight: 800,
                        marginTop: 'auto',
                      }}
                    >
                      {loading ? '確認中' : `${featureCounts[feature.slug] || 0}件を確認`} →
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        ))}

        <InternalSeoLinks />
      </main>
    </>
  );
}

function SeoLandingPage({ page, type, items, loading, colors }) {
  const landingItems = useMemo(() => {
    return filterItemsForLanding(items, page, type)
      .filter((item) => !isItemClosed(item))
      .sort((a, b) => getNewArrivalTimestamp(b) - getNewArrivalTimestamp(a));
  }, [items, page, type]);

  const canonical =
    type === 'area'
      ? `/area/${page.slug}`
      : type === 'feature'
        ? `/feature/${page.slug}`
        : `/purpose/${page.slug}`;
  const breadcrumbName =
    type === 'area' ? '地域から探す' : type === 'feature' ? '特集から探す' : '目的から探す';
  const shownItems = landingItems.slice(0, 12);
  const heading = page.h1 || page.heading || page.title;
  const leadText = page.leadText || page.description;
  const featureKeywords = type === 'feature' ? getFeatureKeywords(page) : [];
  const searchKeyword =
    type === 'area' ? page.region : type === 'feature' ? featureKeywords[0] : page.keywords[0];
  const relatedFeatures =
    type === 'feature'
      ? (page.relatedFeatureSlugs || []).map(getFeaturePageBySlug).filter(Boolean)
      : [];

  return (
    <>
      <SEO
        title={type === 'feature' ? page.seoTitle || page.title : `${page.title}｜事業者向け支援制度`}
        description={page.description}
        canonical={canonical}
        jsonLd={[
          buildCollectionJsonLd({
            title: page.title,
            description: page.description,
            url: `https://ehime-hojokin.jp${canonical}`,
          }),
          buildBreadcrumbJsonLd([
            { name: 'ホーム', path: '/' },
            { name: breadcrumbName, path: canonical },
            { name: page.title, path: canonical },
          ]),
        ]}
      />

      <main className="main-wrapper">
        <div className="disclaimer-text">
          掲載情報はAIを活用して収集・整理したデータをもとに作成しています。申請前には必ず各制度の公式ページで最新情報をご確認ください。
        </div>

        <section style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1
            className="landing-page-title"
            style={{
              fontSize: '30px',
              fontWeight: '800',
              color: colors.primaryText,
              margin: '0 0 16px',
            }}
          >
            {heading}
          </h1>

          <p
            className="landing-page-description"
            style={{
              maxWidth: '760px',
              margin: '0 auto',
              color: colors.textSub,
              fontSize: '15px',
              lineHeight: 1.8,
            }}
          >
            {page.description}
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <div className="title-section">
            <p style={{ color: colors.textSub, fontSize: '15px', margin: 0 }}>
              募集中の補助金・助成金
              <span
                style={{
                  fontWeight: 'bold',
                  fontSize: '24px',
                  color: colors.primary,
                  padding: '0 4px',
                }}
              >
                {landingItems.length}
              </span>
              件
            </p>

            <Link
              to={`/search?keyword=${encodeURIComponent(searchKeyword || page.title)}`}
              style={{
                color: colors.primary,
                fontSize: '14px',
                fontWeight: 'bold',
                textDecoration: 'none',
              }}
            >
              一覧検索でさらに絞り込む →
            </Link>
          </div>
        </section>

        {type === 'feature' && (
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
              marginBottom: '34px',
            }}
            className="feature-page-intro-grid"
          >
            <div
              style={{
                backgroundColor: 'white',
                border: `1px solid ${colors.border}`,
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              <h2
                style={{
                  margin: '0 0 12px',
                  color: colors.primaryText,
                  fontSize: '20px',
                  fontWeight: 800,
                }}
              >
                このような方におすすめ
              </h2>
              <p
                style={{
                  margin: '0 0 18px',
                  color: colors.textMain,
                  fontSize: '14px',
                  lineHeight: 1.8,
                }}
              >
                {leadText}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(page.targetKeywords || []).map((keyword) => (
                  <span
                    key={keyword}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '7px 10px',
                      borderRadius: '999px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: colors.primaryText,
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '16px',
                padding: '22px',
                color: '#713f12',
                fontSize: '13px',
                lineHeight: 1.8,
              }}
            >
              <strong style={{ display: 'block', marginBottom: '8px' }}>
                公式情報をご確認ください
              </strong>
              掲載情報は制度探しの入口として整理しています。申請期間、対象者、上限額、必要書類は必ず公式ページで最新情報をご確認ください。
            </div>
          </section>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: colors.textSub }}>
            データを読み込んでいます...
          </div>
        ) : shownItems.length > 0 ? (
          <div className="card-grid">
            {shownItems.map((item) => (
              <SubsidyCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '56px 24px',
              backgroundColor: 'white',
              border: `1px solid ${colors.border}`,
              borderRadius: '16px',
              color: colors.textSub,
            }}
          >
            {type === 'feature'
              ? '現在、この特集に該当する補助金・助成金は確認中です。関連する目的別ページや地域別ページもご確認ください。'
              : '現在、この条件で募集中の補助金は見つかりませんでした。関連する制度は一覧検索から確認できます。'}
          </div>
        )}

        {type === 'feature' && relatedFeatures.length > 0 && (
          <section style={{ marginTop: '40px' }}>
            <div className="title-section" style={{ marginBottom: '16px' }}>
              <h2
                style={{
                  margin: 0,
                  color: colors.primaryText,
                  fontSize: '22px',
                  fontWeight: 800,
                }}
              >
                関連する特集
              </h2>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
              }}
            >
              {relatedFeatures.map((feature) => (
                <Link
                  key={feature.slug}
                  to={feature.path}
                  style={{
                    display: 'block',
                    padding: '18px',
                    borderRadius: '14px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: 'white',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <FeatureIcon slug={feature.slug} color={feature.color || colors.primary} size={34} />
                  </div>
                  <strong
                    style={{
                      display: 'block',
                      color: colors.primaryText,
                      fontSize: '15px',
                      lineHeight: 1.5,
                    }}
                  >
                    {feature.title}
                  </strong>
                </Link>
              ))}
            </div>
          </section>
        )}

        <InternalSeoLinks />
      </main>
    </>
  );
}

function getKeywordFromSearch(location) {
  const params = new URLSearchParams(location.search);
  return params.get('keyword') || params.get('q') || '';
}

function getNewArrivalTimestamp(item) {
  const candidates = [
    item?.fetched_at,
    item?.updated_at,
    item?.published_at,
    item?.imported_at,
    item?.crawled_at,
    item?.created_at,
  ];

  for (const value of candidates) {
    if (!value) continue;

    const time = new Date(value).getTime();

    if (!Number.isNaN(time)) {
      return time;
    }
  }

  return Number(item?.id || 0);
}

function getAmountValue(item) {
  const rawValue =
    item?.amount_max_yen ||
    parseAmount(item?.amount_text || item?.amount || '');

  const num = Number(rawValue || 0);

  return Number.isFinite(num) ? num : 0;
}

function compareAmountDesc(a, b) {
  const aVal = getAmountValue(a);
  const bVal = getAmountValue(b);

  const aMissing = aVal <= 0;
  const bMissing = bVal <= 0;

  if (aMissing && !bMissing) return 1;
  if (!aMissing && bMissing) return -1;

  return bVal - aVal;
}

function compareAmountAsc(a, b) {
  const aVal = getAmountValue(a);
  const bVal = getAmountValue(b);

  const aMissing = aVal <= 0;
  const bMissing = bVal <= 0;

  if (aMissing && !bMissing) return 1;
  if (!aMissing && bMissing) return -1;

  return aVal - bVal;
}

export default function EhimeSubsidyPortal() {
  const location = useLocation();

  const [subsidies, setSubsidies] = useState([]);
  const [latestColumns, setLatestColumns] = useState([]);
  const [featureColumns, setFeatureColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  const [displayMode, setDisplayMode] = useState('open');
  const [sortBy, setSortBy] = useState('newest');
  const [keyword, setKeyword] = useState('');
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedPurposes, setSelectedPurposes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    const queryKeyword = getKeywordFromSearch(location);

    if (location.pathname === '/search') {
      setKeyword(queryKeyword);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('subsidies')
          .select('*')
          .eq('is_active', true)
          .eq('crawl_status', 'published')
          .order('fetched_at', { ascending: false });

        if (error) throw error;

        setSubsidies(data || []);

        const { data: colData } = await supabase
          .from('columns')
          .select('id, title, slug, published_at, created_at, category')
          .eq('is_published', true)
          .or('category.is.null,category.neq.特集')
          .order('published_at', { ascending: false })
          .limit(3);

        if (colData) setLatestColumns(colData);

        const { data: featureData } = await supabase
          .from('columns')
          .select(
            'id, title, slug, published_at, created_at, category, meta_description, thumbnail_text, thumbnail_url'
          )
          .eq('is_published', true)
          .eq('category', '特集')
          .order('published_at', { ascending: false })
          .limit(3);

        if (featureData) setFeatureColumns(featureData);
      } catch (err) {
        console.error('データ取得エラー:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, displayMode, sortBy, selectedRegions, selectedPurposes]);

  const baseItems = useMemo(() => {
    let items = [...subsidies];

    if (displayMode === 'open') {
      items = items.filter((item) => !isItemClosed(item));
    } else if (displayMode === 'closed') {
      items = items.filter((item) => isItemClosed(item));
    }

    if (keyword !== '') {
      const lowerKeyword = keyword.toLowerCase();

      items = items.filter((item) => {
        const targetEntitiesText = Array.isArray(item.target_entities_arr)
          ? item.target_entities_arr.join(' ')
          : item.target_entities || '';

        const targetExpensesText = Array.isArray(item.target_expenses_arr)
          ? item.target_expenses_arr.join(' ')
          : item.target_expenses || '';

        const regionText = [
          item.region_text,
          item.region,
          item.prefecture,
          item.municipality,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          (item.title && item.title.toLowerCase().includes(lowerKeyword)) ||
          (item.organization &&
            item.organization.toLowerCase().includes(lowerKeyword)) ||
          (item.summary && item.summary.toLowerCase().includes(lowerKeyword)) ||
          targetEntitiesText.toLowerCase().includes(lowerKeyword) ||
          targetExpensesText.toLowerCase().includes(lowerKeyword) ||
          regionText.toLowerCase().includes(lowerKeyword)
        );
      });
    }

    return items;
  }, [subsidies, displayMode, keyword]);

  const regionCounts = useMemo(() => {
    const counts = { '県・全国 (市町村指定なし)': 0 };

    EHIME_MUNICIPALITIES.forEach((city) => {
      counts[city] = 0;
    });

    let items = baseItems;

    if (selectedPurposes.length > 0) {
      items = items.filter((item) => {
        const pList = getPurposeTagList(item);
        return selectedPurposes.some((p) => pList.includes(p));
      });
    }

    items.forEach((item) => {
      const cats = getItemRegionCategories(item);
      cats.forEach((cat) => {
        if (counts[cat] !== undefined) counts[cat]++;
      });
    });

    return counts;
  }, [baseItems, selectedPurposes]);

  const purposeCounts = useMemo(() => {
    const counts = {};
    let items = baseItems;

    if (selectedRegions.length > 0) {
      items = items.filter((item) => {
        const cats = getItemRegionCategories(item);
        return cats.some((cat) => selectedRegions.includes(cat));
      });
    }

    items.forEach((item) => {
      const pList = getPurposeTagList(item);
      Array.from(new Set(pList)).forEach((p) => {
        counts[p] = (counts[p] || 0) + 1;
      });
    });

    return counts;
  }, [baseItems, selectedRegions]);

  const displayItems = useMemo(() => {
    let items = [...baseItems];

    if (selectedRegions.length > 0) {
      items = items.filter((item) => {
        const cats = getItemRegionCategories(item);
        return cats.some((cat) => selectedRegions.includes(cat));
      });
    }

    if (selectedPurposes.length > 0) {
      items = items.filter((item) => {
        const pList = getPurposeTagList(item);
        return selectedPurposes.some((purpose) => pList.includes(purpose));
      });
    }

    items.sort((a, b) => {
      const aClosed = isItemClosed(a);
      const bClosed = isItemClosed(b);

      if (displayMode === 'all' && aClosed !== bClosed) {
        return aClosed ? 1 : -1;
      }

      if (sortBy === 'newest') {
        return getNewArrivalTimestamp(b) - getNewArrivalTimestamp(a);
      }

      if (sortBy === 'deadline') {
        const dateA = getSortableDateTimestamp(a);
        const dateB = getSortableDateTimestamp(b);

        if (displayMode === 'closed') return dateB - dateA;

        return dateA - dateB;
      }

      if (sortBy === 'amount_desc') {
        return compareAmountDesc(a, b);
      }

      if (sortBy === 'amount_asc') {
        return compareAmountAsc(a, b);
      }

      if (sortBy === 'title') {
        return String(a.title || '').localeCompare(String(b.title || ''), 'ja');
      }

      return getNewArrivalTimestamp(b) - getNewArrivalTimestamp(a);
    });

    return items;
  }, [baseItems, selectedRegions, selectedPurposes, sortBy, displayMode]);

  const totalItems = displayItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startCount = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endCount = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  const paginatedItems = displayItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (endPage - startPage < 4) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, 5);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, totalPages - 4);
      }
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  };

  const recentSubsidies = useMemo(
    () => subsidies.filter((item) => !isItemClosed(item)).slice(0, 5),
    [subsidies]
  );

  const colors = {
    primary: '#526b5d',
    primaryText: '#2d3b33',
    border: '#e4e7e5',
    textMain: '#4b5550',
    textSub: '#8b9690',
  };

  const searchTitle = keyword
    ? `${keyword}に関連する補助金・助成金を検索`
    : '愛媛県の補助金・助成金を検索';

  const searchDescription = keyword
    ? `愛媛県内で「${keyword}」に関連する補助金・助成金情報を検索できます。対象地域、申請期間、上限金額、補助率、公式公募ページを確認できます。`
    : '愛媛県内の事業者向け補助金・助成金を、地域・目的・業種・キーワードから検索できます。松山市、今治市、西予市、宇和島市などの支援制度を掲載しています。';

  const searchCanonical = keyword
    ? `/search?keyword=${encodeURIComponent(keyword)}`
    : '/search';

  return (
    <div
      className="portal-container"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <Header />

      <div style={{ flex: 1 }}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <SEO
                  title="愛媛の補助金・助成金ポータル｜松山市・今治市など県内支援制度を検索"
                  description="愛媛県内の事業者向け補助金・助成金情報を検索できるポータルサイトです。松山市、今治市、西予市、宇和島市などの支援制度を、地域・目的・業種から探せます。"
                  canonical="/"
                  jsonLd={buildWebsiteJsonLd()}
                />
                <TopPage
                  recentSubsidies={recentSubsidies}
                  latestColumns={latestColumns}
                  featureColumns={featureColumns}
                />
              </>
            }
          />

          <Route
            path="/simulator"
            element={
              <>
                <SEO
                  title="補助金シミュレーター｜愛媛県内事業者向けの補助金目安を確認"
                  description="IT導入や設備投資などで、どのくらい補助金を活用できる可能性があるかを確認できる無料シミュレーターです。"
                  canonical="/simulator"
                  jsonLd={buildBreadcrumbJsonLd([
                    { name: 'ホーム', path: '/' },
                    { name: 'シミュレーター', path: '/simulator' },
                  ])}
                />
                <Simulator />
              </>
            }
          />

          <Route
            path="/experts"
            element={
              <>
                <SEO
                  title="補助金申請に詳しい専門家を探す｜愛媛県内の事業者支援"
                  description="補助金・助成金の申請をサポートしてくれる愛媛県内の専門家を探せます。申請書類、制度選び、事業計画の相談に役立ちます。"
                  canonical="/experts"
                  jsonLd={buildBreadcrumbJsonLd([
                    { name: 'ホーム', path: '/' },
                    { name: '専門家を探す', path: '/experts' },
                  ])}
                />
                <ExpertsPage />
              </>
            }
          />

          <Route
            path="/beginners"
            element={
              <>
                <SEO
                  title="はじめての方へ｜補助金・助成金の基礎知識と申請の流れ"
                  description="補助金・助成金の違い、申請の流れ、採択後の注意点など、愛媛県内の事業者が知っておきたい基礎知識をわかりやすく解説します。"
                  canonical="/beginners"
                  jsonLd={buildBreadcrumbJsonLd([
                    { name: 'ホーム', path: '/' },
                    { name: 'はじめての方へ', path: '/beginners' },
                  ])}
                />
                <BeginnersPage />
              </>
            }
          />

          <Route
            path="/columns"
            element={
              <>
                <SEO
                  title="お役立ちコラム｜愛媛県の補助金・助成金活用ガイド"
                  description="愛媛県の補助金・助成金に関する最新情報、用語解説、申請の基礎知識、活用事例をコラムで紹介します。"
                  canonical="/columns"
                  jsonLd={buildCollectionJsonLd({
                    title: 'お役立ちコラム',
                    description:
                      '愛媛県の補助金・助成金に関する最新情報や基礎知識を紹介するコラム一覧です。',
                    url: 'https://ehime-hojokin.jp/columns',
                  })}
                />
                <PublicColumns />
              </>
            }
          />

          {AREA_LANDING_PAGES.map((page) => (
            <Route
              key={page.slug}
              path={`/area/${page.slug}`}
              element={
                <SeoLandingPage
                  page={page}
                  type="area"
                  items={subsidies}
                  loading={loading}
                  colors={colors}
                />
              }
            />
          ))}

          {PURPOSE_LANDING_PAGES.map((page) => (
            <Route
              key={page.slug}
              path={`/purpose/${page.slug}`}
              element={
                <SeoLandingPage
                  page={page}
                  type="purpose"
                  items={subsidies}
                  loading={loading}
                  colors={colors}
                />
              }
            />
          ))}

          <Route
            path="/features"
            element={<FeatureListPage items={subsidies} loading={loading} colors={colors} />}
          />

          {FEATURE_PAGES.map((page) => (
            <Route
              key={page.slug}
              path={page.path}
              element={
                <SeoLandingPage
                  page={page}
                  type="feature"
                  items={subsidies}
                  loading={loading}
                  colors={colors}
                />
              }
            />
          ))}

          <Route
            path="/search"
            element={
              <>
                <SEO
                  title={searchTitle}
                  description={searchDescription}
                  canonical={searchCanonical}
                  robots="noindex,follow"
                  jsonLd={buildCollectionJsonLd({
                    title: searchTitle,
                    description: searchDescription,
                    url: `https://ehime-hojokin.jp${searchCanonical}`,
                  })}
                />

                <div className="main-wrapper">
                  <div className="disclaimer-text">
                    掲載している情報は、AIを活用して収集・整理したデータをもとに作成しております。そのため、内容に誤りや最新情報との相違が含まれる可能性がございます。ご利用の際は、必ず各制度・事業の公式ページにて最新かつ正確な情報をご確認くださいますようお願いいたします。
                  </div>

                  <h1
                    className="search-page-title"
                    style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      color: colors.primaryText,
                      marginBottom: '16px',
                      textAlign: 'center',
                    }}
                  >
                    {keyword
                      ? `${keyword}に関連する補助金・助成金一覧`
                      : '愛媛県の補助金・助成金・支援金一覧'}
                  </h1>

                  <p
                    className="search-page-description"
                    style={{
                      maxWidth: '760px',
                      margin: '0 auto 40px',
                      textAlign: 'center',
                      color: colors.textSub,
                      fontSize: '14px',
                      lineHeight: 1.8,
                    }}
                  >
                    愛媛県内の事業者向け補助金・助成金を、地域・目的・キーワードから探せます。申請前には必ず公式ページで最新情報をご確認ください。
                  </p>

                  <div className="title-section search-title-section">
                    <p
                      className="search-result-count"
                      style={{ color: colors.textSub, fontSize: '15px', margin: 0 }}
                    >
                      該当する補助金・助成金
                      <span
                        style={{
                          fontWeight: 'bold',
                          fontSize: '24px',
                          color: colors.primary,
                          padding: '0 4px',
                        }}
                      >
                        {totalItems}
                      </span>
                      件
                    </p>

                    <div
                      className="search-sort-control"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: 'auto',
                      }}
                    >
                      <select
                        className="search-sort-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{
                          padding: '10px 40px 10px 16px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          backgroundColor: 'white',
                          color: colors.textMain,
                          fontSize: '14px',
                          outline: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        <option value="newest">新着順</option>
                        <option value="deadline">締切が近い順</option>
                        <option value="amount_desc">上限金額が高い順</option>
                        <option value="amount_asc">上限金額が低い順</option>
                        <option value="title">タイトル順</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="layout-grid">
                  <aside className="sidebar">
                    <div
                      style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '16px',
                        border: `1px solid ${colors.border}`,
                        boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: '700',
                          marginBottom: '16px',
                          color: colors.primaryText,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>🔍</span> 絞り込み検索
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          marginBottom: '8px',
                          color: colors.textSub,
                        }}
                      >
                        キーワードを入力
                      </div>

                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="例: IT, 創業, 松山市"
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          outline: 'none',
                          color: colors.textMain,
                          boxSizing: 'border-box',
                          fontSize: '14px',
                          backgroundColor: '#f9fafb',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        backgroundColor: 'white',
                        padding: '20px 24px',
                        borderRadius: '16px',
                        border: `1px solid ${colors.border}`,
                        boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: '700',
                          color: colors.primaryText,
                          marginBottom: '16px',
                        }}
                      >
                        👁️ 表示設定
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: colors.textMain,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={displayMode === 'open'}
                            onChange={() => setDisplayMode('open')}
                            style={{
                              accentColor: colors.primary,
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                            }}
                          />
                          募集中のみ表示
                        </label>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: colors.textMain,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={displayMode === 'all'}
                            onChange={() => setDisplayMode('all')}
                            style={{
                              accentColor: colors.primary,
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                            }}
                          />
                          全て表示
                        </label>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: colors.textMain,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={displayMode === 'closed'}
                            onChange={() => setDisplayMode('closed')}
                            style={{
                              accentColor: colors.primary,
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                            }}
                          />
                          受付終了のみ表示
                        </label>
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '16px',
                        border: `1px solid ${colors.border}`,
                        boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: '700',
                          color: colors.primaryText,
                          marginBottom: '8px',
                        }}
                      >
                        📍 対象地域で探す
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: colors.textSub,
                          marginBottom: '16px',
                        }}
                      >
                        ※チェックなしで「すべて」表示されます
                      </div>

                      <div
                        className="custom-scrollbar"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          maxHeight: '280px',
                          overflowY: 'auto',
                          paddingRight: '8px',
                        }}
                      >
                        {['県・全国 (市町村指定なし)', ...EHIME_MUNICIPALITIES].map(
                          (region) => {
                            const count = regionCounts[region] || 0;
                            if (count === 0) return null;

                            return (
                              <label
                                key={region}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  gap: '8px',
                                  width: '100%',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '14px',
                                    color: colors.textMain,
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRegions.includes(region)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRegions([...selectedRegions, region]);
                                      } else {
                                        setSelectedRegions(
                                          selectedRegions.filter((r) => r !== region)
                                        );
                                      }
                                    }}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      accentColor: colors.primary,
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                    }}
                                  />

                                  <span
                                    style={{
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      paddingRight: '4px',
                                    }}
                                  >
                                    {region}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    fontSize: '12px',
                                    color: colors.textSub,
                                    backgroundColor: '#f3f4f6',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    flexShrink: 0,
                                  }}
                                >
                                  {count}件
                                </div>
                              </label>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '16px',
                        border: `1px solid ${colors.border}`,
                        boxShadow: '0 2px 8px -2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: '700',
                          color: colors.primaryText,
                          marginBottom: '16px',
                        }}
                      >
                        🏷 利用目的を選択
                      </div>

                      <div
                        className="custom-scrollbar"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          maxHeight: '280px',
                          overflowY: 'auto',
                          paddingRight: '8px',
                        }}
                      >
                        {Object.entries(purposeCounts)
                          .sort((a, b) => b[1] - a[1])
                          .map(([purpose, count]) => (
                            <label
                              key={purpose}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                gap: '8px',
                                width: '100%',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '14px',
                                  color: colors.textMain,
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPurposes.includes(purpose)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedPurposes([...selectedPurposes, purpose]);
                                    } else {
                                      setSelectedPurposes(
                                        selectedPurposes.filter((p) => p !== purpose)
                                      );
                                    }
                                  }}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: colors.primary,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                  }}
                                />

                                <span
                                  style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    paddingRight: '4px',
                                  }}
                                >
                                  {purpose}
                                </span>
                              </div>

                              <div
                                style={{
                                  fontSize: '12px',
                                  color: colors.textSub,
                                  backgroundColor: '#f3f4f6',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontWeight: '600',
                                  flexShrink: 0,
                                }}
                              >
                                {count}件
                              </div>
                            </label>
                          ))}

                        {Object.keys(purposeCounts).length === 0 && (
                          <span style={{ fontSize: '13px', color: colors.textSub }}>
                            データがありません
                          </span>
                        )}
                      </div>
                    </div>
                  </aside>

                  <div className="content-area">
                    {loading ? (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '80px 0',
                          color: colors.textSub,
                          fontSize: '15px',
                        }}
                      >
                        ⏳ データを読み込んでいます...
                      </div>
                    ) : (
                      <>
                        <div className="card-grid">
                          {displayItems.length === 0 ? (
                            <div
                              style={{
                                gridColumn: '1 / -1',
                                textAlign: 'center',
                                padding: '80px 0',
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                border: `1px solid ${colors.border}`,
                                color: colors.textSub,
                              }}
                            >
                              条件に一致する補助金がありません
                            </div>
                          ) : (
                            paginatedItems.map((item) => (
                              <SubsidyCard
                                key={item.id}
                                item={item}
                                isSelected={selectedItem?.id === item.id}
                                onToggleSelect={() =>
                                  setSelectedItem(
                                    selectedItem?.id === item.id ? null : item
                                  )
                                }
                              />
                            ))
                          )}
                        </div>

                        {totalPages > 1 && (
                          <div
                            style={{
                              marginTop: '48px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '20px',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: colors.primaryText,
                              }}
                            >
                              {totalItems}件中 {startCount}-{endCount}件の補助金を表示
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() =>
                                  handlePageChange(Math.max(1, currentPage - 1))
                                }
                                disabled={currentPage === 1}
                                className="page-btn"
                              >
                                &lt;
                              </button>

                              {getPageNumbers().map((pageNum) => (
                                <button
                                  key={pageNum}
                                  onClick={() => handlePageChange(pageNum)}
                                  className={`page-btn ${
                                    currentPage === pageNum ? 'active' : ''
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              ))}

                              <button
                                onClick={() =>
                                  handlePageChange(Math.min(totalPages, currentPage + 1))
                                }
                                disabled={currentPage === totalPages}
                                className="page-btn"
                              >
                                &gt;
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <InternalSeoLinks />
              </>
            }
          />
        </Routes>
      </div>

      <Footer />
    </div>
  );
}
