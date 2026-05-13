# AGENTS.md — えひめ補助金ポータル

## Project Overview

このプロジェクトは、愛媛県内の補助金・助成金・支援制度を検索・閲覧できるポータルサイトです。

主な機能：
- 補助金・助成金一覧
- 補助金詳細ページ
- 地域別SEOページ
- 目的別SEOページ
- 業種・目的別特集ページ
- コラム
- 管理画面
- AI自動入力・タグ付け補助
- sitemap生成

## Required Reading Before Work

UIを変更する前に、必ず以下を確認してください。

1. `DESIGN.md`
2. 必要に応じて `docs/design-references/` 配下の参考 DESIGN.md

参考ファイルの役割：

- `docs/design-references/digital-go.DESIGN.md`
  - 行政・公共サービス・アクセシビリティの参考
- `docs/design-references/cybozu.DESIGN.md`
  - 業務管理画面の参考
- `docs/design-references/smarthr.DESIGN.md`
  - 手続き・SaaS UIの参考
- `docs/design-references/nikkei.DESIGN.md`
  - メディア型トップページ・記事カードの参考

ただし、参考ファイルのデザインをそのままコピーしないでください。
このプロジェクトでは `DESIGN.md` を最優先してください。

## Priority

1. 既存機能を壊さない
2. DBカラム名・API仕様・保存処理を変更しない
3. `DESIGN.md` に従ってUIを改善する
4. npm run build が通る状態にする
5. 変更内容と理由を簡潔に報告する

## Important Data Rules

- `crawl_status` を使う。`status` に戻さない。
- 公開状態は `crawl_status = 'published'` と `is_active = true` を基本にする。
- 申請期間は `application_period_text` を基本にする。
- 公式URLは `official_url` を優先する。
- 取得元URLは `source_url` として扱う。
- Jグランツ由来データは、タイトル・地域・公式URL・申請期間などを不用意にAIで上書きしない。

## UI Rules

- 日本語本文の line-height は 1.5 以上、通常は 1.7 前後にする。
- スマホで横スクロールを出さない。
- タッチ操作ボタンは押しやすいサイズにする。
- 削除、公開、受付終了などの操作は誤操作を防ぐUIにする。
- 管理画面は情報密度を高めるが、ラベルと余白を明確にする。
- トップページ、特集ページ、コラムは「編集メディア風」の見た目にする。
- 補助金一覧・詳細は、信頼感・可読性・公式情報への導線を優先する。

## Forbidden

- DBカラム名を勝手に変更しない。
- APIレスポンス形式を勝手に変更しない。
- Supabaseのテーブル構造を勝手に前提変更しない。
- 既存の保存・公開・削除ロジックをデザイン都合で変更しない。
- 管理画面をトップページ風デザインに寄せすぎない。
- 外部サイトのデザイン、ロゴ、文言、固有レイアウトを丸写ししない。
- 秘密鍵、APIキー、`.env.production` をコミットしない。

## Commands

作業後は可能な限り以下を実行してください。

```bash
cd ehime-hojo-app
npm run build
```

## Required Workflow for Codex

UI改善・デザイン調整・画面改修を行う前に、必ず以下を実施してください。

1. この `AGENTS.md` を読む。
2. ルートの `DESIGN.md` を読む。
3. 必要に応じて `docs/design-references/` 配下の参考 DESIGN.md を読む。
4. 変更対象ファイルを確認し、既存のデータ取得・保存・公開・削除処理を把握する。
5. UI変更後は `ehime-hojo-app` で `npm run build` を実行する。

## Files and Data That Must Not Be Broken

以下はデザイン作業中でも壊してはいけません。

- 補助金検索機能
- 補助金詳細ページ
- 地域別SEOページ
- 目的別SEOページ
- 特集ページ
- コラムページ
- 管理画面の保存・公開・削除処理
- 管理画面のAI補助入力・タグ付け・公開フロー
- sitemap生成
- SEOコンポーネント

## Database and API Stability

Codexは、明示的な依頼がない限り以下を変更してはいけません。

- DBカラム名
- Supabaseテーブル構造
- APIレスポンス形式
- Edge Functionの戻り値形式
- 既存の保存payload
- 既存の公開判定ロジック

特に以下のカラム・フィールドは壊さないでください。

- `crawl_status`
- `is_active`
- `application_period_text`
- `official_url`
- `source_url`
- `region_text`
- `organization`
- `amount_text`
- `purposes`
- `industries`
- `tags`

公開中の補助金は原則として `crawl_status = 'published'` と `is_active = true` を基準に扱います。
`status` など別名へ勝手に戻してはいけません。

## Security Rules

以下はコミットしてはいけません。

- `.env`
- `.env.local`
- `.env.production`
- `.env.*.local`
- APIキー
- Supabase service role key
- OpenAI API key
- サーバーSSH情報
- 個人情報を含むログ

`.gitignore` に含まれていても、コミット前に `git status --short` で必ず確認してください。

## Design Change Scope

UI改善では、原則として既存の機能・データ構造を維持しながら見た目と使いやすさだけを改善してください。

- トップページ: 編集メディア感、導線整理、カードの見やすさを優先。
- 補助金一覧: 検索性、フィルタ、カードの可読性を優先。
- 補助金詳細: 信頼感、公式情報への導線、申請期間・対象者・金額の見やすさを優先。
- 特集ページ: SEO入口としてのH1、説明文、関連補助金の整理を優先。
- 管理画面: 業務UIとして、入力ミス防止、保存ミス防止、誤操作防止を優先。

## Prohibited UI Changes

- 画面全体を単色の緑や派手なグラデーションで覆う。
- 文字を極端に大きくし、スマホで折り返し崩れを起こす。
- 補助金カードを装飾しすぎて、申請期間・上限額・公式URLが見つけにくくなる。
- 管理画面をメディア風にしすぎて、入力・保存・公開操作を見失わせる。
- 外部サイトのデザイン、ロゴ、固有レイアウト、文言をそのまま複製する。
- SEOページで本文説明を削り、カード一覧だけにする。

## Final Report

作業完了時は、以下を簡潔に報告してください。

- 作成・変更したファイル
- 変更の目的
- `npm run build` の結果
- 未実施の確認がある場合はその理由
