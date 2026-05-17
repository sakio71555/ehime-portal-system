const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const BASE_DIR = process.env.CRAWLER_BASE_DIR || __dirname;
const LOG_DIR = path.join(BASE_DIR, 'logs');
const LOCK_FILE = path.join(LOG_DIR, 'crawler.lock');
const STATUS_FILE = path.join(LOG_DIR, 'crawler-status.json');
const PORT = Number(process.env.CRAWLER_ADMIN_PORT || 3100);
const HOST = process.env.CRAWLER_ADMIN_HOST || '127.0.0.1';
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const TARGET_LABELS = {
  all: '全体クロール',
  official: '通常クローラー',
  jgrants: 'Jグランツ取込',
};

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function splitEnvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeStatus(status) {
  ensureLogDir();
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function readStatus() {
  return readJsonFile(STATUS_FILE, {
    current: null,
    lastRuns: {},
  });
}

function readLock() {
  if (!fs.existsSync(LOCK_FILE)) return null;

  const lock = readJsonFile(LOCK_FILE, null);
  if (lock) return lock;

  const stat = fs.statSync(LOCK_FILE);
  return {
    target: 'unknown',
    startedAt: stat.mtime.toISOString(),
    stale: true,
  };
}

function tailLines(filePath, lineCount = 100) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return text.split(/\r?\n/).slice(-lineCount).join('\n');
  } catch (_) {
    return '';
  }
}

