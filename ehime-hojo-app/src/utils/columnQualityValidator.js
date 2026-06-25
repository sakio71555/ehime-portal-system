export const MIN_FATAL_ARTICLE_TEXT_LENGTH = 1500;
export const MIN_RECOMMENDED_ARTICLE_TEXT_LENGTH = 3000;
export const MIN_RECOMMENDED_FEATURE_TEXT_LENGTH = 5000;

export const COLUMN_QUALITY_SCORE_RUBRIC = `
【100点満点の品質基準】
1. 検索意図との一致: 15点
- 読者が知りたい答えに早く到達している
- タイトルと本文がズレていない
- H1/H2が検索意図に合っている

2. 具体性: 15点
- 対象者、対象経費、対象外になりやすい経費、申請前の注意点が具体的
- 「詳しくは公式へ」だけで逃げていない

3. 公式確認・安全性: 15点
- 公式ページ、自治体、実施機関への確認導線がある
- 制度内容が変わる可能性を書いている
- 「必ず対象」「必ずもらえる」などの断定を避けている
- 未確認の補助率・上限額・年度情報を確定情報として書いていない

4. 記事ボリューム: 10点
- 最低3,000文字以上
- 特集記事なら5,000文字以上を目安
- 概要だけで終わらず読み応えがある

5. 愛媛県向けの地域性: 10点
- 愛媛県内の事業者向けになっている
- 愛媛県、市町村、商工会議所、商工会、支援機関などの視点がある
- えひめ補助金ポータル内で探す導線がある

6. 読みやすさ: 10点
- H2/H3構成が自然
- 表、チェックリスト、CTAがある
- 文章が不自然なAI文になっていない

7. SEO内部リンク: 10点
- 関連検索ページ、特集ページ、シミュレーター、専門家導線に自然につながる

8. 独自性・読み応え: 10点
- 一般論だけでなく、業種別・用途別・経費別の見方がある
- 読者が次に何をすればいいか分かる

9. NG表現チェック: 5点
- 誤解を招く断定がない
- 管理用メモが本文に漏れていない
- タイトルに具体情報があるのに本文で答えていない箇所がない
`.trim();

export const COLUMN_FATAL_ISSUE_RULES = [
  'タイトルに補助率・上限額・令和年度・2026年などの具体情報があるのに、本文に具体的な根拠・説明がない',
  '「必ず対象になる」「必ず受け取れる」「必ず使える」などと断定している',
  '公式確認導線がない',
  '本文が1,500文字未満',
  '表が1つもない',
  '内部リンクが1つもない',
  '対象者・対象経費・注意点が抽象的すぎる',
  '愛媛県・市町村・地域事業者の視点がない',
  '管理用メモが公開本文に出ている',
  '公式情報で確認していない数字を確定情報のように書いている',
  '申請前に契約・発注・購入・着手しない注意がない',
  '公募名・制度名を具体的に出しているのに、実施機関・公募期間・締切・公式URLが不足している',
  'FS調査事業の記事なのに、本文が設備導入や購入中心の説明になっている',
];

