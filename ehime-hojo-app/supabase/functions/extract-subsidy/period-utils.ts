import {
  APPLICATION_PERIOD_HINT_PATTERN,
  CLOSED_PATTERN,
  NOT_APPLICATION_PERIOD_PATTERN,
  OPEN_ENDED_PATTERN,
  PERIOD_LABEL_PATTERN,
} from "./constants.ts";
import {
  cleanLine,
  getLines,
  normalizeJapaneseNumber,
  unique,
} from "./text-utils.ts";

const APPLICATION_STRONG_HINT_PATTERN =
  /(申請|受付|提出|応募|募集|公募|締切|締め切り|期限|申込|申し込み|請求|手続|電子申請|郵送|窓口)/;

const OPEN_OR_CONTINUOUS_HINT_PATTERN =
  /(随時|常時|通年|助成枠に達するまで|予算額に達するまで|予算に達するまで|予算枠に達し次第|予算上限に達し次第|定員に達し次第|達し次第|なくなり次第|予算がなくなり次第)/;

const TARGET_CONDITION_DATE_PATTERN =
  /(出生|生まれ|生年月日|対象児童|対象となる児童|新生児|児童|こども|子ども|児童手当|住民登録|給付対象|支給対象|受給者|世帯|保護者|扶養|所得|年齢)/;

const AI_DERIVED_BAD_PERIOD_PATTERN =
  /(から今|から現在|から現時点|から今日|から本日|より今|より現在|以降今|以降現在)/;

const START_ROW_PATTERN =
  /(公募開始|募集開始|受付開始|申請受付開始|申請開始|公開開始)/;

const FINAL_DEADLINE_ROW_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  {
    pattern:
      /(企画提案書|提案書|プロポーザル|企画書|応募書類|申請書).{0,30}(提出期限|提出締切|提出〆切|締切|期限)/,
    score: 120,
  },
  {
    pattern:
      /(参加申込書|参加申込|申込書|申込).{0,30}(提出期限|提出締切|提出〆切|締切|期限)/,
    score: 70,
  },
  {
    pattern:
      /(提出期限|提出締切|提出〆切|応募期限|募集期限|受付期限|申請期限|締切|締め切り)/,
    score: 60,
  },
];

const IGNORE_DEADLINE_ROW_PATTERN =
  /(質問に対する回答|回答|審査|プレゼンテーション|結果通知|通知|説明会|ヒアリング|選定|審査結果|公表)/;

const JP_DATE_DISPLAY_PATTERN =
  /(令和[元0-9０-９]+年\s*[0-9０-９]{1,2}月\s*[0-9０-９]{1,2}日(?:[（(][^）)]*[）)])?(?:\s*(?:午前|午後)?\s*[0-9０-９]{1,2}時(?:[0-9０-９]{1,2}分)?(?:\s*まで)?|\s*[0-9０-９]{1,2}[:：][0-9０-９]{2})?)/;

export const hasDateLikeText = (text: string) => {
  return /(令和|平成|20\d{2}年|\d{1,2}月\s*\d{1,2}日|随時|通年|達し次第|なくなり次第)/.test(
    text,
  );
};

const normalizeScheduleLine = (line: string) => {
  return cleanLine(line)
    .replace(/[｜]/g, "|")
    .replace(/【必着】/g, "")
    .replace(/[ \t　]+/g, " ")
    .trim();
};

const splitTableLine = (line: string) => {
  const s = normalizeScheduleLine(line);

  if (!s.includes("|")) {
    return [s];
  }

  return s
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
};

const extractJapaneseDateDisplay = (line: string) => {
  const s = normalizeScheduleLine(line);
  const match = s.match(JP_DATE_DISPLAY_PATTERN);

  if (!match) return "";

  return normalizeJapaneseNumber(match[1])
    .replace(/[ \t　]+/g, "")
    .replace(/）([0-9]+時)/g, "）$1")
    .trim();
};

const getDeadlineScore = (line: string) => {
  const s = normalizeScheduleLine(line);

  if (
    IGNORE_DEADLINE_ROW_PATTERN.test(s) &&
    !/(提出期限|提出締切|応募期限|申請期限)/.test(s)
  ) {
    return 0;
  }

  let score = 0;

  for (const item of FINAL_DEADLINE_ROW_PATTERNS) {
    if (item.pattern.test(s)) {
      score = Math.max(score, item.score);
    }
  }

  return score;
};

const hasApplicationSignal = (text: string) => {
  return (
    PERIOD_LABEL_PATTERN.test(text) ||
    APPLICATION_STRONG_HINT_PATTERN.test(text) ||
    OPEN_OR_CONTINUOUS_HINT_PATTERN.test(text)
  );
};

