import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import SEO from './components/SEO';
import SubsidyCard from './SubsidyCard';
import InternalSeoLinks from './components/InternalSeoLinks';
import {
  getPurposeTagList,
  getItemRegionCategories,
  isItemClosed,
} from './portalHelpers';

const SEO_TITLE =
  '愛媛県の補助金・助成金・給付金一覧【2026年最新】個人・事業者向け';

const SEO_DESCRIPTION =
  '愛媛県で利用できる補助金・助成金・給付金を、個人向け・事業者向け・市町村別・目的別に探せます。';

const sectionStyle = {
  marginBottom: '42px',
};

const sectionTitleStyle = {
  margin: '0 0 14px',
  color: '#2d3b33',
  fontSize: '22px',
  lineHeight: 1.45,
  fontWeight: 800,
};

const textStyle = {
  margin: 0,
  color: '#4b5550',
  fontSize: '15px',
  lineHeight: 1.85,
};

const linkGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const cityLinks = [
  { label: '松山市', to: '/area/matsuyama' },
  { label: '今治市', to: '/area/imabari' },
  { label: '宇和島市', to: '/area/uwajima' },
  { label: '新居浜市', to: '/area/niihama' },
  { label: '西条市', to: '/area/saijo' },
  { label: '大洲市', to: '/search?keyword=大洲市' },
  { label: '西予市', to: '/area/seiyo' },
];

const purposeLinks = [
  { label: '住宅・リフォーム', to: '/purpose/housing' },
  { label: '創業・起業', to: '/purpose/startup' },
  { label: '設備投資', to: '/search?keyword=設備投資' },
  { label: '省エネ・太陽光・蓄電池', to: '/purpose/energy-saving' },
  { label: '子育て・医療・福祉', to: '/purpose/childcare' },
  { label: '農業・漁業', to: '/feature/agriculture' },
];

const personalKeywords = [
  '子育て',
  '医療',
  '福祉',
  '住宅',
  'リフォーム',
  '移住',
  '給付金',
  '支援金',
  '助成',
];

const businessKeywords = [
  '創業',
  '起業',
  '設備',
  '販路',
  'DX',
  'IT',
  '省エネ',
  '事業者',
  '中小企業',
  '個人事業主',
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
    getItemRegionCategories(item).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
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

function matchesAnyKeyword(item, keywords) {
  const text = getSearchableText(item);
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function LinkTile({ to, children }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minHeight: '48px',
        padding: '12px 14px',
        border: '1px solid #dbe7e4',
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        color: '#2d3b33',
        fontSize: '14px',
        fontWeight: 800,
        textDecoration: 'none',
      }}
    >
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function SummaryBand({ children }) {
  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px',
      }}
    >
      {children}
    </div>
  );
}

