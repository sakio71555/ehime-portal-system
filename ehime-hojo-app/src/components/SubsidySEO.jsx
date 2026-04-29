import React from 'react';
import SEO from './SEO';
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  buildSubsidySeoDescription,
  buildSubsidySeoTitle,
  getSubsidyRegion,
  stripForSeo,
} from '../seoConfig';

function buildSubsidyJsonLd(subsidy, canonical) {
  if (!subsidy) return null;

  const title = stripForSeo(subsidy.title || '補助金・助成金情報');
  const region = getSubsidyRegion(subsidy);
  const organization = stripForSeo(subsidy.organization || '実施機関未確認');
  const description = buildSubsidySeoDescription(subsidy);

  const amount =
    subsidy.amount_text ||
    subsidy.amount ||
    '';

  const period =
    subsidy.application_period_text ||
    subsidy.deadline ||
    '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: title,
    description,
    provider: {
      '@type': 'GovernmentOrganization',
      name: organization,
    },
    areaServed: {
      '@type': 'AdministrativeArea',
      name: region,
    },
    serviceType: '補助金・助成金情報',
    url: absoluteUrl(canonical),
    mainEntityOfPage: absoluteUrl(canonical),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  if (subsidy.official_url) {
    jsonLd.potentialAction = {
      '@type': 'ApplyAction',
      target: subsidy.official_url,
    };
  }

  if (amount || period) {
    jsonLd.additionalProperty = [
      amount
        ? {
            '@type': 'PropertyValue',
            name: '補助上限額・助成額',
            value: amount,
          }
        : null,
      period
        ? {
            '@type': 'PropertyValue',
            name: '申請期間',
            value: period,
          }
        : null,
      subsidy.subsidy_rate_text || subsidy.subsidy_rate
        ? {
            '@type': 'PropertyValue',
            name: '補助率',
            value: subsidy.subsidy_rate_text || subsidy.subsidy_rate,
          }
        : null,
    ].filter(Boolean);
  }

  return jsonLd;
}

export default function SubsidySEO({ subsidy, canonical }) {
  const title = buildSubsidySeoTitle(subsidy);
  const description = buildSubsidySeoDescription(subsidy);
  const jsonLd = buildSubsidyJsonLd(subsidy, canonical);

  return (
    <SEO
      title={title}
      description={description}
      canonical={canonical}
      type="article"
      jsonLd={jsonLd}
    />
  );
}
