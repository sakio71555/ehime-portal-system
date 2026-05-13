# DESIGN.md — えひめ補助金ポータル

> このファイルは、Codex が「えひめ補助金ポータル」のUIを実装・修正するときに参照するデザイン仕様書です。
> 目的は、愛媛県の補助金・助成金情報を、信頼感のある専門メディアとして見せることです。
> 外部サイトのデザインをそのまま複製せず、行政情報・補助金情報・編集メディア感を組み合わせた独自UIにしてください。

---

## 1. Visual Theme & Atmosphere

### Design Direction

えひめ補助金ポータルは、愛媛県内の補助金・助成金・支援制度を探せる情報サイトです。

単なる検索サイトではなく、以下のような印象を目指します。

- 愛媛県の事業者向け補助金情報を整理して届ける専門メディア
- 自治体・Jグランツ・公式公募ページの情報をわかりやすく確認できるポータル
- 初めて補助金を探す人にも迷わず使える、やさしい行政情報サイト
- 検索・一覧・特集・コラムが自然につながる編集型サイト

### Atmosphere

- **信頼感**: 行政・公的情報を扱うため、誠実で落ち着いた見た目にする。
- **専門感**: 補助金・助成金に特化した情報メディアとして、見出しやカード構成を整理する。
- **読みやすさ**: 日本語本文の行間・余白を広めに取り、長い補助金名でも読みやすくする。
- **編集メディア感**: トップページ・特集ページ・コラムは、記事メディアのような構成にする。
- **業務UIの正確さ**: 管理画面は装飾よりも入力ミス防止・保存ミス防止を優先する。

### Keywords

- Reliable
- Public Service
- Editorial Media
- Clean
- Readable
- Local Business Support
- Ehime

---

## 2. Color Palette & Roles

### Primary Colors

- **Primary** (`#0f7b6c`)
  - ブランドカラー。
  - 公募中ラベル、主要ボタン、タグ、重要リンクに使用。
  - 使いすぎると行政感が弱くなるため、アクセントとして使用する。

- **Primary Dark** (`#084a55`)
  - ヘッダー、濃いCTA、ホバー状態に使用。
  - トップページの強調導線、検索ボタンなどに使用可。

- **Primary Soft** (`#ecfdf5`)
  - タグ背景、薄い強調エリア、補助的なカード背景に使用。

### Accent Colors

- **Official Orange** (`#e76305`)
  - 公式サイトへ移動するボタン専用。
  - 「公式ページで確認する」「公式サイトへ」など、外部公式情報へのCTAに使う。
  - 通常の装飾には多用しない。

- **Highlight Yellow** (`#facc15`)
  - 新機能、注目、注意喚起、小さなラベルに使用。
  - 大面積では使わない。

### Semantic Colors

- **Success** (`#0f7b6c`)
  - 公募中、公開済み、保存成功。

- **Warning** (`#f59e0b`)
  - 予告、要確認、入力不足の注意。

- **Danger** (`#dc2626`)
  - 受付終了、削除、エラー、危険操作。

- **Muted** (`#9ca3af`)
  - 受付終了、無効、非アクティブ、補足。

### Neutral Colors

- **Text Primary** (`#111827`)
  - ページ見出し、カードタイトル、重要本文。

- **Text Secondary** (`#374151`)
  - 通常本文、フォーム入力値。

- **Text Body** (`#4b5563`)
  - 説明文、補助本文。

- **Text Muted** (`#6b7280`)
  - 補足、注意書き、メタ情報。

- **Text Disabled** (`#9ca3af`)
  - 無効状態、終了済み。

- **Border** (`#e5e7eb`)
  - 通常の罫線。

- **Border Strong** (`#d1d5db`)
  - 入力欄、重要な区切り。

- **Background** (`#f9fafb`)
  - ページ背景。

- **Surface** (`#ffffff`)
  - カード、フォーム、記事本文面。

- **Subtle Surface** (`#f8fafc`)
  - 薄い情報ボックス、金額表示エリア。

### Usage Rules

