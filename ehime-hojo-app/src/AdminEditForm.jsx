import React, { useEffect, useState } from 'react';
import { PURPOSE_TAGS, INDUSTRY_TAGS } from './subsidyTags';
import {
  forceApplicationStatusByPeriod,
  normalizeDateForDB,
} from './adminEditHelpers';
import {
  mergeAIResultSafely,
  sanitizeAIResultBeforeMerge,
  explainAIMergeProtection,
} from './adminAIMergeRules';

import AdminEditHeader from './components/AdminEditHeader';
import AdminAIAssistPanel from './components/AdminAIAssistPanel';
import AdminAIDiagnostics from './components/AdminAIDiagnostics';
import AdminBasicFields from './components/AdminBasicFields';
import AdminDetailFields from './components/AdminDetailFields';
import AdminTagSelector from './components/AdminTagSelector';

function toSafeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);

  if (value === null || value === undefined || value === '') return [];

  return String(value)
    .split(/[、,\n/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildInitialEditForm(initialData) {
  const data = initialData || {};

  const purposes = Array.isArray(data.purposes) ? data.purposes : [];
  const industries = Array.isArray(data.industries) ? data.industries : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];

  const targetExpensesArr = Array.isArray(data.target_expenses_arr)
    ? data.target_expenses_arr
    : toSafeArray(data.target_expenses);

  const targetEntitiesArr = Array.isArray(data.target_entities_arr)
    ? data.target_entities_arr
    : toSafeArray(data.target_entities);

  return forceApplicationStatusByPeriod({
    ...data,

    purposes,
    industries,
    tags,

    region_text: data.region_text || data.region || data.prefecture || '',
    region: data.region || data.region_text || data.prefecture || '',

    application_period_text:
      data.application_period_text || data.deadline || '',

    amount_text: data.amount_text || data.amount || '',
    amount: data.amount || data.amount_text || '',

    subsidy_rate_text: data.subsidy_rate_text || data.subsidy_rate || '',
    subsidy_rate: data.subsidy_rate || data.subsidy_rate_text || '',

    target_expenses_arr: targetExpensesArr,
    target_expenses:
      data.target_expenses || targetExpensesArr.join(' / ') || '',

    target_entities_arr: targetEntitiesArr,
    target_entities:
      data.target_entities || targetEntitiesArr.join(' / ') || '',

    crawl_status: data.crawl_status || 'draft',
    is_active: Boolean(data.is_active),

    admin_note: data.admin_note || '',
    duplicate_of_id: data.duplicate_of_id || '',
    duplicate_reason: data.duplicate_reason || '',
  });
}

function isJgrantsData(form) {
  return String(form?.source_type || '').trim() === 'jgrants';
}

function isUsableArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function uniqueArray(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function makeTagsFromPurposesAndIndustries(purposes, industries, previousTags = []) {
  return uniqueArray([
    ...(previousTags || []),
    ...(purposes || []),
    ...(industries || []),
  ]);
}

function normalizeForTagInference(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    )
    .replace(/\s+/g, '')
    .replace(/[・･/／｜|,、。．.（）()［\]【】「」『』:：;；]/g, '');
}

function buildInferenceText(form) {
  const parts = [
    form.title,
    form.organization,
    form.region_text,
    form.region,
    form.summary,
    form.amount_text,
    form.amount,
    form.subsidy_rate_text,
    form.target_expenses,
    form.target_entities,
    form.application_period_text,
    form.fiscal_year,
    ...(Array.isArray(form.target_expenses_arr) ? form.target_expenses_arr : []),
    ...(Array.isArray(form.target_entities_arr) ? form.target_entities_arr : []),
    ...(Array.isArray(form.tags) ? form.tags : []),
    ...(Array.isArray(form.purposes) ? form.purposes : []),
    ...(Array.isArray(form.industries) ? form.industries : []),
  ];

  return normalizeForTagInference(parts.filter(Boolean).join(' '));
}

