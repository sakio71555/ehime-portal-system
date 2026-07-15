export const MIN_FATAL_ARTICLE_TEXT_LENGTH = 1500;
export const MIN_RECOMMENDED_ARTICLE_TEXT_LENGTH = 4000;
export const MIN_RECOMMENDED_FEATURE_TEXT_LENGTH = 6000;

export const COLUMN_QUALITY_SCORE_RUBRIC = `
【100点満点の品質基準】
1. 検索意図との一致: 15点
- 読者が知りたい答えに早く到達している
- タイトルと本文がズレていない
- H1/H2が検索意図に合っている

2. 具体性: 15点
- 補助金は対象者・対象事業・対象経費・対象外経費、奨励金・給付金は交付要件・支給条件・算定方法・申請時期が具体的
- 「詳しくは公式へ」だけで逃げていない

3. 公式確認・安全性: 15点
- 公式ページ、自治体、実施機関への確認導線がある
- 制度内容が変わる可能性を書いている
- 「必ず対象」「必ずもらえる」などの断定を避けている
- 未確認の補助率・上限額・年度情報を確定情報として書いていない

4. 記事ボリューム: 10点
- 通常コラムは最低4,000文字以上
- 特集記事なら6,000文字以上を目安
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
  '制度種別に応じた対象者・対象事業・交付条件・算定方法・注意点が抽象的すぎる',
  '愛媛県・市町村・地域事業者の視点がない',
  '管理用メモが公開本文に出ている',
  '公式情報で確認していない数字を確定情報のように書いている',
  '契約・発注・購入・着手が可能になる時点について、制度ごとの確認を促していない',
  '公募名・制度名を具体的に出しているのに、実施機関・公募期間・締切・公式URLが不足している',
  'FS調査事業の記事なのに、本文が設備導入や購入中心の説明になっている',
  '本文中の金額・日付・対象者・対象経費・対象外経費に、公式ファクトで裏付けられない具体的主張がある',
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
- 通常コラムは最低4,000文字以上、特集記事は6,000文字以上を目安にしてください。
- H2は10〜12個を目安にし、見出しだけを細かく量産しないでください。
- 各H2には原則2段落以上の具体的な説明を入れ、1段落だけの薄い節を並べないでください。
- 表を最低2つ以上入れてください。
- チェックリストを入れてください。
- CTAを入れてください。
- 関連する内部リンクを本文に自然に入れてください。使用してよい主な内部リンクは /ehime-subsidy/、/search?keyword=設備投資、/simulator、/experts、/columns、/features、/feature/startup-digital です。
- 存在しない内部URLを作らないでください。/subsidy-list は存在しないため禁止です。補助金一覧へ誘導する場合は /ehime-subsidy/ または /search を使ってください。
- 公式情報の確認を促してください。
- 契約・発注・購入・着手が可能になる時点は制度ごとに異なるため、公式情報に基づいて表現してください。公式情報で確認できない場合は「交付決定前などに発生した経費が対象外になる場合があるため、公募要領と実施機関へ確認してください」と安全に書いてください。
- 補助金・助成金では対象者、対象事業、対象経費、対象外になりやすい経費を書いてください。奨励金・給付金では、対象者、交付・支給要件、算定方法、申請時期を書き、公式根拠がない対象経費を作らないでください。
- 愛媛県内の事業者、個人事業主、市町村、商工会議所、商工会、支援機関の視点を入れてください。
- 「必ず対象」「必ずもらえる」「必ず使える」など断定しないでください。
- 管理用メモ、品質スコア、自己採点、fatalIssues、warnings、shouldRegenerate などを公開本文に入れないでください。
- suppliedFacts にない制度名、年度、回次、日付、補助率、上限額、対象者、対象経費、対象外経費、実施機関、公式URLを推測で補完しないでください。
- suppliedFacts にない企業名、架空事例、モデルケース、導入効果、試算金額を作らないでください。「株式会社A」などの仮名事例も禁止です。
- 情報が不足する場合は missingFacts として管理用データに返し、本文では断定しないでください。
- 正式な単一制度を特定できない場合は「この補助金」「上限額が設定されています」「一定の補助率が適用されます」など単一制度前提の表現を使わず、業種別・目的別の探し方として構成してください。
- 産業廃棄物処理業者、リサイクル業者、設備投資、新技術導入、環境対策費、人件費、管理費、着手済み経費などの具体項目は、suppliedFacts に根拠がある場合だけ本文に書いてください。
- 検索順位を目的に一般論を水増しせず、公式情報と愛媛県内の読者が次に判断するための整理を優先してください。
- AIを活用した整理であること、公開前に運営者が確認すること、制度内容が変わる可能性を自然な注意書きで示してください。

【本文にできるだけ入れる要素】
1. 冒頭の結論
2. この記事でわかること
3. 公式ファクトで確認できていること
4. まだ確認が必要なこと
5. 対象になる可能性がある人
6. 制度種別に応じた対象事業・対象経費、または交付・支給要件
7. 対象外・注意が必要な条件、または金額の算定方法
8. 申請前に確認すること
9. 申請準備の流れ
10. よくある失敗と回避策
11. 業種別または用途別の見方
12. 愛媛県内での探し方
13. 公式確認の注意
14. 内部リンク
15. CTA
16. まとめ

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
- 本文が1,500文字未満なら致命的NGで49点上限、4,000文字未満なら79点上限です。
- 表なしは59点上限、表が1つだけなら79点上限、内部リンクなしは59点上限、公式確認導線なしは49点上限、契約・発注・購入・着手が可能になる時点の注意なしは69点上限です。
- タイトルで補助率・上限額・金額・令和年度・2026年・第○次公募・締切などを約束したのに本文に対応する具体情報がなければ39点上限です。
- 具体的な公募名・制度名を出す場合は、年度、回次、実施機関、開始日、締切、補助率、上限額、対象者、対象事業、対象経費、対象外経費、申請前注意、公式URL、確認日を表で確認できるようにしてください。不明な情報は断定せず、タイトルを弱めてください。
- FS調査事業の記事で本文が設備導入・購入中心になっている場合は49点上限です。
- unsupportedClaims または contradictoryClaims がある場合は公開不可です。
- sourceCoverageScore、factualGroundingScore、contentQualityScore、finalScore を分けて返してください。
- titleNeedsRewrite と suggestedTitles を返してください。
- 90点以上は、4,000文字以上、タイトルと本文の一致、対象者・対象経費・対象外、契約・発注・購入・着手時期の注意、公式確認、愛媛文脈、表2つ以上、チェックリスト、内部リンク、CTA、管理用メモなし、未確認数字の断定なしをすべて満たす場合だけです。
- llmReview は別の任意APIレビュー用です。記事生成時は enabled:false、usedApi:false、semanticScore:0、各コメントは「APIレビュー未実行」にしてください。
- 品質レビューは管理画面用です。公開本文には混ぜないでください。
`.trim();

export const PUBLISH_QUALITY_CHECKS = [
  'タイトルで約束した答えが本文にある',
  '制度種別に応じた対象者、対象経費または交付・支給要件、算定方法が具体的に書かれている',
  '補助率・上限額・年度などの数字は公式根拠つきで書かれている',
  '公式ページ・自治体窓口・実施機関への確認導線がある',
  '表、チェックリスト、内部リンク、CTAが入っている',
  '愛媛県内の事業者・個人事業主・市町村の文脈が入っている',
  '申請・契約・発注・購入・着手・操業開始の時期を公式情報で確認する注意がある',
  '確認した公式資料と確認日を追跡でき、必要書類・問い合わせ先を確認している',
  '既存記事との類似度を確認し、制度固有の情報を追加している',
  '管理用メモや自己採点が公開本文に混ざっていない',
];

export const COLUMN_ARTICLE_TYPES = [
  'single_program',
  'feature',
  'feasibility_study',
  'equipment',
  'digital',
  'employment',
  'research',
  'marketing',
];

export const COLUMN_PROGRAM_KINDS = ['subsidy', 'incentive', 'benefit', 'loan', 'other'];

const PROGRAM_KIND_LABELS = {
  subsidy: '補助金・助成金',
  incentive: '奨励金',
  benefit: '給付金・支援金',
  loan: '融資・利子補給',
  other: 'その他の支援制度',
};

const ARTICLE_TYPE_LABELS = {
  single_program: '個別制度記事',
  feature: '特集記事',
  feasibility_study: 'FS・実現可能性調査',
  equipment: '設備投資',
  digital: 'IT・デジタル化',
  employment: '雇用・人材',
  research: '研究開発',
  marketing: '販路開拓',
};