- 緑はブランドカラーだが、画面全体を緑にしすぎない。
- オレンジは公式ページCTAに限定する。
- 赤は削除・エラー・受付終了など意味がある場合だけ使う。
- 背景は白を基本にし、薄いグレーで情報の層を作る。
- 黒文字中心の編集メディア感を重視する。

---

## 3. Typography Rules

### 3.1 Japanese Font

基本の和文フォントは以下を使用する。

```css
font-family:
  "Noto Sans JP",
  "Hiragino Kaku Gothic ProN",
  "Hiragino Sans",
  Meiryo,
  sans-serif;
```

### 3.2 Latin Font

英字ラベルやUI補助テキストでは以下を使用してよい。

```css
font-family:
  "Inter",
  "Helvetica Neue",
  Arial,
  sans-serif;
```

### 3.3 Monospace Font

コード、ID、ログ、管理用の技術的表示では以下を使用する。

```css
font-family:
  "SFMono-Regular",
  Consolas,
  Menlo,
  monospace;
```

### 3.4 Type Scale

| Role | Size | Weight | Line Height | Letter Spacing | 用途 |
|------|------|--------|-------------|----------------|------|
| Display | 40px–48px | 800 | 1.25 | 0 | トップページHERO |
| Heading 1 | 28px–36px | 800 | 1.35 | 0 | ページタイトル |
| Heading 2 | 22px–28px | 800 | 1.4 | 0.01em | セクション見出し |
| Heading 3 | 18px–22px | 700 | 1.45 | 0.01em | カード見出し |
| Body | 15px–16px | 400 | 1.7–1.8 | 0.02em | 本文 |
| Caption | 12px–13px | 400 | 1.6 | 0.02em | 補足・注釈 |
| Label | 12px–13px | 700 | 1.4 | 0.08em–0.14em | 英字セクションラベル |

### 3.5 Practical Typography Mapping

#### TopPage.jsx

- HERO見出し: Display
- セクション見出し: Heading 2
- 特集カードタイトル: Heading 3
- 特集カード説明: Body
- 英字セクション名: Label

#### SubsidyCard.jsx

- 補助金タイトル: Heading 3
- 概要文: Body
- 申請期間・地域・金額ラベル: Caption
- タグ: Caption / Label

#### SubsidyDetail.jsx

- 補助金名: Heading 1
- 「制度の概要」「対象事業者」など: Heading 2 / Heading 3
- 本文: Body
- 注意書き: Caption

#### Feature Pages

- ページタイトル: Heading 1
- 説明文: Body
- カードタイトル: Heading 3
- 関連リンク: Caption / Body

#### Admin Pages

- ラベル: Caption / Label
- 入力値: Body
- ボタン: Caption / Body
- 注意文: Caption

### 3.6 Line Height Rules

- 日本語本文は `line-height: 1.7` を標準にする。
- 長文説明は `line-height: 1.75` 以上を許可する。
- 管理画面でも `line-height: 1.5` 未満にしない。
- 見出しは `line-height: 1.25〜1.45` の範囲で調整する。
- 補助金名は長くなるため、窮屈に見えない行間にする。

### 3.7 Letter Spacing Rules

- 日本語本文は `letter-spacing: 0.02em` を基本にする。
- 大きな見出しでは `letter-spacing: 0` でもよい。
- 英字ラベルは `letter-spacing: 0.08em〜0.14em` を使い、メディア感を出す。
- ボタンやタグで過度な字間を使わない。

### 3.8 Text Wrapping

長い補助金名・自治体名・URLでレイアウトが壊れないようにする。

```css
line-break: strict;
overflow-wrap: break-word;
word-break: break-word;
```

補助金カードのタイトルは原則3行まで。

```css
display: -webkit-box;
-webkit-line-clamp: 3;
-webkit-box-orient: vertical;
overflow: hidden;
```

### 3.9 Prohibited Typography

- 日本語本文で `line-height: 1.2` 以下を使わない。
- 全体の本文を12px以下にしない。
- 補助金名を1行固定にしすぎない。
- 英字フォントだけを指定して日本語フォールバックを欠落させない。
- 長いテキストを `white-space: nowrap` で無理に固定しない。