export const COLUMN_GENERATION_PROMPT_RULES = `
【AI生成記事の品質ルール】
あなたは、えひめ補助金ポータルの記事を作成するSEO編集者です。
薄い概要記事ではなく、検索ユーザーの疑問に答える読み応えのある特集記事を作ってください。

【必須ルール】
- 検索意図を冒頭で整理し、読者が知りたい答えに早く到達できる構成にしてください。
- タイトルで約束した答えを本文に必ず入れてください。
- 具体的な補助率・上限額・年度をタイトルに入れる場合は、本文にも具体情報、対象制度名、公式確認導線を入れてください。
- 具体情報を確認できない場合は、タイトルを「確認したい補助金・支援制度」「探し方と申請前の注意点」など安全な表現に弱めてください。
- 通常コラムは最低3,000文字以上、特集記事は5,000文字以上を目安にしてください。
- H2を8個以上入れてください。
- 表を最低1つ、できれば2つ以上入れてください。
- チェックリストを入れてください。
- CTAを入れてください。
- 関連する内部リンクを本文に自然に入れてください。例: /search?keyword=設備投資, /simulator, /experts, /feature/startup-digital
- 公式情報の確認を促してください。
- 申請前に契約・発注・購入・着手しない注意を書いてください。
- 対象者、対象経費、対象外になりやすい経費を書いてください。
- 愛媛県内の事業者、個人事業主、市町村、商工会議所、商工会、支援機関の視点を入れてください。
- 「必ず対象」「必ずもらえる」「必ず使える」など断定しないでください。
- 管理用メモ、品質スコア、自己採点、fatalIssues、warnings、shouldRegenerate などを公開本文に入れないでください。

【本文にできるだけ入れる要素】
1. 冒頭の結論
2. この記事でわかること
3. 対象になる可能性がある人
4. 対象になりやすい経費
5. 対象外・注意が必要な経費
6. 申請前に確認すること
7. 業種別または用途別の見方
8. 愛媛県内での探し方
9. 公式確認の注意
10. 内部リンク
11. CTA
12. まとめ

【公開本文に出してはいけない管理文言】
- この記事の作成・確認方針
- AIを下書き・整理に活用し、公開前に運営者が
- 本文内の外部確認リンク
- 本文内に外部リンクがない場合も
- qualityScore / fatalIssues / warnings / shouldRegenerate

【自然な注意書きの例】
掲載している情報は、AIを活用して収集・整理した情報をもとに作成しています。制度内容は変更される場合があります。申請前には、必ず公式ページ、自治体窓口、実施機関で最新情報をご確認ください。

${COLUMN_QUALITY_SCORE_RUBRIC}

【致命的NG】
${COLUMN_FATAL_ISSUE_RULES.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}

【自己採点ルール】
- qualityScore は 0〜100 の整数
- 90点以上は grade A、80〜89点は grade B、60〜79点は grade C、60点未満は grade D
- fatalIssues が1つでもある場合は shouldRegenerate true、shouldHumanReview true
- scoreCapsApplied は必ず配列で返してください。点数上限ルールに該当した場合は「39点上限: 理由」のように記録してください。
- 本文が1,500文字未満なら致命的NGで49点上限、3,000文字未満なら79点上限です。
- 表なしは59点上限、内部リンクなしは59点上限、公式確認導線なしは49点上限、申請前に契約・発注・購入・着手しない注意なしは69点上限です。
- タイトルで補助率・上限額・金額・令和年度・2026年・第○次公募・締切などを約束したのに本文に対応する具体情報がなければ39点上限です。
- 具体的な公募名・制度名を出す場合は、年度、回次、実施機関、開始日、締切、補助率、上限額、対象者、対象事業、対象経費、対象外経費、申請前注意、公式URL、確認日を表で確認できるようにしてください。不明な情報は断定せず、タイトルを弱めてください。
- FS調査事業の記事で本文が設備導入・購入中心になっている場合は49点上限です。
- 90点以上は、3,000文字以上、タイトルと本文の一致、対象者・対象経費・対象外、申請前注意、公式確認、愛媛文脈、表、チェックリスト、内部リンク、CTA、管理用メモなし、未確認数字の断定なしをすべて満たす場合だけです。
- llmReview は別の任意APIレビュー用です。記事生成時は enabled:false、usedApi:false、semanticScore:0、各コメントは「APIレビュー未実行」にしてください。
- 品質レビューは管理画面用です。公開本文には混ぜないでください。
`.trim();

export const PUBLISH_QUALITY_CHECKS = [
  'タイトルで約束した答えが本文にある',
  '対象者、対象経費、対象外、申請前注意が具体的に書かれている',
  '補助率・上限額・年度などの数字は公式根拠つきで書かれている',
  '公式ページ・自治体窓口・実施機関への確認導線がある',
  '表、チェックリスト、内部リンク、CTAが入っている',
  '愛媛県内の事業者・個人事業主・市町村の文脈が入っている',
  '申請前に契約・発注・購入・着手しない注意がある',
  '管理用メモや自己採点が公開本文に混ざっていない',
];