const PURPOSE_INFERENCE_RULES = [
  {
    tag: '経営改善・経営強化',
    keywords: [
      '経営改善',
      '経営強化',
      '経営力',
      '経営基盤',
      '経営安定',
      '経営支援',
      '事業再構築',
      '事業改善',
      '収益力',
      '売上回復',
      '価格転嫁',
      '賃上げ',
      '事業計画',
      '企業価値',
    ],
  },
  {
    tag: '地域活性・まちづくり',
    keywords: [
      '地域活性',
      '地域振興',
      'まちづくり',
      '商店街',
      '中心市街地',
      '地域資源',
      '地域課題',
      '交流人口',
      '定住',
      '移住',
      'コミュニティ',
      'にぎわい',
      '地域文化',
      '文化財',
    ],
  },
  {
    tag: '設備投資',
    keywords: [
      '設備投資',
      '設備導入',
      '設備整備',
      '設備更新',
      '機械設備',
      '機械装置',
      '機器導入',
      '機器購入',
      '装置',
      '導入費',
      '購入費',
      '改修',
      '修繕',
      '工事',
      '整備費',
      '建設',
      '設置',
      '施設整備',
      '備品購入',
      '厨房機器',
      '車両',
    ],
  },
  {
    tag: '人材育成・雇用',
    keywords: [
      '人材育成',
      '人材確保',
      '人材採用',
      '雇用',
      '採用',
      '求人',
      '研修',
      '教育訓練',
      '職業訓練',
      'スキルアップ',
      'リスキリング',
      '就業',
      '就職',
      '働き方',
      '賃金',
      '従業員',
      '労働者',
    ],
  },
  {
    tag: '生産性向上・業務効率化',
    keywords: [
      '生産性向上',
      '業務効率化',
      '効率化',
      '省力化',
      '省人化',
      '自動化',
      '合理化',
      '工程改善',
      '業務改善',
      '物流合理化',
      '物流効率化',
      '生産性',
      '作業効率',
      'dx',
      'システム化',
      'クラウド',
      'it導入',
    ],
  },
  {
    tag: '起業・創業・ベンチャー',
    keywords: [
      '起業',
      '創業',
      '創業者',
      '新創業',
      'スタートアップ',
      'ベンチャー',
      '開業',
      '新規開業',
      '創業支援',
      '起業家',
      'インキュベーション',
    ],
  },
  {
    tag: '販路開拓・販路拡大',
    keywords: [
      '販路開拓',
      '販路拡大',
      '販路',
      '販売促進',
      '販売拡大',
      'マーケティング',
      '商談会',
      '展示会',
      '見本市',
      'ec',
      'ecサイト',
      'オンライン販売',
      'プロモーション',
      '広告宣伝',
      '広報',
      'ブランディング',
      '営業活動',
    ],
  },
  {
    tag: 'ものづくり・新商品開発',
    keywords: [
      'ものづくり',
      '新商品',
      '新製品',
      '商品開発',
      '製品開発',
      'サービス開発',
      '試作品',
      '試作',
      '開発費',
      '新技術',
      '新サービス',
      '高付加価値',
      '製造',
      '加工',
    ],
  },
  {
    tag: 'デジタル',
    keywords: [
      'デジタル',
      'dx',
      'it',
      'ict',
      'ai',
      'iot',
      'システム',
      'クラウド',
      'ソフトウェア',
      'アプリ',
      'web',
      'ホームページ',
      'ecサイト',
      'オンライン',
      'キャッシュレス',
      '電子申請',
      'データ',
      'デジタル化',
      '情報化',
    ],
  },
  {
    tag: '省エネ',
    keywords: [
      '省エネ',
      '省エネルギー',
      'エネルギー効率',
      '高効率',
      '節電',
      '電気料金',
      '燃料費',
      '断熱',
      'led',
      '空調',
      'ボイラー',
      '冷凍冷蔵',
      'エネルギー消費',
    ],
  },
  {
    tag: '環境',
    keywords: [
      '環境',
      '脱炭素',
      'カーボンニュートラル',
      '温室効果ガス',
      'co2',
      'co₂',
      '排出削減',
      '排出量',
      'ゼロカーボン',
      '環境負荷',
      'リサイクル',
      '廃棄物',
      '循環型',
      'グリーン',
      '低炭素',
    ],
  },
  {
    tag: '再エネ・蓄エネ',
    keywords: [
      '再エネ',
      '再生可能エネルギー',
      '太陽光',
      '太陽光発電',
      '蓄電池',
      '蓄エネ',
      '蓄電',
      'バイオマス',
      '風力',
      '水力',
      '地熱',
      '熱利用',
      '自家消費',
      '発電設備',
    ],
  },
  {
    tag: '研究・実証実験・産学連携',
    keywords: [
      '研究',
      '実証',
      '実証実験',
      '実証事業',
      '産学連携',
      '共同研究',
      '大学',
      '試験研究',
      '技術開発',
      '実用化',
      '研究開発',
      'r&d',
      '検証',
    ],
  },
  {
    tag: '防犯・防災・BCP',
    keywords: [
      '防犯',
      '防災',
      'bcp',
      '事業継続',
      '災害',
      '耐震',
      '耐災害',
      '避難',
      '備蓄',
      '防災設備',
      'セキュリティ',
      'カメラ',
      '感染症',
      '危機管理',
      '強靭化',
    ],
  },
  {
    tag: '海外展開',
    keywords: [
      '海外展開',
      '海外',
      '輸出',
      '輸入',
      '国際',
      '越境',
      '越境ec',
      '海外販路',
      '海外出願',
      '海外展示会',
      '外国語',
      'グローバル',
    ],
  },
  {
    tag: '観光・インバウンド',
    keywords: [
      '観光',
      'インバウンド',
      '旅行',
      '宿泊',
      'ホテル',
      '旅館',
      '観光客',
      '誘客',
      '周遊',
      'ツーリズム',
      '体験型',
      '観光資源',
      '訪日',
    ],
  },
  {
    tag: '新規事業・第二創業',
    keywords: [
      '新規事業',
      '第二創業',
      '新分野',
      '新事業',
      '業態転換',
      '事業転換',
      '新市場',
      '新たな事業',
      '事業多角化',
      '新サービス',
      '新商品',
    ],
  },
  {
    tag: '空き家利用',
    keywords: [
      '空き家',
      '空家',
      '古民家',
      '空き店舗',
      '遊休施設',
      '遊休資産',
      'リノベーション',
      '改装',
      '空き物件',
    ],
  },
  {
    tag: '省力化・省人化',
    keywords: [
      '省力化',
      '省人化',
      '人手不足',
      '自動化',
      '無人化',
      'ロボット',
      'ロボティクス',
      'iot',
      'センサー',
      '券売機',
      'セルフレジ',
      'スマート化',
      '作業削減',
    ],
  },
  {
    tag: '事業承継',
    keywords: [
      '事業承継',
      '承継',
      '後継者',
      '引継ぎ',
      'm&a',
      'ma',
      '親族内承継',
      '第三者承継',
      '廃業回避',
    ],
  },
];