---

## 4. Component Stylings

### 4.1 Buttons

#### Primary Button

用途：
- 検索
- 詳細ページを見る
- 特集を見る
- 主要CTA

```css
background-color: #0f7b6c;
color: #ffffff;
border: none;
border-radius: 8px;
font-weight: 700;
```

Hover:

```css
background-color: #084a55;
```

#### Official Button

用途：
- 公式サイトへ
- 公式ページで確認する

```css
background-color: #e76305;
color: #ffffff;
border: none;
border-radius: 8px;
font-weight: 700;
```

このボタンは公式ページ遷移以外には使わない。

#### Secondary Button

用途：
- 一覧へ戻る
- 補助導線
- 絞り込み解除

```css
background-color: #ffffff;
color: #0f7b6c;
border: 1px solid #0f7b6c;
border-radius: 8px;
font-weight: 700;
```

#### Danger Button

用途：
- 削除
- 取り消し不能な操作

```css
background-color: #dc2626;
color: #ffffff;
border: none;
border-radius: 8px;
font-weight: 700;
```

削除ボタンは必ず確認ダイアログを伴う。

### 4.2 Inputs

```css
background-color: #ffffff;
border: 1px solid #d1d5db;
border-radius: 6px;
padding: 10px 12px;
font-size: 14px;
line-height: 1.5;
color: #1f2937;
```

Focus:

```css
border-color: #0f7b6c;
box-shadow: 0 0 0 3px rgba(15, 123, 108, 0.12);
outline: none;
```

Missing / Required Alert:

```css
background-color: #fee2e2;
border-color: #fca5a5;
```

### 4.3 Cards

#### Media Card

トップページ、コラム、特集で使用する。

```css
background-color: #ffffff;
border: 1px solid #e5e7eb;
border-radius: 10px;
padding: 24px;
box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
```

Hover:

```css
transform: translateY(-2px);
box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
```

#### Subsidy Card

補助金一覧・新着補助金・注目補助金に使用する。

必須表示要素：

- 公募ステータス
- 補助金名
- 地域
- 実施機関
- 申請期間
- 上限金額
- 関連タグ
- 詳細ページ導線
- 公式サイト導線

補助金カードでは、情報を詰め込みすぎず、タイトル・申請期間・金額の優先順位を高くする。

#### Feature Card

業種別・目的別の特集ページ導線に使用する。

要素：

- アイコンまたは絵文字
- 特集タイトル
- 短い説明文
- 「特集を見る」導線

トップページでは3カード固定表示を基本とする。

#### Admin Form Card

管理画面では、装飾よりも入力しやすさを優先する。

```css
background-color: #ffffff;
border: 1px solid #e5e7eb;
border-radius: 12px;
padding: 24px;
```

---

## 5. Layout Principles

### 5.1 Container

- 通常コンテナ幅: `1120px〜1200px`
- 記事・詳細ページ幅: `760px〜860px`
- 管理画面幅: 既存仕様を優先
- 横余白:
  - Desktop: `24px〜32px`
  - Mobile: `16px`

### 5.2 Spacing Scale

| Token | Value | 用途 |
|-------|-------|------|
| XS | 4px | アイコン間隔 |
| S | 8px | ラベル・小要素 |
| M | 16px | フォーム内余白 |
| L | 24px | カード内余白 |
| XL | 40px | セクション内余白 |
| XXL | 64px | セクション間余白 |
| XXXL | 88px | 大きな区切り |

### 5.3 Section Spacing

トップページ・特集ページでは、セクションごとに十分な余白を取る。

```css
margin-bottom: 64px;
```

HERO後やフッター前は `80px〜96px` の余白を許可する。

### 5.4 Grid

Desktop:

```css
grid-template-columns: repeat(3, minmax(0, 1fr));
gap: 24px;
```

Tablet:

```css
grid-template-columns: repeat(2, minmax(0, 1fr));
gap: 20px;
```

Mobile:

```css
grid-template-columns: 1fr;
gap: 16px;
```

