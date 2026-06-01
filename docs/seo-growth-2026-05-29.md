# SEO改善 第2フェーズメモ

日付: 2026-05-29

## 目的

Search Consoleで表示回数が伸びているクエリを、検索結果URLではなく固定LP・基礎コラムで受け止める。
CTRが低いページは、title / meta description とページ冒頭の意図をより検索語に合わせて改善する。

## 今回実施した変更

### 地域別LP追加

既存の地域LPに加えて、以下の固定URLを追加した。

- `/area/uwajima`
- `/area/seiyo`
- `/area/yawatahama`
- `/area/saijo`

既存の以下LPも、給付金系クエリを受け止めやすいように title / description へ「給付金」を追加した。

- `/area/matsuyama`
- `/area/imabari`
- `/area/niihama`

判断理由:

- Search Console上では、市町村名 + 給付金 / 補助金 / 令和年度系のクエリが出やすい。
- `/search?keyword=...` は noindex 対象のため、検索流入を狙うURLとして固定LPを増やす必要がある。

### 目的別LP追加

以下の固定URLを追加した。

- `/purpose/benefits`
- `/purpose/childcare`
- `/purpose/housing`

判断理由:

- 「給付金」「子育て」「医療費助成」「住宅改修」「空き家」「移住」など、個人向け・暮らし向けの検索語を固定LPで受け止めるため。
- 通常検索結果ページではなく、説明文と関連補助金一覧を持つLPとしてGoogleに見せる。

### 給付金・補助金・助成金系コラム追加

DBに依存しない基礎コラムとして、以下を追加した。

- `/column/kyufukin-hojokin-joseikin-chigai`
- `/column/ehime-subsidy-application-first-step`
- `/column/subsidy-official-info-checkpoints`

判断理由:

- 「給付金 補助金 助成金 違い」「補助金 申請 手順」「補助金 公式ページ 確認」など、制度探索前の情報収集クエリを受け止める。
- 補助金詳細ページだけでは拾いにくい、基礎知識系ロングテールを増やす。

## sitemap方針

今回追加した固定LPと基礎コラムは sitemap 対象にする。

引き続き除外するURL:

- `/search`
- `/search?keyword=...`
- `/search?keyword={search_term_string}`
- 任意の検索結果・絞り込みURL

理由:

- 検索結果ページは重複・低品質になりやすいため、`noindex,follow` のままにする。
- sitemapには、Googleに正規URLとして見せたい固定ページだけを含める。

## Search Consoleで見る項目

### 表示回数が多いクエリ

優先して見る条件:

- 表示回数が多い
- 平均掲載順位が 5〜20 位前後
- CTRが低い
- 検索意図が固定LPまたは基礎コラムで受け止められる

見るべき例:

- 市町村名 + 給付金
- 市町村名 + 補助金
- 愛媛 + 補助金 + 業種
- 愛媛 + 助成金 + 子育て
- 補助金 + 助成金 + 違い

### CTRが低いページ

改善観点:

- titleに検索語が自然に入っているか
- meta descriptionで対象者・地域・申請期間・公式確認が伝わるか
- ページ冒頭で「誰向けのページか」が明確か
- 検索結果ページではなく固定LPへ誘導できているか

### インデックス未登録ページ

確認観点:

- sitemapに入れるべきURLか
- noindex対象ではないか
- 検索結果URLや重複URLではないか
- コンテンツが薄すぎないか
- 補助金詳細ページなら公開中・重複なし・公式URLありか

## 未対応事項

- Search Consoleの実データCSVを使ったクエリ別改善表の作成。
- CTRが低い具体ページごとの title / description 個別リライト。
- `/area/ozu`, `/area/shikokuchuo`, `/area/tobe`, `/area/uchiko`, `/area/ainan` などの追加検討。
- 固定LPの本文量をさらに増やし、関連市町村・関連目的への内部リンクを追加する。
- 給付金・補助金・助成金系コラムの追加テーマ拡張。

## 次にやること

1. Search ConsoleからクエリCSVをエクスポートする。
2. 表示回数上位かつCTR低めのクエリを抽出する。
3. 固定LPで受け止めるもの、コラムで受け止めるもの、補助金詳細のtitle/meta改善で対応するものに分類する。
4. インデックス未登録ページを「問題なし」「noindex対象」「改善対象」に分類する。

---

## 2026-05-29 Search Consoleクエリ対応 第2.1フェーズ

### 対象にしたクエリ

Search Consoleの検索パフォーマンスで、以下のような表示回数・クリックが確認できた。

- `今治市 給付金 最新 令和8年`
- `今治市 給付金 2026`
- `久万高原町 暮らし応援商品券`
- `久万高原町 商品券`
- `非課税世帯 給付金`
- `子育て支援金`

### 実施した変更

