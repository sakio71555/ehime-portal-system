import React from 'react';
import { Helmet } from 'react-helmet-async';
import { DEFAULT_SEO, SITE_NAME, absoluteUrl } from '../seoConfig';

export default function SEO({
  title = DEFAULT_SEO.title,
  description = DEFAULT_SEO.description,
  canonical = '/',
  image = DEFAULT_SEO.image,
  type = 'website',
  noindex = false,
  robots = null,
  jsonLd = null,
  appendSiteName = true,
}) {
  const pageTitle =
    !appendSiteName || title.includes(SITE_NAME) || title.includes('愛媛の補助金')
      ? title
      : `${title}｜${SITE_NAME}`;

  const canonicalUrl = absoluteUrl(canonical);
  const imageUrl = absoluteUrl(image);
  const robotsContent = robots || (noindex ? 'noindex,nofollow' : 'index,follow');

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />

      <meta name="robots" content={robotsContent} />

      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:locale" content="ja_JP" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
