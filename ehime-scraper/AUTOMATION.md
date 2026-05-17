# クローラー自動化メモ

## 本番VPSで動かす前提

週次クローラーはMacではなく、本番VPS上で実行します。

本番配置パス:

```bash
/opt/ehime-portal-system/ehime-scraper
```

週次実行スクリプト:

```bash
/opt/ehime-portal-system/ehime-scraper/scripts/run-weekly-scraper.sh
```

このスクリプトは以下の順で実行します。

1. 通常クローラー
2. Jグランツ取込

## VPSへの配置

VPS上でリポジトリを配置します。

```bash
sudo mkdir -p /opt
cd /opt
git clone https://github.com/sakio71555/ehime-portal-system.git
cd /opt/ehime-portal-system/ehime-scraper
npm ci
```

すでに配置済みの場合:

```bash
cd /opt/ehime-portal-system
git pull --rebase origin main
cd /opt/ehime-portal-system/ehime-scraper
npm ci
```

## .env

`.env` はGit管理しません。
VPS上で手動配置してください。

配置先:

```bash
/opt/ehime-portal-system/ehime-scraper/.env
```

確認:

```bash
cd /opt/ehime-portal-system/ehime-scraper
test -f .env && echo ".env OK"
chmod 600 .env
```

## 手動確認

保存せず少量確認:

```bash
cd /opt/ehime-portal-system/ehime-scraper
npm run scraper:dry
```

通常クローラーを週次設定で保存実行:

```bash
cd /opt/ehime-portal-system/ehime-scraper
SCRAPER_DRY_RUN=0 SCRAPER_MAX_URLS=180 SCRAPER_MAX_INSERTS=40 npm run scraper
```

Jグランツを週次設定で保存実行:

```bash
cd /opt/ehime-portal-system/ehime-scraper
JGRANTS_DRY_RUN=0 JGRANTS_LIMIT=100 npm run jgrants
```

通常クローラーとJグランツを続けて実行:

```bash
cd /opt/ehime-portal-system/ehime-scraper
npm run weekly
```

ログ付きで週次スクリプトを実行:

```bash
/opt/ehime-portal-system/ehime-scraper/scripts/run-weekly-scraper.sh
```

## 週1回のcron登録

Macのcronではなく、VPSのcrontabに登録します。

毎週火曜 6:00 に実行:

```cron
0 6 * * 2 /opt/ehime-portal-system/ehime-scraper/scripts/run-weekly-scraper.sh
```

既存の同スクリプト設定を入れ替える場合:

```bash
(crontab -l 2>/dev/null | grep -v 'ehime-scraper/scripts/run-weekly-scraper.sh'; echo '0 6 * * 2 /opt/ehime-portal-system/ehime-scraper/scripts/run-weekly-scraper.sh') | crontab -
```

登録確認:

```bash
crontab -l
```

## ログ確認

ログは以下に保存されます。

```bash
/opt/ehime-portal-system/ehime-scraper/logs/weekly-scraper-YYYYMMDD-HHMMSS.log
```

最新ログ確認:

```bash
ls -lt /opt/ehime-portal-system/ehime-scraper/logs/weekly-scraper-*.log | head
tail -n 120 "$(ls -t /opt/ehime-portal-system/ehime-scraper/logs/weekly-scraper-*.log | head -1)"
```

## 管理画面からの手動実行API

管理画面の「クローラー管理」から手動実行する場合は、VPS上で小さなNode APIを起動します。
このAPIは外部へ直接公開せず、`127.0.0.1:3100` で待ち受け、nginxから `/api/admin/crawler/` へproxyしてください。

起動:

```bash
cd /opt/ehime-portal-system/ehime-scraper
npm run admin:server
```

`.env` に追加する値:

```bash
CRAWLER_ADMIN_HOST=127.0.0.1
CRAWLER_ADMIN_PORT=3100
CRAWLER_ADMIN_EMAILS=管理者メールアドレス
# または
CRAWLER_ADMIN_USER_IDS=Supabaseの管理者user id
```

`SUPABASE_URL` と `SUPABASE_ANON_KEY` も必要です。
APIは管理画面から送られる Supabase access token を検証し、さらに `CRAWLER_ADMIN_EMAILS` / `CRAWLER_ADMIN_USER_IDS` に一致するユーザーだけを許可します。
秘密トークンをフロントのビルドへ埋め込まないでください。

systemd例:

```ini
[Unit]
Description=Ehime crawler admin API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/ehime-portal-system/ehime-scraper
ExecStart=/usr/bin/npm run admin:server
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

nginx proxy例:

```nginx
location /api/admin/crawler/ {
    proxy_pass http://127.0.0.1:3100/api/admin/crawler/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
}
```

二重起動防止:

```bash
/opt/ehime-portal-system/ehime-scraper/logs/crawler.lock
```

手動実行ログ:

- `logs/manual-all-YYYYMMDD-HHMMSS.log`
- `logs/manual-official-YYYYMMDD-HHMMSS.log`
- `logs/manual-jgrants-YYYYMMDD-HHMMSS.log`

## 主な環境変数

- `SCRAPER_DRY_RUN=1`: 通常クローラーを保存せずに確認
- `SCRAPER_DRY_RUN=0`: 通常クローラーをSupabaseへ保存
- `SCRAPER_MAX_URLS=180`: 通常クローラーの処理URL数上限
- `SCRAPER_MAX_INSERTS=40`: 通常クローラーの新規保存件数上限
- `SCRAPER_URLS=https://example.com/a,https://example.com/b`: 指定URLだけを処理
- `JGRANTS_DRY_RUN=1`: Jグランツを保存せずに確認
- `JGRANTS_DRY_RUN=0`: JグランツをSupabaseへ保存
- `JGRANTS_LIMIT=100`: Jグランツの詳細取得件数上限

## 注意

- 追加データは `crawl_status = draft` / `is_active = false` で保存されます。
- 公開前に管理画面で内容確認してください。
- `.env`、`logs/`、`node_modules/` はGitに含めないでください。
- PDF OCRが走る場合はOpenAI APIコストが増える可能性があります。