function listLogFiles() {
  ensureLogDir();

  return fs
    .readdirSync(LOG_DIR)
    .filter((file) => /^(manual|weekly)-.*\.log$/.test(file))
    .map((file) => {
      const filePath = path.join(LOG_DIR, file);
      return {
        file,
        filePath,
        mtimeMs: fs.statSync(filePath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function latestLogByPrefix(prefix) {
  return listLogFiles().find((entry) => entry.file.startsWith(prefix)) || null;
}

function parseSummaryFromLog(logText) {
  const summary = {};
  const fields = {
    inserted: [/inserted\s*[:：]\s*(\d+)/i, /追加\s*[:：]\s*(\d+)/],
    updated: [/updated\s*[:：]\s*(\d+)/i, /更新\s*[:：]\s*(\d+)/],
    skipped: [/skipped\s*[:：]\s*(\d+)/i, /スキップ\s*[:：]\s*(\d+)/],
    errors: [/errors\s*[:：]\s*(\d+)/i, /エラー\s*[:：]\s*(\d+)/],
  };

  Object.entries(fields).forEach(([key, patterns]) => {
    const match = patterns.map((pattern) => logText.match(pattern)).find(Boolean);
    if (match) summary[key] = Number(match[1]);
  });

  return summary;
}

function buildStatusPayload() {
  const status = readStatus();
  const latestLog = listLogFiles()[0] || null;
  const lock = readLock();

  return {
    is_running: Boolean(lock),
    lock,
    current: status.current || null,
    lastRuns: status.lastRuns || {},
    latestLog: latestLog
      ? {
          file: latestLog.file,
          updatedAt: new Date(latestLog.mtimeMs).toISOString(),
          tail: tailLines(latestLog.filePath, 100),
        }
      : null,
    logs: {
      all: formatLatestLog(latestLogByPrefix('manual-all-')),
      official: formatLatestLog(latestLogByPrefix('manual-official-')),
      jgrants: formatLatestLog(latestLogByPrefix('manual-jgrants-')),
      weekly: formatLatestLog(latestLogByPrefix('weekly-scraper-')),
    },
  };
}

function formatLatestLog(entry) {
  if (!entry) return null;

  return {
    file: entry.file,
    updatedAt: new Date(entry.mtimeMs).toISOString(),
  };
}

function getSupabaseAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw Object.assign(
      new Error('SUPABASE_URL と SUPABASE_ANON_KEY が必要です。'),
      { statusCode: 500 }
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function authenticateRequest(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw Object.assign(new Error('Authorization Bearer token が必要です。'), {
      statusCode: 401,
    });
  }

  const allowedEmails = splitEnvList(process.env.CRAWLER_ADMIN_EMAILS);
  const allowedUserIds = splitEnvList(process.env.CRAWLER_ADMIN_USER_IDS);

  if (allowedEmails.length === 0 && allowedUserIds.length === 0) {
    throw Object.assign(
      new Error('CRAWLER_ADMIN_EMAILS または CRAWLER_ADMIN_USER_IDS をVPSの.envに設定してください。'),
      { statusCode: 500 }
    );
  }

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(match[1]);

  if (error || !data?.user) {
    throw Object.assign(new Error('管理者認証に失敗しました。'), {
      statusCode: 401,
    });
  }

  const email = data.user.email || '';
  const userId = data.user.id || '';
  const isAllowed =
    allowedEmails.includes(email) || allowedUserIds.includes(userId);

  if (!isAllowed) {
    throw Object.assign(new Error('このユーザーにはクローラー実行権限がありません。'), {
      statusCode: 403,
    });
  }

  return {
    id: userId,
    email,
  };
}

function getCommandsForTarget(target) {
  const official = {
    key: 'official',
    label: TARGET_LABELS.official,
    args: ['run', 'scraper'],
    env: {
      SCRAPER_DRY_RUN: '0',
      SCRAPER_MAX_URLS: '180',
      SCRAPER_MAX_INSERTS: '40',
    },
  };

  const jgrants = {
    key: 'jgrants',
    label: TARGET_LABELS.jgrants,
    args: ['run', 'jgrants'],
    env: {
      JGRANTS_DRY_RUN: '0',
      JGRANTS_LIMIT: '100',
    },
  };

  if (target === 'official') return [official];
  if (target === 'jgrants') return [jgrants];
  return [official, jgrants];
}

function runCommand(command, logStream) {
  return new Promise((resolve) => {
    const child = spawn(NPM_BIN, command.args, {
      cwd: BASE_DIR,
      env: {
        ...process.env,
        ...command.env,
      },
      shell: false,
    });

    logStream.write(`\n--- ${command.label} start: ${new Date().toISOString()} ---\n`);
    logStream.write(`cwd: ${BASE_DIR}\n`);
    logStream.write(`command: npm ${command.args.join(' ')}\n\n`);

    child.stdout.on('data', (chunk) => logStream.write(chunk));
    child.stderr.on('data', (chunk) => logStream.write(chunk));

    child.on('error', (error) => {
      logStream.write(`\n${command.label} failed to start: ${error.message}\n`);
      resolve({ code: 1, error });
    });

    child.on('close', (code) => {
      logStream.write(`\n--- ${command.label} end: ${new Date().toISOString()} code=${code} ---\n`);
      resolve({ code });
    });
  });
}

async function runCrawlerJob(target, requestedBy, logFile) {
  const commands = getCommandsForTarget(target);
  const status = readStatus();
  const startedAt = new Date().toISOString();

  status.current = {
    target,
    label: TARGET_LABELS[target],
    startedAt,
    requestedBy,
    logFile: path.basename(logFile),
  };
  writeStatus(status);

  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  let finalStatus = 'success';
  let failureMessage = '';

  logStream.write(`${TARGET_LABELS[target]} requested by ${requestedBy.email || requestedBy.id}\n`);
  logStream.write(`startedAt: ${startedAt}\n`);

  try {
    for (const command of commands) {
      const commandStartedAt = new Date().toISOString();
      const result = await runCommand(command, logStream);
      const commandFinishedAt = new Date().toISOString();
      const logText = fs.readFileSync(logFile, 'utf8');
      const commandStatus = result.code === 0 ? 'success' : 'failed';

      const nextStatus = readStatus();
      nextStatus.lastRuns = nextStatus.lastRuns || {};
      nextStatus.lastRuns[command.key] = {
        target: command.key,
        label: command.label,
        status: commandStatus,
        startedAt: commandStartedAt,
        finishedAt: commandFinishedAt,
        logFile: path.basename(logFile),
        summary: parseSummaryFromLog(logText),
        requestedBy,
      };
      nextStatus.current = status.current;
      writeStatus(nextStatus);

      if (result.code !== 0) {
        finalStatus = 'failed';
        failureMessage = `${command.label} が終了コード ${result.code} で失敗しました。`;
        break;
      }
    }
  } catch (error) {
    finalStatus = 'failed';
    failureMessage = error.message;
    logStream.write(`\nUnexpected error: ${error.stack || error.message}\n`);
  } finally {
    const finishedAt = new Date().toISOString();
    logStream.write(`\nfinishedAt: ${finishedAt}\n`);
    if (failureMessage) logStream.write(`result: ${failureMessage}\n`);
    await new Promise((resolve) => logStream.end(resolve));

    const logText = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
    const nextStatus = readStatus();
    nextStatus.lastRuns = nextStatus.lastRuns || {};
    nextStatus.lastRuns[target] = {
      target,
      label: TARGET_LABELS[target],
      status: finalStatus,
      startedAt,
      finishedAt,
      logFile: path.basename(logFile),
      summary: parseSummaryFromLog(logText),
      requestedBy,
      error: failureMessage || null,
    };
    nextStatus.current = null;
    writeStatus(nextStatus);

    try {
      fs.unlinkSync(LOCK_FILE);
    } catch (_) {
      // lockが既に消えている場合は何もしない
    }
  }
}

function createLock(target, requestedBy, logFile) {
  ensureLogDir();

  const lock = {
    target,
    label: TARGET_LABELS[target],
    startedAt: new Date().toISOString(),
    requestedBy,
    logFile: path.basename(logFile),
  };

  const fd = fs.openSync(LOCK_FILE, 'wx');
  fs.writeFileSync(fd, JSON.stringify(lock, null, 2));
  fs.closeSync(fd);

  return lock;
}

function startCrawler(target, requestedBy) {
  if (!TARGET_LABELS[target]) {
    throw Object.assign(new Error('target は all / official / jgrants のいずれかです。'), {
      statusCode: 400,
    });
  }

  ensureLogDir();
  const logFile = path.join(LOG_DIR, `manual-${target}-${timestampForFile()}.log`);

  try {
    const lock = createLock(target, requestedBy, logFile);
    runCrawlerJob(target, requestedBy, logFile).catch((error) => {
      fs.appendFileSync(logFile, `\nFatal background error: ${error.stack || error.message}\n`);
      try {
        fs.unlinkSync(LOCK_FILE);
      } catch (_) {
        // ignore
      }
    });

    return {
      started: true,
      lock,
    };
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw Object.assign(new Error('現在クローラーを実行中です。'), {
        statusCode: 409,
      });
    }

    throw error;
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(Object.assign(new Error('リクエスト本文が大きすぎます。'), { statusCode: 413 }));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) return resolve({});

      try {
        resolve(JSON.parse(body));
      } catch (_) {
        reject(Object.assign(new Error('JSONの形式が不正です。'), { statusCode: 400 }));
      }
    });
  });
}

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = splitEnvList(process.env.CRAWLER_ADMIN_ALLOWED_ORIGINS);
  const isAllowedOrigin =
    origin &&
    (allowedOrigins.includes(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function sendJson(res, statusCode, payload, req) {
  applyCorsHeaders(req, res);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.writeHead(statusCode);
  res.end(JSON.stringify(payload));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (req.method === 'OPTIONS') {
    applyCorsHeaders(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.writeHead(204);
    return res.end();
  }

  try {
    const user = await authenticateRequest(req);

    if (req.method === 'GET' && pathname.endsWith('/status')) {
      return sendJson(res, 200, buildStatusPayload(), req);
    }

    if (req.method === 'POST' && pathname.endsWith('/run')) {
      const body = await parseJsonBody(req);
      const result = startCrawler(body.target || 'all', user);
      return sendJson(res, 202, result, req);
    }

    return sendJson(res, 404, { error: 'not_found' }, req);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendJson(
      res,
      statusCode,
      {
        error: statusCode === 409 ? 'already_running' : 'error',
        message: error.message,
      },
      req
    );
  }
}

ensureLogDir();

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(
      res,
      500,
      {
        error: 'error',
        message: error.message,
      },
      req
    );
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Crawler admin API listening on http://${HOST}:${PORT}`);
});
