export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const OPEN_ENDED_PATTERN =
  /(助成枠に達するまで|予算額に達するまで|予算に達するまで|予算枠に達し次第|予算上限に達し次第|上限に達するまで|定員に達し次第|達し次第|なくなり次第|予算がなくなり次第|随時|常時|通年|期間の定めなし)/;

export const CLOSED_PATTERN =
  /(受付終了|募集終了|公募終了|終了しました|募集は終了|受付は終了|申請受付を終了|終了いたしました)/;

export const PERIOD_LABEL_PATTERN =
  /(募集期間|申請期間|受付期間|公募期間|申請期限|受付期限|提出期限|募集期限|締切|締め切り|応募期間|応募期限)/;

export const APPLICATION_PERIOD_HINT_PATTERN =
  /(申請|受付|提出|応募|募集|公募|締切|締め切り|期限|申込|申し込み|請求|手続|電子申請|郵送|窓口)/;

export const NOT_APPLICATION_PERIOD_PATTERN =
  /(対象児童|給付対象者|支給対象者|対象者|対象となる児童|対象となる方|対象となる世帯|出生|生まれ|生年月日|新生児|児童|こども|子ども|児童手当|住民登録|受給者|給付対象|支給対象|給付額|支給額|年齢|扶養|所得|世帯|令和\d+年\d+月分)/;

export const AMOUNT_LABEL_PATTERN =
  /(補助額|助成額|補助金額|助成金額|補助上限|上限額|限度額|補助限度額|助成限度額|交付額|補助対象額|1事業者あたり|一事業者あたり|給付額|支給額)/;

export const RATE_LABEL_PATTERN =
  /(補助率|助成率|補助割合|助成割合|負担割合|補助対象経費の|対象経費の)/;

export const ENTITY_LABEL_PATTERN =
  /(対象者|対象事業者|補助対象者|助成対象者|申請者|応募対象|対象となる方|対象企業|中小企業者|事業者の要件|給付対象者|支給対象者)/;

export const EXPENSE_LABEL_PATTERN =
  /(対象経費|補助対象経費|助成対象経費|対象となる経費|補助対象事業|助成対象事業|対象事業|取組内容|対象となる取組)/;

export const EXPENSE_QUALITY_PATTERN =
  /(経費|費用|事業|取組|取り組み|購入|導入|委託|工事|設備|システム|改修|削減|削減策|支援|開発|広告|広報|旅費|人件費|材料|備品|機器|調査|設計|施工|販路|研修|認証|検査|試験|製作|制作|印刷|出展)/;

export const ENTITY_QUALITY_PATTERN =
  /(事業者|法人|個人事業主|中小企業|小規模|団体|農業者|漁業者|林業者|県内|市内|町内|本店|支店|営業所|店舗|施設|事務所|組合|会社|企業|創業者|生産者|世帯|保護者|児童|子ども|こども|受給者)/;

export const URL_PATTERN = /https?:\/\/[^\s"'<>）)]+/g;

export const EHIME_MUNICIPALITY_BY_HOST: Record<string, string> = {
  "city.matsuyama.ehime.jp": "松山市",
  "city.imabari.ehime.jp": "今治市",
  "city.uwajima.ehime.jp": "宇和島市",
  "city.yawatahama.ehime.jp": "八幡浜市",
  "city.niihama.lg.jp": "新居浜市",
  "city.niihama.ehime.jp": "新居浜市",
  "city.saijo.ehime.jp": "西条市",
  "city.ozu.ehime.jp": "大洲市",
  "city.iyo.lg.jp": "伊予市",
  "city.iyo.ehime.jp": "伊予市",
  "city.shikokuchuo.ehime.jp": "四国中央市",
  "city.seiyo.ehime.jp": "西予市",
  "city.toon.ehime.jp": "東温市",

  "town.kamijima.lg.jp": "上島町",
  "kumakogen.jp": "久万高原町",
  "town.kumakogen.ehime.jp": "久万高原町",
  "town.masaki.ehime.jp": "松前町",
  "town.tobe.ehime.jp": "砥部町",
  "town.uchiko.ehime.jp": "内子町",
  "town.ikata.ehime.jp": "伊方町",
  "town.matsuno.ehime.jp": "松野町",
  "town.kihoku.ehime.jp": "鬼北町",
  "town.ainan.ehime.jp": "愛南町",
};

export const IMPORTANT_WORDS = [
  "補助金",
  "助成金",
  "補助事業",
  "助成事業",
  "給付金",
  "手当",
  "公募",
  "募集",
  "申請",
  "対象",
  "補助対象",
  "補助率",
  "補助額",
  "給付額",
  "支給額",
  "限度額",
  "上限",
  "受付",
  "期間",
  "締切",
  "要領",
  "交付",
  "事業者",
  "愛媛県",
  "松山市",
];

export const NOISE_PATTERNS = [
  /^!\[.*?\]\(.*?\)$/i,
  /logo\.png/i,
  /search_title\.png/i,
  /JavaScriptが無効/i,
  /文字の大きさ/i,
  /背景色/i,
  /音声読み上げ/i,
  /^検索$/i,
  /サイトマップ/i,
  /ページの先頭/i,
  /本文へ/i,
  /閲覧支援/i,
  /アクセシビリティ/i,
  /新型コロナウイルス/i,
  /職員採用/i,
  /まじめえひめ/i,
  /みきゃん/i,
  /愛媛県庁公式ホームページ/i,
  /愛媛県公式ホームページ/i,
  /Foreign Language/i,
  /Googleカスタム検索/i,
  /現在地/i,
  /トップページ/i,
  /組織で探す/i,
  /分野で探す/i,
  /目的で探す/i,
  /カレンダーで探す/i,
  /更新日：/i,
  /印刷用ページ/i,
  /Tweet/i,
  /LINEで送る/i,
  /Facebook/i,
  /Xでポスト/i,
];