### 5.5 Responsive Layout

- スマホではカードは1カラム。
- 横スクロール前提のUIは禁止。
- 補助金カードのタイトルは3行まで。
- 重要ボタンは44px以上の高さを確保する。
- 特集カードは縦並びにする。
- フォームは2カラムから1カラムへ落とす。

---

## 6. Depth & Elevation

| Level | Shadow | 用途 |
|-------|--------|------|
| 0 | none | フラットなカード |
| 1 | `0 1px 2px rgba(15, 23, 42, 0.05)` | 通常カード |
| 2 | `0 8px 20px rgba(15, 23, 42, 0.08)` | ホバー・注目カード |
| 3 | `0 16px 40px rgba(15, 23, 42, 0.12)` | モーダル・重要ダイアログ |

強い影を多用しない。  
編集メディア風のため、基本は白背景・罫線・余白で階層を作る。

---

## 7. Page-Specific Guidelines

### 7.1 Top Page

トップページは「補助金検索サイト」ではなく「補助金専門メディア」として見せる。

推奨セクション：

1. HERO
2. FEATURE
3. EDITORS' PICKS
4. NEW SUBSIDIES
5. DEADLINE SOON
6. COLUMNS
7. CATEGORY

#### HERO

必須要素：

- 大きな見出し
- サブコピー
- 検索ボックス
- 人気キーワードリンク

見出し例：

```txt
愛媛県の補助金・助成金を探す
```

サブコピー例：

```txt
事業者向けの補助金・助成金・支援制度を、地域・目的・業種から探せます。
```

#### Section Labels

英字ラベルを使って編集メディア感を出す。

例：

- FEATURE
- EDITORS' PICKS
- NEW SUBSIDIES
- DEADLINE SOON
- COLUMNS
- CATEGORY

### 7.2 Search / Listing Page

補助金一覧は検索性を優先する。

- 絞り込み条件がわかりやすいこと。
- 補助金カードのタイトルが読みやすいこと。
- 公募ステータスが一目でわかること。
- 申請期間・上限金額・地域がすぐ確認できること。
- 公式サイトへ行く前に、詳細ページへ誘導すること。

### 7.3 Subsidy Detail Page

補助金詳細ページは信頼性を重視する。

必須要素：

- 補助金名
- 公募ステータス
- 地域
- 実施機関
- 補助上限額・補助率
- 制度の概要
- 対象事業者
- 対象経費
- 申請期間
- 関連キーワード
- 公式ページCTA
- AI整理情報であることの注意書き

注意：

- 「制度の概要」は省略しない。
- 申請前に公式ページ確認を促す。
- 公式URLがない場合は、無理にボタンを表示しない。

### 7.4 Feature Pages

特集ページはSEO入口として設計する。

例：

- `/feature/construction`
- `/feature/restaurant-retail`
- `/feature/startup-digital`

必須要素：

- SEO向けH1
- 300〜600文字程度の説明文
- 対象になりやすい事業者の説明
- 関連補助金一覧
- 目的別・地域別への内部リンク
- 公式情報確認の注意書き

### 7.5 Columns

コラムは記事メディア風にする。

- タイトルを大きくする。
- 本文は読みやすい行間にする。
- 関連補助金への内部リンクを置く。
- カテゴリ・公開日を表示する。
- 補助金初心者向けの記事はわかりやすさを優先する。

### 7.6 Admin Pages

管理画面は業務UIとして扱う。

優先順位：

1. 入力ミス防止
2. 保存漏れ防止
3. 公開・非公開の状態確認
4. AI自動入力による上書き事故防止
5. 削除など危険操作の防止

ルール：

- 管理画面はトップページ風にしすぎない。
- 情報密度は高くてよい。
- ただし、ラベル・余白・警告表示は明確にする。
- 削除、公開、受付終了などは誤操作を防ぐ。
- 申請期間が空欄の場合は確認導線を出してよい。
- AI自動入力では、既存の正しい値を壊さない。

---

## 8. Do's and Don'ts

### Do

