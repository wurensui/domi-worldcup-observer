export const WC26_CLIENT_SESSION_KEY = "wc26-odds-desk-session";
export const WC26_ADMIN_SESSION_KEY = "wc26-admin-session";
export const WC26_ODDS_KEY = "wc26-odds-desk-markets";
export const WC26_ORDERS_KEY = "wc26-client-orders";
export const WC26_RESULTS_KEY = "wc26-match-results";
export const WC26_CUSTOMERS_KEY = "wc26-customers";
export const WC26_ADMIN_PROFILE_KEY = "wc26-admin-profile";
const WORLD_CUP_DESK_ENDPOINT = process.env.NEXT_PUBLIC_WORLDCUP_DESK_ENDPOINT || "/api/worldcup-desk";

export const ADMIN_LOGIN = {
  account: "admin",
  password: process.env.NEXT_PUBLIC_WC26_ADMIN_PASSWORD || "change-me-admin"
};

export const DEFAULT_ADMIN_PROFILE = {
  account: ADMIN_LOGIN.account,
  password: ADMIN_LOGIN.password,
  updatedAt: "2026-05-31T00:00:00.000Z"
};

export const DEFAULT_CUSTOMERS = [
  {
    account: "client",
    password: process.env.NEXT_PUBLIC_WC26_CLIENT_PASSWORD || "change-me-client",
    name: "示例客户",
    status: "启用",
    createdAt: "2026-05-31T00:00:00.000Z"
  }
];

export const RESULT_LABELS = {
  won: "命中",
  lost: "未中",
  push: "走水",
  pending: "待开奖"
};

export const REPORT_MODE_LABELS = {
  all: "所有订单报表合计",
  day: "下单日报表",
  week: "下单周报表",
  month: "下单月报表",
  custom: "自定义日期报表"
};

const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

function ymdToUtcDate(ymd) {
  const [year, month, day] = String(ymd ?? "").split("-").map((item) => Number(item));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDateToYmd(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToYmd(ymd, days) {
  const date = ymdToUtcDate(ymd);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateToYmd(date);
}

export function formatShanghaiYmd(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

export function getReportDateRange(mode, options = {}) {
  const today = formatShanghaiYmd();
  if (mode === "day") {
    const day = options.day || today;
    return { from: day, to: day, label: `${day} 下单日报表` };
  }

  if (mode === "week") {
    const selectedDay = options.weekDay || today;
    const selectedDate = ymdToUtcDate(selectedDay) ?? ymdToUtcDate(today);
    const weekday = selectedDate.getUTCDay() || 7;
    const start = addDaysToYmd(selectedDay, 1 - weekday);
    const end = addDaysToYmd(start, 6);
    return { from: start, to: end, label: `${start} 至 ${end} 下单周报表` };
  }

  if (mode === "month") {
    const month = options.month || today.slice(0, 7);
    const from = `${month}-01`;
    const startDate = ymdToUtcDate(from) ?? ymdToUtcDate(`${today.slice(0, 7)}-01`);
    const endDate = new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    endDate.setUTCDate(0);
    return { from, to: utcDateToYmd(endDate), label: `${month} 下单月报表` };
  }

  if (mode === "custom") {
    const from = options.from || options.to || today;
    const to = options.to || options.from || today;
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    return { from: start, to: end, label: `${start} 至 ${end} 自定义日期报表` };
  }

  return { from: null, to: null, label: REPORT_MODE_LABELS.all };
}

export function orderMatchesReportDate(order, range) {
  if (!range?.from && !range?.to) return true;
  const orderDate = formatShanghaiYmd(order?.createdAt);
  if (!orderDate) return false;
  if (range.from && orderDate < range.from) return false;
  if (range.to && orderDate > range.to) return false;
  return true;
}

export function readStorageJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageJson(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function fetchDeskData() {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch(WORLD_CUP_DESK_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.ok ? payload.data : null;
  } catch {
    return null;
  }
}

export async function postDeskAction(action, payload = {}) {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch(WORLD_CUP_DESK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload })
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result?.ok ? result.data : null;
  } catch {
    return null;
  }
}

export function normalizeCustomers(customers) {
  const rows = Array.isArray(customers) ? customers : [];
  const merged = [...DEFAULT_CUSTOMERS, ...rows];
  const seen = new Set();
  return merged.filter((customer) => {
    if (!customer?.account || seen.has(customer.account)) return false;
    seen.add(customer.account);
    return true;
  });
}

export function normalizeAdminProfile(profile) {
  return {
    ...DEFAULT_ADMIN_PROFILE,
    ...(profile && typeof profile === "object" ? profile : {}),
    account: String(profile?.account || DEFAULT_ADMIN_PROFILE.account).trim() || DEFAULT_ADMIN_PROFILE.account,
    password: String(profile?.password || DEFAULT_ADMIN_PROFILE.password)
  };
}

export function getStoredAdminProfile() {
  const profile = normalizeAdminProfile(readStorageJson(WC26_ADMIN_PROFILE_KEY, DEFAULT_ADMIN_PROFILE));
  writeStorageJson(WC26_ADMIN_PROFILE_KEY, profile);
  return profile;
}

export function getStoredCustomers() {
  const customers = normalizeCustomers(readStorageJson(WC26_CUSTOMERS_KEY, DEFAULT_CUSTOMERS));
  writeStorageJson(WC26_CUSTOMERS_KEY, customers);
  return customers;
}

export function matchIdFromNumber(matchNo) {
  return `wc2026-${String(matchNo).padStart(3, "0")}`;
}

export function cleanJsonImportText(text) {
  let source = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!source) return source;

  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) source = fenced[1].trim();

  source = source.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  const arrayStart = source.indexOf("[");
  const objectStart = source.indexOf("{");
  const starts = [arrayStart, objectStart].filter((index) => index >= 0);
  if (!starts.length) return source;

  const start = Math.min(...starts);
  source = source.slice(start).trim();
  const closer = source.startsWith("[") ? "]" : "}";
  const end = source.lastIndexOf(closer);
  return end >= 0 ? source.slice(0, end + 1) : source;
}