const INTERNAL_DOMAIN_RE = /ehime-hojokin\.jp/i;
const ALLOWED_INTERNAL_LINK_RE =
  /^\/(?:$|[?#]|ehime-subsidy\/?(?:[?#].*)?$|search(?:[?#].*)?$|simulator\/?(?:[?#].*)?$|experts\/?(?:[?#].*)?$|columns\/?(?:[?#].*)?$|features\/?(?:[?#].*)?$|beginners\/?(?:[?#].*)?$|feature\/[a-z0-9-]+\/?(?:[?#].*)?$|purpose\/[a-z0-9-]+\/?(?:[?#].*)?$|area\/[a-z0-9-]+\/?(?:[?#].*)?$|column\/[a-z0-9-]+\/?(?:[?#].*)?$|subsidy\/[0-9]+\/?(?:[?#].*)?$)/i;
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
  /(申請前|交付申請前|交付決定前|事前着手届).{0,60}(契約|発注|購入|着手)|(?:契約|発注|購入|着手).{0,60}(申請前|交付申請前|交付決定前|事前着手届|制度ごと|公募要領|実施機関|確認)/;
const TARGET_RE = /(対象者|対象になる|対象となる|対象の方|事業者|個人事業主|中小企業|法人|市町村|県内事業者)/;
const EXPENSE_RE = /(対象経費|補助対象経費|経費|設備|購入|改修|委託|広告|人件費|旅費|受講費|システム|ソフトウェア|機器)/;
const EXCLUDED_EXPENSE_RE = /(対象外|対象にならない|対象外経費|注意が必要な経費|補助対象外)/;
const CTA_RE = /(相談|診断|探す|確認する|問い合わせ|専門家|シミュレーター|次のステップ|公式ページで確認|補助金を探す|申請前に確認)/;
const PROJECT_RE = /(対象事業|補助対象事業|取り組み|取組|事業内容|対象となる事業|支援対象事業)/;
const START_TIMING_RE =
  /(契約|発注|購入|着手).{0,60}(制度ごと|交付決定前|事前着手|公募要領|実施機関|確認)|(?:交付決定前|事前着手届|公募要領).{0,60}(契約|発注|購入|着手|経費)/;
const INDUSTRY_UNSUPPORTED_RE =
  /(建設業、?製造業、?サービス業|建設業・製造業・サービス業|産業廃棄物処理業者|廃棄物処理業者|リサイクル業者)/;
const EXPENSE_UNSUPPORTED_RE = /(新規設備導入費|研修費|調査費|設備投資|新技術導入|環境対策費)/;
const EXCLUDED_UNSUPPORTED_RE =
  /(中古品|人件費|管理費|着手済み経費).{0,24}(対象外|補助対象外|対象にならない)|(?:対象外|補助対象外).{0,24}(中古品|人件費|管理費|着手済み経費)/;
const FICTIONAL_EXAMPLE_RE =
  /(?:株式会社|有限会社)[A-ZＡ-Ｚ](?:社)?|架空(?:の|事例|企業)|仮想事例|モデルケース|導入効果.{0,60}(?:円|万円|億円)/;
const CLAIM_NUMBER_RE =
  /(補助率|上限額|補助上限|補助額|給付額|助成額|金額|申請締切|締切|公募期間|受付期間|令和\s*\d+\s*年度|20\d{2}\s*年).{0,40}?(%|％|円|万円|千円|令和\s*\d+\s*年|20\d{2}[/-]\d{1,2}|20\d{2}年\d{1,2}月|\d{1,3}\s*\/\s*\d{1,3}|\d+\s*割)/g;
const SINGLE_PROGRAM_LANGUAGE_RE =
  /(この補助金|この制度|上限額が設定されています|一定の補助率が適用されます|令和\s*\d+\s*年度においても実施されています|20\d{2}\s*年においても実施されています)/;

const SOURCE_FACT_REQUIRED_BY_TYPE = {
  single_program: ['officialName', 'administeringBody', 'officialSources', 'eligibleApplicants'],
  feature: ['officialSources'],
  feasibility_study: ['officialSources', 'eligibleProjects'],
  equipment: ['officialSources', 'eligibleExpenses'],
  digital: ['officialSources', 'eligibleExpenses'],
  employment: ['officialSources', 'eligibleApplicants'],
  research: ['officialSources', 'eligibleProjects'],
  marketing: ['officialSources', 'eligibleProjects'],
};

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

const normalizeInternalHrefPath = (href = '') => {
  const value = String(href || '').trim();
  if (!value) return '';
  if (value.startsWith('/')) return value;
  if (/^https?:\/\//i.test(value) && INTERNAL_DOMAIN_RE.test(value)) {
    try {
      const url = new URL(value);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return value;
    }
  }
  return '';
};

const getInvalidInternalLinks = (links = []) =>
  uniqueList(
    links
      .map(normalizeInternalHrefPath)
      .filter(Boolean)
      .filter((href) => !ALLOWED_INTERNAL_LINK_RE.test(href))
  );

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

const splitFactList = (value = '') =>
  uniqueList(String(value || '').split(/[、,\n／/・|]+/).map((item) => item.replace(/^(対象|経費|概要|上限|締切)\s*[:：]?/, '')));

const textValue = (value = '') => String(value || '').trim();

const extractLabeledValue = (text = '', label = '') => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`${escapedLabel}\\s*[:：]\\s*([^|\\n]+)`, 'i'));
  return match ? match[1].trim() : '';
};

const findSubsidyBlockById = (blocks = [], subsidyId = '') => {
  const normalizedId = String(subsidyId || '').trim();
  if (!normalizedId) return '';
  return blocks.find((block) => extractLabeledValue(block, 'ID') === normalizedId) || '';
};

