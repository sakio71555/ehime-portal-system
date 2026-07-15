import {
  buildColumnSourceFacts,
  mergeColumnQualityReview,
  reviewColumnQuality,
} from '../src/utils/columnQualityValidator.js';

const assertCondition = (condition, message, details = {}) => {
  if (condition) return;
  console.error(`NG: ${message}`);
  console.error(JSON.stringify(details, null, 2));
  process.exit(1);
};

const badArticle = {
  title: '愛媛県の産業廃棄物処理業者向け補助金｜令和8年度の補助率・上限額と確認ポイント',
  content: `
    <h2>愛媛県の産業廃棄物処理業者向け補助金とは</h2>
    <p>この補助金は、産業廃棄物処理業者やリサイクル業者が、設備投資、新技術導入、環境対策費に使える制度です。</p>
    <p>令和8年度においても実施されています。一定の補助率が適用され、上限額が設定されています。</p>
    <h2>対象外経費</h2>
    <p>人件費、管理費、着手済み経費は対象外です。</p>
  `,
};

const officialSourceFacts = {
  articleType: 'single_program',
  officialName: '愛媛県中小企業省エネルギー設備更新支援補助金',
  fiscalYear: '2026年',
  applicationRound: '第1次公募',
  administeringBody: '愛媛県経済労働部',
  applicationStart: '2026年4月1日',
  applicationDeadline: '2026年6月30日',
  subsidyRate: '2分の1以内',
  subsidyCap: '上限100万円',
  eligibleApplicants: ['愛媛県内に事業所を有する中小企業者', '愛媛県内の個人事業主'],
  eligibleProjects: ['省エネルギー性能の高い設備への更新', '既存設備の効率化につながる設備更新'],
  eligibleExpenses: ['高効率空調設備', '高効率照明設備', '省エネルギー設備の導入費'],
  ineligibleExpenses: ['交付決定前に契約・発注・購入・着手した経費', '汎用性が高く目的外利用できる備品'],
  applicationMethods: ['公式ページの公募要領を確認し、指定様式で申請'],
  preStartRule: {
    confirmed: true,
    safeDescription: '交付決定前に契約・発注・購入・着手した経費は対象外です。',
    sourceId: 'source-1',
  },
  officialSources: [
    {
      id: 'source-1',
      label: '愛媛県公式ページ',
      url: 'https://example.ehime.jp/energy-subsidy',
      checkedAt: '2026年6月25日',
      evidence:
        'タイトル:愛媛県中小企業省エネルギー設備更新支援補助金 機関:愛媛県経済労働部 対象:愛媛県内に事業所を有する中小企業者、愛媛県内の個人事業主 経費:高効率空調設備、高効率照明設備、省エネルギー設備の導入費 上限:上限100万円 補助率:2分の1以内 締切:2026年6月30日 交付決定前に契約・発注・購入・着手した経費は対象外',
    },
  ],
};

const headings = [
  '冒頭の結論',
  'この記事でわかること',
  '公式ファクトで確認できていること',
  'まだ確認が必要なこと',
  '対象になる事業者',
  '対象事業と対象経費',
  '対象外になりやすい経費',
  '申請前に確認すること',
  '申請準備の流れ',
  'よくある失敗と回避策',
  '愛媛県内での探し方',
  '内部リンクと次の行動',
  'まとめ',
];

const paragraph =
  '愛媛県内の事業者がこの制度を検討するときは、公式ページの公募要領で対象者、対象事業、対象経費、補助率、上限額、申請期間、交付決定前の契約・発注・購入・着手の扱いを順番に確認することが重要です。制度名は愛媛県中小企業省エネルギー設備更新支援補助金、実施機関は愛媛県経済労働部、補助率は2分の1以内、補助上限は上限100万円、申請締切は2026年6月30日です。対象者は愛媛県内に事業所を有する中小企業者と愛媛県内の個人事業主で、対象事業は省エネルギー性能の高い設備への更新、既存設備の効率化につながる設備更新です。対象経費は高効率空調設備、高効率照明設備、省エネルギー設備の導入費です。対象外経費として、交付決定前に契約・発注・購入・着手した経費、汎用性が高く目的外利用できる備品があります。';

const longSections = headings
  .map((heading, index) => `<h2>${heading}</h2><p>${paragraph}</p>${index % 3 === 0 ? `<p>${paragraph}</p>` : ''}`)
  .join('\n');