export function parseJsonImportText(text) {
  return JSON.parse(cleanJsonImportText(text));
}

function splitMatchTeams(teams) {
  return String(teams ?? "")
    .split(/\s+vs\s+|VS|Vs|v|V|－|-|对/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchFromResultLine(line, matches = []) {
  const byMarkedNo = line.match(/(?:^|[^\d])M\s*0*(\d{1,3})(?=$|[^\d])/i);
  if (byMarkedNo) return Number(byMarkedNo[1]);

  const scoreMatch = line.match(/(\d+)\s*(?:-|:|：|比)\s*(\d+)/);
  const beforeScore = scoreMatch ? line.slice(0, scoreMatch.index).trim() : line.trim();
  const byLeadingNo = beforeScore.match(/^0*(\d{1,3})(?=$|[^\d])/);
  if (byLeadingNo) return Number(byLeadingNo[1]);

  const compactLine = line.replace(/\s+/g, "");
  const byTeams = matches.find((match) => {
    const [home, away] = splitMatchTeams(match.teams);
    return home && away && compactLine.includes(home.replace(/\s+/g, "")) && compactLine.includes(away.replace(/\s+/g, ""));
  });
  return byTeams?.matchNo ? Number(byTeams.matchNo) : null;
}

function parsePlainResultLine(line, matches = []) {
  const text = String(line ?? "").trim();
  if (!text || text.startsWith("#")) return null;

  const scoreMatch = text.match(/(\d+)\s*(?:-|:|：|比)\s*(\d+)/);
  if (!scoreMatch) return null;

  const matchNo = matchFromResultLine(text, matches);
  if (!matchNo) return null;

  const match = matches.find((item) => Number(item.matchNo) === Number(matchNo));
  const [homeTeam, awayTeam] = splitMatchTeams(match?.teams);
  const beforeScore = text.slice(0, scoreMatch.index).replace(/\s+/g, "");
  const afterScore = text.slice(scoreMatch.index + scoreMatch[0].length).replace(/\s+/g, "");
  const reversedTeams =
    homeTeam &&
    awayTeam &&
    beforeScore.includes(awayTeam.replace(/\s+/g, "")) &&
    afterScore.includes(homeTeam.replace(/\s+/g, ""));

  const halfScoreMatch = text
    .slice(scoreMatch.index + scoreMatch[0].length)
    .match(/(?:半场|上半场|HT|半)\s*(\d+)\s*(?:-|:|：|比)\s*(\d+)/i);

  const result = {
    id: matchIdFromNumber(matchNo),
    matchNo,
    homeScore: reversedTeams ? Number(scoreMatch[2]) : Number(scoreMatch[1]),
    awayScore: reversedTeams ? Number(scoreMatch[1]) : Number(scoreMatch[2]),
    importedAt: new Date().toISOString()
  };

  if (halfScoreMatch) {
    result.homeHalfScore = reversedTeams ? Number(halfScoreMatch[2]) : Number(halfScoreMatch[1]);
    result.awayHalfScore = reversedTeams ? Number(halfScoreMatch[1]) : Number(halfScoreMatch[2]);
  }

  return result;
}

function parsePlainResultsPayload(text, matches = []) {
  const map = {};
  String(text ?? "")
    .split(/\r?\n|;/)
    .map((line) => parsePlainResultLine(line, matches))
    .filter(Boolean)
    .forEach((row) => {
      map[row.id] = row;
    });
  return map;
}

export function parseOddsImportPayload(text) {
  const parsed = parseJsonImportText(text);
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.markets) ? parsed.markets : Object.values(parsed);
  const map = {};
  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const id = row.id ?? (row.matchNo ? matchIdFromNumber(row.matchNo) : null);
    if (id) map[id] = row;
  });
  return map;
}