const extractUrlsFromText = (text = '') =>
  uniqueList(String(text || '').match(/https?:\/\/[^\s<>"')]+/g) || []);

const normalizeSource = (source = {}, index = 0) => ({
  id: textValue(source.id) || `source-${index + 1}`,
  label: textValue(source.label) || textValue(source.url) || `公式情報 ${index + 1}`,
  url: textValue(source.url),
  checkedAt: textValue(source.checkedAt),
  evidence: textValue(source.evidence),
});

const normalizePreStartRule = (value = {}) => ({
  confirmed: Boolean(value?.confirmed),
  allowedFrom: textValue(value?.allowedFrom),
  safeDescription: textValue(value?.safeDescription),
  sourceId: textValue(value?.sourceId),
});

export const createEmptySourceFacts = (articleType = 'feature') => ({
  articleType,
  programKind: 'other',
  officialName: '',
  fiscalYear: '',
  applicationRound: '',
  administeringBody: '',
  supervisingBody: '',
  applicationStart: '',
  applicationDeadline: '',
  subsidyRate: '',
  subsidyCap: '',
  eligibleApplicants: [],
  eligibleProjects: [],
  eligibleExpenses: [],
  ineligibleExpenses: [],
  eligibilityConditions: [],
  calculationMethod: '',
  paymentConditions: [],
  applicationMethods: [],
  requiredDocuments: [],
  contactInformation: [],
  projectPeriod: '',
  preStartRule: {
    confirmed: false,
    allowedFrom: '',
    safeDescription: '',
    sourceId: '',
  },
  officialSources: [],
  unknownFields: [],
});

export const normalizeColumnArticleType = (value = '', context = {}) => {
  const raw = String(value || '').trim();
  if (COLUMN_ARTICLE_TYPES.includes(raw)) return raw;
  if (raw === 'column') return normalizeColumnArticleType('', context);

  const text = `${context.title || ''} ${context.content || ''} ${context.category || ''}`;
  if (context.category === '特集' || raw === 'feature') return 'feature';
  if (FS_TITLE_RE.test(text)) return 'feasibility_study';
  if (/(設備投資|設備導入|省エネ|太陽光|蓄電池|機械)/.test(text)) return 'equipment';
  if (/(IT|DX|デジタル|システム|ソフトウェア|AI|クラウド)/i.test(text)) return 'digital';
  if (/(雇用|採用|人材|賃上げ|研修|リスキリング)/.test(text)) return 'employment';
  if (/(研究|開発|実証|試作|技術開発)/.test(text)) return 'research';
  if (/(販路|販売促進|展示会|広告|PR|マーケティング|売上)/.test(text)) return 'marketing';
  if (PUBLIC_OFFERING_TITLE_RE.test(text) && !GENERIC_TITLE_RE.test(text)) return 'single_program';
  return 'feature';
};

export const detectColumnProgramKind = (value = '', context = {}) => {
  const raw = String(value || '').trim();
  if (COLUMN_PROGRAM_KINDS.includes(raw)) return raw;

  const text = `${context.title || ''} ${context.content || ''}`;
  if (/(奨励金|立地奨励|企業立地|雇用奨励|立地促進)/.test(text)) return 'incentive';
  if (/(給付金|支援金|手当|商品券|給付事業)/.test(text)) return 'benefit';
  if (/(融資|貸付|利子補給|信用保証料|保証料補助)/.test(text)) return 'loan';
  if (/(補助金|助成金|補助事業|助成事業)/.test(text)) return 'subsidy';
  return 'other';
};

const normalizeSourceFacts = (sourceFacts = {}) => {
  const articleType = normalizeColumnArticleType(sourceFacts.articleType || sourceFacts.article_type || 'feature');
  const programKind = detectColumnProgramKind(sourceFacts.programKind || sourceFacts.program_kind, {
    title: sourceFacts.officialName || sourceFacts.official_name,
  });
  return {
    ...createEmptySourceFacts(articleType),
    ...sourceFacts,
    articleType,
    programKind,
    officialName: textValue(sourceFacts.officialName || sourceFacts.official_name),
    fiscalYear: textValue(sourceFacts.fiscalYear || sourceFacts.fiscal_year),
    applicationRound: textValue(sourceFacts.applicationRound || sourceFacts.application_round),
    administeringBody: textValue(sourceFacts.administeringBody || sourceFacts.administering_body),
    supervisingBody: textValue(sourceFacts.supervisingBody || sourceFacts.supervising_body),
    applicationStart: textValue(sourceFacts.applicationStart || sourceFacts.application_start),
    applicationDeadline: textValue(sourceFacts.applicationDeadline || sourceFacts.application_deadline),
    subsidyRate: textValue(sourceFacts.subsidyRate || sourceFacts.subsidy_rate),
    subsidyCap: textValue(sourceFacts.subsidyCap || sourceFacts.subsidy_cap),
    eligibleApplicants: uniqueList(sourceFacts.eligibleApplicants || sourceFacts.eligible_applicants || []),
    eligibleProjects: uniqueList(sourceFacts.eligibleProjects || sourceFacts.eligible_projects || []),
    eligibleExpenses: uniqueList(sourceFacts.eligibleExpenses || sourceFacts.eligible_expenses || []),
    ineligibleExpenses: uniqueList(sourceFacts.ineligibleExpenses || sourceFacts.ineligible_expenses || []),
    eligibilityConditions: uniqueList(sourceFacts.eligibilityConditions || sourceFacts.eligibility_conditions || []),
    calculationMethod: textValue(sourceFacts.calculationMethod || sourceFacts.calculation_method),
    paymentConditions: uniqueList(sourceFacts.paymentConditions || sourceFacts.payment_conditions || []),
    applicationMethods: uniqueList(sourceFacts.applicationMethods || sourceFacts.application_methods || []),
    requiredDocuments: uniqueList(sourceFacts.requiredDocuments || sourceFacts.required_documents || []),
    contactInformation: uniqueList(sourceFacts.contactInformation || sourceFacts.contact_information || []),
    projectPeriod: textValue(sourceFacts.projectPeriod || sourceFacts.project_period),
    preStartRule: normalizePreStartRule(sourceFacts.preStartRule || sourceFacts.pre_start_rule || {}),
    officialSources: Array.isArray(sourceFacts.officialSources || sourceFacts.official_sources)
      ? (sourceFacts.officialSources || sourceFacts.official_sources).map(normalizeSource)
      : [],
    unknownFields: uniqueList(sourceFacts.unknownFields || sourceFacts.unknown_fields || []),
  };
};

const hasFundingDetails = (facts = {}) =>
  Boolean(facts.subsidyRate || facts.subsidyCap || facts.calculationMethod);

const hasEligibilityDetails = (facts = {}) =>
  (facts.eligibleApplicants || []).length > 0 || (facts.eligibilityConditions || []).length > 0;

const hasPaymentDetails = (facts = {}) =>
  (facts.paymentConditions || []).length > 0 || hasFundingDetails(facts);

export const getColumnFactReadiness = (sourceFacts = {}, context = {}) => {
  const facts = normalizeSourceFacts({
    ...sourceFacts,
    programKind: sourceFacts.programKind || detectColumnProgramKind('', context),
  });
  const checks = [
    ['officialName', Boolean(facts.officialName)],
    ['administeringBody', Boolean(facts.administeringBody)],
    ['officialSources', hasUsableOfficialSource(facts)],
    ['eligibleApplicants', hasEligibilityDetails(facts)],
    ['applicationDeadline', Boolean(facts.applicationDeadline)],
  ];

  if (facts.programKind === 'subsidy') {
    checks.push(['eligibleExpenses', facts.eligibleExpenses.length > 0], ['fundingDetails', hasFundingDetails(facts)]);
  } else if (facts.programKind === 'incentive') {
    checks.push(
      ['eligibilityConditions', facts.eligibilityConditions.length > 0],
      ['calculationMethod', Boolean(facts.calculationMethod || facts.subsidyCap)]
    );
  } else if (facts.programKind === 'benefit') {
    checks.push(['paymentConditions', hasPaymentDetails(facts)], ['eligibilityConditions', hasEligibilityDetails(facts)]);
  } else if (facts.programKind === 'loan') {
    checks.push(['fundingDetails', hasFundingDetails(facts)], ['eligibilityConditions', hasEligibilityDetails(facts)]);
  } else {
    checks.push(
      ['programDetails', facts.eligibleProjects.length > 0 || facts.eligibilityConditions.length > 0 || facts.eligibleExpenses.length > 0],
      ['fundingDetails', hasFundingDetails(facts)]
    );
  }

  const passed = checks.filter(([, complete]) => complete).length;
  const score = Math.round((passed / checks.length) * 100);
  const missingFacts = checks.filter(([, complete]) => !complete).map(([field]) => field);
  const identityReady = checks.slice(0, 3).every(([, complete]) => complete);
  const timingReady = Boolean(facts.applicationDeadline);

  return {
    ready: identityReady && timingReady && missingFacts.length === 0 && score >= 80,
    score,
    programKind: facts.programKind,
    programKindLabel: PROGRAM_KIND_LABELS[facts.programKind] || PROGRAM_KIND_LABELS.other,
    missingFacts,
    sourceFacts: facts,
  };
};

export const buildColumnSourceFacts = (input = {}) => {
  const sourceText = stripHtmlToText(
    [
      input.sourceText,
      input.subsidiesText,
      input.aiInstructions,
      input.officialMemo,
    ]
      .filter(Boolean)
      .join('\n')
  );
  const contentText = stripHtmlToText(input.content || '');
  const title = textValue(input.title || input.seo_title);
  const existingFacts = normalizeSourceFacts(input.sourceFacts || input.source_facts || {});
  const blocks = String(input.subsidiesText || input.sourceText || '')
    .split(/\n---\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const selectedBlock = findSubsidyBlockById(blocks, input.subsidyId) || blocks[0] || sourceText;
  const urls = extractUrlsFromText(sourceText || selectedBlock);
  const officialUrlFromLabel = extractLabeledValue(selectedBlock, '公式URL');
  const officialUrl =
    officialUrlFromLabel && officialUrlFromLabel !== 'なし'
      ? officialUrlFromLabel
      : urls.find((url) => !INTERNAL_DOMAIN_RE.test(url)) || '';
  const sourceEvidence = stripHtmlToText(selectedBlock || sourceText).replace(officialUrl, '').trim();
  const hasSourceEvidence =
    sourceEvidence.length >= 24 &&
    /(タイトル|機関|実施機関|概要|対象|経費|上限|締切|募集|公募|確認日|交付要綱|公募要領)/.test(sourceEvidence);
  const officialSources = [...existingFacts.officialSources];

  if (officialUrl && !officialSources.some((source) => source.url === officialUrl)) {
    officialSources.push({
      id: 'source-1',
      label: extractLabeledValue(selectedBlock, 'タイトル') || '公式情報',
      url: officialUrl,
      checkedAt: extractLabeledValue(sourceText, '確認日'),
      evidence: hasSourceEvidence ? sourceEvidence.slice(0, 800) : '',
    });
  }

  const nextFacts = {
    ...existingFacts,
    officialName: existingFacts.officialName || extractLabeledValue(selectedBlock, 'タイトル'),
    administeringBody: existingFacts.administeringBody || extractLabeledValue(selectedBlock, '機関') || extractLabeledValue(sourceText, '実施機関'),
    eligibleApplicants: uniqueList([
      ...existingFacts.eligibleApplicants,
      ...splitFactList(extractLabeledValue(selectedBlock, '対象')),
    ]),
    eligibleExpenses: uniqueList([
      ...existingFacts.eligibleExpenses,
      ...splitFactList(extractLabeledValue(selectedBlock, '経費')),
    ]),
    subsidyRate: existingFacts.subsidyRate || extractLabeledValue(selectedBlock, '補助率'),
    subsidyCap: existingFacts.subsidyCap || extractLabeledValue(selectedBlock, '上限'),
    applicationDeadline: existingFacts.applicationDeadline || extractLabeledValue(selectedBlock, '締切'),
    officialSources,
  };

  const sourceAwareArticleType = input.articleType === 'column' && existingFacts.articleType
    ? existingFacts.articleType
    : input.articleType || nextFacts.articleType;
  const detectedArticleType = normalizeColumnArticleType(sourceAwareArticleType, {
    title,
    content: `${contentText} ${sourceText}`,
    category: input.category,
  });
  nextFacts.articleType = detectedArticleType;
  nextFacts.programKind = detectColumnProgramKind(
    existingFacts.programKind === 'other' ? '' : existingFacts.programKind,
    { title, content: `${contentText} ${sourceText}` }
  );
  nextFacts.preStartRule =
    nextFacts.preStartRule.confirmed || nextFacts.preStartRule.safeDescription
      ? nextFacts.preStartRule
      : {
          confirmed: false,
          allowedFrom: '',
          safeDescription:
            START_TIMING_RE.test(sourceText)
              ? '契約・発注・購入・着手が可能になる時点は、入力素材内の記載をもとに確認が必要です。'
              : '',
          sourceId: '',
        };

  return {
    ...nextFacts,
    unknownFields: uniqueList([...nextFacts.unknownFields, ...getMissingSourceFactFields(nextFacts, title)]),
  };
};

const sourceFactEvidenceText = (facts = {}) =>
  stripHtmlToText(
    [
      facts.officialName,
      facts.fiscalYear,
      facts.applicationRound,
      facts.administeringBody,
      facts.supervisingBody,
      facts.applicationStart,
      facts.applicationDeadline,
      facts.subsidyRate,
      facts.subsidyCap,
      ...(facts.eligibleApplicants || []),
      ...(facts.eligibleProjects || []),
      ...(facts.eligibleExpenses || []),
      ...(facts.ineligibleExpenses || []),
      ...(facts.eligibilityConditions || []),
      facts.calculationMethod,
      ...(facts.paymentConditions || []),
      ...(facts.applicationMethods || []),
      ...(facts.requiredDocuments || []),
      ...(facts.contactInformation || []),
      facts.projectPeriod,
      facts.preStartRule?.safeDescription,
      ...(facts.officialSources || []).map((source) => `${source.label} ${source.url} ${source.checkedAt} ${source.evidence}`),
    ]
      .filter(Boolean)
      .join('\n')
  );

const hasUsableOfficialSource = (facts = {}) =>
  (facts.officialSources || []).some((source) => source.url && source.evidence && source.evidence.length >= 12);

const getMissingSourceFactFields = (facts = {}, title = '') => {
  const articleType = normalizeColumnArticleType(facts.articleType, { title });
  const required = [...(SOURCE_FACT_REQUIRED_BY_TYPE[articleType] || SOURCE_FACT_REQUIRED_BY_TYPE.feature)];
  const programKind = detectColumnProgramKind(facts.programKind, { title });
  if (articleType === 'single_program') {
    if (programKind === 'subsidy') required.push('eligibleExpenses', 'fundingDetails');
    if (programKind === 'incentive') required.push('eligibilityConditions', 'calculationMethod');
    if (programKind === 'benefit') required.push('eligibilityConditions', 'paymentConditions');
    if (programKind === 'loan') required.push('eligibilityConditions', 'fundingDetails');
    if (programKind === 'other') required.push('programDetails', 'fundingDetails');
  }
  if (AMOUNT_PROMISE_RE.test(title)) {
    required.push('officialName', 'administeringBody', 'officialSources', 'fundingDetails');
  }
  if (articleType === 'single_program' || YEAR_PROMISE_RE.test(title) || DEADLINE_PROMISE_RE.test(title)) {
    required.push('applicationDeadline');
  }

  return uniqueList(
    required.filter((field) => {
      if (field === 'officialSources') return !hasUsableOfficialSource(facts);
      if (field === 'fundingDetails') return !hasFundingDetails(facts);
      if (field === 'eligibilityConditions') return !hasEligibilityDetails(facts);
      if (field === 'paymentConditions') return !hasPaymentDetails(facts);
      if (field === 'calculationMethod') return !textValue(facts.calculationMethod || facts.subsidyCap);
      if (field === 'programDetails') {
        return !(
          facts.eligibleProjects?.length ||
          facts.eligibilityConditions?.length ||
          facts.eligibleExpenses?.length
        );
      }
      const value = facts[field];
      if (Array.isArray(value)) return value.length === 0;
      return !textValue(value);
    })
  );
};

const formatMissingFact = (field) => {
  const labels = {
    officialName: '具体的な制度名',
    administeringBody: '実施機関',
    officialSources: '公式URLと根拠メモ',
    eligibleApplicants: '対象者',
    eligibleProjects: '対象事業',
    eligibleExpenses: '対象経費',
    eligibilityConditions: '交付・支給要件',
    calculationMethod: '算定方法',
    paymentConditions: '支給条件',
    fundingDetails: '補助率・上限額・算定方法のいずれか',
    programDetails: '対象事業・交付要件・対象経費のいずれか',
    subsidyRate: '補助率',
    subsidyCap: '上限額',
    applicationDeadline: '申請期間・締切',
  };
  return labels[field] || field;
};

const calculateSourceCoverageScore = (missingFacts = []) =>
  Math.max(0, Math.min(100, 100 - uniqueList(missingFacts).length * 12));

const extractYenAmounts = (value = '') =>
  Array.from(String(value || '').replace(/,/g, '').matchAll(/(\d+(?:\.\d+)?)\s*(億円|万円|千円|円)/g))
    .map((match) => {
      const amount = Number(match[1]);
      const multiplier = match[2] === '億円' ? 100000000 : match[2] === '万円' ? 10000 : match[2] === '千円' ? 1000 : 1;
      return Number.isFinite(amount) ? amount * multiplier : null;
    })
    .filter((amount) => amount !== null);

const hasEquivalentYenAmount = (left = '', right = '') => {
  const leftAmounts = extractYenAmounts(left);
  const rightAmounts = new Set(extractYenAmounts(right));
  return leftAmounts.some((amount) => rightAmounts.has(amount));
};

const fieldSupported = (factsText = '', value = '') => {
  const needle = stripHtmlToText(value);
  return Boolean(needle && (factsText.includes(needle) || hasEquivalentYenAmount(factsText, needle)));
};

const extractNumericClaims = (text = '') =>
  uniqueList(Array.from(String(text || '').matchAll(CLAIM_NUMBER_RE)).map((match) => match[0]));

const normalizeClaimText = (value = '') => stripHtmlToText(value).replace(/\s/g, '');

const claimSupportedByFacts = (claim = '', sourceFacts = {}, factsText = '') => {
  const normalizedClaim = normalizeClaimText(claim);
  const normalizedFacts = normalizeClaimText(factsText);
  if (normalizedFacts.includes(normalizedClaim)) return true;

  const rate = normalizeClaimText(sourceFacts.subsidyRate);
  const cap = normalizeClaimText(sourceFacts.subsidyCap);
  const start = normalizeClaimText(sourceFacts.applicationStart);
  const deadline = normalizeClaimText(sourceFacts.applicationDeadline);

  if (/補助率/.test(claim) && rate && normalizedClaim.includes(rate)) return true;
  if (
    /(上限額|補助上限|上限)/.test(claim) &&
    cap &&
    (normalizedClaim.includes(cap) || hasEquivalentYenAmount(claim, sourceFacts.subsidyCap))
  ) return true;
  if (/(締切|申請締切|公募期間|受付期間)/.test(claim) && deadline) {
    if (normalizedClaim.includes(deadline) || deadline.includes(normalizedClaim.replace(/.*?(20\d{2}年\d{1,2}月).*/, '$1'))) {
      return true;
    }
  }
  if (start || deadline) {
    const claimMonths = normalizedClaim.match(/20\d{2}年\d{1,2}月/g) || [];
    const hasStart = start && (normalizedClaim.includes(start) || claimMonths.some((month) => start.includes(month)));
    const hasDeadline = deadline && (normalizedClaim.includes(deadline) || claimMonths.some((month) => deadline.includes(month)));
    if ((start && deadline && hasStart && hasDeadline) || hasDeadline) return true;
  }
  if (rate && cap && normalizedClaim.includes(rate) && normalizedClaim.includes(cap)) return true;
  return false;
};

const buildFactualClaims = ({ title = '', text = '', sourceFacts = {} }) => {
  const factsText = sourceFactEvidenceText(sourceFacts);
  const claims = [];
  const addClaim = (claim, status, reason = '', sourceIds = []) => {
    claims.push({ claim, status, sourceIds, reason });
  };

  for (const claim of extractNumericClaims(text)) {
    const supported = claimSupportedByFacts(claim, sourceFacts, factsText);
    addClaim(
      claim,
      supported ? 'supported' : 'unsupported',
      supported ? '' : 'suppliedFacts に同じ金額・日付・補助率の根拠がありません。',
      supported ? ['source-1'] : []
    );
  }

  const titlePromisesRate = /補助率/.test(title);
  const titlePromisesNumericCap = /(上限額|補助上限|補助額|給付額|助成額|上限)/.test(title);
  const titlePromisesGenericAmount = /金額/.test(title);
  const missingPromisedFunding =
    (titlePromisesRate && !sourceFacts.subsidyRate) ||
    (titlePromisesNumericCap && !sourceFacts.subsidyCap) ||
    (titlePromisesGenericAmount && !sourceFacts.subsidyCap && !sourceFacts.calculationMethod);
  if (AMOUNT_PROMISE_RE.test(title) && missingPromisedFunding) {
    addClaim(
      'タイトルで補助率・上限額を約束しているが、公式ファクトに具体値がありません。',
      'unsupported',
      'タイトル安全化が必要です。'
    );
  }

  if (sourceFacts.subsidyCap && AMOUNT_PROMISE_RE.test(text) && MONEY_OR_RATE_RE.test(text) && !fieldSupported(text, sourceFacts.subsidyCap)) {
    addClaim(
      '本文中の上限額らしき記述が、suppliedFacts の上限額と一致しない可能性があります。',
      'contradictory',
      '公式ファクトの上限額と本文の金額を照合してください。',
      ['source-1']
    );
  }

  if (INDUSTRY_UNSUPPORTED_RE.test(text) && !INDUSTRY_UNSUPPORTED_RE.test(factsText)) {
    addClaim('対象者・対象業種の根拠がない', 'unsupported', 'suppliedFacts に本文の対象者・対象業種を裏付ける根拠がありません。');
  }

  if (EXPENSE_UNSUPPORTED_RE.test(text) && !EXPENSE_UNSUPPORTED_RE.test(factsText)) {
    addClaim('対象経費の根拠がない', 'unsupported', 'suppliedFacts に本文の対象経費を裏付ける根拠がありません。');
  }

  if (EXCLUDED_UNSUPPORTED_RE.test(text) && !/(中古品|人件費|管理費|着手済み経費)/.test(factsText)) {
    addClaim('対象外経費の根拠がない', 'unsupported', 'suppliedFacts に本文の対象外経費を裏付ける根拠がありません。');
  }
  const fictionalExample = text.match(FICTIONAL_EXAMPLE_RE)?.[0] || '';
  if (fictionalExample && !factsText.includes(fictionalExample)) {
    addClaim(
      `架空・仮名の事例が含まれています: ${fictionalExample}`,
      'unsupported',
      'suppliedFacts にない企業名、導入事例、試算金額は公開本文へ追加できません。'
    );
  }

  return uniqueList(claims.map((claim) => JSON.stringify(claim))).map((claim) => JSON.parse(claim));
};

const calculateFactualGroundingScore = (factualClaims = [], hasOfficialEvidence = false) => {
  const unsupportedCount = factualClaims.filter((claim) => claim.status === 'unsupported').length;
  const contradictoryCount = factualClaims.filter((claim) => claim.status === 'contradictory').length;
  const base = hasOfficialEvidence ? 100 : 60;
  return Math.max(0, Math.min(100, base - unsupportedCount * 20 - contradictoryCount * 35));
};

const suggestSafeTitles = ({ title = '', sourceFacts = {} }) => {
  const articleType = normalizeColumnArticleType(sourceFacts.articleType, { title });
  const theme = title
    .replace(/｜.*$/, '')
    .replace(/令和\s*\d+\s*年度|20\d{2}\s*年|補助率|上限額|補助上限|締切|第\s*[0-9０-９一二三四五六七八九]+\s*次公募/g, '')
    .replace(/[|｜:：]+/g, '')
    .replace(/\s+/g, '')
    .trim();
  const base = theme || sourceFacts.officialName || '愛媛県の補助金';

  if (articleType === 'single_program' && sourceFacts.officialName) {
    const detailTitle = detectColumnProgramKind(sourceFacts.programKind, { title }) === 'subsidy'
      ? `${sourceFacts.officialName}の対象者・対象経費と申請前の注意点`
      : `${sourceFacts.officialName}の対象者・交付条件と申請前の注意点`;
    return uniqueList([
      `${sourceFacts.officialName}の確認ポイント`,
      detailTitle,
    ]);
  }

  if (/産業廃棄物処理業者|廃棄物処理業者|リサイクル業者/.test(title)) {
    return uniqueList([
      '愛媛県で産業廃棄物処理業者が確認したい補助金・支援制度｜設備更新・再資源化・省エネ対策の探し方',
      '愛媛県の産業廃棄物処理・リサイクル事業者が補助金を探すときの確認ポイント',
      '産業廃棄物処理業者向け補助金を愛媛県内で探す方法と申請前の注意点',
    ]);
  }

  return uniqueList([
    `${base.replace(/向け補助金$/, '向け補助金・支援制度')}の探し方と申請前の注意点`,
    `${base.replace(/補助金$/, '補助金・支援制度')}で確認したい公式情報`,
    `${base.replace(/向け$/, '')}向け支援制度の公式情報確認ポイント`,
  ]);
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

const normalizeFactualClaims = (items = []) =>
  Array.isArray(items)
    ? items
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const status = ['supported', 'unsupported', 'contradictory', 'unclear'].includes(item.status)
            ? item.status
            : 'unclear';
          return {
            claim: textValue(item.claim),
            status,
            sourceIds: uniqueList(item.sourceIds || item.source_ids || []),
            reason: textValue(item.reason),
          };
        })
        .filter((item) => item?.claim)
    : [];

export const normalizeQualityReview = (review = {}) => {
  if (!review || typeof review !== 'object') return null;

  const qualityScore = normalizeScore(review.qualityScore);
  const ruleBasedScore = normalizeScore(review.ruleBasedScore ?? review.deterministicScore ?? review.qualityScore);
  const sourceCoverageScore = normalizeScore(review.sourceCoverageScore);
  const factualGroundingScore = normalizeScore(review.factualGroundingScore);
  const contentQualityScore = normalizeScore(review.contentQualityScore);
  const fatalIssues = uniqueList(review.fatalIssues);
  const warnings = uniqueList(review.warnings);
  const scoreCapsApplied = uniqueList(review.scoreCapsApplied);
  const scoreCap = scoreCapsApplied.length
    ? Math.min(...scoreCapsApplied.map(extractCapValue))
    : 100;
  const cappedQualityScore = Math.min(
    normalizeScore(review.finalScore ?? qualityScore),
    qualityScore || 100,
    scoreCap
  );
  const shouldRegenerate = Boolean(review.shouldRegenerate || fatalIssues.length > 0 || cappedQualityScore < 80);
  const factualClaims = normalizeFactualClaims(review.factualClaims);
  const unsupportedClaims = uniqueList(
    review.unsupportedClaims ||
      factualClaims.filter((claim) => claim.status === 'unsupported').map((claim) => claim.claim)
  );
  const contradictoryClaims = uniqueList(
    review.contradictoryClaims ||
      factualClaims.filter((claim) => claim.status === 'contradictory').map((claim) => claim.claim)
  );
  const sourceFacts = normalizeSourceFacts(review.sourceFacts || review.source_facts || {});
  const articleType = normalizeColumnArticleType(review.articleType || sourceFacts.articleType);
  const humanReviewed = Boolean(review.humanReviewed || review.humanReviewCompleted);

  return {
    qualityScore: cappedQualityScore,
    ruleBasedScore,
    sourceCoverageScore,
    factualGroundingScore,
    contentQualityScore,
    finalScore: cappedQualityScore,
    grade: gradeFromScore(cappedQualityScore),
    articleType,
    articleTypeLabel: ARTICLE_TYPE_LABELS[articleType] || articleType,
    sourceFacts,
    missingFacts: uniqueList(review.missingFacts || sourceFacts.unknownFields),
    factualClaims,
    unsupportedClaims,
    contradictoryClaims,
    fatalIssues,
    warnings,
    strengths: uniqueList(review.strengths),
    improvementSuggestions: uniqueList(review.improvementSuggestions),
    scoreCapsApplied,
    titleNeedsRewrite: Boolean(review.titleNeedsRewrite),
    suggestedTitles: uniqueList(review.suggestedTitles),
    publishAllowed: Boolean(
      review.publishAllowed &&
        humanReviewed &&
        fatalIssues.length === 0 &&
        unsupportedClaims.length === 0 &&
        contradictoryClaims.length === 0 &&
        cappedQualityScore >= 90
    ),
    humanReviewed,
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
  const invalidInternalLinks = getInvalidInternalLinks(internalLinks);
  const h2Count = (content.match(/<h2[\s>]/gi) || []).length;
  const tableCount = (content.match(/<table[\s>]/gi) || []).length;
  const hasTable = tableCount > 0 || /<th[\s>]|<td[\s>]/i.test(content);
  const hasChecklist = /チェックリスト|確認リスト|<ul[\s>]|<ol[\s>]/i.test(content);
  const sourceFacts = buildColumnSourceFacts({
    sourceFacts: options.sourceFacts || column.sourceFacts || column.source_facts || column.quality_review?.sourceFacts,
    sourceText: options.sourceText,
    subsidiesText: options.subsidiesText,
    aiInstructions: column.ai_instructions,
    officialMemo: options.officialMemo,
    title,
    content,
    category: column.category,
    articleType: options.articleType,
    subsidyId: column.subsidy_id,
  });
  const articleType = normalizeColumnArticleType(
    options.articleType === 'column' ? sourceFacts.articleType : options.articleType || sourceFacts.articleType,
    {
      title,
      content: text,
      category: column.category,
    }
  );
  sourceFacts.articleType = articleType;
  const programKind = detectColumnProgramKind(sourceFacts.programKind, { title, content: text });
  sourceFacts.programKind = programKind;
  const requiresExpenseDetails = programKind === 'subsidy';
  const hasProgramSpecificDetails = requiresExpenseDetails
    ? TARGET_RE.test(text) && EXPENSE_RE.test(text) && EXCLUDED_EXPENSE_RE.test(text) && PROJECT_RE.test(text)
    : TARGET_RE.test(text) && /(対象要件|交付要件|支給要件|立地要件|算定方法|交付条件|支給条件|申請条件)/.test(text);
  const isFeature = articleType === 'feature' || column.category === '特集';
  const fatalIssues = [];
  const warnings = [];
  const strengths = [];
  const improvementSuggestions = [];
  const scoreCapsApplied = [];
  const scoreCapValues = [];
  const hasOfficialRoute = externalLinks.length > 0 || OFFICIAL_RE.test(text);
  const hasOfficialEvidence = hasUsableOfficialSource(sourceFacts);
  const missingFacts = getMissingSourceFactFields(sourceFacts, title);
  const sourceCoverageScore = calculateSourceCoverageScore(missingFacts);
  const factualClaims = buildFactualClaims({ title, text, sourceFacts });
  const unsupportedClaims = uniqueList(
    factualClaims.filter((claim) => claim.status === 'unsupported').map((claim) => claim.claim)
  );
  const contradictoryClaims = uniqueList(
    factualClaims.filter((claim) => claim.status === 'contradictory').map((claim) => claim.claim)
  );
  const hasConcretePublicOfferingTitle = PUBLIC_OFFERING_TITLE_RE.test(title) && !GENERIC_TITLE_RE.test(title);
  const titlePromisesSpecifics =
    AMOUNT_PROMISE_RE.test(title) || YEAR_PROMISE_RE.test(title) || DEADLINE_PROMISE_RE.test(title);
  const humanReviewed = Boolean(options.humanReviewed || column.humanReviewed || column.quality_review?.humanReviewed);
  const missingIdentityFacts = [
    !sourceFacts.officialName ? '正式な制度名' : '',
    !sourceFacts.administeringBody ? '実施機関' : '',
    !hasUsableOfficialSource(sourceFacts) ? '公式URL・根拠メモ' : '',
  ].filter(Boolean);
  let titleNeedsRewrite = false;
  const suggestedTitles = [];

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
      requiresExpenseDetails
        ? '対象者、対象経費、対象外、申請前注意、愛媛県内での探し方を追加してください。'
        : `対象者、${PROGRAM_KIND_LABELS[programKind]}の交付・支給要件、算定方法、申請時期、愛媛県内での確認先を追加してください。`
    );
    addScoreCap(49, '本文が1,500文字未満です。');
  } else if (textLength < MIN_RECOMMENDED_ARTICLE_TEXT_LENGTH) {
    addWarning(
      `本文が${textLength}文字です。通常コラムは${MIN_RECOMMENDED_ARTICLE_TEXT_LENGTH}文字以上を目安にしてください。`,
      '概要だけで終わらないよう、用途別・経費別の見方や次の行動を追加してください。'
    );
    addScoreCap(79, '本文が4,000文字未満です。');
  } else {
    strengths.push('通常コラムの推奨文字数を満たしています。');
  }

  if (isFeature && textLength < MIN_RECOMMENDED_FEATURE_TEXT_LENGTH) {
    addWarning(
      `特集記事としては本文が${textLength}文字です。${MIN_RECOMMENDED_FEATURE_TEXT_LENGTH}文字以上を目安にしてください。`,
      '特集ページでは、業種別・用途別の探し方と関連ページ導線を厚めにしてください。'
    );
  }

  if (!hasOfficialEvidence) {
    addWarning(
      '公式URLだけ、または本文内リンクだけでは公式ファクト確認済みとして扱えません。',
      '管理画面の素材欄や自動生成データに、制度名・実施機関・上限額・締切など一次情報から確認した根拠メモを入れてください。'
    );
    addScoreCap(89, '公式URLと根拠メモが揃っていないため、100点・90点台の上限を制限します。');
  }

  if (missingFacts.length > 0) {
    addWarning(
      `公式ファクトが不足しています: ${missingFacts.map(formatMissingFact).join('、')}`,
      '不足している公式情報は本文で断定せず、missingFacts として管理画面で確認してください。'
    );
  } else {
    strengths.push('公式ファクトの必須項目が揃っています。');
  }

  if (AMOUNT_PROMISE_RE.test(title)) {
    const titlePromisesRate = /補助率/.test(title);
    const titlePromisesNumericCap = /(上限額|補助上限|補助額|給付額|助成額|上限)/.test(title);
    const titlePromisesGenericAmount = /金額/.test(title);
    const fundingAnswerInBody =
      ((titlePromisesRate || titlePromisesNumericCap) && MONEY_OR_RATE_RE.test(text)) ||
      (titlePromisesGenericAmount && (MONEY_OR_RATE_RE.test(text) || /算定方法|算定基準|計算方法/.test(text)));
    const hasAmountEvidence =
      (!titlePromisesRate || sourceFacts.subsidyRate) &&
      (!titlePromisesNumericCap || sourceFacts.subsidyCap) &&
      (!titlePromisesGenericAmount || sourceFacts.subsidyCap || sourceFacts.calculationMethod) &&
      AMOUNT_PROMISE_RE.test(text) &&
      fundingAnswerInBody &&
      hasOfficialEvidence;
    if (!hasAmountEvidence) {
      addFatal(
        'タイトルで補助率・上限額を約束しているが本文と公式ファクトに具体情報がありません。',
        '具体情報を確認できない場合は、タイトルを「確認ポイント」「探し方」など安全な表現に弱めてください。'
      );
      addScoreCap(39, 'タイトルの補助率・上限額・金額の約束に本文が答えていません。');
      titleNeedsRewrite = true;
      suggestedTitles.push(...suggestSafeTitles({ title, sourceFacts }));
    }
  }

  if (titlePromisesSpecifics && missingIdentityFacts.length > 0) {
    addFatal(
      `正式な制度名・実施機関・公式URLが確認できません。不足: ${missingIdentityFacts.join('、')}`,
      '補助率・上限額・年度などをタイトルで約束する場合は、正式制度名、実施機関、公式URL、補助率、上限額を suppliedFacts に揃えてください。'
    );
    addScoreCap(39, '強いタイトルに必要な正式制度名・実施機関・公式URLが不足しています。');
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles({ title, sourceFacts }));
  }

  if (SINGLE_PROGRAM_LANGUAGE_RE.test(text) && (!sourceFacts.officialName || !hasOfficialEvidence)) {
    addFatal(
      '正式な単一制度を特定できないのに「この補助金」など単一制度を前提にした表現があります。',
      '正式制度を特定できない場合は、業種別特集として複数制度の探し方・比較方法に書き換えてください。'
    );
    addScoreCap(39, '正式制度未特定のまま単一制度として書いています。');
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles({ title, sourceFacts }));
  }

  if (YEAR_PROMISE_RE.test(title) && (!YEAR_PROMISE_RE.test(text) || !hasOfficialEvidence)) {
    addFatal(
      'タイトルに年度・年号がありますが、本文で同じ年度の根拠説明が不足しています。',
      '年度をタイトルに入れる場合は、本文にも公式確認日や該当年度の根拠を入れてください。'
    );
    addScoreCap(39, 'タイトルの年度・年号の約束に本文が答えていません。');
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles({ title, sourceFacts }));
  }

  if (DEADLINE_PROMISE_RE.test(title) && (!DEADLINE_DETAIL_RE.test(text) || !hasOfficialEvidence)) {
    addFatal(
      'タイトルに締切・公募回・申請期間がありますが、本文に対応する期間・締切・回次の説明が不足しています。',
      '公募期間、締切、開始日、回次が不明な場合は、タイトルを「確認ポイント」など安全な表現に弱めてください。'
    );
    addScoreCap(39, 'タイトルの締切・公募回の約束に本文が答えていません。');
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles({ title, sourceFacts }));
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
  } else if (tableCount < 2) {
    addWarning(
      '表が1つだけです。記事の読み応えを出すため、公式ファクト表と申請前確認表など2つ以上に分けてください。',
      '公式ファクト表、不足情報の確認表、対象経費の確認表、申請前チェック表を追加してください。'
    );
    addScoreCap(79, '表が1つだけです。');
  } else {
    strengths.push('複数の表で情報を整理しています。');
  }

  if (internalLinks.length === 0) {
    addFatal(
      'えひめ補助金ポータル内の内部リンクがありません。',
      '関連特集、検索ページ、シミュレーター、専門家ページへの自然な内部リンクを入れてください。'
    );
    addScoreCap(59, '内部リンクがありません。');
  } else if (invalidInternalLinks.length > 0) {
    addFatal(
      `存在しない可能性がある内部リンクがあります: ${invalidInternalLinks.join('、')}`,
      '補助金一覧への導線は /ehime-subsidy/、検索導線は /search?keyword=... を使ってください。/subsidy-list は存在しません。'
    );
    addScoreCap(59, '存在しない可能性がある内部リンクがあります。');
  } else {
    strengths.push('内部リンクがあります。');
  }

  if (!hasProgramSpecificDetails) {
    addFatal(
      requiresExpenseDetails
        ? '対象者・対象経費・対象外になりやすい経費のいずれかが不足しています。'
        : `${PROGRAM_KIND_LABELS[programKind]}として、対象者・交付要件・算定方法または支給条件の説明が不足しています。`,
      requiresExpenseDetails
        ? '「対象になる可能性がある人」「対象になりやすい経費」「対象外・注意が必要な経費」を具体化してください。'
        : '公式ファクトに基づき、対象者、交付・支給要件、金額の算定方法、申請時期を具体化してください。'
    );
  } else {
    strengths.push(
      requiresExpenseDetails
        ? '対象者・対象経費・対象外の観点があります。'
        : `${PROGRAM_KIND_LABELS[programKind]}に必要な対象者・交付条件・算定方法の観点があります。`
    );
  }

  if (requiresExpenseDetails && !PRE_CONTRACT_RE.test(text) && !START_TIMING_RE.test(text)) {
    addFatal(
      '契約・発注・購入・着手が可能になる時点について、制度ごとの確認を促す注意がありません。',
      '公式情報で確認できない場合は、交付決定前などに発生した経費が対象外になる場合があるため、公募要領と実施機関への確認が必要と安全に書いてください。'
    );
    addScoreCap(69, '契約・発注・購入・着手が可能になる時点の注意がありません。');
  }

  if (!EHIME_CONTEXT_RE.test(text)) {
    addFatal(
      '愛媛県・市町村・地域事業者の視点が不足しています。',
      '愛媛県内の市町村、商工会議所、商工会、地域事業者向けの探し方を入れてください。'
    );
  } else {
    strengths.push('愛媛県内の読者向けの文脈があります。');
  }

  if (h2Count < 10) {
    addWarning(
      `H2が${h2Count}個です。検索意図を満たすには10個以上を目安にしてください。`,
      requiresExpenseDetails
        ? '冒頭の結論、公式ファクト、不足情報、対象者、対象経費、対象外、申請前注意、愛媛県内での探し方、内部リンク、まとめをH2で整理してください。'
        : `冒頭の結論、公式ファクト、不足情報、対象者、${PROGRAM_KIND_LABELS[programKind]}の交付・支給要件、算定方法、申請時期、愛媛県内の確認先、内部リンク、まとめをH2で整理してください。`
    );
  } else if (h2Count > 12) {
    addWarning(
      `H2が${h2Count}個あります。見出しを細分化しすぎず、10〜12個を目安に内容の近い節を統合してください。`,
      '各H2に2段落以上の具体的な説明を持たせ、薄い節の量産を避けてください。'
    );
    addScoreCap(79, 'H2が13個以上あり、見出しが細分化されすぎています。');
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

  if (titlePromisesSpecifics && !hasOfficialEvidence) {
    addFatal(
      'タイトルに具体的な条件があるのに、suppliedFacts に公式根拠がありません。',
      '補助率・上限額・年度・締切をタイトルに入れる前に、公式ファクトを構造化してください。'
    );
    addScoreCap(39, 'タイトルの具体情報に対する公式ファクトがありません。');
    titleNeedsRewrite = true;
    suggestedTitles.push(...suggestSafeTitles({ title, sourceFacts }));
  }

  if (articleType === 'single_program' || hasConcretePublicOfferingTitle) {
    const missingOfferingFields = [];
    if (!DEADLINE_DETAIL_RE.test(text) || !sourceFacts.applicationDeadline) missingOfferingFields.push('公募期間・締切');
    if (!IMPLEMENTER_RE.test(text) || !sourceFacts.administeringBody) missingOfferingFields.push('実施機関');
    if (DEADLINE_PROMISE_RE.test(title) && !ROUND_DETAIL_RE.test(text)) missingOfferingFields.push('回次');
    if (externalLinks.length === 0 || !hasOfficialEvidence) missingOfferingFields.push('公式URL・根拠メモ');
    if (!REVIEWED_DATE_RE.test(text)) missingOfferingFields.push('確認日');

    if (missingOfferingFields.some((field) => ['公募期間・締切', '実施機関', '公式URL・根拠メモ'].includes(field))) {
      addFatal(
        `具体的な公募名・制度名の記事として、${missingOfferingFields.join('、')}が不足しています。`,
        '制度名を具体的に出す場合は、表に年度、回次、実施機関、公募期間、締切、補助率、上限額、対象者、対象事業、対象経費、対象外経費、公式URL、確認日を整理してください。'
      );
      addScoreCap(49, '具体的な公募名・制度名に必要な実施機関・公募期間・公式URL・根拠メモが不足しています。');
    }
  }

  if (FS_TITLE_RE.test(`${title} ${text}`) && EQUIPMENT_CENTERED_RE.test(text) && !FS_DETAIL_RE.test(text)) {
    addFatal(
      'FS調査事業の記事なのに、本文が設備導入・購入中心の説明になっています。',
      'FS調査では、実現可能性調査、市場調査、事業化可能性、調査計画、報告書などの観点を中心に書いてください。'
    );
    addScoreCap(49, 'FS調査事業と本文内容がズレています。');
  }

  if ((DEFINITE_NUMBER_RE.test(text) || (MONEY_OR_RATE_RE.test(text) && YEAR_PROMISE_RE.test(text))) && !hasOfficialEvidence) {
    addFatal(
      '未確認の補助率・上限額・年度情報を確定情報として書いている可能性があります。',
      '公式情報で確認できない数字は断定せず、「確認が必要です」「公募要領で確認してください」と表現してください。'
    );
    addScoreCap(39, '未確認の補助率・上限額・年度情報を断定しています。');
  }

  if (unsupportedClaims.length > 0) {
    addFatal(
      `公式ファクトで裏付けられない具体的主張があります: ${unsupportedClaims.join('、')}`,
      '対象者・対象経費・対象外経費・金額・日付は、suppliedFacts にある範囲だけを書いてください。'
    );
    addScoreCap(39, '本文中に根拠不明の金額・日付・対象者・対象経費があります。');

    if (unsupportedClaims.some((claim) => /(対象者|対象業種|対象経費|対象外経費)/.test(claim))) {
      addFatal(
        '根拠のない対象者・対象経費・対象外経費が記載されています。',
        'suppliedFacts にない対象者、対象経費、対象外経費は本文から削除し、missingFacts として管理画面で確認してください。'
      );
      addScoreCap(39, '根拠のない対象者・対象経費・対象外経費があります。');
    }
  }

  if (contradictoryClaims.length > 0) {
    addFatal(
      `公式ファクトと矛盾する可能性がある主張があります: ${contradictoryClaims.join('、')}`,
      '本文の具体値を公式ファクトに合わせるか、根拠がない場合は削除してください。'
    );
    addScoreCap(29, '公式情報と矛盾する可能性がある主張があります。');
  }

  const factualGroundingScore = calculateFactualGroundingScore(factualClaims, hasOfficialEvidence);
  const highScoreRequirementsMet =
    textLength >= MIN_RECOMMENDED_ARTICLE_TEXT_LENGTH &&
    sourceCoverageScore === 100 &&
    factualGroundingScore === 100 &&
    hasProgramSpecificDetails &&
    (!requiresExpenseDetails || PRE_CONTRACT_RE.test(text) || START_TIMING_RE.test(text)) &&
    hasOfficialRoute &&
    hasOfficialEvidence &&
    EHIME_CONTEXT_RE.test(text) &&
    tableCount >= 2 &&
    hasChecklist &&
    internalLinks.length > 0 &&
    invalidInternalLinks.length === 0 &&
    CTA_RE.test(text) &&
    !MANAGEMENT_MEMO_RE.test(content) &&
    unsupportedClaims.length === 0 &&
    contradictoryClaims.length === 0 &&
    !((DEFINITE_NUMBER_RE.test(text) || MONEY_OR_RATE_RE.test(text)) && !hasOfficialEvidence);

  if (!highScoreRequirementsMet) {
    addScoreCap(89, '90点以上に必要な強条件をすべて満たしていません。');
  }

  if (!humanReviewed) {
    addScoreCap(99, '人間確認完了が確認できないため100点にはしません。');
  }

  const baseScore = Math.max(0, Math.min(100, 100 - fatalIssues.length * 12 - warnings.length * 4));
  const hardScoreCap = scoreCapValues.length ? Math.min(...scoreCapValues) : 100;
  const contentQualityScore = Math.min(baseScore, hardScoreCap);
  const qualityScore = Math.min(baseScore, sourceCoverageScore, factualGroundingScore, hardScoreCap);
  const grade = gradeFromScore(qualityScore);
  const publishAllowed =
    qualityScore >= 90 &&
    fatalIssues.length === 0 &&
    unsupportedClaims.length === 0 &&
    contradictoryClaims.length === 0 &&
    !titleNeedsRewrite &&
    hasOfficialEvidence &&
    humanReviewed;

  return {
    qualityScore,
    ruleBasedScore: qualityScore,
    sourceCoverageScore,
    factualGroundingScore,
    contentQualityScore,
    finalScore: qualityScore,
    grade,
    articleType,
    articleTypeLabel: ARTICLE_TYPE_LABELS[articleType] || articleType,
    sourceFacts: {
      ...sourceFacts,
      unknownFields: uniqueList([...sourceFacts.unknownFields, ...missingFacts]),
    },
    missingFacts: uniqueList(missingFacts),
    factualClaims,
    unsupportedClaims,
    contradictoryClaims,
    fatalIssues: uniqueList(fatalIssues),
    warnings: uniqueList(warnings),
    strengths: uniqueList(strengths),
    improvementSuggestions: uniqueList(improvementSuggestions),
    scoreCapsApplied: uniqueList(scoreCapsApplied),
    titleNeedsRewrite,
    suggestedTitles: uniqueList(suggestedTitles),
    publishAllowed,
    humanReviewed,
    llmReview: createDefaultLlmReview(),
    shouldRegenerate: fatalIssues.length > 0 || qualityScore < 80,
    shouldHumanReview: true,
  };
};