- `/area/imabari` のtitle / descriptionを、2026年・令和8年・給付金系クエリを受け止めやすい内容に強化した。
- `/area/kumakogen` を追加し、久万高原町の商品券・給付金・補助金系クエリの固定LPとして使えるようにした。
- `/purpose/benefits` を、非課税世帯・商品券・物価高騰対策・給付金系の検索意図に寄せて強化した。
- `/purpose/childcare` を、子育て支援金・子ども医療・ひとり親・不妊治療などの個人向け助成の検索意図に寄せて強化した。
- 静的SEOコラムとして以下を追加した。
  - `/column/imabari-kyufukin-hojokin-guide`
  - `/column/hikazei-setai-kyufukin-check`
  - `/column/ehime-childcare-support-guide`

### SEO上の判断

`/search?keyword=...` は引き続き `noindex,follow` とし、Googleに固定URLとして見せない。検索クエリを受け止めるURLは、地域別LP、目的別LP、静的コラムへ寄せる。

今回の追加URLは、検索結果ページではなく、説明文と関連補助金一覧または基礎解説を持つ固定ページとしてsitemap対象にする。

### Search Consoleで次に確認すること

ブラウザ操作は行わず、Search Console上では手動で以下を確認する。

1. 「検索パフォーマンス」で対象クエリをクリックする。
2. 「ページ」タブで、表示されているURLを確認する。
3. `/search?keyword=...` が残っている場合は、noindex反映待ちとして扱う。
4. `/area/imabari`、`/area/kumakogen`、`/purpose/benefits`、`/purpose/childcare`、追加コラムが表示対象に入ってくるかを継続観察する。
5. CTRが低い固定LPは、title / description / 冒頭説明を追加で調整する。

### 未対応事項

- Search ConsoleのクエリCSVを使った一覧表化。
- 久万高原町以外の町村LP追加。
- 給付金・子育て系コラムのさらなる拡張。
- 固定LP本文のさらなる長文化と内部リンク強化。

---

## 2026-06-01 Search Console URL分類ヘルパー

Search Consoleの「ページがインデックスに登録されない新しい要因」は、件数だけでは優先順位を誤りやすい。実URLをCSVでエクスポートし、URLパターン単位で分類してから、NotFound/404、301正規化、prerender/SSG、canonical調整のどれを先に行うか判断する。

### CSVを分類する目的

- `/subsidy/`、`/column/`、`/area/`、`/feature/` など、未登録理由の主対象を実URLベースで確認する。
- 末尾スラッシュ、`http://`、`www`、`/index.html`、二重スラッシュ、クエリ付きURLが多いかを確認する。
- 存在しないURLらしきものや画像/静的アセットが混ざっていないかを確認する。
- 推測ではなく、Search Consoleのエクスポート結果を元に次フェーズの作業順を決める。

### 使い方

Search Consoleから対象レポートのURL一覧をCSVでエクスポートし、以下を実行する。

```bash
node scripts/classify-search-console-urls.mjs search-console-pages.csv
```

詳細結果を残す場合:

```bash
node scripts/classify-search-console-urls.mjs search-console-pages.csv --out classified-search-console-urls.csv --format csv
node scripts/classify-search-console-urls.mjs search-console-pages.csv --out classified-search-console-urls.json
```

スクリプトは `URL`、`url`、`Page`、`ページ`、`対象URL` の列名をURL列として扱う。URL列が見つからない場合はエラーで終了する。

### 分類後の判断

- `/subsidy/` が多い場合は、補助金詳細ページのprerender/SSG、初期HTML、データなし404相当化を優先する。
- `/column/` が多い場合は、コラム詳細のcanonical確認、初期HTML、SSG/prerenderを優先する。
- `/area/`、`/purpose/`、`/feature/` が多い場合は、固定LPのtitle/description/canonical/h1/本文冒頭を初期HTMLで出す対応を優先する。
- 末尾スラッシュ、`http://`、`www`、`/index.html`、二重スラッシュが多い場合は、Cloudflare Redirect RulesまたはNginxでの301正規化を優先する。
- 存在しないURLらしきものが多い場合は、NotFound/404対応とSPA fallback 200問題の解消を優先する。
- `/search` が多い場合は、意図した `noindex` 対象か、sitemapや内部リンクから不要に検出されていないかを確認する。
- 画像/静的アセットが多い場合は、HTMLページのインデックス問題とは切り分け、404ノイズやキャッシュ参照として扱う。

### サンプル確認

```bash
node scripts/classify-search-console-urls.mjs scripts/sample-search-console-urls.csv
```

サンプルCSVには、SPA fallback 200や正規化不足の確認で使ったURLを入れている。実CSVを入手したら、同じコマンドで分類し、上位URLパターンと不明URL一覧を確認する。

---

## 2026-06-01 Search Console実CSV分類結果

Search Consoleからエクスポートされた6つのCoverage Drilldown ZIPを `reports/search-console-url-classification/raw/` に展開し、`表.csv` を分類した。実CSV、解凍CSV、分類結果CSV/JSONはSearch Console由来データのためコミットしない。作業用保存先は `.gitignore` で `reports/search-console-url-classification/` を除外する。

### 分類したZIP/CSV

