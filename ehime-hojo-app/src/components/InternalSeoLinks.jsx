import React from 'react';
import { Link } from 'react-router-dom';
import { getFeaturePageBySlug } from '../featurePages';

const areaLinks = [
  { label: '松山市の補助金', to: '/area/matsuyama' },
  { label: '今治市の補助金', to: '/area/imabari' },
  { label: '新居浜市の補助金', to: '/area/niihama' },
  { label: '西予市の補助金', to: '/search?keyword=西予市' },
  { label: '宇和島市の補助金', to: '/search?keyword=宇和島市' },
  { label: '四国中央市の補助金', to: '/search?keyword=四国中央市' },
  { label: '西条市の補助金', to: '/search?keyword=西条市' },
  { label: '大洲市の補助金', to: '/search?keyword=大洲市' },
];

const purposeLinks = [
  { label: '創業・起業に使える補助金', to: '/purpose/startup' },
  { label: '省エネ・設備投資向け補助金', to: '/purpose/energy-saving' },
  { label: 'IT導入・デジタル化補助金', to: '/purpose/digital' },
  { label: '設備投資に使える補助金', to: '/search?keyword=設備' },
  { label: '販路開拓・展示会補助金', to: '/search?keyword=販路' },
  { label: '農業・就農支援補助金', to: '/search?keyword=農業' },
  { label: '観光・宿泊業向け補助金', to: '/search?keyword=観光' },
  { label: '人材育成・雇用関連助成金', to: '/search?keyword=人材' },
];

const industryFeatureLinks = [
  'construction',
  'restaurant-retail',
  'manufacturing',
  'agriculture',
  'tourism',
  'beauty-salon',
].map((slug) => {
  const feature = getFeaturePageBySlug(slug);
  return { label: feature.title, to: feature.path };
});

const purposeFeatureLinks = [
  'startup-digital',
  'energy-equipment',
  'sales-channel',
  'housing-renovation',
].map((slug) => {
  const feature = getFeaturePageBySlug(slug);
  return { label: feature.title, to: feature.path };
});

const personalFeatureLinks = ['childcare-family', 'personal-assistance'].map((slug) => {
  const feature = getFeaturePageBySlug(slug);
  return { label: feature.title, to: feature.path };
});

const guideLinks = [
  { label: '補助金の基礎知識', to: '/beginners' },
  { label: '補助金シミュレーター', to: '/simulator' },
  { label: '専門家を探す', to: '/experts' },
  { label: 'お役立ちコラム', to: '/columns' },
];

function LinkGroup({ title, description, links }) {
  return (
    <section
      style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      <h2
        style={{
          margin: '0 0 8px',
          fontSize: '18px',
          color: '#1f2937',
          fontWeight: '800',
        }}
      >
        {title}
      </h2>

      {description && (
        <p
          style={{
            margin: '0 0 18px',
            fontSize: '13px',
            color: '#6b7280',
            lineHeight: 1.7,
          }}
        >
          {description}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              borderRadius: '999px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#526b5d',
              fontSize: '13px',
              fontWeight: 'bold',
              textDecoration: 'none',
            }}
          >
            {link.label}
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function InternalSeoLinks() {
  return (
    <div
      style={{
        maxWidth: '1100px',
        margin: '56px auto 0',
        padding: '0 24px 80px',
        display: 'grid',
        gap: '20px',
      }}
    >
      <LinkGroup
        title="地域から補助金・助成金を探す"
        description="愛媛県内の市町村名から、事業者向けの補助金・助成金情報を探せます。"
        links={areaLinks}
      />

      <LinkGroup
        title="目的から補助金・助成金を探す"
        description="創業、設備投資、省エネ、IT導入、販路開拓など、利用目的に合わせて支援制度を探せます。"
        links={purposeLinks}
      />

      <LinkGroup
        title="業種別特集から探す"
        description="建設、製造、農業、観光、店舗運営など、業種に合わせて支援制度を探せます。"
        links={industryFeatureLinks}
      />

      <LinkGroup
        title="目的別特集から探す"
        description="創業、IT導入、省エネ、販路開拓、住宅・空き家活用などのテーマで探せます。"
        links={purposeFeatureLinks}
      />

      <LinkGroup
        title="個人向け支援の特集から探す"
        description="子育て、医療費助成、住宅改修、移住、福祉など暮らしに関わる支援制度を探せます。"
        links={personalFeatureLinks}
      />

      <LinkGroup
        title="補助金申請に役立つページ"
        description="補助金の基礎知識、シミュレーター、専門家相談、コラム記事への導線です。"
        links={guideLinks}
      />
    </div>
  );
}
