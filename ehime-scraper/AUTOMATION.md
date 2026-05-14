# クローラー自動化メモ

## まず手動で確認

保存せず少量確認:

```bash
npm run scraper:dry
```

週次想定の設定で実行:

```bash
npm run scraper:weekly
```

ログ付きで実行:

```bash
./scripts/run-weekly-scraper.sh
```

## 主な環境変数

- `SCRAPER_DRY_RUN=1`: 保存せずに抽出だけ確認
- `SCRAPER_MAX_URLS=180`: 処理URL数の上限
- `SCRAPER_MAX_INSERTS=40`: 新規保存件数の上限
- `SCRAPER_PREFILTER_SOURCE_URL=1`: 既に登録済みの `source_url` を取得前にスキップ
- `SCRAPER_URLS=https://example.com/a,https://example.com/b`: 指定URLだけを処理

## macOSで週1回動かす場合

`crontab -e` に例として以下を追加します。

```cron
0 6 * * 1 /Users/sakio/Desktop/ehime-portal-system/ehime-scraper/scripts/run-weekly-scraper.sh
```

毎週月曜 6:00 に実行します。最初は `SCRAPER_DRY_RUN=1` を付けた手動確認を推奨します。

## 注意

- 追加データは `crawl_status = draft` / `is_active = false` で保存されます。
- 公開前に管理画面で内容確認してください。
- PDFは解析できるように修正済みですが、OCRが走るPDFはOpenAI APIコストが増えます。