const INDUSTRY_INFERENCE_RULES = [
  {
    tag: '業種指定無し',
    keywords: [
      '業種の制限なし',
      '業種制限なし',
      '業種指定なし',
      '全業種',
      'すべての業種',
      '全ての業種',
      '中小企業者',
      '小規模事業者',
      '事業者全般',
      '従業員数の制約なし',
      '制約なし',
    ],
  },
  {
    tag: 'サービス業',
    keywords: [
      'サービス業',
      '生活関連サービス',
      '専門サービス',
      '対人サービス',
      'クリーニング',
      '理美容',
      '美容',
      'サロン',
      '修理',
      'レンタル',
      '教室',
      'スクール',
    ],
  },
  {
    tag: '農業',
    keywords: [
      '農業',
      '農家',
      '農業者',
      '農地',
      '農産物',
      '園芸',
      '施設園芸',
      '野菜',
      '果樹',
      '水稲',
      '米',
      '就農',
      '新規就農',
      '担い手',
      '農林水産',
    ],
  },
  {
    tag: '医療・福祉',
    keywords: [
      '医療',
      '福祉',
      '医療機関',
      '病院',
      '診療所',
      'クリニック',
      '薬局',
      '障がい',
      '障害',
      '福祉施設',
      '社会福祉',
      '児童福祉',
      '高齢者福祉',
    ],
  },
  {
    tag: '製造業',
    keywords: [
      '製造業',
      '製造',
      '工場',
      '加工',
      '生産設備',
      'ものづくり',
      '機械加工',
      '金属加工',
      '部品',
      '製品開発',
      '量産',
      '生産ライン',
    ],
  },
  {
    tag: '運輸業',
    keywords: [
      '運輸',
      '運送',
      '物流',
      '貨物',
      'トラック',
      '配送',
      '輸送',
      '倉庫',
      '旅客',
      'バス',
      'タクシー',
      '海運',
      '港湾',
    ],
  },
  {
    tag: '介護',
    keywords: [
      '介護',
      '介護施設',
      '介護事業',
      '介護サービス',
      '訪問介護',
      '通所介護',
      'デイサービス',
      '老人ホーム',
      '福祉用具',
    ],
  },
  {
    tag: '飲食業',
    keywords: [
      '飲食',
      '飲食店',
      'レストラン',
      'カフェ',
      '喫茶',
      '居酒屋',
      '食堂',
      '厨房',
      'メニュー',
      'テイクアウト',
      'デリバリー',
    ],
  },
  {
    tag: '小売業',
    keywords: [
      '小売',
      '小売業',
      '店舗',
      '販売店',
      '商店',
      'ショップ',
      '物販',
      'ec',
      'ecサイト',
      'オンライン販売',
      '直売',
    ],
  },
  {
    tag: '宿泊業',
    keywords: [
      '宿泊',
      '宿泊業',
      'ホテル',
      '旅館',
      '民宿',
      'ゲストハウス',
      'キャンプ場',
      '宿泊施設',
    ],
  },
  {
    tag: '卸売業',
    keywords: [
      '卸売',
      '卸売業',
      '卸',
      '問屋',
      '流通',
      '商社',
      '仕入',
      '販売先',
    ],
  },
  {
    tag: '情報通信業',
    keywords: [
      '情報通信',
      '通信',
      'ict',
      'it',
      'ソフトウェア',
      'システム開発',
      'アプリ開発',
      'web制作',
      'web',
      'クラウド',
      'saas',
      'データセンター',
      'ケーブルテレビ',
      '放送',
      'ネットワーク',
    ],
  },
  {
    tag: '漁業',
    keywords: [
      '漁業',
      '漁師',
      '水産',
      '養殖',
      '漁港',
      '漁船',
      '水産物',
      '魚介',
      '海面養殖',
      '内水面',
    ],
  },
  {
    tag: '建設業',
    keywords: [
      '建設',
      '建設業',
      '建築',
      '土木',
      '工務店',
      '施工',
      '工事業',
      '設備工事',
      '電気工事',
      '管工事',
      'リフォーム',
      '改修工事',
    ],
  },
  {
    tag: '林業',
    keywords: [
      '林業',
      '森林',
      '木材',
      '伐採',
      '造林',
      '間伐',
      '製材',
      '木質',
      '林産',
    ],
  },
  {
    tag: '食品製造業',
    keywords: [
      '食品製造',
      '食品加工',
      '食品',
      '加工食品',
      '惣菜',
      '菓子',
      'パン',
      '製菓',
      '製パン',
      '水産加工',
      '農産加工',
      'haccp',
      'iso22000',
      'fssc22000',
      '冷凍冷蔵',
      '食品衛生',
    ],
  },
  {
    tag: '畜産業',
    keywords: [
      '畜産',
      '畜産業',
      '酪農',
      '牛',
      '豚',
      '鶏',
      '家畜',
      '飼料',
      '養豚',
      '養鶏',
      '肉用牛',
      '乳牛',
    ],
  },
];