- 日本語本文は読みやすい行間にする。
- 補助金名が長い前提でUIを作る。
- 申請期間・金額・地域・実施機関は見つけやすくする。
- 公式URLへの導線は明確にする。
- トップページは編集メディア風にする。
- 特集ページはSEO入口として作る。
- 地域別・目的別・業種別ページを内部リンクでつなぐ。
- Search Consoleを意識し、noindexやcanonicalを不用意に変更しない。
- スマホで見ても使いやすくする。
- 管理画面では、保存・公開・削除の意味を明確にする。

### Don't

- 外部サイトのデザインを丸写ししない。
- DBカラム名を勝手に変更しない。
- APIレスポンス形式を勝手に変更しない。
- `status` と `crawl_status` を混同しない。
- Supabaseのテーブル構造を勝手に変えない。
- 管理画面の保存・公開・削除ロジックをデザイン都合で変更しない。
- 公式サイトボタン以外でオレンジを多用しない。
- 日本語本文で `line-height: 1.2` 以下を使わない。
- 12px未満の本文を多用しない。
- スマホで横スクロールが出るUIを作らない。
- sitemap、robots、SEOコンポーネントを理由なく変更しない。
- `.env.production` やAPIキーをコミットしない。

---

## 9. Responsive Behavior

### Breakpoints

| Name | Width | 方針 |
|------|-------|------|
| Mobile | ≤ 640px | 1カラム、余白16px |
| Tablet | 641px–960px | 2カラム中心 |
| Desktop | > 960px | 3カラム・広め余白 |

### Mobile Rules

- HERO見出しは32px前後まで縮小する。
- 補助金カードは1カラム。
- 特集カードは1カラム。
- 検索ボックスは横並びにしない。
- ボタンは最低44px程度の高さを確保する。
- 長い補助金名は3行まで表示する。
- 公式URLや取得元URLは折り返す。
- 管理画面の2カラムフォームは1カラムに落とす。

### Touch Target

- 主要ボタンは高さ44px以上を目安にする。
- 小さな補助ボタンも、クリックしやすい余白を確保する。

---

## 10. Accessibility Guidelines

- 色だけで状態を伝えない。
- 公募中・受付終了などはテキストでも表示する。
- ボタンには意味がわかる文言を入れる。
- 外部リンクは `target="_blank"` の場合 `rel="noopener noreferrer"` を付ける。
- 重要な画像・アイコンには補助テキストを用意する。
- フォーカス状態を消さない。
- コントラストの低い薄グレー文字を本文に使わない。
- フォーム入力欄にはラベルを付ける。
- エラー・警告は赤や黄色だけでなく文言でも説明する。

---

## 11. SEO UI Guidelines

### Top Page

- 内部リンクを十分に置く。
- 特集ページ、地域別ページ、目的別ページへ誘導する。
- 検索ボックスだけに依存しない。

### Area Pages

- H1に市町村名を含める。
- 説明文に「補助金・助成金・支援制度」を含める。
- その地域の補助金一覧を表示する。
- 近隣地域や目的別ページへのリンクを置く。

### Purpose Pages

- H1に目的名を含める。
- 例: 創業、省エネ、IT導入、設備投資、販路開拓。
- 関連補助金を一覧表示する。
- 関連特集・関連コラムへリンクする。

### Feature Pages

- 業種・目的の検索意図を満たす説明文を入れる。
- 補助金カードを並べるだけにしない。
- 「このような事業者におすすめ」の説明を入れる。
- 関連目的ページや地域ページへ内部リンクを置く。

### Detail Pages

- title、description、canonicalを適切に設定する。
- noindexを不用意に出さない。
- 存在する公開ページは index,follow を基本にする。
- 404相当のページだけ noindex を検討する。
- 公式ページへの導線を明確にする。

---

## 12. Data and Logic Safety

UI変更時に以下を変更しない。

### DB Columns

- `crawl_status`
- `is_active`
- `application_status`
- `application_period_text`
- `application_start_date`
- `application_end_date`
- `official_url`
- `source_url`
- `source_type`
- `source_external_id`
- `purposes`
- `industries`
- `tags`