const INTERNAL_DOMAIN_RE = /ehime-hojokin\.jp/i;
const YEAR_PROMISE_RE = /(令和\s*\d+\s*年度|20\d{2}\s*年|2026\s*年|2027\s*年)/;
const AMOUNT_PROMISE_RE = /(補助率|上限額|補助上限|補助額|給付額|助成額|金額|上限)/;
const MONEY_OR_RATE_RE = /(%|％|円|万円|千円|分の[一二三四五六七八九0-9０-９]|[0-9０-９]+\s*\/\s*[0-9０-９]+|[0-9０-９]+\s*割|以内)/;
const OFFICIAL_RE = /(公式|募集要項|公募要領|交付要綱|自治体|実施機関|窓口|申請前|最新情報|確認日)/;
const REVIEWED_DATE_RE = /(確認日|更新日|掲載日|参照日|閲覧日|令和\s*\d+\s*年\s*\d+\s*月|20\d{2}[/-]\d{1,2}[/-]\d{1,2}|20\d{2}年\d{1,2}月\d{1,2}日)/;
const DEADLINE_PROMISE_RE =
  /(締切|期限|申請期間|公募期間|受付期間|募集期間|第\s*[0-9０-９一二三四五六七八九]+\s*次\s*公募)/;
const DEADLINE_DETAIL_RE =
  /(締切|期限|申請期間|公募期間|受付期間|募集期間|開始|終了|必着|消印有効|令和\s*\d+\s*年\s*\d+\s*月|20\d{2}[/-]\d{1,2}[/-]\d{1,2}|20\d{2}年\d{1,2}月\d{1,2}日)/;
const ROUND_DETAIL_RE = /(第\s*[0-9０-９一二三四五六七八九]+\s*次|一次|二次|三次|四次|公募回|回次)/;
const IMPLEMENTER_RE =
  /(実施機関|所管|事務局|主催|運営主体|自治体|国|県|市|町|村|愛媛県|経済産業省|中小企業庁|商工会議所|商工会)/;
const PUBLIC_OFFERING_TITLE_RE =
  /(第\s*[0-9０-９一二三四五六七八九]+\s*次\s*公募|令和\s*\d+\s*年度.{0,30}(補助金|助成金|給付金|支援事業|調査事業|補助事業)|[一-龥ぁ-んァ-ンA-Za-z0-9０-９・ー]{6,}(補助金|助成金|給付金|支援事業|調査事業|補助事業))/;
const GENERIC_TITLE_RE = /(一覧|まとめ|探し方|とは|解説|基礎|選び方|向けの補助金|使える補助金|補助金を探す)/;
const FS_TITLE_RE = /(FS\s*調査|フィージビリティ|実現可能性調査|調査事業)/i;
const FS_DETAIL_RE = /(調査計画|実現可能性|市場調査|事業化可能性|検証|調査費|専門家|委託調査|報告書|計画策定)/;
const EQUIPMENT_CENTERED_RE = /(設備投資|設備導入|機械導入|機器購入|設備購入|購入費|導入費|省エネ設備|生産設備|システム導入)/;
const DEFINITE_NUMBER_RE =
  /(補助率|上限額|補助上限|補助額|給付額|助成額|金額|令和\s*\d+\s*年度|20\d{2}\s*年).{0,24}(です|となります|対象です|支給されます|補助されます|受けられます|使えます|利用できます)/;
const RISKY_PROMISE_RE =
  /(必ず|絶対).{0,12}(対象|採択|受給|支給|受け取|もらえ|通る|使える)|誰でも.{0,12}(対象|もらえ|使える|受給|受け取)/;