export function parseResultsPayload(text, matches = []) {
  let parsed;
  try {
    parsed = parseJsonImportText(text);
  } catch {
    return parsePlainResultsPayload(text, matches);
  }

  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.results) ? parsed.results : Object.values(parsed);
  const map = {};
  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const id = row.id ?? (row.matchNo ? matchIdFromNumber(row.matchNo) : null);
    const homeScore = Number(row.homeScore ?? row.home ?? row.homeGoals);
    const awayScore = Number(row.awayScore ?? row.away ?? row.awayGoals);
    if (!id || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return;
    map[id] = {
      id,
      matchNo: Number(row.matchNo ?? id.split("-").at(-1)),
      homeScore,
      awayScore,
      ...(Number.isFinite(Number(row.homeHalfScore ?? row.halfHome ?? row.homeHalf ?? row.htHome))
        ? { homeHalfScore: Number(row.homeHalfScore ?? row.halfHome ?? row.homeHalf ?? row.htHome) }
        : {}),
      ...(Number.isFinite(Number(row.awayHalfScore ?? row.halfAway ?? row.awayHalf ?? row.htAway))
        ? { awayHalfScore: Number(row.awayHalfScore ?? row.halfAway ?? row.awayHalf ?? row.htAway) }
        : {}),
      importedAt: new Date().toISOString()
    };
  });
  return map;
}

function parseLine(value) {
  const text = String(value ?? "0").trim().replace(/\s+/g, "");
  if (text.includes("/")) {
    const sign = text.startsWith("-") ? -1 : 1;
    const unsignedText = text.replace(/^[+-]/, "");
    const numbers = unsignedText.split("/").map((item) => Number(item));
    if (numbers.every(Number.isFinite)) return sign * (numbers.reduce((sum, item) => sum + item, 0) / numbers.length);
  }
  const parsed = Number(text.replace("+", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function settleSelection(selection, results) {
  const result = results?.[selection.matchId];
  if (!result) return "pending";

  const isHalfMarket = ["handicapHalf", "totalHalf", "moneylineHalf"].includes(selection.marketType);
  const homeScore = Number(isHalfMarket ? result.homeHalfScore : result.homeScore);
  const awayScore = Number(isHalfMarket ? result.awayHalfScore : result.awayScore);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return "pending";

  if (selection.marketType === "score") {
    return Number(selection.homeScore) === homeScore && Number(selection.awayScore) === awayScore ? "won" : "lost";
  }

  if (selection.marketType === "moneyline" || selection.marketType === "moneylineHalf") {
    const winner = homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "draw";
    return winner === selection.side ? "won" : "lost";
  }

  if (selection.marketType === "total" || selection.marketType === "totalHalf") {
    const total = homeScore + awayScore;
    const line = parseLine(selection.line);
    if (total === line) return "push";
    if (selection.side === "under") return total < line ? "won" : "lost";
    return total > line ? "won" : "lost";
  }

  if (selection.marketType === "handicap" || selection.marketType === "handicapHalf") {
    const line = parseLine(selection.line);
    const adjustedHome = homeScore + line;
    if (adjustedHome === awayScore) return "push";
    if (selection.side === "away") return adjustedHome < awayScore ? "won" : "lost";
    return adjustedHome > awayScore ? "won" : "lost";
  }

  return "pending";
}

export function summarizeOrder(order, results) {
  const selections = (order.selections ?? []).map((selection) => ({
    ...selection,
    settleStatus: settleSelection(selection, results)
  }));
  const counts = selections.reduce(
    (acc, selection) => {
      acc[selection.settleStatus] += 1;
      return acc;
    },
    { won: 0, lost: 0, push: 0, pending: 0 }
  );
  return {
    ...order,
    selections,
    counts,
    isSettled: selections.length > 0 && counts.pending === 0
  };
}

export function summarizeOrders(orders, results) {
  const rows = (orders ?? []).map((order) => summarizeOrder(order, results));
  return {
    rows,
    totalOrders: rows.length,
    totalStake: rows.reduce((sum, order) => sum + Number(order.stake || 0), 0),
    won: rows.reduce((sum, order) => sum + order.counts.won, 0),
    lost: rows.reduce((sum, order) => sum + order.counts.lost, 0),
    push: rows.reduce((sum, order) => sum + order.counts.push, 0),
    pending: rows.reduce((sum, order) => sum + order.counts.pending, 0)
  };
}
