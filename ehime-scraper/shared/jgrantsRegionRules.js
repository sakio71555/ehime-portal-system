const EHIME_MUNICIPALITIES = [
  '松山市',
  '今治市',
  '宇和島市',
  '八幡浜市',
  '新居浜市',
  '西条市',
  '大洲市',
  '伊予市',
  '四国中央市',
  '西予市',
  '東温市',
  '上島町',
  '久万高原町',
  '松前町',
  '砥部町',
  '内子町',
  '伊方町',
  '松野町',
  '鬼北町',
  '愛南町',
];

const OTHER_PREFECTURES = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
];

const MUNICIPALITY_IGNORE_WORDS = new Set([
  '市町村',
  '市区町村',
  '町村',
  '都市',
  '地方都市',
  '中核市',
  '政令市',
  '市民',
  '市内',
  '市外',
  '市街地',
]);

function detectMunicipality(areaText) {
  const text = String(areaText || '');
  return EHIME_MUNICIPALITIES.find((name) => text.includes(name)) || '';
}

function containsEhimeOrShikoku(value) {
  const text = String(value || '');

  return (
    text.includes('愛媛県') ||
    text.includes('愛媛') ||
    text.includes('四国地方') ||
    text.includes('四国')
  );
}

function containsNationwide(value) {
  const text = String(value || '');
  return text.includes('全国') || text.includes('地域での制限はありません');
}

function containsOtherPrefecture(value) {
  const text = String(value || '');
  return OTHER_PREFECTURES.some((pref) => text.includes(pref));
}

function extractMunicipalityCandidates(value) {
  const text = String(value || '');
  const matches = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,12}(?:市|町|村)/gu);

  if (!matches) return [];

  return [...new Set(matches)]
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => !MUNICIPALITY_IGNORE_WORDS.has(name))
    .filter((name) => name.length >= 3);
}

function containsOtherMunicipality(value) {
  const candidates = extractMunicipalityCandidates(value);

  return candidates.some((name) => {
    if (EHIME_MUNICIPALITIES.includes(name)) return false;
    return true;
  });
}

function isEhimeSearchKeyword(keyword) {
  const text = String(keyword || '');

  return (
    text.includes('愛媛') ||
    EHIME_MUNICIPALITIES.some((name) => text.includes(name))
  );
}

function shouldKeepForEhimePortal({ regionText, title, organization, keyword }) {
  const region = String(regionText || '');
  const titleText = String(title || '');
  const orgText = String(organization || '');
  const haystack = `${region} ${titleText} ${orgText}`;
  const ehimeKeyword = isEhimeSearchKeyword(keyword);

  if (containsEhimeOrShikoku(haystack)) {
    return {
      keep: true,
      reason: '愛媛・四国対象',
    };
  }

  if (ehimeKeyword) {
    return {
      keep: true,
      reason: '愛媛キーワード由来のためdraft採用',
    };
  }

  if (containsNationwide(region)) {
    if (containsOtherPrefecture(haystack)) {
      return {
        keep: false,
        reason: '全国表記ありだが他県名を含む',
      };
    }

    if (containsOtherMunicipality(haystack)) {
      return {
        keep: false,
        reason: '全国表記ありだが他市町村名を含む',
      };
    }

    return {
      keep: true,
      reason: '全国対象',
    };
  }

  return {
    keep: false,
    reason: '愛媛・四国・全国対象ではない',
  };
}

module.exports = {
  EHIME_MUNICIPALITIES,
  detectMunicipality,
  containsEhimeOrShikoku,
  containsNationwide,
  containsOtherPrefecture,
  containsOtherMunicipality,
  isEhimeSearchKeyword,
  shouldKeepForEhimePortal,
};
