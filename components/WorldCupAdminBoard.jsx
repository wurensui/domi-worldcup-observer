"use client";

import { Check, FileJson, LockKeyhole, LogOut, Search, ShieldCheck, SlidersHorizontal, Trophy, Upload, UserPlus, UserRound, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ADMIN_PROFILE,
  RESULT_LABELS,
  WC26_ADMIN_PROFILE_KEY,
  WC26_ADMIN_SESSION_KEY,
  WC26_CUSTOMERS_KEY,
  WC26_ODDS_KEY,
  WC26_ORDERS_KEY,
  WC26_RESULTS_KEY,
  addDaysToYmd,
  fetchDeskData,
  formatShanghaiYmd,
  getStoredAdminProfile,
  getStoredCustomers,
  getReportDateRange,
  normalizeAdminProfile,
  normalizeCustomers,
  orderMatchesReportDate,
  parseOddsImportPayload,
  postDeskAction,
  readStorageJson,
  summarizeOrder,
  summarizeOrders,
  writeStorageJson
} from "../lib/worldcupDesk";

const oddsSample = '[{"matchNo":1,"status":"开盘","handicap":{"home":"-0.5","away":"+0.5","homeWater":"0.88","awayWater":"1.02"},"total":{"line":"2.5","overWater":"0.96","underWater":"0.94"}}]';

const detailMarketTypes = [
  { value: "handicap", label: "让球" },
  { value: "handicapHalf", label: "让球 上半场" },
  { value: "total", label: "大小" },
  { value: "totalHalf", label: "大小 上半场" },
  { value: "moneyline", label: "独赢" },
  { value: "moneylineHalf", label: "独赢 上半场" },
  { value: "score", label: "波胆" }
];

const detailGroupKeys = {
  handicap: "handicap",
  handicapHalf: "handicapHalf",
  total: "totals",
  totalHalf: "totalsHalf",
  moneyline: "moneyline",
  moneylineHalf: "moneylineHalf"
};

function fieldValue(value) {
  return value === undefined || value === null ? "" : String(value);
}

function cleanField(value) {
  return String(value ?? "").trim();
}

function hasField(value) {
  return cleanField(value) !== "";
}

function isValidPrice(value) {
  const text = cleanField(value);
  return text !== "" && Number.isFinite(Number(text)) && Number(text) > 0;
}

function oppositeLine(line) {
  const text = cleanField(line).replace(/\s+/g, "");
  if (!text || text === "0" || text === "+0" || text === "-0") return "0";
  if (text.startsWith("-")) return `+${text.slice(1)}`;
  if (text.startsWith("+")) return `-${text.slice(1)}`;
  return `-${text}`;
}

function manualOption(type, label, primary, price, extra = {}) {
  return {
    type,
    label,
    primary: String(primary),
    secondary: `水位 ${price}`,
    price: String(price),
    extra
  };
}

function manualOptionKey(option) {
  return option?.extra?.keySuffix ?? option?.extra?.side ?? option?.primary;
}

function upsertManualOptions(existingOptions, updates) {
  const updateKeys = new Set(updates.map((option) => manualOptionKey(option)));
  return [...(Array.isArray(existingOptions) ? existingOptions : []).filter((option) => !updateKeys.has(manualOptionKey(option))), ...updates];
}

function parseManualScoreRows(text) {
  return String(text ?? "")
    .split(/\r?\n|;|；/)
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s*(?:-|:|：)\s*(\d+)\s*(?:=|,|，|\s+)\s*([0-9]+(?:\.[0-9]+)?)$/);
      if (!match) return null;
      return {
        homeScore: Number(match[1]),
        awayScore: Number(match[2]),
        price: match[3],
        score: `${Number(match[1])}-${Number(match[2])}`
      };
    })
    .filter(Boolean);
}

function mergeManualScoreColumns(existingColumns, updates, home, away) {
  const titles = [home, "和局", away];
  const byTitle = new Map(titles.map((title) => [title, []]));
  if (Array.isArray(existingColumns)) {
    existingColumns.forEach((column) => {
      const title = titles.includes(column?.title) ? column.title : "和局";
      byTitle.set(title, [...(byTitle.get(title) ?? []), ...(Array.isArray(column?.options) ? column.options : [])]);
    });
  }

  const updateOptionsByTitle = new Map(titles.map((title) => [title, []]));
  updates.forEach((row) => {
    const title = row.homeScore > row.awayScore ? home : row.homeScore === row.awayScore ? "和局" : away;
    const option = manualOption("score", "波胆", row.score, row.price, {
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      keySuffix: row.score
    });
    updateOptionsByTitle.set(title, [...(updateOptionsByTitle.get(title) ?? []), option]);
  });

  return titles
    .map((title) => ({
      title,
      options: upsertManualOptions(byTitle.get(title) ?? [], updateOptionsByTitle.get(title) ?? [])
    }))
    .filter((column) => column.options.length);
}

function mergeOddsRow(current, patch) {
  return {
    ...(current ?? {}),
    ...patch,
    handicap: patch.handicap ? { ...(current?.handicap ?? {}), ...patch.handicap } : current?.handicap,
    total: patch.total ? { ...(current?.total ?? {}), ...patch.total } : current?.total,
    moneyline: patch.moneyline ? { ...(current?.moneyline ?? {}), ...patch.moneyline } : current?.moneyline,
    fullMarkets: patch.fullMarkets ? { ...(current?.fullMarkets ?? {}), ...patch.fullMarkets } : current?.fullMarkets
  };
}

function splitTeams(teams) {
  const [home = "主队待定", away = "客队待定"] = String(teams ?? "").split(/\s+vs\s+/i);
  return [home.trim(), away.trim()];
}

