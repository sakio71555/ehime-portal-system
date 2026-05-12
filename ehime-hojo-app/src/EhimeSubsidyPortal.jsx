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
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://ehime-hojokin.jp/search?keyword={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
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
    title: '松山市の補助金・助成金一覧',
    description:
      '松山市で利用できる事業者向け補助金・助成金・支援金をまとめています。創業、設備投資、販路開拓、IT導入などに使える制度を確認できます。',
  },
  {
    slug: 'imabari',
    region: '今治市',
    title: '今治市の補助金・助成金一覧',
    description:
      '今治市で利用できる事業者向け補助金・助成金・支援金を掲載しています。申請期間、対象者、上限額、公式公募ページを確認できます。',
  },
  {
    slug: 'niihama',
    region: '新居浜市',
    title: '新居浜市の補助金・助成金一覧',
    description:
      '新居浜市の中小企業・個人事業主向け補助金、助成金、支援制度を探せます。設備投資、創業、雇用、デジタル化などの制度確認に役立ちます。',
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
];

const FEATURE_LANDING_PAGES = [
  {
    slug: 'construction',
    title: '建設業・建築業の方必見｜愛媛県で使える補助金・助成金特集',
    heading: '建設業・建築業の方におすすめの補助金・助成金',
    description:
      '愛媛県内の建設業・建築業・工務店・設備工事業の方が確認しておきたい補助金・助成金をまとめています。設備投資、省エネ、IT導入、人材確保、防災・BCP、事業承継など、建設関連事業者が活用しやすい制度を探せます。',
    keywords: [
      '建設業',
      '建築業',
      '工務店',
      '設備工事',
      '設備投資',
      '省エネ',
      '人材育成',
      '雇用',
      '生産性向上',
      '業務効率化',
      '防犯',
      '防災',
      'BCP',
      '事業承継',
    ],
  },
  {
    slug: 'restaurant-retail',
    title: '飲食店・小売店の方必見｜愛媛県で使える補助金・助成金特集',
    heading: '飲食店・小売店の方におすすめの補助金・助成金',
    description:
      '愛媛県内の飲食店・小売店・店舗運営事業者の方が確認しておきたい補助金・助成金をまとめています。店舗改装、販路開拓、省力化、デジタル化、キャッシュレス対応、省エネ設備の導入などに活用できる制度を探せます。',
    keywords: [
      '飲食業',
      '飲食店',
      '小売業',
      '小売店',
      '店舗',
      '店舗改装',
      '販路開拓',
      '販路拡大',
      '設備投資',
      '省力化',
      '省人化',
      'デジタル',
      'キャッシュレス',
      '省エネ',
    ],
  },
  {
    slug: 'startup-digital',
    title: '創業・IT導入・DXをお考えの方へ｜愛媛県の補助金・助成金特集',
    heading: '創業・IT導入・DXに使える補助金・助成金',
    description:
      '愛媛県内で創業・起業を考えている方、IT導入やDX、業務効率化を進めたい事業者向けの補助金・助成金をまとめています。ホームページ制作、ECサイト、業務システム、クラウドツール、デジタル化、販路開拓などに関する制度を探せます。',
    keywords: [
      '起業',
      '創業',
      'ベンチャー',
      'デジタル',
      '生産性向上',
      '業務効率化',
      '販路開拓',
      '販路拡大',
      '新規事業',
      '第二創業',
      'IT',
      'DX',
      'ホームページ',
      'EC',
      'システム',
      'クラウド',
    ],
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

  return items.filter((item) => {
    const text = getSearchableText(item);
    return page.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });
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
  const heading = page.heading || page.title;

  return (
    <>
      <SEO
        title={type === 'feature' ? page.title : `${page.title}｜事業者向け支援制度`}
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
              to={`/search?keyword=${encodeURIComponent(
                type === 'area' ? page.region : page.keywords[0]
              )}`}
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
            現在、この条件で募集中の補助金は見つかりませんでした。関連する制度は一覧検索から確認できます。
          </div>
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

          {FEATURE_LANDING_PAGES.map((page) => (
            <Route
              key={page.slug}
              path={`/feature/${page.slug}`}
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
