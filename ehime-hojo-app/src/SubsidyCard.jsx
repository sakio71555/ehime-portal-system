import React from 'react';
import {
  isItemClosed,
  getPurposeTagList,
  getItemRegionCategories,
} from './portalHelpers';

const cleanText = (value) => {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getOfficialUrl = (item) => {
  const url = item?.official_url || item?.source_url || '';

  if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
    return url.trim();
  }

  return '';
};

const getAmountText = (item) => {
  const value =
    cleanText(item?.amount_text) ||
    cleanText(item?.amount) ||
    cleanText(item?.subsidy_amount_text) ||
    cleanText(item?.max_amount_text);

  return value || '公式ページをご確認ください';
};

const getPeriodText = (item) => {
  return (
    cleanText(item?.application_period_text) ||
    cleanText(item?.deadline) ||
    cleanText(item?.application_period) ||
    '随時募集'
  );
};

const getSummaryText = (item) => {
  return (
    cleanText(item?.summary) ||
    cleanText(item?.description) ||
    cleanText(item?.overview) ||
    '詳細は公式ページをご確認ください。'
  );
};

const getTitleText = (item) => {
  const title = cleanText(item?.title) || '補助金・助成金情報';
  const organization = cleanText(item?.organization);

  if (!organization) return title;

  const normalizedTitle = title.replace(/[「」『』【】（）()\s]/g, '');
  const normalizedOrg = organization.replace(/[「」『』【】（）()\s]/g, '');

  if (
    normalizedOrg.length >= 8 &&
    normalizedTitle.includes(normalizedOrg)
  ) {
    return title;
  }

  return `${organization}：${title}`;
};

export default function SubsidyCard({ item }) {
  const isClosed = isItemClosed(item);
  const officialUrl = getOfficialUrl(item);

  const purposeTags = getPurposeTagList(item);
  const regionTags = getItemRegionCategories(item);
  const tags = [...new Set([...purposeTags, ...regionTags])].filter(Boolean);

  const statusLabel = isClosed ? '受付終了' : '公募中';
  const statusColor = isClosed ? '#9ca3af' : '#0f7b6c';

  const titleText = getTitleText(item);
  const regionText = cleanText(item?.region_text || item?.region) || '愛媛県';
  const periodText = getPeriodText(item);
  const amountText = getAmountText(item);
  const summaryText = getSummaryText(item);

  const handleCardClick = () => {
    window.location.href = `/subsidy/${item.id}`;
  };

  return (
    <div
      className="portal-subsidy-card"
      onClick={handleCardClick}
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        position: 'relative',
        height: '100%',
        boxSizing: 'border-box',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow =
          '0 10px 15px -3px rgba(0,0,0,0.1)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow =
          '0 4px 6px -1px rgba(0,0,0,0.05)';
      }}
    >
      {/* 上部：正方形ステータス + タイトル上下中央 */}
      <div
        className="portal-subsidy-card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          minHeight: '92px',
        }}
      >
        <div
          className="portal-subsidy-status-box"
          style={{
            width: '92px',
            height: '92px',
            minWidth: '92px',
            minHeight: '92px',
            backgroundColor: statusColor,
            color: 'white',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: '800',
            lineHeight: '1.2',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {statusLabel}
        </div>

        <div
          className="portal-subsidy-title-wrap"
          style={{
            height: '92px',
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h3
            className="portal-subsidy-title"
            title={titleText}
            style={{
              margin: 0,
              color: '#111827',
              fontSize: '18px',
              lineHeight: '1.35',
              fontWeight: '800',
              letterSpacing: '-0.01em',
              width: '100%',
              maxHeight: '73px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
            }}
          >
            {titleText}
          </h3>
        </div>
      </div>

      <div
        className="portal-subsidy-meta"
        style={{
          display: 'flex',
          gap: '16px',
          fontSize: '13px',
          color: '#64748b',
          flexWrap: 'wrap',
        }}
      >
        <span
          className="portal-subsidy-meta-item"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          📍 {regionText}
        </span>

        <span
          className="portal-subsidy-meta-item"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          📅 申請期間: {periodText}
        </span>
      </div>

      <div
        className="portal-subsidy-amount-box"
        style={{
          backgroundColor: '#f8fafc',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          className="portal-subsidy-amount-label"
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#475569',
            whiteSpace: 'nowrap',
          }}
        >
          上限金額
        </div>

        <div
          className="portal-subsidy-amount-value"
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#111827',
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {amountText}
        </div>
      </div>

      <p
        className="portal-subsidy-summary"
        title={summaryText}
        style={{
          margin: 0,
          fontSize: '14px',
          color: '#4b5563',
          lineHeight: '1.6',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {summaryText}
      </p>

      <div
        className="portal-subsidy-tags"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: 'auto',
        }}
      >
        {tags.slice(0, 5).map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            style={{
              backgroundColor: '#ecfdf5',
              color: '#059669',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              border: '1px solid #a7f3d0',
              fontWeight: 'bold',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div
        className="portal-subsidy-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px dashed #e2e8f0',
          gap: '12px',
        }}
      >
        <span
          className="portal-subsidy-detail-link"
          style={{
            color: '#0f7b6c',
            fontWeight: 'bold',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          詳細ページを見る <span>→</span>
        </span>

        <div
          className="portal-subsidy-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            className="portal-subsidy-note"
            style={{
              fontSize: '10px',
              color: '#9ca3af',
              width: '120px',
              lineHeight: '1.2',
              textAlign: 'right',
            }}
          >
            文章等に誤りがある場合がありますので必ず公式サイトでご確認ください。
          </span>

          <button
            className="portal-subsidy-official-button"
            type="button"
            disabled={!officialUrl}
            onClick={(e) => {
              e.stopPropagation();
              if (officialUrl) {
                window.open(officialUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            style={{
              backgroundColor: officialUrl ? '#e76305' : '#cbd5e1',
              color: 'white',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: officialUrl ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={(e) => {
              if (officialUrl) e.currentTarget.style.opacity = '0.9';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            公式サイトへ
          </button>
        </div>
      </div>
    </div>
  );
}