function inferTagsFromRules(form, rules, allowedTags, maxCount) {
  const text = buildInferenceText(form);
  const scoreMap = new Map();

  rules.forEach((rule) => {
    let score = 0;

    rule.keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeForTagInference(keyword);

      if (normalizedKeyword && text.includes(normalizedKeyword)) {
        score += 1;
      }
    });

    if (score > 0 && allowedTags.includes(rule.tag)) {
      scoreMap.set(rule.tag, score);
    }
  });

  return Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, maxCount);
}

function inferPurposeTagsFromForm(form) {
  return inferTagsFromRules(form, PURPOSE_INFERENCE_RULES, PURPOSE_TAGS, 5);
}

function inferIndustryTagsFromForm(form) {
  const inferred = inferTagsFromRules(form, INDUSTRY_INFERENCE_RULES, INDUSTRY_TAGS, 4);

  /**
   * 個別業種が取れている場合は「業種指定無し」を外す。
   * 例：食品製造業 + 業種指定無し のような重複を避ける。
   */
  if (inferred.length >= 2 && inferred.includes('業種指定無し')) {
    return inferred.filter((tag) => tag !== '業種指定無し');
  }

  return inferred;
}

function buildAutoTaggedPublishForm(form) {
  const inferredPurposes = inferPurposeTagsFromForm(form);
  const purposes =
    inferredPurposes.length > 0
      ? inferredPurposes
      : Array.isArray(form.purposes)
        ? form.purposes
        : [];

  const formWithPurposes = {
    ...form,
    purposes,
  };

  const inferredIndustries = inferIndustryTagsFromForm(formWithPurposes);
  const industries =
    inferredIndustries.length > 0
      ? inferredIndustries
      : Array.isArray(form.industries)
        ? form.industries
        : [];

  return forceApplicationStatusByPeriod({
    ...form,
    purposes,
    industries,
    tags: makeTagsFromPurposesAndIndustries(
      purposes,
      industries,
      form.tags || []
    ),
  });
}