const MANAGEMENT_MEMO_RE =
  /(この記事の作成・確認方針|AIを下書き・整理に活用し、公開前に運営者が|本文内の外部確認リンク|本文内に外部リンクがない場合も|qualityScore|fatalIssues|shouldRegenerate|shouldHumanReview|管理用メモ)/;
const EHIME_CONTEXT_RE =
  /(愛媛県|県内|松山市|今治市|宇和島市|新居浜市|西条市|大洲市|西予市|八幡浜市|四国中央市|商工会議所|商工会|地域事業者|えひめ補助金ポータル)/;
const PRE_CONTRACT_RE =
  /(申請前|交付決定前).{0,40}(契約|発注|購入|着手)|(?:契約|発注|購入|着手).{0,40}(申請前|交付決定前)/;
const TARGET_RE = /(対象者|対象になる|対象となる|対象の方|事業者|個人事業主|中小企業|法人|市町村|県内事業者)/;
const EXPENSE_RE = /(対象経費|補助対象経費|経費|設備|購入|改修|委託|広告|人件費|旅費|受講費|システム|ソフトウェア|機器)/;
const EXCLUDED_EXPENSE_RE = /(対象外|対象にならない|対象外経費|注意が必要な経費|補助対象外)/;
const CTA_RE = /(相談|診断|探す|確認する|問い合わせ|専門家|シミュレーター|次のステップ|公式ページで確認|補助金を探す|申請前に確認)/;
const PROJECT_RE = /(対象事業|補助対象事業|取り組み|取組|事業内容|対象となる事業|支援対象事業)/;

export const stripHtmlToText = (value = '') =>
  String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

export const countArticleTextLength = (content = '') =>
  stripHtmlToText(content).replace(/\s/g, '').length;

export const extractLinks = (html = '') =>
  Array.from(String(html).matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => match[1])
    .filter(Boolean);

const uniqueList = (items = []) =>
  Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)));

const gradeFromScore = (score) => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 60) return 'C';
  return 'D';
};

const normalizeScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const formatScoreCap = (maxScore, reason) => `${maxScore}点上限: ${reason}`;

const extractCapValue = (cap) => {
  const match = String(cap || '').match(/(\d{1,3})\s*点?上限/);
  return match ? normalizeScore(match[1]) : 100;
};

export const createDefaultLlmReview = (overrides = {}) => {
  const semanticScore = normalizeScore(overrides.semanticScore);

  return {
    enabled: Boolean(overrides.enabled),
    usedApi: Boolean(overrides.usedApi),
    semanticScore,
    titleBodyAlignment: String(overrides.titleBodyAlignment || 'APIレビュー未実行'),
    factualRisk: String(overrides.factualRisk || 'APIレビュー未実行'),
    searchIntentFit: String(overrides.searchIntentFit || 'APIレビュー未実行'),
    reviewerComments: uniqueList(overrides.reviewerComments),
  };
};

const normalizeLlmReview = (value = {}) => {
  if (!value || typeof value !== 'object') return createDefaultLlmReview();
  return createDefaultLlmReview(value);
};

export const normalizeQualityReview = (review = {}) => {
  if (!review || typeof review !== 'object') return null;

  const qualityScore = normalizeScore(review.qualityScore);
  const ruleBasedScore = normalizeScore(review.ruleBasedScore ?? review.deterministicScore ?? review.qualityScore);
  const fatalIssues = uniqueList(review.fatalIssues);
  const warnings = uniqueList(review.warnings);
  const scoreCapsApplied = uniqueList(review.scoreCapsApplied);
  const scoreCap = scoreCapsApplied.length
    ? Math.min(...scoreCapsApplied.map(extractCapValue))
    : 100;
  const cappedQualityScore = Math.min(qualityScore, scoreCap);
  const shouldRegenerate = Boolean(review.shouldRegenerate || fatalIssues.length > 0 || cappedQualityScore < 80);

  return {
    qualityScore: cappedQualityScore,
    ruleBasedScore,
    grade: gradeFromScore(cappedQualityScore),
    fatalIssues,
    warnings,
    strengths: uniqueList(review.strengths),
    improvementSuggestions: uniqueList(review.improvementSuggestions),
    scoreCapsApplied,
    llmReview: normalizeLlmReview(review.llmReview),
    shouldRegenerate,
    shouldHumanReview: review.shouldHumanReview !== false,
  };
};