export const isBadApplicationPeriodCandidate = (text: string) => {
  const s = cleanLine(text || "");

  if (!s) return false;

  if (NOT_APPLICATION_PERIOD_PATTERN.test(s)) {
    return true;
  }

  if (TARGET_CONDITION_DATE_PATTERN.test(s)) {
    return true;
  }

  if (AI_DERIVED_BAD_PERIOD_PATTERN.test(s)) {
    return true;
  }

  return false;
};

export const isGoodApplicationPeriodCandidate = (text: string) => {
  const s = cleanLine(text || "");

  if (!s) return false;
  if (isBadApplicationPeriodCandidate(s)) return false;

  if (START_ROW_PATTERN.test(s) && !/(期限|締切|締め切り|まで|～|〜)/.test(s)) {
    return false;
  }

  const hasPeriodLabel = PERIOD_LABEL_PATTERN.test(s);
  const hasApplicationHint = APPLICATION_PERIOD_HINT_PATTERN.test(s);
  const hasDate = hasDateLikeText(s);
  const hasRange =
    /(～|〜|-|から|より|まで|随時|通年|達し次第|なくなり次第|期限|締切|締め切り)/.test(
      s,
    );

  return hasDate && hasRange && (hasPeriodLabel || hasApplicationHint || hasApplicationSignal(s));
};

export const normalizeDateToISO = (value: unknown) => {
  if (!value) return null;

  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  return null;
};

export const warekiToWesternText = (value: string) => {
  let s = normalizeJapaneseNumber(value || "");

  s = s.replace(/令和(元|\d+)年/g, (_, yearText) => {
    const year = yearText === "元" ? 2019 : 2018 + Number(yearText);
    return `${year}年`;
  });

  s = s.replace(/平成(元|\d+)年/g, (_, yearText) => {
    const year = yearText === "元" ? 1989 : 1988 + Number(yearText);
    return `${year}年`;
  });

  return s;
};

export const parseFirstDateFromText = (value: string) => {
  const s = warekiToWesternText(value);

  const match = s.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日?/);

  if (!match) return null;

  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(
    Number(match[3]),
  ).padStart(2, "0")}`;
};

export const parseLastDateFromText = (value: string) => {
  const s = warekiToWesternText(value);
  const matches = [...s.matchAll(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日?/g)];

  if (matches.length === 0) return null;

  const match = matches[matches.length - 1];

  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(
    Number(match[3]),
  ).padStart(2, "0")}`;
};

export const isISODateBefore = (a: string, b: string) => {
  return a < b;
};

