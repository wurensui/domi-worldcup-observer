"use client";

import {
  Check,
  Clock3,
  FileJson,
  LockKeyhole,
  LogOut,
  Search,
  SlidersHorizontal,
  Trophy,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CUSTOMERS,
  RESULT_LABELS,
  WC26_CLIENT_SESSION_KEY,
  WC26_CUSTOMERS_KEY,
  WC26_ODDS_KEY,
  WC26_ORDERS_KEY,
  WC26_RESULTS_KEY,
  addDaysToYmd,
  fetchDeskData,
  formatShanghaiYmd,
  getStoredCustomers,
  getReportDateRange,
  normalizeCustomers,
  orderMatchesReportDate,
  parseJsonImportText,
  postDeskAction,
  readStorageJson,
  summarizeOrders,
  writeStorageJson
} from "../lib/worldcupDesk";

const SESSION_KEY = WC26_CLIENT_SESSION_KEY;
const ODDS_KEY = WC26_ODDS_KEY;
const ORAL_HANDICAP_KEY = "wc26-show-oral-handicap";
const MATCH_LOCK_AHEAD_MS = 60 * 1000;

const marketTypeLabels = {
  handicap: "让球",
  handicapHalf: "让球上半场",
  total: "大小",
  totalHalf: "大小上半场",
  moneyline: "独赢",
  moneylineHalf: "独赢上半场",
  score: "波胆"
};

function seeded(matchNo, salt = 1) {
  const x = Math.sin((Number(matchNo) + 11) * (salt + 7) * 19.87) * 10000;
  return x - Math.floor(x);
}

function decimal(value) {
  return Number(value).toFixed(2);
}

function water(matchNo, salt) {
  return decimal(0.78 + seeded(matchNo, salt) * 0.34);
}

function formatDate(date, time) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(`${date}T${time}:00+08:00`));
}

function matchStartTimestamp(match) {
  const timestamp = new Date(`${match.date}T${match.time}:00+08:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function isMatchTimeClosed(match, now = Date.now()) {
  return now >= matchStartTimestamp(match) - MATCH_LOCK_AHEAD_MS;
}

function formatResultScore(result) {
  const homeScore = Number(result?.homeScore);
  const awayScore = Number(result?.awayScore);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;

  const homeHalfScore = Number(result?.homeHalfScore);
  const awayHalfScore = Number(result?.awayHalfScore);
  return {
    full: `${homeScore}-${awayScore}`,
    half: Number.isFinite(homeHalfScore) && Number.isFinite(awayHalfScore) ? `${homeHalfScore}-${awayHalfScore}` : ""
  };
}

function splitTeams(teams) {
  const [home = "主队待定", away = "客队待定"] = teams.split(/\s+vs\s+/i);
  return [home.trim(), away.trim()];
}

function lineFor(matchNo, side = "home") {
  const options = ["0", "-0.25", "-0.5", "-0.75", "+0.25", "+0.5"];
  const line = options[Math.floor(seeded(matchNo, side === "home" ? 2 : 3) * options.length)] ?? "0";
  return line;
}

function oppositeLine(line) {
  if (line === "0" || line === "+0" || line === "-0") return "0";
  if (line.startsWith("-")) return `+${line.slice(1)}`;
  if (line.startsWith("+")) return `-${line.slice(1)}`;
  return `-${line}`;
}

function defaultMarket(match) {
  const [home, away] = splitTeams(match.teams);
  const leanHome = seeded(match.matchNo, 5) > 0.48;
  const handicapLine = lineFor(match.matchNo, leanHome ? "home" : "away");
  const totalLine = ["2", "2/2.5", "2.5", "2.5/3", "3"][Math.floor(seeded(match.matchNo, 6) * 5)] ?? "2.5";
  const homeOdds = decimal(1.76 + seeded(match.matchNo, 7) * 1.28);
  const drawOdds = decimal(2.92 + seeded(match.matchNo, 8) * 0.74);
  const awayOdds = decimal(1.82 + seeded(match.matchNo, 9) * 1.32);

  return {
    id: match.id,
    matchNo: match.matchNo,
    status: match.matchNo % 17 === 0 ? "封盘" : match.matchNo % 11 === 0 ? "升水" : "开盘",
    risk: match.recommended ? "热" : match.matchNo % 5 === 0 ? "稳" : "常规",
    updatedAt: `${match.date} ${match.time}`,
    handicap: {
      home: leanHome ? handicapLine : oppositeLine(handicapLine),
      away: leanHome ? oppositeLine(handicapLine) : handicapLine,
      homeWater: water(match.matchNo, 10),
      awayWater: water(match.matchNo, 11)
    },
    total: {
      line: totalLine,
      overWater: water(match.matchNo, 12),
      underWater: water(match.matchNo, 13)
    },
    moneyline: {
      home,
      away,
      homeOdds,
      drawOdds,
      awayOdds
    },
    correctScore: [
      { score: "1-0", odds: decimal(5.4 + seeded(match.matchNo, 14) * 3.8) },
      { score: "1-1", odds: decimal(4.2 + seeded(match.matchNo, 15) * 2.4) },
      { score: "2-1", odds: decimal(6.0 + seeded(match.matchNo, 16) * 4.2) }
    ]
  };
}

function mergeMarket(base, override) {
  if (!override) return base;
  return {
    ...base,
    ...override,
    handicap: { ...base.handicap, ...(override.handicap ?? {}) },
    total: { ...base.total, ...(override.total ?? {}) },
    moneyline: { ...base.moneyline, ...(override.moneyline ?? {}) },
    correctScore: override.correctScore ?? base.correctScore
  };
}

function parseImportPayload(text) {
  const parsed = parseJsonImportText(text);
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.markets) ? parsed.markets : Object.values(parsed);
  const map = {};
  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const id = row.id ?? (row.matchNo ? `wc2026-${String(row.matchNo).padStart(3, "0")}` : null);
    if (id) map[id] = row;
  });
  return map;
}

function LoginScreen({ customers = DEFAULT_CUSTOMERS, onLogin }) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="min-h-screen bg-[#f4efe4] text-[#211d18]">
      <section className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden bg-[#112116] px-6 py-10 text-white md:px-12">
          <div className="absolute inset-0 opacity-35">
            <div className="h-full w-full bg-[linear-gradient(115deg,rgba(255,255,255,.08)_0_1px,transparent_1px_80px),linear-gradient(25deg,rgba(255,255,255,.08)_0_1px,transparent_1px_72px)]" />
          </div>
          <div className="relative z-10 flex h-full min-h-[420px] flex-col justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center border border-white/20 bg-white/10">
                <Trophy className="h-5 w-5 text-[#f3c969]" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#f3c969]">World Cup 2026</p>
                <h1 className="text-xl font-semibold">赛事观察室</h1>
              </div>
            </div>

            <div className="max-w-2xl py-12">
              <h2 className="text-5xl font-semibold leading-tight tracking-normal md:text-7xl">世界杯赛事观察室</h2>
              <p className="mt-5 text-lg font-semibold leading-relaxed text-[#f3c969] md:text-2xl">比分网盘口 · AI预测 · 数据解读</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-5 py-10">
          <form
            className="w-full max-w-md border border-[#211d18]/10 bg-white p-6 shadow-[0_24px_80px_rgba(30,24,18,.12)] md:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              const loginId = account.trim();
              const normalizedLoginId = loginId.toLowerCase();
              const loginPassword = password.trim();
              const normalizedLoginPassword = loginPassword.toLowerCase();
              const customer = customers.find((item) => {
                const accountValue = String(item.account ?? "").trim();
                const nameValue = String(item.name ?? "").trim();
                const passwordValue = String(item.password ?? "").trim();
                const canUseLoginId = [accountValue, nameValue].some((value) => value && value.toLowerCase() === normalizedLoginId);
                const canUsePassword = passwordValue === loginPassword || passwordValue.toLowerCase() === normalizedLoginPassword;
                return canUseLoginId && canUsePassword && item.status !== "停用";
              });
              if (customer) {
                const session = { account: customer.account, name: customer.name || customer.account };
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                onLogin(session);
                return;
              }
              setError("账号或密码不正确");
            }}
          >
            <span className="grid h-12 w-12 place-items-center bg-[#112116] text-white">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <h3 className="mt-7 text-3xl font-semibold">客户登录</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#211d18]/55">输入客户账号或会员名后进入世界杯赛事观察室。</p>
            <p className="mt-3 border border-[#c59b43]/30 bg-[#fff8e8] px-3 py-2 text-sm leading-relaxed text-[#7c5b1c]">
              竞猜仅为现场娱乐互动，不涉及任何有奖竞猜、现金奖励或赌博行为。
            </p>

            <label className="mt-8 grid gap-2 text-sm text-[#211d18]/70">
              <span>账号/会员名</span>
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="h-12 border border-[#211d18]/12 bg-[#f7f3eb] px-4 outline-none transition focus:border-[#c59b43]"
                autoComplete="username"
                placeholder="123"
              />
            </label>
            <label className="mt-4 grid gap-2 text-sm text-[#211d18]/70">
              <span>密码</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 border border-[#211d18]/12 bg-[#f7f3eb] px-4 outline-none transition focus:border-[#c59b43]"
                type="password"
                autoComplete="current-password"
                placeholder="123"
              />
            </label>
            {error && <p className="mt-4 bg-[#8e2f2b]/10 px-4 py-3 text-sm text-[#8e2f2b]">{error}</p>}
            <button type="submit" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 bg-[#112116] px-5 text-sm font-semibold text-white transition hover:bg-[#244e31]">
              登录进入
              <Check className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, tone = "dark" }) {
  const color = tone === "gold" ? "text-[#c59b43]" : tone === "red" ? "text-[#9b302d]" : "text-[#122017]";
  return (
    <div className="border border-[#211d18]/10 bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">{label}</p>
      <strong className={`mt-2 block text-3xl font-semibold ${color}`}>{value}</strong>
    </div>
  );
}

function MarketCell({ label, primary, secondary, oral, onClick, active, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[70px] border px-3 py-2 text-left transition ${
        active ? "border-[#c59b43] bg-[#fff6df]" : "border-[#211d18]/10 bg-white hover:border-[#c59b43]/70"
      } disabled:cursor-not-allowed disabled:bg-[#efebe2] disabled:text-[#211d18]/35`}
    >
      <span className="block text-[11px] uppercase tracking-[0.18em] text-[#211d18]/42">{label}</span>
      <strong className="mt-1 block truncate text-base text-[#122017] sm:text-lg">{primary}</strong>
      {oral && <span className="mt-1 block text-xs font-semibold text-[#a57b22]">{oral}</span>}
      <span className="mt-1 block text-xs text-[#211d18]/55">{secondary}</span>
    </button>
  );
}