export default function EhimeSubsidyPage({ items = [], loading = false, colors }) {
  const openItems = useMemo(() => {
    return items
      .filter((item) => !isItemClosed(item))
      .sort((a, b) => getNewArrivalTimestamp(b) - getNewArrivalTimestamp(a));
  }, [items]);

  const personalItems = useMemo(() => {
    return openItems.filter((item) => matchesAnyKeyword(item, personalKeywords));
  }, [openItems]);

  const businessItems = useMemo(() => {
    return openItems.filter((item) => matchesAnyKeyword(item, businessKeywords));
  }, [openItems]);

  const shownOpenItems = openItems.slice(0, 6);
  const shownPersonalItems = personalItems.slice(0, 3);
  const shownBusinessItems = businessItems.slice(0, 3);
  const primaryColor = colors?.primary || '#526b5d';
  const primaryText = colors?.primaryText || '#2d3b33';

  return (
    <>
      <SEO
        title={SEO_TITLE}
        description={SEO_DESCRIPTION}
        canonical="/ehime-subsidy/"
        robots="index,follow"
        appendSiteName={false}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: SEO_TITLE,
            description: SEO_DESCRIPTION,
            url: 'https://ehime-hojokin.jp/ehime-subsidy/',
            inLanguage: 'ja',
            isPartOf: {
              '@type': 'WebSite',
              name: '愛媛の補助金・助成金ポータル',
              url: 'https://ehime-hojokin.jp/',
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'ホーム',
                item: 'https://ehime-hojokin.jp/',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: '愛媛県の補助金・助成金・給付金一覧',
                item: 'https://ehime-hojokin.jp/ehime-subsidy/',
              },
            ],
          },
        ]}
      />

      <main className="main-wrapper">
        <div className="disclaimer-text">
          掲載情報はAIを活用して収集・整理したデータをもとに作成しています。申請前には必ず各制度の公式ページで最新情報をご確認ください。
        </div>

        <section
          style={{
            textAlign: 'center',
            marginBottom: '46px',
            padding: '18px 0 8px',
          }}
        >
          <p
            style={{
              margin: '0 0 10px',
              color: primaryColor,
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.14em',
            }}
          >
            EHIME SUBSIDY GUIDE
          </p>

          <h1
            style={{
              margin: '0 0 16px',
              color: primaryText,
              fontSize: 'clamp(28px, 3.4vw, 40px)',
              lineHeight: 1.28,
              fontWeight: 800,
            }}
          >
            愛媛県の補助金・助成金・給付金一覧
          </h1>

          <p
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              color: '#4b5550',
              fontSize: '16px',
              lineHeight: 1.85,
            }}
          >
            愛媛県内で利用できる補助金・助成金・給付金を、個人向け、事業者向け、市町村別、目的別に整理しています。
          </p>
        </section>

        <section style={sectionStyle}>
          <div className="title-section" style={{ marginBottom: '18px' }}>
            <div>
              <h2 style={sectionTitleStyle}>今募集中の愛媛県の補助金</h2>
              <p style={textStyle}>
                公募中として確認できる制度を新着順に表示しています。申請期間や対象者は制度ごとに異なるため、詳細ページと公式ページをあわせて確認してください。
              </p>
            </div>

            <Link
              to="/search"
              style={{
                color: primaryColor,
                fontSize: '14px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              すべての補助金を検索 →
            </Link>
          </div>

          {loading ? (
            <SummaryBand>
              <p style={{ ...textStyle, textAlign: 'center' }}>データを読み込んでいます...</p>
            </SummaryBand>
          ) : shownOpenItems.length > 0 ? (
            <div className="card-grid">
              {shownOpenItems.map((item) => (
                <SubsidyCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <SummaryBand>
              <p style={{ ...textStyle, textAlign: 'center' }}>
                現在、公募中の補助金・助成金は確認中です。最新情報は公式ページも確認してください。
              </p>
            </SummaryBand>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>個人向けの補助金</h2>
          <p style={{ ...textStyle, marginBottom: '18px' }}>
            子育て、医療、福祉、住宅、移住、給付金など、暮らしに関わる支援制度を確認できます。
          </p>

          {shownPersonalItems.length > 0 ? (
            <div className="card-grid">
              {shownPersonalItems.map((item) => (
                <SubsidyCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <SummaryBand>
              <p style={textStyle}>
                個人向け制度は市町村や年度によって変わります。子育て、住宅、医療、福祉などの目的別ページからも確認できます。
              </p>
            </SummaryBand>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>事業者向けの補助金</h2>
          <p style={{ ...textStyle, marginBottom: '18px' }}>
            創業、設備投資、販路開拓、IT導入、省エネ、人材育成など、中小企業や個人事業主が確認したい制度を探せます。
          </p>

          {shownBusinessItems.length > 0 ? (
            <div className="card-grid">
              {shownBusinessItems.map((item) => (
                <SubsidyCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <SummaryBand>
              <p style={textStyle}>
                事業者向け制度は公募期間が短いものもあります。設備投資、創業、販路開拓などの目的から探すと確認しやすくなります。
              </p>
            </SummaryBand>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>市町村別の補助金</h2>
          <p style={{ ...textStyle, marginBottom: '18px' }}>
            松山市、今治市、宇和島市など、愛媛県内の市町村ごとに利用できる補助金・助成金・給付金を探せます。
          </p>

          <div style={linkGridStyle}>
            {cityLinks.map((link) => (
              <LinkTile key={link.label} to={link.to}>
                {link.label}
              </LinkTile>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>目的別の補助金</h2>
          <p style={{ ...textStyle, marginBottom: '18px' }}>
            住宅改修、創業、設備投資、省エネ、子育て、農業など、使いたい目的から支援制度を探せます。
          </p>

          <div style={linkGridStyle}>
            {purposeLinks.map((link) => (
              <LinkTile key={link.label} to={link.to}>
                {link.label}
              </LinkTile>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>申請前の注意点</h2>
          <SummaryBand>
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                color: '#4b5550',
                fontSize: '15px',
                lineHeight: 1.9,
              }}
            >
              <li>対象者、対象経費、補助率、上限額を制度ごとに確認してください。</li>
              <li>申請期間内でも予算上限に達すると受付が終了する場合があります。</li>
              <li>交付決定前に契約や支払いをすると対象外になる制度があります。</li>
              <li>必要書類、見積書、事業計画書、実績報告の条件を事前に確認してください。</li>
            </ul>
          </SummaryBand>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>公式情報確認の案内</h2>
          <SummaryBand>
            <p style={textStyle}>
              掲載内容は制度探しの入口として整理しています。申請前には、愛媛県、市町村、実施機関の公式ページで最新の募集要項、申請期間、対象条件、必要書類を必ず確認してください。
            </p>
          </SummaryBand>
        </section>

        <InternalSeoLinks />
      </main>
    </>
  );
}