export const todayISO = () => {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const extractValueAfterPeriodLabel = (line: string) => {
  return cleanLine(line)
    .replace(PERIOD_LABEL_PATTERN, "")
    .replace(APPLICATION_PERIOD_HINT_PATTERN, "")
    .replace(/^[:：\s]+/, "")
    .trim();
};

const hasSafeApplicationDateValue = (line: string) => {
  const s = cleanLine(line);

  if (!s) return false;
  if (!hasDateLikeText(s)) return false;
  if (isBadApplicationPeriodCandidate(s)) return false;

  if (START_ROW_PATTERN.test(s) && !/(期限|締切|締め切り|まで|～|〜)/.test(s)) {
    return false;
  }

  return true;
};

const extractScheduleRows = (lines: string[]) => {
  const rows: Array<{
    item: string;
    dateText: string;
    iso: string;
    raw: string;
  }> = [];

  for (const rawLine of lines) {
    const line = normalizeScheduleLine(rawLine);

    if (!line) continue;

    const columns = splitTableLine(line);

    if (columns.length >= 2) {
      const item = columns[0];
      const dateColumn = columns.slice(1).join(" ");
      const dateText = extractJapaneseDateDisplay(dateColumn);
      const iso = dateText ? parseFirstDateFromText(dateText) || "" : "";

      if (item && dateText && iso) {
        rows.push({
          item,
          dateText,
          iso,
          raw: line,
        });
      }

      continue;
    }

    const dateText = extractJapaneseDateDisplay(line);
    const iso = dateText ? parseFirstDateFromText(dateText) || "" : "";

    if (dateText && iso) {
      rows.push({
        item: line.replace(dateText, "").trim(),
        dateText,
        iso,
        raw: line,
      });
    }
  }

  return rows;
};

const extractSchedulePeriodFromLines = (lines: string[]) => {
  const rows = extractScheduleRows(lines);

  let startText = "";
  let startIso = "";

  let bestEndText = "";
  let bestEndIso = "";
  let bestEndScore = 0;

  for (const row of rows) {
    const rowText = `${row.item} ${row.raw}`;

    if (START_ROW_PATTERN.test(rowText)) {
      if (!startText || row.iso < startIso) {
        startText = row.dateText;
        startIso = row.iso;
      }
    }

    const deadlineScore = getDeadlineScore(rowText);

    if (deadlineScore > 0) {
      if (
        deadlineScore > bestEndScore ||
        (deadlineScore === bestEndScore && row.iso > bestEndIso)
      ) {
        bestEndText = row.dateText;
        bestEndIso = row.iso;
        bestEndScore = deadlineScore;
      }
    }
  }

  if (startText && bestEndText) {
    return `${startText} ～ ${bestEndText}`;
  }

  if (bestEndText) {
    return `${bestEndText}まで`;
  }

  return "";
};

export const extractBestPeriodText = (periodCandidates: string[], text: string) => {
  const lines = getLines(text);

  const schedulePeriod = extractSchedulePeriodFromLines(lines);

  if (schedulePeriod && !isBadApplicationPeriodCandidate(schedulePeriod)) {
    return schedulePeriod;
  }

  const candidates = unique([
    ...periodCandidates,
    ...lines.filter((line) => isGoodApplicationPeriodCandidate(line)),
  ]).filter((candidate) => !isBadApplicationPeriodCandidate(candidate));

  for (const candidate of candidates) {
    const candidateLines = candidate.split("\n").map(cleanLine).filter(Boolean);

    const schedulePeriodInBlock = extractSchedulePeriodFromLines(candidateLines);

    if (schedulePeriodInBlock && !isBadApplicationPeriodCandidate(schedulePeriodInBlock)) {
      return schedulePeriodInBlock;
    }

    for (let i = 0; i < candidateLines.length; i += 1) {
      const line = candidateLines[i];

      if (START_ROW_PATTERN.test(line) && !/(期限|締切|締め切り|まで|～|〜)/.test(line)) {
        continue;
      }

      if (PERIOD_LABEL_PATTERN.test(line) || APPLICATION_PERIOD_HINT_PATTERN.test(line)) {
        const sameLineValue = extractValueAfterPeriodLabel(line);

        if (sameLineValue && hasSafeApplicationDateValue(sameLineValue)) {
          return sameLineValue;
        }

        const nextLines = [
          candidateLines[i + 1],
          candidateLines[i + 2],
          candidateLines[i + 3],
        ]
          .map((item) => cleanLine(item || ""))
          .filter(Boolean);

        const foundNext = nextLines.find((next) => {
          if (!hasSafeApplicationDateValue(next)) return false;

          if (START_ROW_PATTERN.test(next) && !/(期限|締切|締め切り|まで|～|〜)/.test(next)) {
            return false;
          }

          return true;
        });

        if (foundNext) {
          return foundNext;
        }
      }
    }
  }

  for (const candidate of candidates) {
    const line = cleanLine(candidate);

    if (isGoodApplicationPeriodCandidate(line)) {
      return line;
    }
  }

  return "";
};

export const parsePeriodDates = (periodText: string) => {
  const s = warekiToWesternText(periodText);

  if (!s || isBadApplicationPeriodCandidate(s)) {
    return {
      start: null,
      end: null,
      isOpenEnded: false,
    };
  }

  const isOpenEnded = OPEN_ENDED_PATTERN.test(s);

  if (isOpenEnded) {
    return {
      start: parseFirstDateFromText(s),
      end: null,
      isOpenEnded: true,
    };
  }

  const range = s.match(
    /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日?(?:（[^）]+）)?\s*(?:～|〜|-|から|より)\s*(?:(20\d{2})年\s*)?(\d{1,2})月\s*(\d{1,2})日?/,
  );

  if (range) {
    const start = `${range[1]}-${String(Number(range[2])).padStart(2, "0")}-${String(
      Number(range[3]),
    ).padStart(2, "0")}`;

    const endYear = range[4] || range[1];

    const end = `${endYear}-${String(Number(range[5])).padStart(2, "0")}-${String(
      Number(range[6]),
    ).padStart(2, "0")}`;

    return {
      start,
      end,
      isOpenEnded: false,
    };
  }

  const lastDate = parseLastDateFromText(s);

  return {
    start: null,
    end: lastDate,
    isOpenEnded: false,
  };
};

export const determineApplicationStatus = ({
  periodText,
  startDate,
  endDate,
  aiStatus,
}: {
  periodText: string;
  startDate: string | null;
  endDate: string | null;
  aiStatus: string;
}) => {
  const today = todayISO();
  const source = `${periodText}\n${aiStatus}`;

  if (CLOSED_PATTERN.test(source)) {
    return "受付終了";
  }

  if (!periodText || isBadApplicationPeriodCandidate(periodText)) {
    if (aiStatus === "予告" || aiStatus === "受付終了" || aiStatus === "公募中") {
      return aiStatus;
    }

    return "不明";
  }

  if (startDate && isISODateBefore(today, startDate)) {
    return "予告";
  }

  if (endDate && isISODateBefore(endDate, today)) {
    return "受付終了";
  }

  if (OPEN_ENDED_PATTERN.test(periodText)) {
    return "公募中";
  }

  if (/随時|常時|通年/.test(periodText)) {
    return "公募中";
  }

  if (aiStatus === "予告" || aiStatus === "受付終了" || aiStatus === "公募中") {
    return aiStatus;
  }

  return "不明";
};