import React from 'react';

const iconStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 0,
};

const commonProps = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function getIconPaths(slug) {
  switch (slug) {
    case 'construction':
      return (
        <>
          <path d="M8 29h28" />
          <path d="M12 29V15h17v14" />
          <path d="M12 15l8-6 9 6" />
          <path d="M18 29v-7h5v7" />
          <path d="M29 18h5v11" />
          <path d="M32 18v-5h4" />
        </>
      );
    case 'restaurant-retail':
      return (
        <>
          <path d="M13 8v13" />
          <path d="M9 8v6" />
          <path d="M17 8v6" />
          <path d="M9 14h8" />
          <path d="M13 21v13" />
          <path d="M27 8v26" />
          <path d="M27 8c5 3 6 10 2 14" />
        </>
      );
    case 'startup-digital':
      return (
        <>
          <path d="M9 27h26" />
          <path d="M13 11h18v13H13z" />
          <path d="M16 31h12" />
        </>
      );
    case 'sole-proprietor':
      return (
        <>
          <path d="M22 19a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
          <path d="M11 35c1-7 5-11 11-11s10 4 11 11" />
          <path d="M10 30h7" />
          <path d="M27 30h7" />
          <path d="M15 35h14" />
        </>
      );
    case 'manufacturing':
      return (
        <>
          <path d="M8 31h28" />
          <path d="M10 31V18l8 5v-5l8 5v-8h8v16" />
          <path d="M29 15V9h5v6" />
          <path d="M14 27h3" />
          <path d="M22 27h3" />
        </>
      );
    case 'agriculture':
      return (
        <>
          <path d="M22 34V19" />
          <path d="M22 20c-7 0-11-4-12-10 7 0 11 4 12 10Z" />
          <path d="M22 22c7 0 11-4 12-10-7 0-11 4-12 10Z" />
          <path d="M15 34h14" />
        </>
      );
    case 'tourism':
      return (
        <>
          <path d="M12 16h20v17H12z" />
          <path d="M17 16v-4h10v4" />
          <path d="M16 22h12" />
          <path d="M16 27h8" />
        </>
      );
    case 'beauty-salon':
      return (
        <>
          <path d="M14 30l16-16" />
          <path d="M12 14l18 18" />
          <path d="M12 14a4 4 0 1 0 0 8" />
          <path d="M30 14a4 4 0 1 1 0 8" />
        </>
      );
    case 'medical-welfare':
      return (
        <>
          <path d="M22 8v28" />
          <path d="M8 22h28" />
          <path d="M12 12h20v20H12z" />
        </>
      );
    case 'housing-renovation':
      return (
        <>
          <path d="M8 21 22 10l14 11" />
          <path d="M12 20v14h20V20" />
          <path d="M19 34v-9h6v9" />
        </>
      );
    case 'childcare-family':
      return (
        <>
          <path d="M16 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M28 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M10 32c1-6 5-9 10-9" />
          <path d="M34 32c-1-6-5-9-10-9" />
          <path d="M18 28h8" />
        </>
      );
    case 'energy-equipment':
      return (
        <>
          <path d="M22 7a9 9 0 0 0-5 16c2 1 2 3 2 5h6c0-2 0-4 2-5a9 9 0 0 0-5-16Z" />
          <path d="M18 33h8" />
          <path d="M19 37h6" />
        </>
      );
    case 'sales-channel':
      return (
        <>
          <path d="M10 32h24" />
          <path d="M13 28V18" />
          <path d="M22 28V12" />
          <path d="M31 28v-7" />
          <path d="M12 14l7-5 7 5 8-8" />
        </>
      );
    case 'personal-assistance':
      return (
        <>
          <path d="M22 34s-12-7-12-16a6 6 0 0 1 11-3 6 6 0 0 1 11 3c0 9-10 16-10 16Z" />
          <path d="M16 23h12" />
        </>
      );
    default:
      return (
        <>
          <circle cx="20" cy="20" r="10" />
          <path d="m28 28 7 7" />
        </>
      );
  }
}

export default function FeatureIcon({ slug, color = '#0f7b6c', size = 44, strokeWidth = 3 }) {
  return (
    <span style={{ ...iconStyle, width: size, height: size }} aria-hidden="true">
      <svg
        viewBox="0 0 44 44"
        width={size}
        height={size}
        {...commonProps}
        stroke={color}
        strokeWidth={strokeWidth}
      >
        {getIconPaths(slug)}
      </svg>
    </span>
  );
}