function buildSubsidyUpdatePayload(form) {
  const fixed = forceApplicationStatusByPeriod(form);
  const duplicateOfIdText = String(fixed.duplicate_of_id || '').trim();

  return {
    title: fixed.title,
    region: fixed.region,
    region_text: fixed.region_text,
    prefecture: fixed.prefecture,
    municipality: fixed.municipality,
    organization: fixed.organization,

    deadline: fixed.application_period_text || fixed.deadline,
    application_period_text: fixed.application_period_text,
    application_start_date: normalizeDateForDB(fixed.application_start_date),
    application_end_date: normalizeDateForDB(fixed.application_end_date),
    application_status: fixed.application_status,

    amount: fixed.amount,
    amount_text: fixed.amount_text,
    amount_max_yen: fixed.amount_max_yen || 0,

    subsidy_rate: fixed.subsidy_rate,
    subsidy_rate_text: fixed.subsidy_rate_text,

    target_expenses: fixed.target_expenses,
    target_expenses_arr: fixed.target_expenses_arr || [],
    target_entities: fixed.target_entities,
    target_entities_arr: fixed.target_entities_arr || [],

    summary: fixed.summary,

    source_url: fixed.source_url,
    official_url: fixed.official_url,

    purposes: fixed.purposes || [],
    industries: fixed.industries || [],
    tags: fixed.tags || [],

    fiscal_year: fixed.fiscal_year,

    source_type: fixed.source_type || null,
    source_external_id: fixed.source_external_id || null,

    admin_note: fixed.admin_note || null,
    duplicate_of_id: /^\d+$/.test(duplicateOfIdText)
      ? Number(duplicateOfIdText)
      : null,
    duplicate_reason: fixed.duplicate_reason || null,
  };
}

function hasAdminReviewNote(form) {
  return Boolean(form?.admin_note || form?.duplicate_of_id || form?.duplicate_reason);
}