const goodArticle = {
  title: '愛媛県中小企業省エネルギー設備更新支援補助金｜2026年の補助率・上限額と申請前チェック',
  quality_review: { humanReviewed: true },
  content: `
    <p>掲載情報は2026年6月25日に愛媛県公式ページで確認した内容をもとに整理しています。申請前には必ず<a href="https://example.ehime.jp/energy-subsidy">愛媛県公式ページ</a>と公募要領で最新情報をご確認ください。</p>
    <table><caption>公式ファクト</caption><tbody><tr><th>制度名</th><td>愛媛県中小企業省エネルギー設備更新支援補助金</td></tr><tr><th>実施機関</th><td>愛媛県経済労働部</td></tr><tr><th>補助率</th><td>2分の1以内</td></tr><tr><th>上限額</th><td>上限100万円</td></tr><tr><th>申請期間</th><td>2026年4月1日から2026年6月30日まで</td></tr></tbody></table>
    <table><caption>申請前チェック</caption><tbody><tr><th>対象者</th><td>愛媛県内に事業所を有する中小企業者、愛媛県内の個人事業主</td></tr><tr><th>対象事業</th><td>省エネルギー性能の高い設備への更新、既存設備の効率化につながる設備更新</td></tr><tr><th>対象経費</th><td>高効率空調設備、高効率照明設備、省エネルギー設備の導入費</td></tr><tr><th>対象外経費</th><td>交付決定前に契約・発注・購入・着手した経費、汎用性が高く目的外利用できる備品</td></tr></tbody></table>
    ${longSections}
    <h2>申請前チェックリスト</h2><ul><li>公式ページで制度名と実施機関を確認する</li><li>補助率2分の1以内と上限100万円を公募要領で確認する</li><li>交付決定前に契約・発注・購入・着手しない</li><li>愛媛県内の商工会議所や商工会にも相談する</li></ul>
    <h2>次の行動</h2><p>関連する制度を比較したい場合は、<a href="/ehime-subsidy/">愛媛県の補助金一覧</a>や<a href="/search?keyword=省エネ">省エネ補助金検索</a>を確認し、必要に応じて専門家へ相談してください。</p>
  `,
};

const badReview = reviewColumnQuality(badArticle, { articleType: 'column' });
const goodReview = reviewColumnQuality(goodArticle, {
  articleType: 'single_program',
  sourceFacts: officialSourceFacts,
  humanReviewed: true,
});
const generatedSelfReview = mergeColumnQualityReview(
  {
    qualityScore: 0,
    finalScore: 0,
    grade: 'D',
    fatalIssues: [],
    warnings: [],
    strengths: [],
    improvementSuggestions: [],
    scoreCapsApplied: [],
    publishAllowed: false,
    llmReview: {
      enabled: false,
      usedApi: false,
      semanticScore: 0,
    },
  },
  goodArticle,
  {
    articleType: 'single_program',
    sourceFacts: officialSourceFacts,
    humanReviewed: true,
  }
);
const semanticReview = mergeColumnQualityReview(
  {
    qualityScore: 85,
    finalScore: 85,
    grade: 'B',
    fatalIssues: [],
    warnings: [],
    strengths: ['タイトルと本文が整合しています。'],
    improvementSuggestions: [],
    scoreCapsApplied: [],
    publishAllowed: false,
    humanReviewed: true,
    llmReview: {
      enabled: true,
      usedApi: true,
      semanticScore: 85,
      titleBodyAlignment: '整合しています。',
      factualRisk: '低リスクです。',
      searchIntentFit: '検索意図に回答しています。',
      reviewerComments: [],
    },
  },
  goodArticle,
  {
    articleType: 'single_program',
    sourceFacts: officialSourceFacts,
    humanReviewed: true,
  }
);
const selectedFacts = buildColumnSourceFacts({
  subsidiesText: [
    'ID:12 | タイトル:制度12 | 機関:愛媛県 | 対象:県内事業者 | 経費:設備費 | 上限:100万円 | 締切:2026年8月1日 | 公式URL:https://example.ehime.jp/12 | 概要:制度12の概要',
    'ID:123 | タイトル:制度123 | 機関:松山市 | 対象:市内事業者 | 経費:広報費 | 上限:200万円 | 締切:2026年9月1日 | 公式URL:https://example.ehime.jp/123 | 概要:制度123の概要',
  ].join('\n---\n'),
  subsidyId: '12',
  articleType: 'single_program',
  title: '制度12の確認ポイント',
});
const equivalentMoneyFacts = {
  ...officialSourceFacts,
  subsidyCap: '上限6,000万円',
  officialSources: officialSourceFacts.officialSources.map((source) => ({
    ...source,
    evidence: source.evidence.replaceAll('上限100万円', '上限6,000万円'),
  })),
};
const equivalentMoneyArticle = {
  ...goodArticle,
  content: goodArticle.content.replaceAll('上限100万円', '上限60,000,000円'),
};
const equivalentMoneyReview = reviewColumnQuality(equivalentMoneyArticle, {
  articleType: 'single_program',
  sourceFacts: equivalentMoneyFacts,
  humanReviewed: true,
});