function parseMarketNumber(value) {
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

function handicapLineName(value) {
  const rounded = Math.round(Math.abs(value) * 4) / 4;
  const names = {
    0.25: "平/半",
    0.5: "半球",
    0.75: "半/一",
    1: "1球",
    1.25: "1球/球半",
    1.5: "球半",
    1.75: "球半/2球",
    2: "2球",
    2.25: "2球/2球半",
    2.5: "2球半",
    2.75: "2球半/3球",
    3: "3球",
    3.25: "3球/3球半",
    3.5: "3球半"
  };
  return names[rounded] ?? `${Number(rounded.toFixed(2))}球`;
}

function handicapOralExpression(line) {
  const value = parseMarketNumber(line);
  if (!Number.isFinite(value) || value === 0) return "平手";
  return `${value > 0 ? "受让" : "让"}${handicapLineName(value)}`;
}

function handicapLineFromOption(option) {
  if (!option || !String(option.type ?? "").startsWith("handicap")) return "";
  const extraLine = option.extra?.line;
  if (extraLine !== undefined && extraLine !== null) {
    return option.extra?.side === "away" ? oppositeLine(String(extraLine)) : String(extraLine);
  }

  const match = String(option.primary ?? "").match(/([+-]?(?:\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?|0\/0\.5))$/);
  return match?.[1] ?? "";
}

function handicapOralForOption(option) {
  const line = handicapLineFromOption(option);
  return line ? handicapOralExpression(line) : "";
}

function handicapOralForSelection(type, pick, extra) {
  return handicapOralForOption({ type, primary: pick, extra });
}

function formatMarketLine(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return "0";
  const sign = number > 0 ? "+" : "-";
  const abs = Math.abs(number);
  const rounded = Math.round(abs * 4) / 4;
  const lower = Math.floor(rounded * 2) / 2;
  const upper = lower + 0.5;
  const clean = (item) => Number(item.toFixed(2)).toString();
  if (Math.abs(rounded - lower - 0.25) < 0.01) return `${sign}${clean(lower)}/${clean(upper)}`;
  return `${sign}${clean(rounded)}`;
}

function formatTotalLine(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  const rounded = Math.round(number * 4) / 4;
  const lower = Math.floor(rounded * 2) / 2;
  const upper = lower + 0.5;
  const clean = (item) => Number(item.toFixed(2)).toString();
  if (Math.abs(rounded - lower - 0.25) < 0.01) return `${clean(lower)}/${clean(upper)}`;
  return clean(rounded);
}

function detailWater(matchNo, salt, min = 0.52, max = 1.48) {
  return decimal(min + seeded(matchNo, salt) * (max - min));
}

function detailOdds(matchNo, salt, min = 1.45, max = 8.8) {
  return decimal(min + seeded(matchNo, salt) * (max - min));
}

function scoreOdds(matchNo, homeScore, awayScore) {
  const goals = homeScore + awayScore;
  const gap = Math.abs(homeScore - awayScore);
  const base = 5.2 + goals * 13 + gap * 8 + seeded(matchNo + homeScore * 7 + awayScore * 11, 23) * 10;
  if (goals >= 7) return String(Math.min(311, Math.round(base + 150)));
  if (goals >= 5) return String(Math.min(311, Math.round(base + 70)));
  return decimal(base);
}

function buildCommonOptions(match, market) {
  const [home, away] = splitTeams(match.teams);
  return [
    { type: "handicap", label: "让球 主", primary: `${home} ${market.handicap.home}`, secondary: `水位 ${market.handicap.homeWater}`, price: market.handicap.homeWater, extra: { line: market.handicap.home, side: "home", keySuffix: `home:${market.handicap.home}` } },
    { type: "handicap", label: "让球 客", primary: `${away} ${market.handicap.away}`, secondary: `水位 ${market.handicap.awayWater}`, price: market.handicap.awayWater, extra: { line: market.handicap.home, side: "away", keySuffix: `away:${market.handicap.home}` } },
    { type: "total", label: "大小 大", primary: `大 ${market.total.line}`, secondary: `水位 ${market.total.overWater}`, price: market.total.overWater, extra: { line: market.total.line, side: "over", keySuffix: `over:${market.total.line}` } },
    { type: "total", label: "大小 小", primary: `小 ${market.total.line}`, secondary: `水位 ${market.total.underWater}`, price: market.total.underWater, extra: { line: market.total.line, side: "under", keySuffix: `under:${market.total.line}` } },
    { type: "moneyline", label: "独赢 主", primary: home, secondary: `水位 ${market.moneyline.homeOdds}`, price: market.moneyline.homeOdds, extra: { side: "home" } },
    { type: "moneyline", label: "独赢 平", primary: "平局", secondary: `水位 ${market.moneyline.drawOdds}`, price: market.moneyline.drawOdds, extra: { side: "draw" } },
    { type: "moneyline", label: "独赢 客", primary: away, secondary: `水位 ${market.moneyline.awayOdds}`, price: market.moneyline.awayOdds, extra: { side: "away" } }
  ];
}

function makeMarketOption(match, type, label, primary, price, extra = {}) {
  return { type, label, primary, secondary: `水位 ${price}`, price, extra };
}

function normalizeImportedOption(option, fallbackType, fallbackLabel) {
  if (!option || typeof option !== "object") return null;
  const price = option.price ?? option.odds ?? option.water;
  const primary = option.primary ?? option.selection ?? option.score ?? option.name;
  if (price === undefined || price === null || primary === undefined || primary === null) return null;

  return {
    type: option.type ?? fallbackType,
    label: option.label ?? fallbackLabel,
    primary: String(primary),
    secondary: option.secondary ?? `水位 ${price}`,
    price: String(price),
    extra: { ...(option.extra ?? {}) }
  };
}

function normalizeImportedOptions(options, fallbackType, fallbackLabel) {
  if (!Array.isArray(options)) return null;
  const rows = options.map((option) => normalizeImportedOption(option, fallbackType, fallbackLabel)).filter(Boolean);
  return rows.length ? rows : null;
}

function normalizeImportedScoreColumns(columns) {
  if (!Array.isArray(columns)) return null;
  const rows = columns
    .map((column) => {
      const options = normalizeImportedOptions(column?.options, "score", "波胆");
      return options ? { title: column.title ?? "", options } : null;
    })
    .filter(Boolean);
  return rows.length ? rows : null;
}

function importedOptionKey(option) {
  return option?.extra?.keySuffix ?? option?.extra?.side ?? option?.primary;
}

function mergeScoreColumns(baseColumns, importedColumns) {
  if (!Array.isArray(importedColumns) || !importedColumns.length) return baseColumns;
  const byTitle = new Map();
  const order = [];

  const ensureColumn = (title) => {
    const safeTitle = title || "波胆";
    if (!byTitle.has(safeTitle)) {
      byTitle.set(safeTitle, []);
      order.push(safeTitle);
    }
    return safeTitle;
  };

  (Array.isArray(baseColumns) ? baseColumns : []).forEach((column) => {
    const title = ensureColumn(column?.title);
    byTitle.set(title, [...(byTitle.get(title) ?? []), ...(Array.isArray(column?.options) ? column.options : [])]);
  });

  importedColumns.forEach((column) => {
    const title = ensureColumn(column?.title);
    const currentOptions = byTitle.get(title) ?? [];
    const importedOptions = Array.isArray(column?.options) ? column.options : [];
    const importedKeys = new Set(importedOptions.map((option) => importedOptionKey(option)));
    byTitle.set(title, [...currentOptions.filter((option) => !importedKeys.has(importedOptionKey(option))), ...importedOptions]);
  });

  return order.map((title) => ({ title, options: byTitle.get(title) ?? [] })).filter((column) => column.options.length);
}

function mergeImportedFullMarkets(groups, market) {
  const imported = market.fullMarkets ?? market.details ?? market.full;
  if (!imported || typeof imported !== "object") return groups;

  const next = { ...groups };
  [
    ["handicap", "handicap", "让球"],
    ["handicapHalf", "handicapHalf", "让球 上半场"],
    ["totals", "total", "大小"],
    ["totalsHalf", "totalHalf", "大小 上半场"],
    ["moneyline", "moneyline", "独赢"],
    ["moneylineHalf", "moneylineHalf", "独赢 上半场"]
  ].forEach(([groupKey, type, label]) => {
    const options = normalizeImportedOptions(imported[groupKey], type, label);
    if (options) next[groupKey] = options;
  });

  const score = normalizeImportedScoreColumns(imported.score);
  if (score) next.score = mergeScoreColumns(groups.score, score);
  return next;
}

function buildFullMarketGroups(match, market) {
  const [home, away] = splitTeams(match.teams);
  const baseHandicap = parseMarketNumber(market.handicap.home);
  const baseTotal = parseMarketNumber(market.total.line);
  const handicapLines = [baseHandicap - 0.5, baseHandicap, baseHandicap + 0.5];
  const halfHandicapLines = [baseHandicap / 2 - 0.25, baseHandicap / 2, baseHandicap / 2 + 0.25];
  const totalLines = [baseTotal, baseTotal + 0.5, baseTotal + 0.75];
  const halfTotalBase = Math.max(0.5, baseTotal / 2);
  const halfTotalLines = [halfTotalBase, halfTotalBase + 0.25, halfTotalBase + 0.5];

  const handicap = handicapLines.flatMap((line, index) => [
    makeMarketOption(match, "handicap", "让球", `${home} ${formatMarketLine(line)}`, index === 1 ? market.handicap.homeWater : detailWater(match.matchNo, 30 + index), { line: formatMarketLine(line), side: "home", keySuffix: `home:${formatMarketLine(line)}` }),
    makeMarketOption(match, "handicap", "让球", `${away} ${formatMarketLine(-line)}`, index === 1 ? market.handicap.awayWater : detailWater(match.matchNo, 40 + index), { line: formatMarketLine(line), side: "away", keySuffix: `away:${formatMarketLine(line)}` })
  ]);

  const handicapHalf = halfHandicapLines.flatMap((line, index) => [
    makeMarketOption(match, "handicapHalf", "让球 上半场", `${home} ${formatMarketLine(line)}`, detailWater(match.matchNo, 50 + index), { line: formatMarketLine(line), side: "home", keySuffix: `home:${formatMarketLine(line)}` }),
    makeMarketOption(match, "handicapHalf", "让球 上半场", `${away} ${formatMarketLine(-line)}`, detailWater(match.matchNo, 60 + index), { line: formatMarketLine(line), side: "away", keySuffix: `away:${formatMarketLine(line)}` })
  ]);

  const totals = totalLines.flatMap((line, index) => [
    makeMarketOption(match, "total", "大小", `大 ${formatTotalLine(line)}`, index === 0 ? market.total.overWater : detailWater(match.matchNo, 70 + index), { line: formatTotalLine(line), side: "over", keySuffix: `over:${formatTotalLine(line)}` }),
    makeMarketOption(match, "total", "大小", `小 ${formatTotalLine(line)}`, index === 0 ? market.total.underWater : detailWater(match.matchNo, 80 + index), { line: formatTotalLine(line), side: "under", keySuffix: `under:${formatTotalLine(line)}` })
  ]);

  const totalsHalf = halfTotalLines.flatMap((line, index) => [
    makeMarketOption(match, "totalHalf", "大小 上半场", `大 ${formatTotalLine(line)}`, detailWater(match.matchNo, 90 + index), { line: formatTotalLine(line), side: "over", keySuffix: `over:${formatTotalLine(line)}` }),
    makeMarketOption(match, "totalHalf", "大小 上半场", `小 ${formatTotalLine(line)}`, detailWater(match.matchNo, 100 + index), { line: formatTotalLine(line), side: "under", keySuffix: `under:${formatTotalLine(line)}` })
  ]);

  const moneyline = [
    makeMarketOption(match, "moneyline", "独赢", home, market.moneyline.homeOdds, { side: "home" }),
    makeMarketOption(match, "moneyline", "独赢", "平局", market.moneyline.drawOdds, { side: "draw" }),
    makeMarketOption(match, "moneyline", "独赢", away, market.moneyline.awayOdds, { side: "away" })
  ];

  const moneylineHalf = [
    makeMarketOption(match, "moneylineHalf", "独赢 上半场", home, detailOdds(match.matchNo, 110, 1.8, 4.8), { side: "home" }),
    makeMarketOption(match, "moneylineHalf", "独赢 上半场", "平局", detailOdds(match.matchNo, 111, 1.9, 4.5), { side: "draw" }),
    makeMarketOption(match, "moneylineHalf", "独赢 上半场", away, detailOdds(match.matchNo, 112, 1.8, 5.6), { side: "away" })
  ];

  const homeScores = [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2], [4, 0], [4, 1], [4, 2], [4, 3], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [6, 0], [6, 1], [6, 2]];
  const drawScores = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
  const awayScores = [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3], [0, 4], [1, 4], [2, 4], [3, 4]];
  const score = [
    { title: home, items: homeScores },
    { title: "和局", items: drawScores },
    { title: away, items: awayScores }
  ].map((column) => ({
    ...column,
    options: column.items.map(([homeScore, awayScore]) =>
      makeMarketOption(match, "score", "波胆", `${homeScore}-${awayScore}`, scoreOdds(match.matchNo, homeScore, awayScore), { homeScore, awayScore, keySuffix: `${homeScore}-${awayScore}` })
    )
  }));

  const groups = {
    popular: buildCommonOptions(match, market),
    handicap,
    handicapHalf,
    totals,
    totalsHalf,
    moneyline,
    moneylineHalf,
    score
  };
  return mergeImportedFullMarkets(groups, market);
}