function matchStartTimestamp(match) {
  const timestamp = new Date(`${match.date}T${match.time}:00+08:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function isMatchStartedForResult(match, now = Date.now()) {
  return now >= matchStartTimestamp(match);
}

function matchKickoffLabel(match) {
  return `${match.date.slice(5).replace("-", "月")}日 ${match.time}`;
}

function scoreNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function resultDraftFrom(result) {
  return {
    homeHalfScore: result?.homeHalfScore ?? "",
    awayHalfScore: result?.awayHalfScore ?? "",
    homeScore: result?.homeScore ?? "",
    awayScore: result?.awayScore ?? ""
  };
}

function AdminStat({ label, value, tone = "dark" }) {
  const color = tone === "gold" ? "text-[#c59b43]" : tone === "red" ? "text-[#9b302d]" : "text-[#122017]";
  return (
    <div className="border border-[#211d18]/10 bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">{label}</p>
      <strong className={`mt-2 block text-3xl font-semibold ${color}`}>{value}</strong>
    </div>
  );
}

function AdminLogin({ adminProfile, onLogin }) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="grid min-h-screen bg-[#f4efe4] px-5 py-10 text-[#211d18] lg:grid-cols-[1fr_420px]">
      <section className="flex min-h-[420px] flex-col justify-between bg-[#112116] p-8 text-white md:p-12">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center border border-white/20 bg-white/10">
            <Trophy className="h-5 w-5 text-[#f3c969]" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#f3c969]">World Cup 2026</p>
            <h1 className="text-xl font-semibold">管理端</h1>
          </div>
        </div>
        <div className="max-w-2xl py-16">
          <p className="text-sm uppercase tracking-[0.34em] text-white/55">Admin Desk</p>
          <h2 className="mt-5 text-5xl font-semibold leading-tight tracking-normal md:text-7xl">客户、盘口与赛果管理</h2>
        </div>
        <div className="grid gap-3 text-sm text-white/60 md:grid-cols-3">
          <span className="inline-flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-[#f3c969]" />
            客户新增
          </span>
          <span className="inline-flex items-center gap-2">
            <FileJson className="h-4 w-4 text-[#f3c969]" />
            盘口导入
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#f3c969]" />
            赛果统计
          </span>
        </div>
      </section>

      <section className="flex items-center justify-center bg-white p-6 md:p-8">
        <form
          className="w-full max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (account.trim() === adminProfile.account && password === adminProfile.password) {
              localStorage.setItem(WC26_ADMIN_SESSION_KEY, "active");
              onLogin();
              return;
            }
            setError("管理员账号或密码不正确");
          }}
        >
          <span className="grid h-12 w-12 place-items-center bg-[#112116] text-white">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <h3 className="mt-7 text-3xl font-semibold">管理员登录</h3>
          <p className="mt-3 text-sm leading-relaxed text-[#211d18]/55">输入管理员账号和当前密码。</p>
          <label className="mt-8 grid gap-2 text-sm text-[#211d18]/70">
            <span>账号</span>
            <input value={account} onChange={(event) => setAccount(event.target.value)} className="h-12 border border-[#211d18]/12 bg-[#f7f3eb] px-4 outline-none focus:border-[#c59b43]" placeholder={DEFAULT_ADMIN_PROFILE.account} />
          </label>
          <label className="mt-4 grid gap-2 text-sm text-[#211d18]/70">
            <span>密码</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 border border-[#211d18]/12 bg-[#f7f3eb] px-4 outline-none focus:border-[#c59b43]" placeholder="当前密码" type="password" />
          </label>
          {error && <p className="mt-4 bg-[#8e2f2b]/10 px-4 py-3 text-sm text-[#8e2f2b]">{error}</p>}
          <button type="submit" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 bg-[#112116] px-5 text-sm font-semibold text-white transition hover:bg-[#244e31]">
            登录管理端
            <Check className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  );
}

function ImportBox({ title, body, value, setValue, placeholder, onImport, message }) {
  return (
    <section className="border border-[#211d18]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">{body}</p>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        </div>
        <FileJson className="h-5 w-5 text-[#c59b43]" />
      </div>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} className="mt-4 h-36 w-full resize-none border border-[#211d18]/10 bg-[#f7f3eb] p-3 font-mono text-xs outline-none focus:border-[#c59b43]" placeholder={placeholder} />
      {message && <p className="mt-3 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">{message}</p>}
      <button type="button" onClick={onImport} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044]">
        <Upload className="h-4 w-4" />
        导入
      </button>
    </section>
  );
}

function ManualOddsTextInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[#211d18]/55">
      {label}
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full border border-[#211d18]/10 bg-[#f7f3eb] px-3 text-sm text-[#211d18] outline-none focus:border-[#c59b43]"
        placeholder={placeholder}
      />
    </label>
  );
}

function ManualOddsPanel({ matches, odds, message, onSaveOdds }) {
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [localMessage, setLocalMessage] = useState("");
  const [baseDraft, setBaseDraft] = useState({
    status: "开盘",
    handicapHomeLine: "",
    handicapHomeWater: "",
    handicapAwayLine: "",
    handicapAwayWater: "",
    totalLine: "",
    totalOverWater: "",
    totalUnderWater: "",
    moneylineHome: "",
    moneylineDraw: "",
    moneylineAway: ""
  });
  const [detailDraft, setDetailDraft] = useState({
    type: "handicap",
    line: "",
    awayLine: "",
    homeWater: "",
    awayWater: "",
    totalLine: "",
    overWater: "",
    underWater: "",
    moneyHome: "",
    moneyDraw: "",
    moneyAway: "",
    scoreRows: ""
  });

  const selectedMatch = useMemo(() => matches.find((match) => match.id === matchId) ?? matches[0], [matchId, matches]);
  const existingOdds = selectedMatch ? odds[selectedMatch.id] ?? {} : {};
  const [home, away] = splitTeams(selectedMatch?.teams);

  useEffect(() => {
    if (!selectedMatch) return;
    const row = odds[selectedMatch.id] ?? {};
    setBaseDraft({
      status: fieldValue(row.status || "开盘"),
      handicapHomeLine: fieldValue(row.handicap?.home),
      handicapHomeWater: fieldValue(row.handicap?.homeWater),
      handicapAwayLine: fieldValue(row.handicap?.away),
      handicapAwayWater: fieldValue(row.handicap?.awayWater),
      totalLine: fieldValue(row.total?.line),
      totalOverWater: fieldValue(row.total?.overWater),
      totalUnderWater: fieldValue(row.total?.underWater),
      moneylineHome: fieldValue(row.moneyline?.homeOdds),
      moneylineDraw: fieldValue(row.moneyline?.drawOdds),
      moneylineAway: fieldValue(row.moneyline?.awayOdds)
    });
  }, [odds, selectedMatch]);

  const updateBaseDraft = (key, value) => setBaseDraft((current) => ({ ...current, [key]: value }));
  const updateDetailDraft = (key, value) => setDetailDraft((current) => ({ ...current, [key]: value }));

  const saveBaseOdds = async () => {
    if (!selectedMatch) return;
    const patch = {
      id: selectedMatch.id,
      matchNo: Number(selectedMatch.matchNo),
      status: cleanField(baseDraft.status) || "开盘",
      updatedAt: new Date().toISOString()
    };

    const handicap = {};
    if (hasField(baseDraft.handicapHomeLine)) handicap.home = cleanField(baseDraft.handicapHomeLine);
    if (hasField(baseDraft.handicapAwayLine)) handicap.away = cleanField(baseDraft.handicapAwayLine);
    if (hasField(baseDraft.handicapHomeWater)) handicap.homeWater = cleanField(baseDraft.handicapHomeWater);
    if (hasField(baseDraft.handicapAwayWater)) handicap.awayWater = cleanField(baseDraft.handicapAwayWater);
    if (Object.keys(handicap).length) patch.handicap = handicap;

    const total = {};
    if (hasField(baseDraft.totalLine)) total.line = cleanField(baseDraft.totalLine);
    if (hasField(baseDraft.totalOverWater)) total.overWater = cleanField(baseDraft.totalOverWater);
    if (hasField(baseDraft.totalUnderWater)) total.underWater = cleanField(baseDraft.totalUnderWater);
    if (Object.keys(total).length) patch.total = total;

    const moneyline = {};
    if (hasField(baseDraft.moneylineHome)) moneyline.homeOdds = cleanField(baseDraft.moneylineHome);
    if (hasField(baseDraft.moneylineDraw)) moneyline.drawOdds = cleanField(baseDraft.moneylineDraw);
    if (hasField(baseDraft.moneylineAway)) moneyline.awayOdds = cleanField(baseDraft.moneylineAway);
    if (Object.keys(moneyline).length) patch.moneyline = moneyline;

    await onSaveOdds(selectedMatch, patch, `已保存 M${String(selectedMatch.matchNo).padStart(3, "0")} 常玩盘口`);
    setLocalMessage("");
  };

  const saveDetailOdds = async () => {
    if (!selectedMatch) return;
    const type = detailDraft.type;
    const label = detailMarketTypes.find((item) => item.value === type)?.label ?? "盘口";
    const fullMarkets = { ...(existingOdds.fullMarkets ?? {}) };

    if (type === "handicap" || type === "handicapHalf") {
      const line = cleanField(detailDraft.line);
      const homeWater = cleanField(detailDraft.homeWater);
      const awayWater = cleanField(detailDraft.awayWater);
      if (!line || !isValidPrice(homeWater) || !isValidPrice(awayWater)) {
        setLocalMessage("让球盘口需要填写盘口线、主队水位、客队水位");
        return;
      }
      const awayLine = cleanField(detailDraft.awayLine) || oppositeLine(line);
      const groupKey = detailGroupKeys[type];
      const updates = [
        manualOption(type, label, `${home} ${line}`, homeWater, { line, side: "home", keySuffix: `home:${line}` }),
        manualOption(type, label, `${away} ${awayLine}`, awayWater, { line, side: "away", keySuffix: `away:${line}` })
      ];
      fullMarkets[groupKey] = upsertManualOptions(fullMarkets[groupKey], updates);
    } else if (type === "total" || type === "totalHalf") {
      const line = cleanField(detailDraft.totalLine);
      const overWater = cleanField(detailDraft.overWater);
      const underWater = cleanField(detailDraft.underWater);
      if (!line || !isValidPrice(overWater) || !isValidPrice(underWater)) {
        setLocalMessage("大小盘口需要填写盘口线、大球水位、小球水位");
        return;
      }
      const groupKey = detailGroupKeys[type];
      const updates = [
        manualOption(type, label, `大 ${line}`, overWater, { line, side: "over", keySuffix: `over:${line}` }),
        manualOption(type, label, `小 ${line}`, underWater, { line, side: "under", keySuffix: `under:${line}` })
      ];
      fullMarkets[groupKey] = upsertManualOptions(fullMarkets[groupKey], updates);
    } else if (type === "moneyline" || type === "moneylineHalf") {
      const homeOdds = cleanField(detailDraft.moneyHome);
      const drawOdds = cleanField(detailDraft.moneyDraw);
      const awayOdds = cleanField(detailDraft.moneyAway);
      if (!isValidPrice(homeOdds) || !isValidPrice(drawOdds) || !isValidPrice(awayOdds)) {
        setLocalMessage("独赢需要填写主胜、和局、客胜三个水位");
        return;
      }
      const groupKey = detailGroupKeys[type];
      fullMarkets[groupKey] = [
        manualOption(type, label, home, homeOdds, { side: "home" }),
        manualOption(type, label, "和局", drawOdds, { side: "draw" }),
        manualOption(type, label, away, awayOdds, { side: "away" })
      ];
    } else if (type === "score") {
      const rows = parseManualScoreRows(detailDraft.scoreRows);
      if (!rows.length) {
        setLocalMessage("波胆请按“1-0=5.2”格式每行填写一个比分水位");
        return;
      }
      fullMarkets.score = mergeManualScoreColumns(fullMarkets.score, rows, home, away);
    }

    await onSaveOdds(
      selectedMatch,
      {
        id: selectedMatch.id,
        matchNo: Number(selectedMatch.matchNo),
        updatedAt: new Date().toISOString(),
        fullMarkets
      },
      `已保存 M${String(selectedMatch.matchNo).padStart(3, "0")} ${label}`
    );
    setLocalMessage("");
  };

  if (!selectedMatch) return null;

  return (
    <section id="manual-odds" className="border border-[#211d18]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">Manual Markets</p>
          <h2 className="mt-1 text-xl font-semibold">手工录入盘口水位</h2>
        </div>
        <SlidersHorizontal className="h-5 w-5 text-[#c59b43]" />
      </div>

      {(message || localMessage) && <p className="mt-3 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">{localMessage || message}</p>}

      <label className="mt-4 grid gap-2 text-sm text-[#211d18]/70">
        <span>选择比赛</span>
        <select value={selectedMatch.id} onChange={(event) => setMatchId(event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]">
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              M{String(match.matchNo).padStart(3, "0")} · {match.date.slice(5)} {match.time} · {match.teams}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 bg-[#fbf8ef] px-3 py-2 text-sm font-semibold text-[#211d18]">
        {home} vs {away}
        <span className="ml-2 text-xs font-normal text-[#211d18]/50">{selectedMatch.phase}</span>
      </div>

      <div className="mt-4 border border-[#211d18]/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">主列表常玩盘口</h3>
          <select value={baseDraft.status} onChange={(event) => updateBaseDraft("status", event.target.value)} className="h-9 border border-[#211d18]/10 bg-[#f7f3eb] px-2 text-sm outline-none focus:border-[#c59b43]">
            <option value="开盘">开盘</option>
            <option value="升水">升水</option>
            <option value="封盘">封盘</option>
          </select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ManualOddsTextInput label={`${home} 让球`} value={baseDraft.handicapHomeLine} onChange={(value) => updateBaseDraft("handicapHomeLine", value)} placeholder="-0.5" />
          <ManualOddsTextInput label={`${home} 水位`} value={baseDraft.handicapHomeWater} onChange={(value) => updateBaseDraft("handicapHomeWater", value)} placeholder="0.88" type="number" />
          <ManualOddsTextInput label={`${away} 让球`} value={baseDraft.handicapAwayLine} onChange={(value) => updateBaseDraft("handicapAwayLine", value)} placeholder="+0.5" />
          <ManualOddsTextInput label={`${away} 水位`} value={baseDraft.handicapAwayWater} onChange={(value) => updateBaseDraft("handicapAwayWater", value)} placeholder="1.02" type="number" />
          <ManualOddsTextInput label="大小盘口" value={baseDraft.totalLine} onChange={(value) => updateBaseDraft("totalLine", value)} placeholder="2/2.5" />
          <div className="grid grid-cols-2 gap-2">
            <ManualOddsTextInput label="大球水位" value={baseDraft.totalOverWater} onChange={(value) => updateBaseDraft("totalOverWater", value)} placeholder="0.84" type="number" />
            <ManualOddsTextInput label="小球水位" value={baseDraft.totalUnderWater} onChange={(value) => updateBaseDraft("totalUnderWater", value)} placeholder="1.00" type="number" />
          </div>
          <ManualOddsTextInput label={`${home} 独赢`} value={baseDraft.moneylineHome} onChange={(value) => updateBaseDraft("moneylineHome", value)} placeholder="1.45" type="number" />
          <ManualOddsTextInput label="和局" value={baseDraft.moneylineDraw} onChange={(value) => updateBaseDraft("moneylineDraw", value)} placeholder="4.25" type="number" />
          <ManualOddsTextInput label={`${away} 独赢`} value={baseDraft.moneylineAway} onChange={(value) => updateBaseDraft("moneylineAway", value)} placeholder="7.80" type="number" />
        </div>

        <button type="button" onClick={saveBaseOdds} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044]">
          <Upload className="h-4 w-4" />
          保存常玩盘口
        </button>
      </div>

      <div className="mt-4 border border-[#211d18]/10 p-3">
        <h3 className="font-semibold">详情页全部盘口</h3>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-xs font-semibold text-[#211d18]/55">
            盘口类型
            <select value={detailDraft.type} onChange={(event) => updateDetailDraft("type", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 text-sm outline-none focus:border-[#c59b43]">
              {detailMarketTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {(detailDraft.type === "handicap" || detailDraft.type === "handicapHalf") && (
            <div className="grid gap-3 md:grid-cols-2">
              <ManualOddsTextInput label={`${home} 盘口`} value={detailDraft.line} onChange={(value) => updateDetailDraft("line", value)} placeholder="-0.5" />
              <ManualOddsTextInput label={`${away} 盘口`} value={detailDraft.awayLine} onChange={(value) => updateDetailDraft("awayLine", value)} placeholder="留空自动相反" />
              <ManualOddsTextInput label={`${home} 水位`} value={detailDraft.homeWater} onChange={(value) => updateDetailDraft("homeWater", value)} placeholder="0.88" type="number" />
              <ManualOddsTextInput label={`${away} 水位`} value={detailDraft.awayWater} onChange={(value) => updateDetailDraft("awayWater", value)} placeholder="1.02" type="number" />
            </div>
          )}

          {(detailDraft.type === "total" || detailDraft.type === "totalHalf") && (
            <div className="grid gap-3 md:grid-cols-3">
              <ManualOddsTextInput label="盘口线" value={detailDraft.totalLine} onChange={(value) => updateDetailDraft("totalLine", value)} placeholder="2/2.5" />
              <ManualOddsTextInput label="大球水位" value={detailDraft.overWater} onChange={(value) => updateDetailDraft("overWater", value)} placeholder="0.84" type="number" />
              <ManualOddsTextInput label="小球水位" value={detailDraft.underWater} onChange={(value) => updateDetailDraft("underWater", value)} placeholder="1.00" type="number" />
            </div>
          )}

          {(detailDraft.type === "moneyline" || detailDraft.type === "moneylineHalf") && (
            <div className="grid gap-3 md:grid-cols-3">
              <ManualOddsTextInput label={`${home} 水位`} value={detailDraft.moneyHome} onChange={(value) => updateDetailDraft("moneyHome", value)} placeholder="1.45" type="number" />
              <ManualOddsTextInput label="和局水位" value={detailDraft.moneyDraw} onChange={(value) => updateDetailDraft("moneyDraw", value)} placeholder="4.25" type="number" />
              <ManualOddsTextInput label={`${away} 水位`} value={detailDraft.moneyAway} onChange={(value) => updateDetailDraft("moneyAway", value)} placeholder="7.80" type="number" />
            </div>
          )}

          {detailDraft.type === "score" && (
            <label className="grid gap-1 text-xs font-semibold text-[#211d18]/55">
              波胆比分水位
              <textarea
                value={detailDraft.scoreRows}
                onChange={(event) => updateDetailDraft("scoreRows", event.target.value)}
                className="h-28 resize-none border border-[#211d18]/10 bg-[#f7f3eb] p-3 font-mono text-xs outline-none focus:border-[#c59b43]"
                placeholder={"1-0=5.2\n2-0=5.8\n0-1=16.0"}
              />
            </label>
          )}

          <button type="button" onClick={saveDetailOdds} className="inline-flex h-10 w-full items-center justify-center gap-2 bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044]">
            <Upload className="h-4 w-4" />
            保存到全部盘口
          </button>
        </div>
      </div>
    </section>
  );
}

function ScoreInput({ label, value, onChange }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[#211d18]/55">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full border border-[#211d18]/10 bg-white px-3 text-center text-lg font-semibold text-[#211d18] outline-none focus:border-[#c59b43]"
      />
    </label>
  );
}

function ManualResultsPanel({ matches, results, nowTick, message, onSaveResult }) {
  const startedMatches = useMemo(() => matches.filter((match) => isMatchStartedForResult(match, nowTick)), [matches, nowTick]);
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts((current) => {
      let changed = false;
      const next = { ...current };
      startedMatches.forEach((match) => {
        if (!next[match.id]) {
          next[match.id] = resultDraftFrom(results[match.id]);
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [results, startedMatches]);

  const updateDraft = (matchId, key, value) => {
    setDrafts((current) => ({
      ...current,
      [matchId]: {
        ...resultDraftFrom(results[matchId]),
        ...(current[matchId] ?? {}),
        [key]: value
      }
    }));
  };

  return (
    <section className="border border-[#211d18]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">Started Matches</p>
          <h2 className="mt-1 text-xl font-semibold">赛果导入</h2>
        </div>
        <FileJson className="h-5 w-5 text-[#c59b43]" />
      </div>

      {message && <p className="mt-3 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">{message}</p>}

      <div className="mt-4 grid max-h-[520px] gap-3 overflow-auto pr-1">
        {startedMatches.length ? (
          startedMatches.map((match) => {
            const [home, away] = splitTeams(match.teams);
            const draft = drafts[match.id] ?? resultDraftFrom(results[match.id]);
            const saved = results[match.id];
            return (
              <article key={match.id} className="border border-[#211d18]/10 bg-[#fbf8ef] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#527044]">M{String(match.matchNo).padStart(3, "0")} · {matchKickoffLabel(match)}</p>
                    <h3 className="mt-1 text-base font-semibold">{home} vs {away}</h3>
                  </div>
                  <span className="bg-[#8e2f2b]/10 px-3 py-1.5 text-xs font-semibold text-[#8e2f2b]">已开赛</span>
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#211d18]/52">上半场比分</p>
                    <div className="grid grid-cols-[1fr_32px_1fr] items-end gap-2">
                      <ScoreInput label={home} value={draft.homeHalfScore} onChange={(value) => updateDraft(match.id, "homeHalfScore", value)} />
                      <span className="grid h-11 place-items-center text-[#211d18]/45">-</span>
                      <ScoreInput label={away} value={draft.awayHalfScore} onChange={(value) => updateDraft(match.id, "awayHalfScore", value)} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#211d18]/52">全场比分</p>
                    <div className="grid grid-cols-[1fr_32px_1fr] items-end gap-2">
                      <ScoreInput label={home} value={draft.homeScore} onChange={(value) => updateDraft(match.id, "homeScore", value)} />
                      <span className="grid h-11 place-items-center text-[#211d18]/45">-</span>
                      <ScoreInput label={away} value={draft.awayScore} onChange={(value) => updateDraft(match.id, "awayScore", value)} />
                    </div>
                  </div>
                </div>

                {saved && (
                  <p className="mt-3 bg-white px-3 py-2 text-sm text-[#527044]">
                    已导入：全场 {saved.homeScore}-{saved.awayScore}
                    {Number.isFinite(Number(saved.homeHalfScore)) && Number.isFinite(Number(saved.awayHalfScore)) ? ` · 半场 ${saved.homeHalfScore}-${saved.awayHalfScore}` : ""}
                  </p>
                )}

                <button type="button" onClick={() => onSaveResult(match, draft)} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044]">
                  <Upload className="h-4 w-4" />
                  保存赛果
                </button>
              </article>
            );
          })
        ) : (
          <div className="grid min-h-[180px] place-items-center bg-[#f7f3eb] px-4 text-center text-sm text-[#211d18]/52">比赛开始后会显示在这里。</div>
        )}
      </div>
    </section>
  );
}

function CustomerManager({ customers, onAddCustomer }) {
  const [draft, setDraft] = useState({ name: "", account: "", password: "" });
  const [message, setMessage] = useState("");

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="border border-[#211d18]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">Customers</p>
          <h2 className="mt-1 text-xl font-semibold">新增客户</h2>
        </div>
        <UserPlus className="h-5 w-5 text-[#c59b43]" />
      </div>
      <form
        className="mt-4 grid gap-3 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const account = draft.account.trim();
          if (!account || !draft.password.trim()) return;
          if (customers.some((customer) => customer.account === account)) {
            setMessage("账号已存在");
            return;
          }
          onAddCustomer({
            account,
            password: draft.password.trim(),
            name: draft.name.trim() || account,
            status: "启用",
            createdAt: new Date().toISOString()
          });
          setDraft({ name: "", account: "", password: "" });
          setMessage(`已新增客户 ${account}`);
        }}
      >
        <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="客户名称" />
        <input value={draft.account} onChange={(event) => updateDraft("account", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="登录账号" />
        <input value={draft.password} onChange={(event) => updateDraft("password", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="登录密码" />
        <button type="submit" className="h-11 bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044] md:col-span-3">新增客户</button>
      </form>
      {message && <p className="mt-3 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">{message}</p>}
      <div className="mt-4 max-h-[260px] overflow-auto border-t border-[#211d18]/10 pt-3">
        {customers.map((customer) => (
          <div key={customer.account} className="mb-2 flex items-center justify-between gap-3 bg-[#fbf8ef] px-3 py-2 text-sm">
            <span>
              <strong>{customer.name || customer.account}</strong>
              <span className="ml-2 text-[#211d18]/45">{customer.account}</span>
            </span>
            <span className="text-xs text-[#527044]">{customer.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminPasswordPanel({ adminProfile, onChangePassword }) {
  const [draft, setDraft] = useState({ current: "", next: "", confirm: "" });
  const [message, setMessage] = useState("");

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="border border-[#211d18]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">Security</p>
          <h2 className="mt-1 text-xl font-semibold">管理员密码</h2>
        </div>
        <LockKeyhole className="h-5 w-5 text-[#c59b43]" />
      </div>
      <form
        className="mt-4 grid gap-3 md:grid-cols-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (draft.current !== adminProfile.password) {
            setMessage("当前密码不正确");
            return;
          }
          if (!draft.next.trim()) {
            setMessage("请输入新密码");
            return;
          }
          if (draft.next !== draft.confirm) {
            setMessage("两次新密码不一致");
            return;
          }
          await onChangePassword(draft.next.trim());
          setDraft({ current: "", next: "", confirm: "" });
          setMessage("管理员密码已更新");
        }}
      >
        <input value={draft.current} onChange={(event) => updateDraft("current", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="当前密码" type="password" />
        <input value={draft.next} onChange={(event) => updateDraft("next", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="新密码" type="password" />
        <input value={draft.confirm} onChange={(event) => updateDraft("confirm", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="确认新密码" type="password" />
        <button type="submit" className="h-11 bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044] md:col-span-3">保存管理员密码</button>
      </form>
      {message && <p className="mt-3 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">{message}</p>}
    </section>
  );
}

function CustomerPasswordPanel({ customers, onChangePassword }) {
  const [account, setAccount] = useState(customers[0]?.account ?? "");
  const [draft, setDraft] = useState({ next: "", confirm: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!customers.some((customer) => customer.account === account)) {
      setAccount(customers[0]?.account ?? "");
    }
  }, [account, customers]);

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="border border-[#211d18]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">Customer Password</p>
          <h2 className="mt-1 text-xl font-semibold">客户密码</h2>
        </div>
        <UsersRound className="h-5 w-5 text-[#c59b43]" />
      </div>
      <form
        className="mt-4 grid gap-3 md:grid-cols-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const customer = customers.find((item) => item.account === account);
          if (!customer) {
            setMessage("请选择客户");
            return;
          }
          if (!draft.next.trim()) {
            setMessage("请输入新密码");
            return;
          }
          if (draft.next !== draft.confirm) {
            setMessage("两次新密码不一致");
            return;
          }
          await onChangePassword(customer.account, draft.next.trim());
          setDraft({ next: "", confirm: "" });
          setMessage(`已更新 ${customer.name || customer.account} 的密码`);
        }}
      >
        <select value={account} onChange={(event) => setAccount(event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]">
          {customers.map((customer) => (
            <option key={customer.account} value={customer.account}>
              {customer.name || customer.account}（{customer.account}）
            </option>
          ))}
        </select>
        <input value={draft.next} onChange={(event) => updateDraft("next", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="新密码" type="password" />
        <input value={draft.confirm} onChange={(event) => updateDraft("confirm", event.target.value)} className="h-11 border border-[#211d18]/10 bg-[#f7f3eb] px-3 outline-none focus:border-[#c59b43]" placeholder="确认新密码" type="password" />
        <button type="submit" className="h-11 bg-[#122017] text-sm font-semibold text-white transition hover:bg-[#527044] md:col-span-3">保存客户密码</button>
      </form>
      {message && <p className="mt-3 bg-[#527044]/10 px-3 py-2 text-sm text-[#527044]">{message}</p>}
    </section>
  );
}

function AdminDateInput({ label, value, onChange, type = "date" }) {
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

function AdminMemberSelect({ customers, orders, value, onChange }) {
  const options = useMemo(() => {
    const rows = new Map();
    customers.forEach((customer) => {
      if (customer.account) rows.set(customer.account, { account: customer.account, name: customer.name || customer.account });
    });
    orders.forEach((order) => {
      if (order.account && !rows.has(order.account)) rows.set(order.account, { account: order.account, name: order.customerName || order.account });
    });
    return Array.from(rows.values());
  }, [customers, orders]);

  return (
    <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#211d18]/45">
      会员
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full border border-[#211d18]/10 bg-[#f7f3eb] px-3 text-sm normal-case tracking-normal text-[#211d18] outline-none focus:border-[#c59b43]">
        <option value="all">全部会员</option>
        {options.map((customer) => (
          <option key={customer.account} value={customer.account}>
            {customer.name}（{customer.account}）
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminReportTabs({ active, setActive }) {
  return (
    <div className="grid grid-cols-2 border-b border-[#211d18]/10 bg-white text-center text-base">
      <button type="button" onClick={() => setActive("today")} className={`h-12 border-b-2 ${active === "today" ? "border-[#b18a2a] text-[#b18a2a]" : "border-transparent text-[#211d18]/60"}`}>
        交易状况
      </button>
      <button type="button" onClick={() => setActive("history")} className={`h-12 border-b-2 ${active === "history" ? "border-[#b18a2a] text-[#b18a2a]" : "border-transparent text-[#211d18]/60"}`}>
        账户历史
      </button>
    </div>
  );
}

function adminReportDate(ymd) {
  const [, month, day] = String(ymd).split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function adminWeekday(ymd) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", weekday: "long" }).format(new Date(`${ymd}T00:00:00+08:00`));
}

function adminDateRangeDays(from, to) {
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T00:00:00+08:00`);
  const rows = [];
  for (let cursor = new Date(end); cursor >= start; cursor.setDate(cursor.getDate() - 1)) {
    rows.push(formatShanghaiYmd(cursor));
  }
  return rows;
}