export const reviewColumnQuality = (column = {}, options = {}) => {
  const title = String(column.title || column.seo_title || '');
  const content = String(column.content || '');
  const text = stripHtmlToText(content);
  const textLength = countArticleTextLength(content);
  const links = extractLinks(content);
  const externalLinks = links.filter((href) => /^https?:\/\//i.test(href) && !INTERNAL_DOMAIN_RE.test(href));
  const internalLinks = links.filter((href) => href.startsWith('/') || INTERNAL_DOMAIN_RE.test(href));
  const h2Count = (content.match(/<h2[\s>]/gi) || []).length;
  const hasTable = /<table[\s>]|<th[\s>]|<td[\s>]/i.test(content);
  const hasChecklist = /チェックリスト|確認リスト|<ul[\s>]|<ol[\s>]/i.test(content);
  const isFeature = options.articleType === 'feature' || column.category === '特集';
  const fatalIssues = [];
  const warnings = [];
  const strengths = [];
  const improvementSuggestions = [];
  const scoreCapsApplied = [];
  const scoreCapValues = [];
  const hasOfficialRoute = externalLinks.length > 0 || OFFICIAL_RE.test(text);
  const hasConcretePublicOfferingTitle = PUBLIC_OFFERING_TITLE_RE.test(title) && !GENERIC_TITLE_RE.test(title);
  const titlePromisesSpecifics =
    AMOUNT_PROMISE_RE.test(title) || YEAR_PROMISE_RE.test(title) || DEADLINE_PROMISE_RE.test(title);

  const addFatal = (message, suggestion = '') => {
    fatalIssues.push(message);
    if (suggestion) improvementSuggestions.push(suggestion);
  };

  const addWarning = (message, suggestion = '') => {
    warnings.push(message);
    if (suggestion) improvementSuggestions.push(suggestion);
  };

  const addScoreCap = (maxScore, reason) => {
    scoreCapValues.push(maxScore);
    scoreCapsApplied.push(formatScoreCap(maxScore, reason));
  };

  if (textLength < MIN_FATAL_ARTICLE_TEXT_LENGTH) {
    addFatal(
      `本文が${textLength}文字です。致命的NGの目安である${MIN_FATAL_ARTICLE_TEXT_LENGTH}文字を下回っています。`,
      '対象者、対象経費、対象外、申請前注意、愛媛県内での探し方を追加してください。'
    );
    addScoreCap(49, '本文が1,500文字未満です。');
  } else if (textLength < MIN_RECOMMENDED_ARTICLE_TEXT_LENGTH) {
    addWarning(
      `本文が${textLength}文字です。通常コラムは${MIN_RECOMMENDED_ARTICLE_TEXT_LENGTH}文字以上を目安にしてください。`,
      '概要だけで終わらないよう、用途別・経費別の見方や次の行動を追加してください。'
    );
    addScoreCap(79, '本文が3,000文字未満です。');
  } else {
    strengths.push('通常コラムの推奨文字数を満たしています。');
  }

  if (isFeature && textLength < MIN_RECOMMENDED_FEATURE_TEXT_LENGTH) {
    addWarning(
      `特集記事としては本文が${textLength}文字です。${MIN_RECOMMENDED_FEATURE_TEXT_LENGTH}文字以上を目安にしてください。`,
      '特集ページでは、業種別・用途別の探し方と関連ページ導線を厚めにしてください。'
    );
  }

  if (AMOUNT_PROMISE_RE.test(title)) {
    const hasAmountEvidence = AMOUNT_PROMISE_RE.test(text) && MONEY_OR_RATE_RE.test(text) && OFFICIAL_RE.test(text);
    if (!hasAmountEvidence) {
      addFatal(
        'タイトルに補助率・上限額などの具体情報があるのに、本文に具体的な数字・制度名・公式確認導線が不足しています。',
        '具体情報を確認できない場合は、タイトルを「確認ポイント」「探し方」など安全な表現に弱めてください。'
      );
      addScoreCap(39, 'タイトルの補助率・上限額・金額の約束に本文が答えていません。');
    }
  }

  if (YEAR_PROMISE_RE.test(title) && !YEAR_PROMISE_RE.test(text)) {
    addFatal(
      'タイトルに年度・年号がありますが、本文で同じ年度の根拠説明が不足しています。',
      '年度をタイトルに入れる場合は、本文にも公式確認日や該当年度の根拠を入れてください。'
    );
    addScoreCap(39, 'タイトルの年度・年号の約束に本文が答えていません。');
  }

  if (DEADLINE_PROMISE_RE.test(title) && !DEADLINE_DETAIL_RE.test(text)) {
    addFatal(
      'タイトルに締切・公募回・申請期間がありますが、本文に対応する期間・締切・回次の説明が不足しています。',
      '公募期間、締切、開始日、回次が不明な場合は、タイトルを「確認ポイント」など安全な表現に弱めてください。'
    );
    addScoreCap(39, 'タイトルの締切・公募回の約束に本文が答えていません。');
  }

  if (RISKY_PROMISE_RE.test(text)) {
    addFatal(
      '「必ず対象」「必ずもらえる」など、補助金の対象・受給を断定する表現があります。',
      '「対象になる可能性があります」「公式要件の確認が必要です」などに弱めてください。'
    );
  }

  if (MANAGEMENT_MEMO_RE.test(content)) {
    addFatal(
      '管理用メモや品質レビュー用の文言が公開本文に混ざっている可能性があります。',
      '品質スコア、自己採点、確認方針、外部リンク件数などは管理画面だけに表示してください。'
    );
    addScoreCap(39, '管理用メモが公開本文に混ざっています。');
  }

  if (!hasOfficialRoute) {
    addFatal(
      '公式ページ・自治体窓口・実施機関への確認導線がありません。',
      '公式URLがある場合は本文にリンクし、ない場合も自治体窓口や実施機関での確認を案内してください。'
    );
    addScoreCap(49, '公式情報確認の導線がありません。');
  } else if (externalLinks.length === 0) {
    addWarning(
      '本文内に公式ページなどの外部確認リンクがありません。',
      '公式URLが分かる場合は、本文に一次情報へのリンクを追加してください。'
    );
  } else {
    strengths.push('公式情報への外部リンクがあります。');
  }

  if (!hasTable) {
    addFatal(
      '表が1つもありません。',
      '対象者、対象経費、補助率、上限額、注意点などを表で整理してください。'
    );
    addScoreCap(59, '表がありません。');
  } else {
    strengths.push('表で情報を整理しています。');
  }

  if (internalLinks.length === 0) {
    addFatal(
      'えひめ補助金ポータル内の内部リンクがありません。',
      '関連特集、検索ページ、シミュレーター、専門家ページへの自然な内部リンクを入れてください。'
    );
    addScoreCap(59, '内部リンクがありません。');
  } else {
    strengths.push('内部リンクがあります。');
  }

  if (!TARGET_RE.test(text) || !EXPENSE_RE.test(text) || !EXCLUDED_EXPENSE_RE.test(text)) {
    addFatal(
      '対象者・対象経費・対象外になりやすい経費のいずれかが不足しています。',
      '「対象になる可能性がある人」「対象になりやすい経費」「対象外・注意が必要な経費」を具体化してください。'
    );
  } else {
    strengths.push('対象者・対象経費・対象外の観点があります。');
  }

  if (!PRE_CONTRACT_RE.test(text)) {
    addFatal(
      '申請前に契約・発注・購入・着手しない注意がありません。',
      '交付決定前の契約・発注・購入・着手が対象外になる可能性を明記してください。'
    );
    addScoreCap(69, '申請前に契約・発注・購入・着手しない注意がありません。');
  }

  if (!EHIME_CONTEXT_RE.test(text)) {
    addFatal(
      '愛媛県・市町村・地域事業者の視点が不足しています。',
      '愛媛県内の市町村、商工会議所、商工会、地域事業者向けの探し方を入れてください。'
    );
  } else {
    strengths.push('愛媛県内の読者向けの文脈があります。');
  }

  if (h2Count < 8) {
    addWarning(
      `H2が${h2Count}個です。検索意図を満たすには8個以上を目安にしてください。`,
      '冒頭の結論、対象者、対象経費、対象外、申請前注意、愛媛県内での探し方、内部リンク、まとめをH2で整理してください。'
    );
  }

  if (!hasChecklist) {
    addWarning('チェックリストがありません。', '申請前に確認する項目を箇条書きで追加してください。');
  }

  if (!CTA_RE.test(text)) {
    addWarning('CTAが弱い可能性があります。', '「補助金を探す」「診断する」「専門家に相談する」など次の行動を入れてください。');
  }

  if (titlePromisesSpecifics && !hasOfficialRoute) {
    addFatal(
      'タイトルに具体的な条件があるのに、公式情報で確認する導線が不足しています。',
      '具体的な数字・年度・締切を扱う場合は、公式ページまたは実施機関への確認導線を必ず入れてください。'
    );
    addScoreCap(39, 'タイトルの具体情報に対する公式確認導線がありません。');
  }

  if (hasConcretePublicOfferingTitle) {
    const missingOfferingFields = [];
    if (!DEADLINE_DETAIL_RE.test(text)) missingOfferingFields.push('公募期間・締切');
    if (!IMPLEMENTER_RE.test(text)) missingOfferingFields.push('実施機関');
    if (DEADLINE_PROMISE_RE.test(title) && !ROUND_DETAIL_RE.test(text)) missingOfferingFields.push('回次');
    if (externalLinks.length === 0) missingOfferingFields.push('公式URL');
    if (!REVIEWED_DATE_RE.test(text)) missingOfferingFields.push('確認日');

    if (missingOfferingFields.some((field) => ['公募期間・締切', '実施機関', '公式URL'].includes(field))) {
      addFatal(
        `具体的な公募名・制度名の記事として、${missingOfferingFields.join('、')}が不足しています。`,
        '制度名を具体的に出す場合は、表に年度、回次、実施機関、公募期間、締切、補助率、上限額、対象者、対象事業、対象経費、対象外経費、公式URL、確認日を整理してください。'
      );
      addScoreCap(69, '具体的な公募名・制度名に必要な実施機関・公募期間・公式URLが不足しています。');
    }
  }

  if (FS_TITLE_RE.test(`${title} ${text}`) && EQUIPMENT_CENTERED_RE.test(text) && !FS_DETAIL_RE.test(text)) {
    addFatal(
      'FS調査事業の記事なのに、本文が設備導入・購入中心の説明になっています。',
      'FS調査では、実現可能性調査、市場調査、事業化可能性、調査計画、報告書などの観点を中心に書いてください。'
    );
    addScoreCap(49, 'FS調査事業と本文内容がズレています。');
  }

  if ((DEFINITE_NUMBER_RE.test(text) || (MONEY_OR_RATE_RE.test(text) && YEAR_PROMISE_RE.test(text))) && !hasOfficialRoute) {
    addFatal(
      '未確認の補助率・上限額・年度情報を確定情報として書いている可能性があります。',
      '公式情報で確認できない数字は断定せず、「確認が必要です」「公募要領で確認してください」と表現してください。'
    );
    addScoreCap(39, '未確認の補助率・上限額・年度情報を断定しています。');
  }

  const hasConcreteAudienceExpenseExclusions =
    TARGET_RE.test(text) && EXPENSE_RE.test(text) && EXCLUDED_EXPENSE_RE.test(text) && PROJECT_RE.test(text);
  const highScoreRequirementsMet =
    textLength >= MIN_RECOMMENDED_ARTICLE_TEXT_LENGTH &&
    hasConcreteAudienceExpenseExclusions &&
    PRE_CONTRACT_RE.test(text) &&
    hasOfficialRoute &&
    EHIME_CONTEXT_RE.test(text) &&
    hasTable &&
    hasChecklist &&
    internalLinks.length > 0 &&
    CTA_RE.test(text) &&
    !MANAGEMENT_MEMO_RE.test(content) &&
    !((DEFINITE_NUMBER_RE.test(text) || MONEY_OR_RATE_RE.test(text)) && !hasOfficialRoute);

  if (!highScoreRequirementsMet) {
    addScoreCap(89, '90点以上に必要な強条件をすべて満たしていません。');
  }

  const baseScore = Math.max(0, Math.min(100, 100 - fatalIssues.length * 12 - warnings.length * 4));
  const hardScoreCap = scoreCapValues.length ? Math.min(...scoreCapValues) : 100;
  const qualityScore = Math.min(baseScore, hardScoreCap);
  const grade = gradeFromScore(qualityScore);

  return {
    qualityScore,
    ruleBasedScore: qualityScore,
    grade,
    fatalIssues: uniqueList(fatalIssues),
    warnings: uniqueList(warnings),
    strengths: uniqueList(strengths),
    improvementSuggestions: uniqueList(improvementSuggestions),
    scoreCapsApplied: uniqueList(scoreCapsApplied),
    llmReview: createDefaultLlmReview(),
    shouldRegenerate: fatalIssues.length > 0 || qualityScore < 80,
    shouldHumanReview: true,
  };
};

export const mergeColumnQualityReview = (aiReview, column = {}, options = {}) => {
  const machineReview = reviewColumnQuality(column, options);
  const normalizedAiReview = normalizeQualityReview(aiReview);

  if (!normalizedAiReview) return machineReview;

  const fatalIssues = uniqueList([...normalizedAiReview.fatalIssues, ...machineReview.fatalIssues]);
  const warnings = uniqueList([...normalizedAiReview.warnings, ...machineReview.warnings]);
  const scoreCapsApplied = uniqueList([
    ...normalizedAiReview.scoreCapsApplied,
    ...machineReview.scoreCapsApplied,
  ]);
  const scoreCap = scoreCapsApplied.length
    ? Math.min(...scoreCapsApplied.map(extractCapValue))
    : 100;
  const qualityScore = Math.min(normalizedAiReview.qualityScore, machineReview.qualityScore);
  const cappedQualityScore = Math.min(qualityScore, scoreCap);
  const grade = gradeFromScore(cappedQualityScore);
  const llmReview = normalizedAiReview.llmReview?.usedApi || normalizedAiReview.llmReview?.enabled
    ? normalizedAiReview.llmReview
    : machineReview.llmReview;

  return {
    qualityScore: cappedQualityScore,
    ruleBasedScore: machineReview.ruleBasedScore,
    grade,
    fatalIssues,
    warnings,
    strengths: uniqueList([...normalizedAiReview.strengths, ...machineReview.strengths]),
    improvementSuggestions: uniqueList([
      ...normalizedAiReview.improvementSuggestions,
      ...machineReview.improvementSuggestions,
    ]),
    scoreCapsApplied,
    llmReview,
    shouldRegenerate:
      normalizedAiReview.shouldRegenerate ||
      machineReview.shouldRegenerate ||
      fatalIssues.length > 0 ||
      cappedQualityScore < 80,
    shouldHumanReview: true,
  };
};