function MatchRow({ match, market, selectedKeys = [], showOralLines, timeClosed = false, onPick, onOpenDetails }) {
  const [home, away] = splitTeams(match.teams);
  const disabled = timeClosed || market.status === "封盘";
  const visibleStatus = timeClosed ? "已开赛" : market.status;
  const isActive = (key) => selectedKeys.includes(key);
  const commonOptions = buildCommonOptions(match, market);
  const [handicapHome, handicapAway, totalOver, totalUnder, moneyHome, moneyDraw, moneyAway] = commonOptions;
  const compactPick = (option) => onPick(match, option.type, option.primary, option.price, option.extra);
  const compactActive = (option) => isActive(optionKey(match, option));

  return (
    <>
      <article className="border border-[#211d18]/10 bg-white md:hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[#211d18]/10 bg-[#eeeeec] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs font-semibold text-[#527044]">M{String(match.matchNo).padStart(3, "0")}</span>
            <span className="text-sm font-semibold text-[#211d18]">{match.date.slice(5).replace("-", "月")}日 {match.time}</span>
          </div>
          <span className={`shrink-0 px-2 py-1 text-[11px] ${disabled ? "bg-[#8e2f2b]/10 text-[#8e2f2b]" : "bg-[#527044]/10 text-[#527044]"}`}>{visibleStatus}</span>
        </div>

        <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-2 p-3">
          <button type="button" onClick={onOpenDetails} className="flex min-w-0 flex-col justify-between text-left">
            <div className="space-y-3">
              <p className="truncate text-lg font-semibold text-[#211d18]">{home}</p>
              <p className="truncate text-lg font-semibold text-[#211d18]">{away}</p>
            </div>
            <div className="mt-4 space-y-2">
              <span className="inline-flex h-7 items-center rounded-full bg-[#f3f1ed] px-2 text-xs font-semibold text-[#211d18]/64">{match.group ?? match.tag}</span>
              <span className="block text-xs font-semibold text-[#527044]">全部盘口 ›</span>
            </div>
          </button>

          <div className="grid min-w-0 grid-cols-3 gap-1.5">
            <CompactMarketColumn title="让球">
              <CompactOddButton option={handicapHome} active={compactActive(handicapHome)} disabled={disabled} onPick={() => compactPick(handicapHome)} shortText={market.handicap.home} oral={showOralLines ? handicapOralForOption(handicapHome) : ""} />
              <CompactOddButton option={handicapAway} active={compactActive(handicapAway)} disabled={disabled} onPick={() => compactPick(handicapAway)} shortText={market.handicap.away} oral={showOralLines ? handicapOralForOption(handicapAway) : ""} />
            </CompactMarketColumn>
            <CompactMarketColumn title="大小">
              <CompactOddButton option={totalOver} active={compactActive(totalOver)} disabled={disabled} onPick={() => compactPick(totalOver)} shortText={`大 ${market.total.line}`} />
              <CompactOddButton option={totalUnder} active={compactActive(totalUnder)} disabled={disabled} onPick={() => compactPick(totalUnder)} shortText={`小 ${market.total.line}`} />
            </CompactMarketColumn>
            <CompactMarketColumn title="独赢">
              <CompactOddButton option={moneyHome} active={compactActive(moneyHome)} disabled={disabled} onPick={() => compactPick(moneyHome)} shortText="主" />
              <CompactOddButton option={moneyAway} active={compactActive(moneyAway)} disabled={disabled} onPick={() => compactPick(moneyAway)} shortText="客" />
              <CompactOddButton option={moneyDraw} active={compactActive(moneyDraw)} disabled={disabled} onPick={() => compactPick(moneyDraw)} shortText="和" />
            </CompactMarketColumn>
          </div>
        </div>
      </article>

      <article className="hidden gap-4 border border-[#211d18]/10 bg-[#fbf8ef] p-4 md:grid md:grid-cols-[minmax(210px,0.74fr)_minmax(280px,1fr)_minmax(420px,1.34fr)] md:items-center">
      <div className="flex items-start justify-between gap-4 md:block">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#527044]">M{String(match.matchNo).padStart(3, "0")}</p>
          <h3 className="mt-2 text-lg font-semibold text-[#211d18]">{formatDate(match.date, match.time)}</h3>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-[#211d18]/56">
            <Clock3 className="h-4 w-4 text-[#c59b43]" />
            北京时间
          </p>
        </div>
        <span className={`shrink-0 px-3 py-1.5 text-xs ${disabled ? "bg-[#8e2f2b]/10 text-[#8e2f2b]" : "bg-[#527044]/10 text-[#527044]"}`}>{visibleStatus}</span>
      </div>

      <button type="button" onClick={onOpenDetails} className="text-left">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-white px-3 py-1.5 text-[#211d18]/58">{match.phase}</span>
          <span className="bg-[#c59b43]/12 px-3 py-1.5 text-[#7c5b1c]">{match.group ?? match.tag}</span>
          <span className="bg-[#8e2f2b]/10 px-3 py-1.5 text-[#8e2f2b]">风险：{market.risk}</span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <strong className="min-w-0 text-right text-xl text-[#122017]">{home}</strong>
          <span className="grid h-9 w-9 place-items-center bg-[#122017] text-xs font-semibold text-white">VS</span>
          <strong className="min-w-0 text-xl text-[#122017]">{away}</strong>
        </div>
        <span className="mt-3 inline-flex h-8 items-center bg-white px-3 text-xs font-semibold text-[#527044]">点击球队查看全部盘口</span>
      </button>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[#211d18]/50">
          <span className="font-semibold text-[#211d18]">常玩</span>
          <button type="button" onClick={onOpenDetails} className="text-[#527044]">全部盘口</button>
        </div>
        <div className="grid grid-flow-col auto-cols-[136px] gap-2 overflow-x-auto pb-1 md:grid-flow-row md:grid-cols-3 md:auto-cols-auto xl:grid-cols-4">
          {commonOptions.map((option) => {
            const key = `${match.id}:${option.type}:${option.extra.keySuffix ?? option.extra.side ?? option.primary}`;
            return (
              <MarketCell
                key={key}
                label={option.label}
                primary={option.primary}
                secondary={option.secondary}
                oral={showOralLines ? handicapOralForOption(option) : ""}
                disabled={disabled}
                active={isActive(key)}
                onClick={() => onPick(match, option.type, option.primary, option.price, option.extra)}
              />
            );
          })}
        </div>
      </div>
    </article>
    </>
  );
}

function CompactMarketColumn({ title, children }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-center text-[11px] font-semibold text-[#211d18]/45">{title}</p>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}

function CompactOddButton({ option, shortText, oral, active, disabled, onPick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={`min-h-[48px] border px-1 py-1.5 text-center transition ${
        active ? "border-[#c59b43] bg-[#fff6df]" : "border-[#211d18]/10 bg-[#fbfbfa]"
      } disabled:cursor-not-allowed disabled:bg-[#efebe2] disabled:text-[#211d18]/35`}
    >
      <span className="block truncate text-[13px] font-semibold leading-tight text-[#211d18]">{shortText}</span>
      {oral && <span className="block truncate text-[10px] font-semibold leading-tight text-[#a57b22]">{oral}</span>}
      <strong className="mt-0.5 block text-base leading-tight text-[#c72516]">{option.price}</strong>
    </button>
  );
}

function optionKey(match, option) {
  return `${match.id}:${option.type}:${option.extra?.keySuffix ?? option.extra?.side ?? option.primary}`;
}

function DetailOptionButton({ match, option, oral, active, disabled, onPick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(match, option.type, option.primary, option.price, option.extra)}
      className={`min-h-[70px] border px-3 py-3 text-center transition ${
        active ? "border-[#c59b43] bg-[#fff6df]" : "border-[#211d18]/10 bg-white hover:border-[#c59b43]/70"
      } disabled:cursor-not-allowed disabled:bg-[#efebe2] disabled:text-[#211d18]/35`}
    >
      <span className="block text-sm font-semibold text-[#211d18]">{option.primary}</span>
      {oral && <span className="mt-1 block text-xs font-semibold text-[#a57b22]">{oral}</span>}
      <strong className="mt-1 block text-xl text-[#c72516]">{option.price}</strong>
    </button>
  );
}

function OptionGrid({ title, subtitle, options, match, selectedKeys, disabled, showOralLines, onPick, columns = "grid-cols-2" }) {
  return (
    <section>
      <div className="bg-[#eeeeec] px-4 py-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        {subtitle && <p className="mt-1 text-base text-[#211d18]/55">{subtitle}</p>}
      </div>
      <div className={`grid ${columns} gap-3 px-4 py-4`}>
        {options.map((option) => {
          const key = optionKey(match, option);
          return <DetailOptionButton key={key} match={match} option={option} oral={showOralLines ? handicapOralForOption(option) : ""} active={selectedKeys.includes(key)} disabled={disabled} onPick={onPick} />;
        })}
      </div>
    </section>
  );
}

function ScoreGrid({ scoreColumns, match, selectedKeys, disabled, onPick }) {
  return (
    <section>
      <div className="bg-[#eeeeec] px-4 py-4">
        <h3 className="text-xl font-semibold">波胆</h3>
        <div className="mt-4 flex items-center gap-4 text-sm font-semibold text-[#211d18]/65">
          <span className="text-[#a57b22]">全选项</span>
          <span>自选比分</span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_0.62fr_1fr] border-t border-[#211d18]/10 bg-white">
        {scoreColumns.map((column) => (
          <div key={column.title} className="border-r border-[#211d18]/10 px-2 py-4 last:border-r-0">
            <h4 className="mb-3 text-center text-sm text-[#211d18]/45">{column.title}</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {column.options.map((option) => {
                const key = optionKey(match, option);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(match, option.type, option.primary, option.price, option.extra)}
                    className={`min-h-[58px] px-1 text-center transition ${selectedKeys.includes(key) ? "bg-[#fff6df]" : "bg-white hover:bg-[#f7f3eb]"} disabled:text-[#211d18]/30`}
                  >
                    <span className="block text-sm">{option.primary}</span>
                    <strong className="block text-lg text-[#c72516]">{option.price}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FullMarketPanel({ match, market, selectedKeys, showOralLines, timeClosed = false, result, onToggleOralLines, onPick, onClose }) {
  const [tab, setTab] = useState("popular");
  const [home, away] = splitTeams(match.teams);
  const disabled = timeClosed || market.status === "封盘";
  const resultScore = formatResultScore(result);
  const groups = useMemo(() => buildFullMarketGroups(match, market), [match, market]);
  const tabs = [
    { id: "popular", label: "热门" },
    { id: "handicap", label: "让球 & 大小" },
    { id: "moneyline", label: "独赢" },
    { id: "score", label: "波胆" }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white text-[#211d18]">
      <header className="sticky top-0 z-20 bg-[#071d10] text-white shadow-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center text-3xl leading-none text-white/80" aria-label="返回">
            ‹
          </button>
          <h2 className="text-lg font-semibold">世界杯2026(美加墨)</h2>
          <button
            type="button"
            onClick={onToggleOralLines}
            className={`h-9 px-3 text-xs font-semibold ${showOralLines ? "bg-[#f3c969] text-[#071d10]" : "bg-white/10 text-white/72"}`}
          >
            口语
          </button>
        </div>
      </header>

      <section className="bg-[#2d241d] px-4 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 text-xl font-semibold">
            <p>{home}</p>
            <p>{away}</p>
          </div>
          <div className="text-right text-[#f3c969]">
            <p>{match.date.slice(5).replace("-", "月")}日</p>
            <p>{match.time}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-white/55">M{String(match.matchNo).padStart(3, "0")} · {match.phase}</p>
        {(disabled || resultScore) && (
          <div className="mt-3 grid gap-2 text-sm">
            {disabled && <span className="inline-flex w-fit bg-[#8e2f2b]/35 px-3 py-1 text-white">盘口已关闭</span>}
            {resultScore && <span className="inline-flex w-fit bg-[#527044]/35 px-3 py-1 text-white">赛果 {resultScore.full}{resultScore.half ? ` · 半场 ${resultScore.half}` : ""}</span>}
          </div>
        )}
      </section>

      <nav className="sticky top-14 z-10 flex gap-6 overflow-x-auto border-b border-[#211d18]/10 bg-white px-4 text-base">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`h-14 shrink-0 border-b-2 ${tab === item.id ? "border-[#c59b43] font-semibold text-[#a57b22]" : "border-transparent text-[#211d18]/62"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="pb-80">
        {tab === "popular" && (
          <>
            <OptionGrid title="热门" subtitle="常玩盘口" options={groups.popular} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} />
            <OptionGrid title="让球" options={groups.handicap.slice(0, 6)} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} />
            <OptionGrid title="大小" options={groups.totals.slice(0, 6)} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} />
          </>
        )}
        {tab === "handicap" && (
          <>
            <OptionGrid title="让球" options={groups.handicap} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} />
            <OptionGrid title="让球" subtitle="上半场" options={groups.handicapHalf} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} />
            <OptionGrid title="大小" options={groups.totals} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} />
            <OptionGrid title="大小" subtitle="上半场" options={groups.totalsHalf} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} />
          </>
        )}
        {tab === "moneyline" && (
          <>
            <OptionGrid title="独赢" options={groups.moneyline} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} columns="grid-cols-3" />
            <OptionGrid title="独赢" subtitle="上半场" options={groups.moneylineHalf} match={match} selectedKeys={selectedKeys} disabled={disabled} showOralLines={showOralLines} onPick={onPick} columns="grid-cols-3" />
          </>
        )}
        {tab === "score" && <ScoreGrid scoreColumns={groups.score} match={match} selectedKeys={selectedKeys} disabled={disabled} onPick={onPick} />}
      </div>
    </div>
  );
}

function StartedMatchCard({ match, result }) {
  const [home, away] = splitTeams(match.teams);
  const resultScore = formatResultScore(result);

  return (
    <article className="border border-[#211d18]/10 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#211d18]/10 bg-[#eeeeec] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#527044]">M{String(match.matchNo).padStart(3, "0")}</p>
          <p className="mt-1 text-sm font-semibold text-[#211d18]">{match.date.slice(5).replace("-", "月")}日 {match.time}</p>
        </div>
        <span className="shrink-0 bg-[#8e2f2b]/10 px-3 py-1.5 text-xs font-semibold text-[#8e2f2b]">已开赛</span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <strong className="text-xl text-[#122017] md:text-right">{home}</strong>
        <span className="hidden h-9 w-9 place-items-center bg-[#122017] text-xs font-semibold text-white md:grid">VS</span>
        <strong className="text-xl text-[#122017]">{away}</strong>
      </div>

      <div className="border-t border-[#211d18]/10 p-4">
        {resultScore ? (
          <div className="grid gap-1 bg-[#527044]/10 px-4 py-3 text-sm text-[#211d18]">
            <span className="text-[#211d18]/55">赛果</span>
            <strong className="text-2xl text-[#527044]">{resultScore.full}</strong>
            {resultScore.half && <span className="text-[#211d18]/55">半场 {resultScore.half}</span>}
          </div>
        ) : (
          <div className="bg-[#f7f3eb] px-4 py-3 text-sm font-semibold text-[#211d18]/55">赛果待导入</div>
        )}
      </div>
    </article>
  );
}

function StartedMatchesPage({ matches, results }) {
  return (
    <div className="mx-auto grid max-w-[980px] gap-4 px-4 py-4 md:px-6">
      <section className="border border-[#211d18]/10 bg-[#fbf8ef] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.22em] text-[#211d18]/42">赛事</p>
            <h2 className="mt-1 text-2xl font-semibold">已开赛</h2>
          </div>
          <span className="bg-white px-3 py-1.5 text-sm font-semibold text-[#527044]">{matches.length} 场</span>
        </div>
      </section>

      {matches.length ? (
        <section className="grid gap-3">
          {matches.map((match) => (
            <StartedMatchCard key={match.id} match={match} result={results[match.id]} />
          ))}
        </section>
      ) : (
        <section className="grid min-h-[240px] place-items-center border border-[#211d18]/10 bg-white p-6 text-center text-sm text-[#211d18]/55">暂无已开赛赛事。</section>
      )}
    </div>
  );
}

function Slip({ selections, onRemove, onClear, onSubmitOrder, className = "" }) {
  const [stakeValue, setStakeValue] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const total = selections.length;
  const estimate = selections.reduce((sum, item) => sum + Number(item.price || 0), 0).toFixed(2);
  const numericStake = Number(stakeValue);
  const canSubmit = selections.length > 0 && Number.isFinite(numericStake) && numericStake > 0;

  return (
    <aside className={`${className} sticky top-4 h-fit border border-[#211d18]/10 bg-white`}>
      <div className="border-b border-[#211d18]/10 px-4 py-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[#211d18]/42">Ticket</p>
        <h2 className="mt-2 text-2xl font-semibold">竞猜单</h2>
      </div>
      <div className="max-h-[420px] overflow-auto p-4">
        {selections.length === 0 ? (
          <div className="grid min-h-[180px] place-items-center bg-[#f7f3eb] px-4 text-center text-sm leading-relaxed text-[#211d18]/50">选择盘口后会出现在这里</div>
        ) : (
          <div className="space-y-3">
            {selections.map((item) => (
              <div key={item.key} className="border border-[#211d18]/10 bg-[#fbf8ef] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#527044]">M{String(item.matchNo).padStart(3, "0")} · {item.type}</p>
                    <strong className="mt-1 block text-sm text-[#211d18]">{item.teams}</strong>
                  </div>
                  <button type="button" onClick={() => onRemove(item.key)} className="grid h-7 w-7 place-items-center border border-[#211d18]/10 text-[#211d18]/55 hover:border-[#8e2f2b] hover:text-[#8e2f2b]" aria-label="移除">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between bg-white px-3 py-2 text-sm">
                  <span>
                    {item.pick}
                    {item.lineSpeech && <em className="ml-2 not-italic text-[#a57b22]">{item.lineSpeech}</em>}
                  </span>
                  <strong>{item.price}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-[#211d18]/10 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="单注" value={total} />
          <Stat label="水位" value={estimate} tone="gold" />
        </div>
        <form
          className="mt-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canSubmit) return;
            const order = await onSubmitOrder?.(numericStake);
            setStakeValue("");
            setSubmittedText(order ? `已提交订单 ${order.id}` : `已提交，竞猜数值 ${numericStake.toFixed(2)}`);
          }}
        >
          <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#211d18]/45">
            竞猜数值
            <input
              required
              min="1"
              step="0.01"
              type="number"
              inputMode="decimal"
              value={stakeValue}
              onChange={(event) => {
                setStakeValue(event.target.value);
                setSubmittedText("");
              }}
              className="h-11 w-full border border-[#211d18]/10 bg-[#f7f3eb] px-3 text-base normal-case tracking-normal text-[#211d18] outline-none focus:border-[#c59b43]"
              placeholder="请输入数值"
            />
          </label>
          {selections.length > 0 && !canSubmit && <p className="mt-2 text-xs text-[#8e2f2b]">填写竞猜数值后才能提交。</p>}
          {submittedText && <p className="mt-2 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">{submittedText}</p>}
          <button type="submit" disabled={!canSubmit} className="mt-3 h-11 w-full bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044] disabled:cursor-not-allowed disabled:bg-[#211d18]/18">
            提交竞猜单
          </button>
        </form>
        {selections.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setStakeValue("");
              setSubmittedText("");
              onClear();
            }}
            className="mt-2 h-10 w-full border border-[#211d18]/10 text-sm text-[#211d18]/60 transition hover:border-[#8e2f2b] hover:text-[#8e2f2b]"
          >
            清空
          </button>
        )}
      </div>
    </aside>
  );
}

function MobileOrderDock({ selections, onRemove, onClear, onSubmitOrder }) {
  const [stakeValue, setStakeValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submittedText, setSubmittedText] = useState("");
  const total = selections.length;
  const numericStake = Number(stakeValue);
  const latest = selections[0] ?? null;
  const odds = Number(latest?.price || 0);
  const possibleWin = Number.isFinite(numericStake) && Number.isFinite(odds) ? numericStake * odds : 0;
  const canSubmit = total > 0 && Number.isFinite(numericStake) && numericStake > 0;

  useEffect(() => {
    if (total > 0) {
      setSubmittedText("");
    }
    setConfirming(false);
  }, [total]);

  if (total === 0) {
    if (!submittedText) return null;
    return (
      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#211d18]/10 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_40px_rgba(18,32,23,0.14)] lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">
          <span>{submittedText}</span>
          <button type="button" onClick={() => setSubmittedText("")} className="grid h-8 w-8 place-items-center border border-[#527044]/20">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#211d18]/10 bg-white shadow-[0_-16px_40px_rgba(18,32,23,0.16)] lg:hidden">
      <div className="mx-auto max-w-md">
        <div className="relative px-4 pb-4 pt-5">
          <button
            type="button"
            onClick={() => {
              if (!confirming) {
                setStakeValue("");
                setSubmittedText("");
                onClear();
              }
            }}
            disabled={confirming}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center text-[#211d18]/45 transition hover:text-[#8e2f2b] disabled:opacity-30"
            aria-label="关闭下注小窗"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="pr-10">
            <p className="text-lg font-semibold text-[#211d18]">{latest?.type ?? "单注"}</p>
            <p className="mt-1 text-sm text-[#211d18]/55">世界杯2026(美加墨)</p>
            <p className="mt-1 text-sm font-semibold text-[#211d18]">{latest?.teams}</p>
            <p className="mt-3 text-2xl font-semibold text-[#211d18]">
              {latest?.pick} <span className="text-[#211d18]/45">@</span> <span className="text-[#c7352b]">{latest?.price}</span>
            </p>
            {latest?.lineSpeech && <p className="mt-1 text-sm font-semibold text-[#a57b22]">{latest.lineSpeech}</p>}
          </div>

          <form
            className="mt-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!canSubmit) return;
              if (!confirming) {
                setConfirming(true);
                return;
              }
              const order = await onSubmitOrder?.(numericStake);
              setStakeValue("");
              setConfirming(false);
              setSubmittedText(order ? `已提交订单 ${order.id}` : `已提交，竞猜数值 ${numericStake.toFixed(2)}`);
            }}
          >
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <label className="min-w-0">
                <span className="sr-only">下单金额</span>
                <input
                  required
                  min="1"
                  step="0.01"
                  type="number"
                  inputMode="decimal"
                  value={stakeValue}
                  onChange={(event) => {
                    setStakeValue(event.target.value);
                    setConfirming(false);
                  }}
                  className="h-14 w-full border border-[#18805f] bg-white px-3 text-2xl font-semibold text-[#211d18] outline-none focus:border-[#0f9a6f]"
                  placeholder="下单金额"
                />
              </label>
              <div className="pb-1 text-right text-sm">
                <span className="block text-[#211d18]/45">可赢额</span>
                <strong className="text-base text-[#18805f]">{canSubmit ? possibleWin.toFixed(2) : "0.00"}</strong>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
              {["100", "500", "1000", "5000"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setStakeValue((current) => String(Number(current || 0) + Number(value)));
                    setConfirming(false);
                  }}
                  className="h-10 bg-[#f3f1ed] font-semibold text-[#211d18]/70"
                >
                  +{Number(value).toLocaleString()}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-[1fr_1.2fr]">
              <div className="flex h-16 items-center gap-2 bg-[#f3f1ed] px-4 text-sm text-[#211d18]/62">
                <span className="h-5 w-5 rounded-full border border-[#211d18]/45" />
                记住此次下单金额
              </div>
              <button type="submit" disabled={!canSubmit} className="h-16 bg-[#18805f] text-lg font-semibold text-white transition hover:bg-[#0f9a6f] disabled:cursor-not-allowed disabled:bg-[#211d18]/18">
                {confirming ? "确认提交" : "下注"}
                <span className="mt-1 block text-sm font-normal">{canSubmit ? `${numericStake.toFixed(2)} RMB` : ""}</span>
              </button>
            </div>
            {confirming && <p className="mt-2 text-center text-xs text-[#8e2f2b]">请再次点击确认提交。</p>}
          </form>
        </div>
      </div>
    </section>
  );
}

function outcomeClass(status) {
  if (status === "won") return "bg-[#527044]/10 text-[#527044]";
  if (status === "lost") return "bg-[#8e2f2b]/10 text-[#8e2f2b]";
  if (status === "push") return "bg-[#c59b43]/12 text-[#7c5b1c]";
  return "bg-[#211d18]/8 text-[#211d18]/55";
}

function formatOrderTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatReportDisplayDate(ymd) {
  const [, month, day] = String(ymd).split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function formatReportWeekday(ymd) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "long"
  }).format(new Date(`${ymd}T00:00:00+08:00`));
}

function dateRangeDays(from, to) {
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T00:00:00+08:00`);
  const days = [];
  for (let cursor = new Date(end); cursor >= start; cursor.setDate(cursor.getDate() - 1)) {
    days.push(formatShanghaiYmd(cursor));
  }
  return days;
}

function summarizeHistoryDays(orders, results, from, to) {
  const rowsByDate = new Map();
  summarizeOrders(orders, results).rows.forEach((order) => {
    const day = formatShanghaiYmd(order.createdAt);
    if (!day || day < from || day > to) return;
    const current = rowsByDate.get(day) ?? { totalOrders: 0, totalStake: 0, won: 0, lost: 0, push: 0, pending: 0 };
    current.totalOrders += 1;
    current.totalStake += Number(order.stake || 0);
    current.won += order.counts.won;
    current.lost += order.counts.lost;
    current.push += order.counts.push;
    current.pending += order.counts.pending;
    rowsByDate.set(day, current);
  });
  return dateRangeDays(from, to).map((day) => ({
    day,
    ...(rowsByDate.get(day) ?? { totalOrders: 0, totalStake: 0, won: 0, lost: 0, push: 0, pending: 0 })
  }));
}

function DateInput({ label, value, onChange, type = "date" }) {
  return (
    <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#211d18]/45">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full border border-[#211d18]/10 bg-[#f7f3eb] px-3 text-sm normal-case tracking-normal text-[#211d18] outline-none focus:border-[#c59b43]"
      />
    </label>
  );
}

function ReportTabs({ active, setActive }) {
  return (
    <div className="grid grid-cols-2 border-b border-[#211d18]/10 bg-white text-center text-base">
      <button type="button" onClick={() => setActive("today")} className={`h-14 border-b-2 ${active === "today" ? "border-[#b18a2a] text-[#b18a2a]" : "border-transparent text-[#211d18]/60"}`}>
        交易状况
      </button>
      <button type="button" onClick={() => setActive("history")} className={`h-14 border-b-2 ${active === "history" ? "border-[#b18a2a] text-[#b18a2a]" : "border-transparent text-[#211d18]/60"}`}>
        账户历史
      </button>
    </div>
  );
}

function OrderHistory({ orders, results }) {
  const [reportTab, setReportTab] = useState("today");
  const [todayDate, setTodayDate] = useState(() => formatShanghaiYmd());
  const [customFrom, setCustomFrom] = useState(() => addDaysToYmd(formatShanghaiYmd(), -7));
  const [customTo, setCustomTo] = useState(() => formatShanghaiYmd());
  const [selectedHistoryDay, setSelectedHistoryDay] = useState(null);
  const todayRange = useMemo(() => getReportDateRange("day", { day: todayDate }), [todayDate]);
  const todaySummary = useMemo(() => summarizeOrders(orders.filter((order) => orderMatchesReportDate(order, todayRange)), results), [orders, results, todayRange]);
  const historyRows = useMemo(() => summarizeHistoryDays(orders, results, customFrom, customTo), [customFrom, customTo, orders, results]);
  const selectedHistorySummary = useMemo(() => {
    if (!selectedHistoryDay) return null;
    const range = getReportDateRange("day", { day: selectedHistoryDay });
    return summarizeOrders(orders.filter((order) => orderMatchesReportDate(order, range)), results);
  }, [orders, results, selectedHistoryDay]);

  useEffect(() => {
    setSelectedHistoryDay(null);
  }, [customFrom, customTo]);

  return (
    <section id="client-report" className="scroll-mt-4 border border-[#211d18]/10 bg-white">
      <ReportTabs active={reportTab} setActive={setReportTab} />
      <div className="bg-[#f4f1eb] px-4 py-4 text-center">
        <h2 className="text-xl font-semibold">{reportTab === "today" ? "交易状况" : "账户历史总览"}</h2>
      </div>

      {reportTab === "today" ? (
        <div className="p-4">
          <DateInput label="交易日期" value={todayDate} onChange={setTodayDate} />
          {todaySummary.rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#211d18]/55">
              <p>目前没有任何交易单。</p>
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="mt-8 h-12 w-full bg-[#888] text-base font-semibold text-white">
                回到顶部
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {todaySummary.rows.map((order) => (
                <ReportOrderCard key={order.id} order={order} results={results} />
              ))}
            </div>
          )}
          <p className="mt-6 border border-[#c59b43]/30 bg-[#fff8e8] px-3 py-2 text-sm leading-relaxed text-[#7c5b1c]">
            竞猜仅为现场娱乐互动，不涉及任何有奖竞猜、现金奖励或赌博行为。
          </p>
        </div>
      ) : (
        <div>
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-[1fr_1fr_48px] gap-2">
              <DateInput label="从" value={customFrom} onChange={setCustomFrom} />
              <DateInput label="到" value={customTo} onChange={setCustomTo} />
              <button type="button" className="mt-6 grid h-11 place-items-center bg-[#888] text-white" aria-label="搜索">
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr] bg-[#33261e] px-3 py-4 text-center text-sm font-semibold text-white">
            <span>日期</span>
            <span>投注金额</span>
            <span>有效金额</span>
            <span>赢 / 输</span>
          </div>
          <div>
            {historyRows.map((row, index) => {
              const resultCount = row.won - row.lost;
              const isSelected = selectedHistoryDay === row.day;
              return (
                <div key={row.day}>
                  <div className={`grid grid-cols-[1fr_1fr_1fr_0.8fr] px-3 py-4 text-center text-sm ${isSelected ? "bg-[#fff4d8]" : index % 2 ? "bg-[#e7e7e7]" : "bg-white"}`}>
                    <button
                      type="button"
                      disabled={!row.totalOrders}
                      onClick={() => setSelectedHistoryDay((current) => (current === row.day ? null : row.day))}
                      className={`font-semibold ${row.totalOrders ? "text-[#0f78d1] underline-offset-4 hover:underline" : "cursor-default text-[#211d18]"}`}
                    >
                      {formatReportDisplayDate(row.day)}
                      <br />
                      {formatReportWeekday(row.day)}
                    </button>
                    <span>{row.totalOrders ? row.totalStake.toFixed(2) : "-"}</span>
                    <span>{row.totalOrders ? row.totalStake.toFixed(2) : "-"}</span>
                    <span>{row.totalOrders ? resultCount : "-"}</span>
                  </div>
                  {isSelected && (
                    <div className="space-y-3 border-y border-[#c59b43]/35 bg-[#fffaf0] p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <strong>{formatReportDisplayDate(row.day)} 下注详情</strong>
                        <span className="text-[#211d18]/55">{selectedHistorySummary?.totalOrders ?? 0} 单</span>
                      </div>
                      {selectedHistorySummary?.rows.length ? (
                        selectedHistorySummary.rows.map((order) => <ReportOrderCard key={order.id} order={order} results={results} />)
                      ) : (
                        <div className="grid min-h-[96px] place-items-center bg-white text-sm text-[#211d18]/50">该日期没有下注详情。</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="m-4 border border-[#c59b43]/30 bg-[#fff8e8] px-3 py-2 text-sm leading-relaxed text-[#7c5b1c]">
            竞猜仅为现场娱乐互动，不涉及任何有奖竞猜、现金奖励或赌博行为。
          </p>
        </div>
      )}
    </section>
  );
}

function ReportOrderCard({ order, results }) {
  return (
    <article className="border border-[#211d18]/10 bg-[#fbf8ef] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#527044]">{order.id}</p>
          <strong className="mt-1 block text-sm text-[#211d18]">竞猜数值 {Number(order.stake || 0).toFixed(2)}</strong>
        </div>
        <span className="text-xs text-[#211d18]/45">{formatOrderTime(order.createdAt)}</span>
      </div>
      <div className="mt-3 space-y-2">
        {order.selections.map((selection) => {
          const result = results[selection.matchId];
          return (
            <div key={selection.key} className="border border-[#211d18]/8 bg-white p-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-[#211d18]">M{String(selection.matchNo).padStart(3, "0")} · {selection.type}</span>
                <span className={`shrink-0 px-2 py-1 ${outcomeClass(selection.settleStatus)}`}>{RESULT_LABELS[selection.settleStatus]}</span>
              </div>
              <p className="mt-1 text-[#211d18]/60">{selection.teams}</p>
              <p className="mt-1 text-[#211d18]">{selection.pick} · {selection.price}</p>
              {selection.lineSpeech && <p className="mt-1 font-semibold text-[#a57b22]">{selection.lineSpeech}</p>}
              {result && <p className="mt-1 text-[#211d18]/48">赛果 {result.homeScore}-{result.awayScore}</p>}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ClientPasswordPanel({ customerName, onChangePassword, onClose }) {
  const [draft, setDraft] = useState({ current: "", next: "", confirm: "" });
  const [message, setMessage] = useState("");

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="mx-auto max-w-[1500px] px-4 pt-4 md:px-6">
      <form
        className="border border-[#211d18]/10 bg-white p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.next.trim()) {
            setMessage("请输入新密码");
            return;
          }
          if (draft.next !== draft.confirm) {
            setMessage("两次新密码不一致");
            return;
          }
          const result = await onChangePassword(draft.current, draft.next.trim());
          setMessage(result.message);
          if (result.ok) setDraft({ current: "", next: "", confirm: "" });
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">Password</p>
            <h2 className="mt-1 text-xl font-semibold">{customerName || "客户"} 修改密码</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center border border-[#211d18]/10 text-[#211d18]/55 hover:border-[#8e2f2b] hover:text-[#8e2f2b]" aria-label="关闭修改密码">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input value={draft.current} onChange={(event) => updateDraft("current", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="当前密码" type="password" />
          <input value={draft.next} onChange={(event) => updateDraft("next", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="新密码" type="password" />
          <input value={draft.confirm} onChange={(event) => updateDraft("confirm", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="确认新密码" type="password" />
        </div>
        {message && <p className={`mt-3 px-3 py-2 text-sm ${message.includes("已") ? "bg-[#527044]/10 text-[#527044]" : "bg-[#8e2f2b]/10 text-[#8e2f2b]"}`}>{message}</p>}
        <button type="submit" className="mt-3 h-11 w-full bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044]">保存新密码</button>
      </form>
    </section>
  );
}

function ImportPanel({ importText, setImportText, onImport, onReset, message }) {
  return (
    <section className="border border-[#211d18]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">Feed</p>
          <h2 className="mt-1 text-xl font-semibold">授权盘口导入</h2>
        </div>
        <FileJson className="h-5 w-5 text-[#c59b43]" />
      </div>
      <textarea
        value={importText}
        onChange={(event) => setImportText(event.target.value)}
        className="mt-4 h-32 w-full resize-none border border-[#211d18]/10 bg-[#f7f3eb] p-3 font-mono text-xs outline-none focus:border-[#c59b43]"
        placeholder='[{"matchNo":1,"handicap":{"home":"-0.5","away":"+0.5","homeWater":"0.88","awayWater":"1.02"}}]'
      />
      {message && <p className="mt-3 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">{message}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onImport} className="inline-flex h-10 items-center justify-center gap-2 bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044]">
          <Upload className="h-4 w-4" />
          导入
        </button>
        <button type="button" onClick={onReset} className="h-10 border border-[#211d18]/10 text-sm text-[#211d18]/62 transition hover:border-[#8e2f2b] hover:text-[#8e2f2b]">
          重置
        </button>
      </div>
    </section>
  );
}

export default function WorldCupOddsBoard({ matches }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [customers, setCustomers] = useState(DEFAULT_CUSTOMERS);
  const [activePage, setActivePage] = useState("home");
  const [selections, setSelections] = useState([]);
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [orders, setOrders] = useState([]);
  const [results, setResults] = useState({});
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [showOralLines, setShowOralLines] = useState(false);
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const syncPageFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      setActivePage(view === "report" || window.location.hash === "#client-report" ? "report" : view === "started" ? "started" : "home");
    };
    const loadDesk = async () => {
      const remote = await fetchDeskData();
      const storedCustomers = remote?.customers ?? getStoredCustomers();
      setCustomers(storedCustomers);
      setOverrides(remote?.odds ?? readStorageJson(ODDS_KEY, {}));
      setOrders(remote?.orders ?? readStorageJson(WC26_ORDERS_KEY, []));
      setResults(remote?.results ?? readStorageJson(WC26_RESULTS_KEY, {}));

      const rawSession = localStorage.getItem(SESSION_KEY);
      let session = null;
      if (rawSession === "active") {
        const customer = storedCustomers[0];
        session = customer ? { account: customer.account, name: customer.name || customer.account } : null;
      } else if (rawSession) {
        try {
          session = JSON.parse(rawSession);
        } catch {
          session = null;
        }
      }
      const matchedCustomer = storedCustomers.find((customer) => customer.account === session?.account && customer.status !== "停用");
      setCurrentCustomer(matchedCustomer ? { account: matchedCustomer.account, name: matchedCustomer.name || matchedCustomer.account } : null);
      setAuthed(Boolean(matchedCustomer));
    };

    syncPageFromUrl();
    setShowOralLines(localStorage.getItem(ORAL_HANDICAP_KEY) === "on");
    loadDesk();
    setReady(true);
    const handleStorage = () => loadDesk();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("popstate", syncPageFromUrl);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("popstate", syncPageFromUrl);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const markets = useMemo(() => {
    return Object.fromEntries(matches.map((match) => [match.id, mergeMarket(defaultMarket(match), overrides[match.id])]));
  }, [matches, overrides]);

  const activeMatches = useMemo(() => matches.filter((match) => !isMatchTimeClosed(match, nowTick)), [matches, nowTick]);
  const startedMatches = useMemo(() => matches.filter((match) => isMatchTimeClosed(match, nowTick)), [matches, nowTick]);
  const isClosedForBetting = (match) => {
    const market = markets[match.id];
    return market?.status === "封盘" || isMatchTimeClosed(match, nowTick);
  };

  useEffect(() => {
    setSelections((current) => {
      const next = current.filter((selection) => {
        const match = matches.find((item) => item.id === selection.matchId);
        return match && !isClosedForBetting(match);
      });
      return next.length === current.length ? current : next;
    });
  }, [markets, matches, nowTick]);

  const onPick = (match, type, pick, price, extra = {}) => {
    if (isClosedForBetting(match)) {
      setSelections((current) => current.filter((item) => item.matchId !== match.id));
      return;
    }
    const key = `${match.id}:${type}:${extra.keySuffix ?? extra.side ?? pick}`;
    const lineSpeech = handicapOralForSelection(type, pick, extra);
    setSelections([
      {
        key,
        matchId: match.id,
        matchNo: match.matchNo,
        teams: match.teams,
        type: marketTypeLabels[type] ?? "盘口",
        marketType: type,
        pick,
        price,
        ...(lineSpeech ? { lineSpeech } : {}),
        ...extra
      }
    ]);
  };

  const toggleOralLines = () => {
    setShowOralLines((current) => {
      const next = !current;
      localStorage.setItem(ORAL_HANDICAP_KEY, next ? "on" : "off");
      return next;
    });
  };

  const changeOwnPassword = async (currentPassword, nextPassword) => {
    const customer = customers.find((item) => item.account === currentCustomer?.account);
    if (!customer) return { ok: false, message: "客户资料不存在" };
    if (customer.password !== currentPassword) return { ok: false, message: "当前密码不正确" };

    const updatedCustomer = { ...customer, password: nextPassword, updatedAt: new Date().toISOString() };
    const nextCustomers = normalizeCustomers(customers.map((item) => (item.account === updatedCustomer.account ? updatedCustomer : item)));
    writeStorageJson(WC26_CUSTOMERS_KEY, nextCustomers);
    setCustomers(nextCustomers);
    const remote = await postDeskAction("upsertCustomer", { customer: updatedCustomer });
    if (remote?.customers) setCustomers(remote.customers);
    return { ok: true, message: "密码已更新，下次登录请使用新密码" };
  };

  const handleSubmitOrder = async (stake) => {
    if (!currentCustomer || selections.length === 0) return null;
    const availableSelections = selections.filter((selection) => {
      const match = matches.find((item) => item.id === selection.matchId);
      return match && !isClosedForBetting(match);
    });
    if (!availableSelections.length || availableSelections.length !== selections.length) {
      setSelections(availableSelections);
      return null;
    }
    const order = {
      id: `WC${Date.now().toString(36).toUpperCase()}`,
      account: currentCustomer.account,
      customerName: currentCustomer.name,
      stake,
      createdAt: new Date().toISOString(),
      selections: availableSelections
    };
    const nextOrders = [order, ...orders];
    writeStorageJson(WC26_ORDERS_KEY, nextOrders);
    setOrders(nextOrders);
    setSelections([]);
    const remote = await postDeskAction("createOrder", { order });
    if (remote?.orders) {
      setOrders(remote.orders);
      setResults(remote.results ?? results);
      setOverrides(remote.odds ?? overrides);
    }
    return order;
  };

  const handleImport = () => {
    try {
      const next = parseImportPayload(importText);
      const merged = { ...overrides, ...next };
      localStorage.setItem(ODDS_KEY, JSON.stringify(merged));
      setOverrides(merged);
      setMessage(`已导入 ${Object.keys(next).length} 条盘口`);
    } catch {
      setMessage("JSON 格式不正确");
    }
  };

  const handleReset = () => {
    localStorage.removeItem(ODDS_KEY);
    setOverrides({});
    setImportText("");
    setMessage("已恢复默认盘口结构");
  };

  const customerOrders = useMemo(
    () => orders.filter((order) => order.account === currentCustomer?.account),
    [currentCustomer?.account, orders]
  );
  const activeDetailMatch = useMemo(() => matches.find((match) => match.id === activeMatchId), [activeMatchId, matches]);
  const navigatePage = (page) => {
    setActivePage(page);
    setActiveMatchId(null);
    const url = page === "home" ? window.location.pathname : `${window.location.pathname}?view=${page}`;
    window.history.pushState({ page }, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const navButtonClass = (page) =>
    `inline-flex h-10 items-center border px-3 text-sm transition ${
      activePage === page ? "border-[#f3c969] text-[#f3c969]" : "border-white/15 text-white/72 hover:border-[#f3c969] hover:text-[#f3c969]"
    }`;

  if (!ready) {
    return <main className="grid min-h-screen place-items-center bg-[#f4efe4] text-[#211d18]">加载中</main>;
  }

  if (!authed) {
    return (
      <LoginScreen
        customers={customers}
        onLogin={(session) => {
          setCurrentCustomer(session);
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <main className={`min-h-screen bg-[#f4efe4] text-[#211d18] ${activePage === "home" && selections.length > 0 ? "pb-80 lg:pb-0" : ""}`}>
      <header className="border-b border-[#211d18]/10 bg-[#112116] px-4 py-4 text-white md:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center border border-white/20 bg-white/10">
              <Trophy className="h-5 w-5 text-[#f3c969]" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#f3c969]">World Cup 2026</p>
              <h1 className="text-2xl font-semibold">世界杯赛事观察室</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 border border-white/15 bg-white/8 px-3 text-sm text-white/72">
              <UserRound className="h-4 w-4 text-[#f3c969]" />
              {currentCustomer?.name ?? currentCustomer?.account}
            </span>
            <button type="button" onClick={() => navigatePage("home")} className={navButtonClass("home")}>
              首页
            </button>
            <button type="button" onClick={() => navigatePage("started")} className={navButtonClass("started")}>
              已开赛
            </button>
            <button type="button" onClick={() => navigatePage("report")} className={navButtonClass("report")}>
              报表
            </button>
            <button type="button" onClick={() => setShowPasswordPanel((current) => !current)} className="inline-flex h-10 items-center border border-white/15 px-3 text-sm text-white/72 transition hover:border-[#f3c969] hover:text-[#f3c969]">
              改密码
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(SESSION_KEY);
                setCurrentCustomer(null);
                setAuthed(false);
              }}
              className="inline-flex h-10 items-center gap-2 border border-white/15 px-3 text-sm text-white/72 transition hover:border-[#f3c969] hover:text-[#f3c969]"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </div>
        </div>
      </header>

      {showPasswordPanel && (
        <ClientPasswordPanel customerName={currentCustomer?.name ?? currentCustomer?.account} onChangePassword={changeOwnPassword} onClose={() => setShowPasswordPanel(false)} />
      )}

      {activePage === "report" ? (
        <div className="mx-auto grid max-w-[980px] gap-4 px-4 py-4 md:px-6">
          <OrderHistory orders={customerOrders} results={results} />
          <section className="border border-[#211d18]/10 bg-[#fbf8ef] p-4 text-sm leading-relaxed text-[#211d18]/58">
            <div className="mb-3 flex items-center gap-2 text-[#211d18]">
              <SlidersHorizontal className="h-4 w-4 text-[#c59b43]" />
              <strong>赛果统计</strong>
            </div>
            管理端导入赛果后，这里会自动按订单明细统计命中、未中、走水和待开奖合计。
          </section>
        </div>
      ) : activePage === "started" ? (
        <StartedMatchesPage matches={startedMatches} results={results} />
      ) : (
        <>
          <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 lg:grid-cols-[1fr_340px] md:px-6">
            <div className="min-w-0 space-y-4">
              <section className="flex items-center justify-end border border-[#211d18]/10 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={toggleOralLines}
                  className={`inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold transition ${
                    showOralLines ? "bg-[#f3c969] text-[#211d18]" : "bg-[#f7f3eb] text-[#211d18]/68 hover:text-[#211d18]"
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  盘口口语
                </button>
              </section>
              <section className="space-y-3">
                {activeMatches.length ? (
                  activeMatches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      market={markets[match.id]}
                      selectedKeys={selections.filter((item) => item.matchId === match.id).map((item) => item.key)}
                      showOralLines={showOralLines}
                      timeClosed={isMatchTimeClosed(match, nowTick)}
                      onPick={onPick}
                      onOpenDetails={() => setActiveMatchId(match.id)}
                    />
                  ))
                ) : (
                  <div className="grid min-h-[240px] place-items-center border border-[#211d18]/10 bg-white p-6 text-center text-sm text-[#211d18]/55">暂无可下注赛事。</div>
                )}
              </section>
            </div>

            <div className="space-y-4">
              <Slip
                className="hidden lg:block"
                selections={selections}
                onRemove={(key) => setSelections((current) => current.filter((item) => item.key !== key))}
                onClear={() => setSelections([])}
                onSubmitOrder={handleSubmitOrder}
              />
              <section className="border border-[#211d18]/10 bg-[#fbf8ef] p-4 text-sm leading-relaxed text-[#211d18]/58">
                <div className="mb-3 flex items-center gap-2 text-[#211d18]">
                  <SlidersHorizontal className="h-4 w-4 text-[#c59b43]" />
                  <strong>赛果统计</strong>
                </div>
                管理端导入赛果后，这里会自动按订单明细统计命中、未中、走水和待开奖合计。
              </section>
            </div>
          </div>
          <MobileOrderDock
            selections={selections}
            onRemove={(key) => setSelections((current) => current.filter((item) => item.key !== key))}
            onClear={() => setSelections([])}
            onSubmitOrder={handleSubmitOrder}
          />
          {activeDetailMatch && (
            <FullMarketPanel
              key={activeDetailMatch.id}
              match={activeDetailMatch}
              market={markets[activeDetailMatch.id]}
              selectedKeys={selections.filter((item) => item.matchId === activeDetailMatch.id).map((item) => item.key)}
              showOralLines={showOralLines}
              timeClosed={isMatchTimeClosed(activeDetailMatch, nowTick)}
              result={results[activeDetailMatch.id]}
              onToggleOralLines={toggleOralLines}
              onPick={onPick}
              onClose={() => setActiveMatchId(null)}
            />
          )}
        </>
      )}
    </main>
  );
}
