# 補助金詳細ソフト404対策メモ

作成日: 2026-06-11

## 目的

存在しない `/subsidy/{id}` が React SPA の fallback により `200 OK` を返し、Search Console でソフト404扱いになる状態を止める。

対象は補助金詳細URLだけに限定する。その他の未登録理由、canonical、noindex、固定LP、コラム、検索ページはこの対応の対象外。

## リポジトリ側の変更

`npm run generate:sitemap` 実行時に、sitemap と同じ公開補助金リストから `public/subsidy-route-map.conf` を生成する。

このファイルは nginx の `map` ディレクティブで使う公開補助金IDの許可リスト。

SEO対象外として除外するもの:

- DBに存在しないID
- `is_active=true` / `crawl_status=published` ではないID
- `duplicate_of_id` があるID
- タイトル、概要、実施機関に `申請練習用`、`練習用`、`ダミー`、`テスト`、`補助金の支払いはありません` を含むもの

## VPS nginx 設定

2026-06-11 に VPS へ反映済み。

### http コンテキスト

`/etc/nginx/conf.d/ehime-subsidy-route-map.conf` から、デプロイ済みの生成ファイルを読み込む。

```nginx
include /var/www/ehime-portal/subsidy-route-map.conf;
```

`/var/www/ehime-portal/subsidy-route-map.conf` には、`public/subsidy-route-map.conf` と同じ `map` ディレクティブを配置する。

### server コンテキスト

既存の `server { ... }` の中で、通常の SPA fallback より前に追加する。

```nginx
location ~ ^/subsidy/([0-9]+)/$ {
    return 301 /subsidy/$1$is_args$args;
}

location ~ ^/subsidy/[0-9]+$ {
    if ($ehime_subsidy_known_route = 0) {
        return 404;
    }

    try_files $uri $uri/ /index.html;
}

location = /subsidy-route-map.conf {
    return 404;
}
```

## 確認コマンド

```bash
curl -I https://ehime-hojokin.jp/subsidy/1231
curl -I https://ehime-hojokin.jp/subsidy/1310
curl -I https://ehime-hojokin.jp/subsidy/1305
curl -I https://ehime-hojokin.jp/subsidy/1307
curl -I https://ehime-hojokin.jp/subsidy/1298
curl -I https://ehime-hojokin.jp/subsidy/1298/
curl -I https://ehime-hojokin.jp/
curl -I https://ehime-hojokin.jp/sitemap.xml
curl -I https://ehime-hojokin.jp/subsidy-route-map.conf
```

期待値:

- DBに存在しない `/subsidy/1231`、`/subsidy/1310`、`/subsidy/1305`: `404`
- 申請練習用として除外した `/subsidy/1307`: `404`
- sitemapに残る公開補助金詳細: `200`
- `/subsidy/{id}/`: `/subsidy/{id}` へ `301`
- トップページなど補助金詳細以外: 既存挙動維持
- `subsidy-route-map.conf`: `404`

2026-06-11 確認結果:

- `/subsidy/1231`: `404`
- `/subsidy/1310`: `404`
- `/subsidy/1305`: `404`
- `/subsidy/1307`: `404`
- `/subsidy/1298`: `200`
- `/subsidy/1298/`: `301`
- `/`: `200`
- `/sitemap.xml`: `200`
- `/subsidy-route-map.conf`: `404`

## Search Console

nginx反映とcurl確認後、Search Console の「ソフト404」だけで「新しい検証を開始」する。

`クロール済み - インデックス未登録`、`noindex タグによって除外されました`、`代替ページ`、`重複` は別原因を含むため、この対応では触らない。