assertCondition(badReview.finalScore <= 39, '低品質fixtureは39点以下であるべきです。', badReview);
assertCondition(badReview.grade === 'D', '低品質fixtureはD判定であるべきです。', badReview);
assertCondition(badReview.publishAllowed === false, '低品質fixtureは公開不可であるべきです。', badReview);
assertCondition(badReview.titleNeedsRewrite === true, '低品質fixtureはタイトル修正が必要です。', badReview);
assertCondition(badReview.shouldRegenerate === true, '低品質fixtureは再生成推奨であるべきです。', badReview);
assertCondition(badReview.shouldHumanReview === true, '低品質fixtureは人間確認必須であるべきです。', badReview);
assertCondition(badReview.unsupportedClaims.length > 0, '低品質fixtureは根拠不明の主張を検出すべきです。', badReview);
assertCondition(badReview.fatalIssues.length > 0, '低品質fixtureは致命的問題を検出すべきです。', badReview);
assertCondition(badReview.suggestedTitles.length > 0, '低品質fixtureは安全なタイトル案を返すべきです。', badReview);

assertCondition(goodReview.finalScore >= 90, '合格fixtureは90点以上であるべきです。', goodReview);
assertCondition(goodReview.publishAllowed === true, '合格fixtureは公開可能であるべきです。', goodReview);
assertCondition(goodReview.fatalIssues.length === 0, '合格fixtureは致命的問題なしであるべきです。', goodReview);
assertCondition(
  generatedSelfReview.finalScore === goodReview.finalScore,
  'APIレビュー未実行の自己採点0点でルール点を上書きしてはいけません。',
  { generatedSelfReview, goodReview }
);
assertCondition(
  semanticReview.finalScore === 85,
  'APIレビュー実行済みの場合は意味評価をルール点の上限内で反映すべきです。',
  { semanticReview, goodReview }
);
assertCondition(
  semanticReview.publishAllowed === false,
  'APIレビューが90点未満の場合は公開可能にしてはいけません。',
  semanticReview
);
assertCondition(
  selectedFacts.officialName === '制度12' && selectedFacts.subsidyCap === '100万円',
  '補助金IDは部分一致ではなく、選択したIDのデータブロックだけを使うべきです。',
  selectedFacts
);
assertCondition(
  equivalentMoneyReview.unsupportedClaims.length === 0 && equivalentMoneyReview.contradictoryClaims.length === 0,
  '6,000万円と60,000,000円は同額として扱うべきです。',
  equivalentMoneyReview
);

console.log(JSON.stringify({
  bad: {
    finalScore: badReview.finalScore,
    grade: badReview.grade,
    publishAllowed: badReview.publishAllowed,
    titleNeedsRewrite: badReview.titleNeedsRewrite,
    shouldRegenerate: badReview.shouldRegenerate,
    shouldHumanReview: badReview.shouldHumanReview,
    unsupportedClaims: badReview.unsupportedClaims.length,
    fatalIssues: badReview.fatalIssues.length,
    suggestedTitles: badReview.suggestedTitles.length,
  },
  good: {
    finalScore: goodReview.finalScore,
    grade: goodReview.grade,
    publishAllowed: goodReview.publishAllowed,
    fatalIssues: goodReview.fatalIssues.length,
  },
  selfReviewIgnored: {
    finalScore: generatedSelfReview.finalScore,
    usedApi: generatedSelfReview.llmReview.usedApi,
  },
  semanticReviewApplied: {
    finalScore: semanticReview.finalScore,
    usedApi: semanticReview.llmReview.usedApi,
    publishAllowed: semanticReview.publishAllowed,
  },
  selectedSourceFacts: {
    officialName: selectedFacts.officialName,
    subsidyCap: selectedFacts.subsidyCap,
  },
  equivalentMoney: {
    unsupportedClaims: equivalentMoneyReview.unsupportedClaims.length,
    contradictoryClaims: equivalentMoneyReview.contradictoryClaims.length,
  },
}, null, 2));