- `https___ehime-hojokin.jp_-Coverage-Drilldown-2026-06-01.zip`: ソフト 404
- `https___ehime-hojokin.jp_-Coverage-Drilldown-2026-06-01 (1).zip`: クロール済み - インデックス未登録
- `https___ehime-hojokin.jp_-Coverage-Drilldown-2026-06-01 (2).zip`: 重複しています。ユーザーにより、正規ページとして選択されていません
- `https___ehime-hojokin.jp_-Coverage-Drilldown-2026-06-01 (3).zip`: 重複しています。Google により、ユーザーがマークしたページとは異なるページが正規ページとして選択されました
- `https___ehime-hojokin.jp_-Coverage-Drilldown-2026-06-01 (4).zip`: 代替ページ（適切な canonical タグあり）
- `https___ehime-hojokin.jp_-Coverage-Drilldown-2026-06-01 (5).zip`: noindex タグによって除外されました

### 未登録理由別の分類結果

| 未登録理由 | 総URL数 | `/subsidy/` | `/column/` | `/search` | 末尾スラッシュ | クエリ | unknown |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ソフト 404 | 4 | 4 | 0 | 0 | 4 | 0 | 0 |
| クロール済み - インデックス未登録 | 31 | 28 | 1 | 2 | 14 | 2 | 0 |
| 重複: ユーザーにより正規未選択 | 23 | 20 | 1 | 2 | 19 | 2 | 0 |
| 重複: Googleが別正規を選択 | 11 | 11 | 0 | 0 | 11 | 0 | 0 |
| 代替ページ canonicalあり | 28 | 25 | 2 | 1 | 11 | 1 | 0 |
| noindex除外 | 28 | 20 | 4 | 4 | 3 | 4 | 0 |

全体では125URL中108URLが `/subsidy/`。`/expert-articles/`、`/area/`、`/purpose/`、`/feature/`、`http://`、`www`、`/index.html`、二重スラッシュ、存在しないURLらしき文字列、静的アセットはいずれも0件だった。

### 主因候補

- 最大要因は補助金詳細URL。特に `クロール済み - インデックス未登録` は31件中28件、`noindex除外` は28件中20件、canonical関連は62件中56件が `/subsidy/`。
- 末尾スラッシュ付きURLが62件あり、`ソフト404` は4件すべて、`Googleが別正規を選択` は11件すべて、`ユーザーにより正規未選択` は23件中19件が末尾スラッシュ付き。sitemapは末尾スラッシュなしのため、末尾スラッシュ正規化不足が重複・soft404の主因候補。
- sitemap完全一致URLなのに `noindex` に入っているURLが10件あった。内訳は補助金詳細6件、コラム4件。sitemap掲載対象とnoindex判定の不整合として優先確認する。
- `クロール済み - インデックス未登録` ではsitemap完全一致URLが15件あり、補助金詳細の初期HTML薄さ、CSR依存、本文・title・description・canonicalの初期HTML不足が主因候補。
- `/search` は9件で、クエリ付きURLとして検出されている。検索結果ページのnoindex自体は意図通りだが、内部リンクや検出経路は確認する。
- Search Console実CSV上では `/ogp.jpg` など静的アセットは0件。画像404はノイズ対策であり、今回の未登録理由の本丸ではない。

### Search Console側で確認する代表URL例

- ソフト404/末尾スラッシュ: `https://ehime-hojokin.jp/subsidy/1231/`
- Googleが別正規を選択/末尾スラッシュ: `https://ehime-hojokin.jp/subsidy/992/`
- クロール済み - インデックス未登録: `https://ehime-hojokin.jp/subsidy/1295`
- noindexかつsitemap掲載: `https://ehime-hojokin.jp/subsidy/1574`
- noindexかつsitemap掲載コラム: `https://ehime-hojokin.jp/column/guide-1777161754897`
- 検索クエリURL: `https://ehime-hojokin.jp/search?keyword=%E5%AD%90%E8%82%B2%E3%81%A6`

### 次に実装すべき優先順位

1. 末尾スラッシュなしへ301正規化する設計を確定する。今回の実CSVでは重複・soft404の強い共通項。
2. sitemap掲載URLと `noindex` の不整合を調査する。補助金詳細6件、コラム4件は、公開対象なら `index`、非公開/薄いページならsitemapから除外する。
3. 補助金詳細ページの初期HTML改善を優先する。`/subsidy/` が全体の大半を占めるため、prerender/SSGまたは詳細ページ単位の初期HTML生成を検討する。
4. canonical関連でsitemap完全一致なのに代替扱いされている補助金詳細を確認する。React Helmetだけでなく初期HTMLまたはサーバー応答レベルのcanonicalを検討する。
5. `/search?keyword=...` はnoindex対象として基本維持しつつ、sitemap混入や過剰な内部リンク露出がないか確認する。
6. NotFound/SPA fallback 200対策は引き続き必要だが、今回の実CSVでは「存在しないURLらしき文字列」は0件のため、末尾スラッシュ正規化とsitemap/noindex不整合の後に扱う。