export const mergeColumnQualityReview = (aiReview, column = {}, options = {}) => {
  const machineReview = reviewColumnQuality(column, options);
  const normalizedAiReview = normalizeQualityReview(aiReview);

  if (!normalizedAiReview) return machineReview;
  const hasLlmReview = Boolean(normalizedAiReview.llmReview?.usedApi);

  // 記事生成時の自己採点は参考値にとどめる。APIレビュー未実行の0点で
  // deterministicな品質スコアが0点へ潰れないようにする。
  if (!hasLlmReview) {
    return {
      ...machineReview,
      strengths: uniqueList([...normalizedAiReview.strengths, ...machineReview.strengths]),
      improvementSuggestions: uniqueList([
        ...normalizedAiReview.improvementSuggestions,
        ...machineReview.improvementSuggestions,
      ]),
      suggestedTitles: uniqueList([
        ...normalizedAiReview.suggestedTitles,
        ...machineReview.suggestedTitles,
      ]),
      repairIterations: Math.max(0, Number(aiReview?.repairIterations || 0)),
    };
  }

  const fatalIssues = uniqueList([...normalizedAiReview.fatalIssues, ...machineReview.fatalIssues]);
  const warnings = uniqueList([...normalizedAiReview.warnings, ...machineReview.warnings]);
  const scoreCapsApplied = uniqueList([
    ...normalizedAiReview.scoreCapsApplied,
    ...machineReview.scoreCapsApplied,
  ]);
  const scoreCap = scoreCapsApplied.length
    ? Math.min(...scoreCapsApplied.map(extractCapValue))
    : 100;
  const semanticScore = normalizedAiReview.llmReview.semanticScore;
  const qualityScore = Math.min(machineReview.qualityScore, semanticScore);
  const cappedQualityScore = Math.min(qualityScore, scoreCap);
  const grade = gradeFromScore(cappedQualityScore);
  const llmReview = normalizedAiReview.llmReview?.usedApi || normalizedAiReview.llmReview?.enabled
    ? normalizedAiReview.llmReview
    : machineReview.llmReview;
  const factualClaims = [
    ...(normalizedAiReview.factualClaims || []),
    ...(machineReview.factualClaims || []),
  ];
  const unsupportedClaims = uniqueList([
    ...(normalizedAiReview.unsupportedClaims || []),
    ...(machineReview.unsupportedClaims || []),
  ]);
  const contradictoryClaims = uniqueList([
    ...(normalizedAiReview.contradictoryClaims || []),
    ...(machineReview.contradictoryClaims || []),
  ]);
  const titleNeedsRewrite = Boolean(normalizedAiReview.titleNeedsRewrite || machineReview.titleNeedsRewrite);
  const humanReviewed = Boolean(options.humanReviewed || normalizedAiReview.humanReviewed || machineReview.humanReviewed);
  const suggestedTitles = uniqueList([
    ...(normalizedAiReview.suggestedTitles || []),
    ...(machineReview.suggestedTitles || []),
  ]);
  const publishAllowed = Boolean(
    machineReview.publishAllowed &&
      fatalIssues.length === 0 &&
      unsupportedClaims.length === 0 &&
      contradictoryClaims.length === 0 &&
      !titleNeedsRewrite &&
      humanReviewed &&
      cappedQualityScore >= 90
  );

  return {
    qualityScore: cappedQualityScore,
    ruleBasedScore: machineReview.ruleBasedScore,
    sourceCoverageScore: machineReview.sourceCoverageScore,
    factualGroundingScore: machineReview.factualGroundingScore,
    contentQualityScore: machineReview.contentQualityScore,
    finalScore: cappedQualityScore,
    grade,
    articleType: machineReview.articleType,
    articleTypeLabel: machineReview.articleTypeLabel,
    sourceFacts: machineReview.sourceFacts,
    missingFacts: uniqueList([...(normalizedAiReview.missingFacts || []), ...(machineReview.missingFacts || [])]),
    factualClaims: normalizeFactualClaims(factualClaims),
    unsupportedClaims,
    contradictoryClaims,
    fatalIssues,
    warnings,
    strengths: uniqueList([...normalizedAiReview.strengths, ...machineReview.strengths]),
    improvementSuggestions: uniqueList([
      ...normalizedAiReview.improvementSuggestions,
      ...machineReview.improvementSuggestions,
    ]),
    scoreCapsApplied,
    titleNeedsRewrite,
    suggestedTitles,
    publishAllowed,
    humanReviewed,
    llmReview,
    repairIterations: Math.max(0, Number(aiReview?.repairIterations || 0)),
    shouldRegenerate:
      normalizedAiReview.shouldRegenerate ||
      machineReview.shouldRegenerate ||
      fatalIssues.length > 0 ||
      cappedQualityScore < 80,
    shouldHumanReview: true,
  };
};