### Important Rules

- 公開判定は基本的に `crawl_status = 'published'` と `is_active = true`。
- `status` には戻さない。
- Jグランツ由来データは、AIで不用意に確定項目を上書きしない。
- 申請期間は推測で作らない。
- 公式URLがある場合は公式URLを優先する。
- 取得元URLは管理・追跡用として扱う。

---

## 13. Agent Prompt Guide

### Quick Reference

```txt
Primary Color: #0f7b6c
Primary Dark: #084a55
Accent Orange: #e76305
Text Primary: #111827
Text Body: #4b5563
Muted Text: #6b7280
Background: #f9fafb
Surface: #ffffff
Border: #e5e7eb
Font: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif
Body Size: 15px-16px
Body Line Height: 1.7-1.8
Container Width: 1120px-1200px
Editorial Section Gap: 64px-88px
```

### Standard Codex Instruction

CodexにUI作業を依頼するときは、以下を前提にする。

```txt
AGENTS.md と DESIGN.md を読んでから作業してください。
UI変更では DESIGN.md を最優先の見た目ルールとして使ってください。
ただし、DBカラム名、API仕様、保存・公開・削除ロジックは変更しないでください。
npm run build が通る状態にしてください。
```

### Top Page Improvement Prompt

```txt
AGENTS.md と DESIGN.md に従って、トップページを編集メディア風に改善してください。
白背景、黒文字中心、緑アクセント、広めの余白、英字セクションラベルを使ってください。
既存の検索機能、補助金詳細ページ、管理画面は壊さないでください。
```

### Admin UI Prompt

```txt
AGENTS.md と DESIGN.md に従って、管理画面のUIを改善してください。
ただし、保存処理、公開処理、削除処理、AI自動入力処理、DBカラム名は変更しないでください。
入力ミス防止、見落とし防止、誤操作防止を優先してください。
```

### Feature Page Prompt

```txt
AGENTS.md と DESIGN.md に従って、特集ページを改善してください。
SEO入口ページとして、H1、説明文、関連補助金、関連リンクを整理してください。
カードを並べるだけではなく、その業種・目的向けの説明を入れてください。
```

---

## 14. Implementation Notes

### Recommended Shared Tokens

将来的には以下のような共通ファイルを作ってもよい。

```txt
ehime-hojo-app/src/designTokens.js
```

例：

```js
export const colors = {
  primary: '#0f7b6c',
  primaryDark: '#084a55',
  officialOrange: '#e76305',
  textPrimary: '#111827',
  textBody: '#4b5563',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  background: '#f9fafb',
  surface: '#ffffff',
};

export const typography = {
  display: {
    fontSize: '44px',
    fontWeight: 800,
    lineHeight: 1.25,
    letterSpacing: '0',
  },
  h1: {
    fontSize: '32px',
    fontWeight: 800,
    lineHeight: 1.35,
    letterSpacing: '0',
  },
  h2: {
    fontSize: '26px',
    fontWeight: 800,
    lineHeight: 1.4,
    letterSpacing: '0.01em',
  },
  h3: {
    fontSize: '20px',
    fontWeight: 700,
    lineHeight: 1.45,
    letterSpacing: '0.01em',
  },
  body: {
    fontSize: '15px',
    fontWeight: 400,
    lineHeight: 1.75,
    letterSpacing: '0.02em',
  },
  caption: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: '0.02em',
  },
  label: {
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: '0.12em',
  },
};
```

ただし、既存コードが大きく崩れる場合は無理に共通化しない。
まずは既存UIを壊さず、段階的に適用する。

---

## 15. Final Checklist for UI Changes

UI変更後は以下を確認する。

- `npm run build` が成功する。
- トップページがPC・スマホで崩れていない。
- 補助金一覧が表示される。
- 補助金詳細ページに遷移できる。
- 公式サイトボタンが動く。
- 管理画面の保存・公開・削除が壊れていない。
- noindexが不要な公開ページに出ていない。
- sitemapやSEO関連を不用意に壊していない。
- `.env.production` や秘密情報をコミットしていない。