function buildDuplicatePublishBlockMessage(form) {
  return [
    '⚠ 正データIDが設定された重複候補のため、このまま公開できません。',
    '',
    `タイトル: ${form.title || '未記載'}`,
    form.duplicate_of_id ? `正データID: ${form.duplicate_of_id}` : null,
    form.duplicate_reason ? `理由: ${form.duplicate_reason}` : null,
    form.admin_note ? `メモ: ${form.admin_note}` : null,
    '',
    '公開する場合は、重複元ID・重複理由・管理メモを確認し、重複候補ではない状態にしてから公開してください。',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPublishWarningMessage(form) {
  return [
    '⚠ 管理メモ・重複理由があるデータを公開しようとしています。',
    '',
    `タイトル: ${form.title || '未記載'}`,
    form.duplicate_of_id ? `正データID: ${form.duplicate_of_id}` : null,
    form.duplicate_reason ? `理由: ${form.duplicate_reason}` : null,
    form.admin_note ? `メモ: ${form.admin_note}` : null,
    '',
    '重複候補や非公開理由があるデータです。',
    '本当に公開しますか？',
  ]
    .filter(Boolean)
    .join('\n');
}

export default function AdminEditForm({
  initialData,
  supabase,
  onBack,
  onRefresh,
}) {
  const [editForm, setEditForm] = useState(() =>
    buildInitialEditForm(initialData)
  );

  const [aiSourceUrl, setAiSourceUrl] = useState('');
  const [aiRawText, setAiRawText] = useState('');
  const [step, setStep] = useState(1);
  const [extractedText, setExtractedText] = useState('');
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiDiagnostics, setAiDiagnostics] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextForm = buildInitialEditForm(initialData);

      setEditForm(nextForm);

      const defaultUrl = nextForm.official_url || nextForm.source_url;

      if (defaultUrl && String(defaultUrl).startsWith('http')) {
        setAiSourceUrl(defaultUrl);
      } else {
        setAiSourceUrl('');
      }

      setAiRawText('');
      setExtractedText('');
      setResolvedUrl('');
      setStep(1);
      setAiDiagnostics(null);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [initialData]);

  const updateEditForm = (patch) => {
    setEditForm((prev) => forceApplicationStatusByPeriod({ ...prev, ...patch }));
  };

  const validateDuplicateTarget = async (form) => {
    const duplicateOfIdText = String(form.duplicate_of_id || '').trim();

    if (!duplicateOfIdText) return true;

    if (!/^\d+$/.test(duplicateOfIdText)) {
      alert('重複元IDは数字で入力してください。');
      return false;
    }

    const duplicateOfId = Number(duplicateOfIdText);

    if (Number(initialData?.id) === duplicateOfId) {
      alert('自分自身のIDは重複元IDにできません。');
      return false;
    }

    const { data, error } = await supabase
      .from('subsidies')
      .select('id, title, crawl_status, is_active')
      .eq('id', duplicateOfId)
      .maybeSingle();

    if (error) {
      alert('重複元IDの確認に失敗しました: ' + error.message);
      return false;
    }

    if (!data) {
      alert(`重複元ID ${duplicateOfId} のデータが見つかりません。`);
      return false;
    }

    return true;
  };

  const handleCheckboxChange = (field, value) => {
    setEditForm((prev) => {
      const currentList = Array.isArray(prev[field]) ? prev[field] : [];

      const nextList = currentList.includes(value)
        ? currentList.filter((tag) => tag !== value)
        : [...currentList, value];

      const nextForm = {
        ...prev,
        [field]: nextList,
      };

      if (field === 'purposes') {
        nextForm.tags = makeTagsFromPurposesAndIndustries(
          nextList,
          prev.industries || [],
          prev.tags || []
        );
      }

      if (field === 'industries') {
        nextForm.tags = makeTagsFromPurposesAndIndustries(
          prev.purposes || [],
          nextList,
          prev.tags || []
        );
      }

      return forceApplicationStatusByPeriod(nextForm);
    });
  };

  const handleAutoPurposeTags = () => {
    setEditForm((prev) => {
      const inferredPurposes = inferPurposeTagsFromForm(prev);

      if (inferredPurposes.length === 0) {
        alert(
          '利用目的タグを自動判定できませんでした。タイトル・概要・対象経費などを確認して、手動で選択してください。'
        );
        return prev;
      }

      const nextForm = {
        ...prev,
        purposes: inferredPurposes,
        tags: makeTagsFromPurposesAndIndustries(
          inferredPurposes,
          prev.industries || [],
          prev.tags || []
        ),
      };

      return forceApplicationStatusByPeriod(nextForm);
    });
  };

  const handleClearPurposeTags = () => {
    setEditForm((prev) => {
      const previousPurposes = Array.isArray(prev.purposes) ? prev.purposes : [];
      const previousTags = Array.isArray(prev.tags) ? prev.tags : [];

      const nextTags = previousTags.filter((tag) => !previousPurposes.includes(tag));

      const nextForm = {
        ...prev,
        purposes: [],
        tags: makeTagsFromPurposesAndIndustries(
          [],
          prev.industries || [],
          nextTags
        ),
      };

      return forceApplicationStatusByPeriod(nextForm);
    });
  };

  const handleAutoIndustryTags = () => {
    setEditForm((prev) => {
      const inferredIndustries = inferIndustryTagsFromForm(prev);

      if (inferredIndustries.length === 0) {
        alert(
          '業種タグを自動判定できませんでした。タイトル・概要・対象事業者などを確認して、手動で選択してください。'
        );
        return prev;
      }

      const nextForm = {
        ...prev,
        industries: inferredIndustries,
        tags: makeTagsFromPurposesAndIndustries(
          prev.purposes || [],
          inferredIndustries,
          prev.tags || []
        ),
      };

      return forceApplicationStatusByPeriod(nextForm);
    });
  };

  const handleClearIndustryTags = () => {
    setEditForm((prev) => {
      const previousIndustries = Array.isArray(prev.industries)
        ? prev.industries
        : [];
      const previousTags = Array.isArray(prev.tags) ? prev.tags : [];

      const nextTags = previousTags.filter(
        (tag) => !previousIndustries.includes(tag)
      );

      const nextForm = {
        ...prev,
        industries: [],
        tags: makeTagsFromPurposesAndIndustries(
          prev.purposes || [],
          [],
          nextTags
        ),
      };

      return forceApplicationStatusByPeriod(nextForm);
    });
  };

  const handleSave = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    const baseFixedEditForm = forceApplicationStatusByPeriod(editForm);
    const fixedEditForm = isCurrentlyPublished
      ? baseFixedEditForm
      : buildAutoTaggedPublishForm(baseFixedEditForm);

    if (!(await validateDuplicateTarget(fixedEditForm))) return;

    const payload = buildSubsidyUpdatePayload(fixedEditForm);

    const { error } = await supabase
      .from('subsidies')
      .update(payload)
      .eq('id', initialData.id);

    if (!error) {
      setEditForm(fixedEditForm);
      alert('内容を保存しました！');
      onRefresh();
    } else {
      alert('エラーが発生しました: ' + error.message);
    }
  };

  const handleTogglePublish = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    const isCurrentlyPublished = editForm.crawl_status === 'published';
    const newStatus = isCurrentlyPublished ? 'draft' : 'published';

    const fixedEditForm = forceApplicationStatusByPeriod(editForm);

    if (!(await validateDuplicateTarget(fixedEditForm))) return;

    if (!isCurrentlyPublished && fixedEditForm.duplicate_of_id) {
      alert(buildDuplicatePublishBlockMessage(fixedEditForm));
      return;
    }

    if (!isCurrentlyPublished && hasAdminReviewNote(fixedEditForm)) {
      const shouldPublish = window.confirm(
        buildPublishWarningMessage(fixedEditForm)
      );

      if (!shouldPublish) return;
    }

    const payload = buildSubsidyUpdatePayload(fixedEditForm);

    const { error } = await supabase
      .from('subsidies')
      .update({
        ...payload,
        crawl_status: newStatus,
        is_active: !isCurrentlyPublished,
      })
      .eq('id', initialData.id);

    if (!error) {
      setEditForm({
        ...fixedEditForm,
        crawl_status: newStatus,
        is_active: !isCurrentlyPublished,
      });

      alert(
        isCurrentlyPublished
          ? '現在の内容を保存して、記事を「承認待ち」に戻しました！'
          : '現在の内容を保存して、公開しました！'
      );

      onRefresh();
      onBack();
    } else {
      alert('エラーが発生しました: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    if (!window.confirm('本当にこのデータを削除してもよろしいですか？')) {
      return;
    }

    const { error } = await supabase
      .from('subsidies')
      .delete()
      .eq('id', initialData.id);

    if (!error) {
      onRefresh();
      onBack();
    } else {
      alert('削除に失敗しました: ' + error.message);
    }
  };

  const handleFetchText = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    setIsLoading(true);
    setAiDiagnostics(null);

    try {
      const fallbackUrl = editForm.official_url || editForm.source_url || '';
      const organization =
        editForm.organization ||
        editForm.region_text ||
        editForm.region ||
        '愛媛県';

      const { data, error } = await supabase.functions.invoke('fetch-page-text', {
        body: {
          rawText: aiRawText,
          sourceUrl: aiSourceUrl,
          fallbackUrl,
          title: editForm.title,
          organization,
          source_type: editForm.source_type || '',
          currentData: editForm,
        },
      });

      if (error) {
        throw new Error(`サーバー通信エラー: ${error.message}`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const sourceText = data?.sourceText || '';
      const newUrl = data?.resolvedUrl || aiSourceUrl || fallbackUrl || '';

      if (!sourceText) {
        throw new Error('本文テキストを取得できませんでした。');
      }

      if (sourceText.length < 500) {
        alert(
          `⚠️ 抽出された本文が ${sourceText.length} 文字しかありません。\n一覧ページやメニュー部分だけを取得してしまった可能性があります。\n内容をプレビューで確認してください。`
        );
      }

      setExtractedText(sourceText);
      setResolvedUrl(newUrl);
      setStep(2);
    } catch (err) {
      alert('取得エラー: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAI = async () => {
    if (!supabase) {
      alert('Supabaseの接続情報が設定されていません。');
      return;
    }

    if (!extractedText || extractedText.trim().length < 50) {
      alert('AIに送る本文が短すぎます。本文を取得するか、テキストを貼り付けてください。');
      return;
    }

    setIsLoading(true);

    try {
      const org =
        editForm.organization ||
        editForm.region_text ||
        editForm.region ||
        '愛媛県';

      const { data, error } = await supabase.functions.invoke('extract-subsidy', {
        body: {
          extractedText,
          resolvedUrl,
          source_url: resolvedUrl || aiSourceUrl || editForm.source_url || '',
          official_url: editForm.official_url || '',
          editFormTitle: editForm.title,
          title: editForm.title,
          org,
          summary: editForm.summary,
          source_type: editForm.source_type || '',
          currentData: editForm,
          purposesTags: PURPOSE_TAGS.join(','),
          industryTags: INDUSTRY_TAGS.join(','),
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const facts = data?.facts || {};
      const tags = data?.tags || {};
      const finalTitle = data?.finalTitle || '';

      const tagPurposes = Array.isArray(tags.purposes) ? tags.purposes : [];
      const tagIndustries = Array.isArray(tags.industries) ? tags.industries : [];

      const aiResultRaw = {
        ...facts,

        title: finalTitle || facts.title,

        purposes: isUsableArray(facts.purposes)
          ? facts.purposes
          : tagPurposes,

        industries: isUsableArray(facts.industries)
          ? facts.industries
          : tagIndustries,

        tags: uniqueArray([
          ...(Array.isArray(facts.tags) ? facts.tags : []),
          ...tagPurposes,
          ...tagIndustries,
          ...(Array.isArray(facts.purposes) ? facts.purposes : []),
          ...(Array.isArray(facts.industries) ? facts.industries : []),
        ]),
      };

      const safeAIResult = sanitizeAIResultBeforeMerge(aiResultRaw);
      const protection = explainAIMergeProtection(editForm);
      const isJgrants = isJgrantsData(editForm);

      const fieldConfidence = facts.field_confidence || {};
      const baseWarnings = Array.isArray(facts.warnings) ? facts.warnings : [];
      const warnings = [...baseWarnings];

      if (protection.protected) {
        warnings.unshift(
          'Jグランツ由来データのため、タイトル・地域・申請期間・公式URLなどの確定項目はAIで上書きしません。'
        );
      }

      setAiDiagnostics({
        fieldConfidence,
        warnings,
        evidence: facts.evidence || {},
        candidateDebug: data?.candidate_debug || {},
      });

      const confidence = Number(facts.confidence ?? 100);

      if (confidence < 70) {
        const proceed = window.confirm(
          `⚠️ AIの抽出信頼度が低いです（${facts.confidence}%）。\n別制度の案内やヘッダー情報が混入している可能性があります。\n\n抽出されたデータをフォームに反映しますか？`
        );

        if (!proceed) {
          setIsLoading(false);
          return;
        }
      }

      setEditForm((prev) => {
        const merged = mergeAIResultSafely(prev, safeAIResult);
        return forceApplicationStatusByPeriod(merged);
      });

      if (!isJgrants) {
        if (facts.source_url && facts.source_url !== aiSourceUrl) {
          setAiSourceUrl(facts.source_url);
        } else if (resolvedUrl && resolvedUrl !== aiSourceUrl) {
          setAiSourceUrl(resolvedUrl);
        }
      }

      setStep(1);

      alert(
        isJgrants
          ? '🎉 Jグランツ由来の確定項目を保護したまま、AI補完を反映しました！'
          : '🎉 バックエンドでの安全なAI解析が完了しました！'
      );
    } catch (err) {
      alert('AIエラー: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const statusFixedForm = forceApplicationStatusByPeriod(editForm);
  const currentApplicationStatus =
    statusFixedForm.application_status || editForm.application_status || '不明';

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      }}
    >
      <AdminEditHeader
        editForm={editForm}
        onBack={onBack}
        handleDelete={handleDelete}
        handleSave={handleSave}
        handleTogglePublish={handleTogglePublish}
      />

      <div style={{ padding: '32px' }}>
        {isJgrantsData(editForm) && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '18px',
              fontSize: '13px',
              lineHeight: 1.7,
            }}
          >
            <strong>取得元：Jグランツ</strong>
            <br />
            AI自動入力を実行しても、タイトル・地域・申請期間・公式URLなどの確定項目は上書きしません。
          </div>
        )}

        <AdminAIAssistPanel
          step={step}
          setStep={setStep}
          aiSourceUrl={aiSourceUrl}
          setAiSourceUrl={setAiSourceUrl}
          aiRawText={aiRawText}
          setAiRawText={setAiRawText}
          extractedText={extractedText}
          setExtractedText={setExtractedText}
          resolvedUrl={resolvedUrl}
          isLoading={isLoading}
          handleFetchText={handleFetchText}
          handleRunAI={handleRunAI}
        />

        <AdminAIDiagnostics aiDiagnostics={aiDiagnostics} />

        <AdminBasicFields
          editForm={editForm}
          updateEditForm={updateEditForm}
          setEditForm={setEditForm}
          currentApplicationStatus={currentApplicationStatus}
        />

        <AdminDetailFields editForm={editForm} updateEditForm={updateEditForm} />

        <AdminTagSelector
          editForm={editForm}
          handleCheckboxChange={handleCheckboxChange}
          handleAutoPurposeTags={handleAutoPurposeTags}
          handleClearPurposeTags={handleClearPurposeTags}
          handleAutoIndustryTags={handleAutoIndustryTags}
          handleClearIndustryTags={handleClearIndustryTags}
        />
      </div>
    </div>
  );
}
