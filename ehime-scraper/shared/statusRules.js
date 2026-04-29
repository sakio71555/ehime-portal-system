function toDateOrNull(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function toIsoOrNull(value) {
  const date = toDateOrNull(value);
  if (!date) return null;
  return date.toISOString();
}

function toDateOnly(value) {
  const date = toDateOrNull(value);
  if (!date) return null;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function formatJapaneseDate(value) {
  const date = toDateOrNull(value);
  if (!date) return '';

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function buildApplicationPeriodText(start, end) {
  const startText = formatJapaneseDate(start);
  const endText = formatJapaneseDate(end);

  if (startText && endText) return `${startText}から${endText}まで`;
  if (startText && !endText) return `${startText}から`;
  if (!startText && endText) return `${endText}まで`;

  return '不明';
}

function forceApplicationStatusByPeriod({ start, end, periodText = '' }) {
  const now = new Date();
  const startDate = toDateOrNull(start);
  const endDate = toDateOrNull(end);
  const text = String(periodText || '');

  if (endDate && endDate.getTime() < now.getTime()) return '受付終了';
  if (startDate && startDate.getTime() > now.getTime()) return '予告';

  if (startDate && !endDate && startDate.getTime() <= now.getTime()) {
    return '公募中';
  }

  if (
    startDate &&
    endDate &&
    startDate.getTime() <= now.getTime() &&
    endDate.getTime() >= now.getTime()
  ) {
    return '公募中';
  }

  if (/随時|受付中|募集中|予算に達し次第|予算額に達し次第|先着/.test(text)) {
    return '公募中';
  }

  return '不明';
}

module.exports = {
  toDateOrNull,
  toIsoOrNull,
  toDateOnly,
  formatJapaneseDate,
  buildApplicationPeriodText,
  forceApplicationStatusByPeriod,
};