function summarizeAdminHistoryDays(orders, results, from, to) {
  const byDate = new Map();
  summarizeOrders(orders, results).rows.forEach((order) => {
    const day = formatShanghaiYmd(order.createdAt);
    if (!day || day < from || day > to) return;
    const current = byDate.get(day) ?? { totalOrders: 0, totalStake: 0, won: 0, lost: 0, push: 0, pending: 0 };
    current.totalOrders += 1;
    current.totalStake += Number(order.stake || 0);
    current.won += order.counts.won;
    current.lost += order.counts.lost;
    current.push += order.counts.push;
    current.pending += order.counts.pending;
    byDate.set(day, current);
  });
  return adminDateRangeDays(from, to).map((day) => ({
    day,
    ...(byDate.get(day) ?? { totalOrders: 0, totalStake: 0, won: 0, lost: 0, push: 0, pending: 0 })
  }));
}

function OrderMonitor({ orders, results, customers }) {
  const [reportTab, setReportTab] = useState("today");
  const [selectedCustomer, setSelectedCustomer] = useState("all");
  const [todayDate, setTodayDate] = useState(() => formatShanghaiYmd());
  const [customFrom, setCustomFrom] = useState(() => addDaysToYmd(formatShanghaiYmd(), -7));
  const [customTo, setCustomTo] = useState(() => formatShanghaiYmd());
  const [selectedHistoryDay, setSelectedHistoryDay] = useState(null);
  const filteredOrders = useMemo(
    () => (selectedCustomer === "all" ? orders : orders.filter((order) => order.account === selectedCustomer)),
    [orders, selectedCustomer]
  );
  const todayRange = useMemo(() => getReportDateRange("day", { day: todayDate }), [todayDate]);
  const summary = useMemo(() => summarizeOrders(filteredOrders.filter((order) => orderMatchesReportDate(order, todayRange)), results), [filteredOrders, results, todayRange]);
  const historyRows = useMemo(() => summarizeAdminHistoryDays(filteredOrders, results, customFrom, customTo), [customFrom, customTo, filteredOrders, results]);
  const selectedHistorySummary = useMemo(() => {
    if (!selectedHistoryDay) return null;
    const range = getReportDateRange("day", { day: selectedHistoryDay });
    return summarizeOrders(filteredOrders.filter((order) => orderMatchesReportDate(order, range)), results);
  }, [filteredOrders, results, selectedHistoryDay]);

  useEffect(() => {
    setSelectedHistoryDay(null);
  }, [customFrom, customTo, selectedCustomer]);

  return (
    <section id="admin-report" className="scroll-mt-4 border border-[#211d18]/10 bg-white">
      <AdminReportTabs active={reportTab} setActive={setReportTab} />
      <div className="flex items-center justify-between gap-3">
        <div className="p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[#211d18]/42">Report</p>
          <h2 className="mt-1 text-xl font-semibold">{reportTab === "today" ? "交易状况" : "账户历史总览"}</h2>
        </div>
        <UserRound className="mr-4 h-5 w-5 text-[#c59b43]" />
      </div>
      <div className="border-y border-[#211d18]/10 bg-[#fbf8ef] p-4">
        <AdminMemberSelect customers={customers} orders={orders} value={selectedCustomer} onChange={setSelectedCustomer} />
      </div>
      {reportTab === "today" ? (
        <div className="p-4">
          <AdminDateInput label="交易日期" value={todayDate} onChange={setTodayDate} />
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            <AdminStat label="订单" value={summary.totalOrders} />
            <AdminStat label="投注金额" value={summary.totalStake.toFixed(2)} tone="gold" />
            <AdminStat label="命中" value={summary.won} />
            <AdminStat label="待开奖" value={summary.pending} tone="red" />
          </div>
          <div className="mt-4 max-h-[520px] overflow-auto space-y-3">
            {summary.rows.length === 0 ? (
              <div className="grid min-h-[160px] place-items-center bg-[#f7f3eb] px-4 text-center text-sm text-[#211d18]/50">目前没有任何交易单。</div>
            ) : (
              summary.rows.map((order) => <AdminReportOrder key={order.id} order={order} results={results} />)
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-[1fr_1fr_48px] gap-2">
              <AdminDateInput label="从" value={customFrom} onChange={setCustomFrom} />
              <AdminDateInput label="到" value={customTo} onChange={setCustomTo} />
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
          {historyRows.map((row, index) => {
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
                    {adminReportDate(row.day)}
                    <br />
                    {adminWeekday(row.day)}
                  </button>
                  <span>{row.totalOrders ? row.totalStake.toFixed(2) : "-"}</span>
                  <span>{row.totalOrders ? row.totalStake.toFixed(2) : "-"}</span>
                  <span>{row.totalOrders ? row.won - row.lost : "-"}</span>
                </div>
                {isSelected && (
                  <div className="space-y-3 border-y border-[#c59b43]/35 bg-[#fffaf0] p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <strong>{adminReportDate(row.day)} 下注详情</strong>
                      <span className="text-[#211d18]/55">{selectedHistorySummary?.totalOrders ?? 0} 单</span>
                    </div>
                    {selectedHistorySummary?.rows.length ? (
                      selectedHistorySummary.rows.map((order) => <AdminReportOrder key={order.id} order={order} results={results} />)
                    ) : (
                      <div className="grid min-h-[96px] place-items-center bg-white text-sm text-[#211d18]/50">该日期没有下注详情。</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AdminReportOrder({ order, results }) {
  return (
    <article className="border border-[#211d18]/10 bg-[#fbf8ef] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#527044]">{order.id}</p>
          <h3 className="mt-1 font-semibold">{order.customerName || order.account}</h3>
        </div>
        <span className="text-sm text-[#211d18]/60">数值 {Number(order.stake || 0).toFixed(2)}</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {summarizeOrder(order, results).selections.map((selection) => (
          <div key={selection.key} className="bg-white p-2 text-xs">
            <div className="flex justify-between gap-2">
              <strong>M{String(selection.matchNo).padStart(3, "0")} · {selection.type}</strong>
              <span>{RESULT_LABELS[selection.settleStatus]}</span>
            </div>
            <p className="mt-1 text-[#211d18]/58">{selection.pick} · {selection.price}</p>
            {selection.lineSpeech && <p className="mt-1 font-semibold text-[#a57b22]">{selection.lineSpeech}</p>}
          </div>
        ))}
      </div>
    </article>
  );
}

export default function WorldCupAdminBoard({ matches }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [adminProfile, setAdminProfile] = useState(DEFAULT_ADMIN_PROFILE);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [odds, setOdds] = useState({});
  const [results, setResults] = useState({});
  const [oddsText, setOddsText] = useState("");
  const [oddsMessage, setOddsMessage] = useState("");
  const [resultsMessage, setResultsMessage] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  const loadDesk = async () => {
    const remote = await fetchDeskData();
    const nextAdminProfile = normalizeAdminProfile(remote?.adminProfile ?? getStoredAdminProfile());
    writeStorageJson(WC26_ADMIN_PROFILE_KEY, nextAdminProfile);
    setAdminProfile(nextAdminProfile);
    setCustomers(remote?.customers ?? getStoredCustomers());
    setOrders(remote?.orders ?? readStorageJson(WC26_ORDERS_KEY, []));
    setOdds(remote?.odds ?? readStorageJson(WC26_ODDS_KEY, {}));
    setResults(remote?.results ?? readStorageJson(WC26_RESULTS_KEY, {}));
    setAuthed(localStorage.getItem(WC26_ADMIN_SESSION_KEY) === "active");
  };

  useEffect(() => {
    loadDesk();
    setReady(true);
    const handleStorage = () => loadDesk();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const importedOddsCount = Object.keys(odds).length;
  const importedResultsCount = Object.keys(results).length;

  const saveAdminProfile = async (nextProfile) => {
    const normalized = normalizeAdminProfile(nextProfile);
    writeStorageJson(WC26_ADMIN_PROFILE_KEY, normalized);
    setAdminProfile(normalized);
    const remote = await postDeskAction("updateAdminProfile", { adminProfile: normalized });
    if (remote?.adminProfile) setAdminProfile(normalizeAdminProfile(remote.adminProfile));
  };

  const updateCustomerPassword = async (account, password) => {
    const target = customers.find((customer) => customer.account === account);
    if (!target) return;
    const updatedCustomer = { ...target, password, updatedAt: new Date().toISOString() };
    const nextCustomers = normalizeCustomers(customers.map((customer) => (customer.account === account ? updatedCustomer : customer)));
    writeStorageJson(WC26_CUSTOMERS_KEY, nextCustomers);
    setCustomers(nextCustomers);
    const remote = await postDeskAction("upsertCustomer", { customer: updatedCustomer });
    if (remote?.customers) setCustomers(remote.customers);
  };

  const saveManualResult = async (match, draft) => {
    const homeScore = scoreNumber(draft.homeScore);
    const awayScore = scoreNumber(draft.awayScore);
    const homeHalfScore = scoreNumber(draft.homeHalfScore);
    const awayHalfScore = scoreNumber(draft.awayHalfScore);
    const hasHalfInput = draft.homeHalfScore !== "" || draft.awayHalfScore !== "";

    if (homeScore === null || awayScore === null) {
      setResultsMessage("请先填写全场比分");
      return;
    }

    if (hasHalfInput && (homeHalfScore === null || awayHalfScore === null)) {
      setResultsMessage("上半场比分需要两边都填写");
      return;
    }

    const next = {
      [match.id]: {
        id: match.id,
        matchNo: Number(match.matchNo),
        homeScore,
        awayScore,
        ...(hasHalfInput ? { homeHalfScore, awayHalfScore } : {}),
        importedAt: new Date().toISOString()
      }
    };
    const merged = { ...results, ...next };
    writeStorageJson(WC26_RESULTS_KEY, merged);
    setResults(merged);
    setResultsMessage(`已保存 M${String(match.matchNo).padStart(3, "0")} 赛果，订单结果已自动重新统计`);

    const remote = await postDeskAction("importResults", { results: next });
    if (remote?.results) {
      setResults(remote.results);
      setOrders(remote.orders ?? orders);
    }
  };

  const saveManualOdds = async (match, patch, successMessage) => {
    const nextRow = mergeOddsRow(odds[match.id], patch);
    const next = { [match.id]: nextRow };
    const merged = { ...odds, ...next };
    writeStorageJson(WC26_ODDS_KEY, merged);
    setOdds(merged);
    setOddsMessage(successMessage || `已保存 M${String(match.matchNo).padStart(3, "0")} 盘口水位`);

    const remote = await postDeskAction("importOdds", { odds: next });
    if (remote?.odds) setOdds(remote.odds);
  };

  if (!ready) {
    return <main className="grid min-h-screen place-items-center bg-[#f4efe4] text-[#211d18]">加载中</main>;
  }

  if (!authed) {
    return <AdminLogin adminProfile={adminProfile} onLogin={() => setAuthed(true)} />;
  }

  return (
    <main className="min-h-screen bg-[#f4efe4] text-[#211d18]">
      <header className="border-b border-[#211d18]/10 bg-[#112116] px-4 py-4 text-white md:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center border border-white/20 bg-white/10">
              <Trophy className="h-5 w-5 text-[#f3c969]" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#f3c969]">World Cup 2026</p>
              <h1 className="text-2xl font-semibold">世界杯管理端</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="#admin-report" className="inline-flex h-10 items-center border border-white/15 px-3 text-sm text-white/72 transition hover:border-[#f3c969] hover:text-[#f3c969]">报表</a>
            <a href="#manual-odds" className="inline-flex h-10 items-center border border-white/15 px-3 text-sm text-white/72 transition hover:border-[#f3c969] hover:text-[#f3c969]">手工盘口</a>
            <a href="/worldcup-board" className="inline-flex h-10 items-center border border-white/15 px-3 text-sm text-white/72 transition hover:border-[#f3c969] hover:text-[#f3c969]">客户端</a>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(WC26_ADMIN_SESSION_KEY);
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

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 md:px-6">
        <section className="grid gap-3 md:grid-cols-4">
          <AdminStat label="客户" value={customers.length} />
          <AdminStat label="赛事" value={matches.length} />
          <AdminStat label="盘口导入" value={importedOddsCount} tone="gold" />
          <AdminStat label="赛果导入" value={importedResultsCount} tone="red" />
        </section>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <CustomerManager
              customers={customers}
              onAddCustomer={async (customer) => {
                const nextCustomers = normalizeCustomers([...customers, customer]);
                writeStorageJson(WC26_CUSTOMERS_KEY, nextCustomers);
                setCustomers(nextCustomers);
                const remote = await postDeskAction("upsertCustomer", { customer });
                if (remote?.customers) {
                  setCustomers(remote.customers);
                  setOrders(remote.orders ?? orders);
                  setOdds(remote.odds ?? odds);
                  setResults(remote.results ?? results);
                }
              }}
            />
            <AdminPasswordPanel adminProfile={adminProfile} onChangePassword={(password) => saveAdminProfile({ ...adminProfile, password, updatedAt: new Date().toISOString() })} />
            <CustomerPasswordPanel customers={customers} onChangePassword={updateCustomerPassword} />
            <ManualOddsPanel matches={matches} odds={odds} message={oddsMessage} onSaveOdds={saveManualOdds} />
            <ImportBox
              title="盘口导入"
              body="Markets"
              value={oddsText}
              setValue={setOddsText}
              placeholder={oddsSample}
              message={oddsMessage}
              onImport={() => {
                try {
                  const next = parseOddsImportPayload(oddsText || oddsSample);
                  const merged = { ...odds, ...next };
                  writeStorageJson(WC26_ODDS_KEY, merged);
                  setOdds(merged);
                  setOddsMessage(`已导入 ${Object.keys(next).length} 条盘口`);
                  postDeskAction("importOdds", { odds: next }).then((remote) => {
                    if (remote?.odds) setOdds(remote.odds);
                  });
                } catch {
                  setOddsMessage("盘口 JSON 格式不正确");
                }
              }}
            />
            <ManualResultsPanel matches={matches} results={results} nowTick={nowTick} message={resultsMessage} onSaveResult={saveManualResult} />
          </div>
          <OrderMonitor orders={orders} results={results} customers={customers} />
        </div>
      </div>
    </main>
  );
}
