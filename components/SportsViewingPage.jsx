"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Crown,
  Gamepad2,
  GlassWater,
  Home,
  MapPin,
  MonitorPlay,
  Phone,
  QrCode,
  Send,
  Sparkles,
  TicketCheck,
  Trophy,
  UsersRound
} from "lucide-react";
import { useMemo, useState } from "react";

const productIcons = [TicketCheck, UsersRound, Building2];
const gameIcons = [Trophy, QrCode, Camera, Crown];

function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.82, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function copyLines(copy) {
  return copy.split("\n").map((line, index) => (
    <span key={`${line}-${index}`} className={line ? "block" : "block h-4"}>
      {line}
    </span>
  ));
}

function formatMatchDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function scrollToBooking() {
  window.requestAnimationFrame(() => {
    document.getElementById("worldcup-booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function bookingTypeFromProduct(name) {
  if (name.includes("包场")) return "包场观赛";
  if (name.includes("好友")) return "好友桌";
  return "单人位";
}

function MatchScreenVisual({ event }) {
  return (
    <div className="match-screen-visual shadow-night">
      <div className="relative z-10 flex items-center justify-between border-b border-porcelain/12 px-5 py-4 text-porcelain">
        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold">
          <CircleDot className="h-3.5 w-3.5 fill-gold/70" />
          Live Rooftop
        </span>
        <span className="text-[10px] uppercase tracking-[0.24em] text-porcelain/54">Haikou 19F</span>
      </div>
      <div className="relative z-10 px-6 py-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-porcelain/50">Match Night</p>
            <h3 className="mt-2 text-xl font-semibold text-porcelain">{event.eventTitle}</h3>
          </div>
          <MonitorPlay className="h-9 w-9 text-gold" />
        </div>
        <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
          <div className="border border-porcelain/12 bg-porcelain/6 px-3 py-5">
            <span className="text-xs uppercase tracking-[0.25em] text-porcelain/55">Team</span>
            <strong className="mt-3 block text-2xl text-porcelain">TBD</strong>
          </div>
          <div className="font-display text-4xl text-gold">VS</div>
          <div className="border border-porcelain/12 bg-porcelain/6 px-3 py-5">
            <span className="text-xs uppercase tracking-[0.25em] text-porcelain/55">Team</span>
            <strong className="mt-3 block text-2xl text-porcelain">TBD</strong>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs text-porcelain/68">
          {event.hero.signals.slice(0, 3).map((signal) => (
            <span key={signal} className="border border-gold/24 bg-gold/8 px-3 py-2">
              {signal}
            </span>
          ))}
        </div>
      </div>
      <div className="rooftop-rail" />
    </div>
  );
}

function HeroImageWall({ images, variant = "mobile" }) {
  const heroImages = (images ?? []).slice(0, 4);
  if (heroImages.length === 0) return null;

  if (variant === "desktop") {
    return (
      <div className="grid grid-cols-6 gap-3">
        {heroImages.map((item, index) => (
          <figure
            key={item.image}
            className={`group relative overflow-hidden border border-porcelain/16 bg-porcelain/8 shadow-night ${
              index === 0 ? "col-span-6 h-[300px]" : "col-span-2 h-36"
            }`}
          >
            <img src={item.image} alt={item.title ?? "DOMI 世界杯屋顶观赛"} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10130f]/42 via-transparent to-transparent" />
          </figure>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-2 lg:hidden">
      {heroImages.map((item) => (
        <figure key={item.image} className="relative aspect-[1.45/1] overflow-hidden border border-porcelain/14 bg-porcelain/8 shadow-night">
          <img src={item.image} alt={item.title ?? "DOMI 世界杯屋顶观赛"} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10130f]/30 via-transparent to-transparent" />
        </figure>
      ))}
    </div>
  );
}

function ViewingPackageCard({ product, index, onSelect }) {
  const Icon = productIcons[index % productIcons.length];

  return (
    <Reveal delay={index * 0.08}>
      <article className="group flex min-h-[420px] flex-col border border-coffee/10 bg-porcelain p-6 shadow-soft transition hover:-translate-y-1 hover:border-gold/45 md:p-7">
        <div className="flex items-start justify-between gap-5">
          <span className="grid h-12 w-12 place-items-center border border-gold/35 bg-gold/10 text-cacao">
            <Icon className="h-6 w-6" />
          </span>
          <span className="text-xs uppercase tracking-[0.24em] text-coffee/36">0{index + 1}</span>
        </div>
        <h3 className="mt-8 text-3xl font-semibold text-coffee">{product.name}</h3>
        <p className="mt-4 text-sm leading-relaxed text-coffee/58">适合：{product.fit}</p>
        <div className="mt-7">
          <p className="text-xs uppercase tracking-[0.22em] text-leaf/70">包含</p>
          <ul className="mt-4 space-y-3 text-sm text-coffee/70">
            {product.includes.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="h-4 w-4 shrink-0 text-gold" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => onSelect(product)}
          className="mt-auto inline-flex items-center justify-center gap-3 bg-coffee px-5 py-4 text-sm font-semibold text-porcelain transition hover:bg-leaf"
        >
          {product.cta}
          <ArrowRight className="h-4 w-4" />
        </button>
      </article>
    </Reveal>
  );
}

function PackageSets({ sets }) {
  return (
    <section className="section-pad bg-[#10130f] text-porcelain">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-gold">Viewing Sets</p>
            <h2 className="mt-3 font-display text-4xl leading-tight tracking-normal text-porcelain md:text-6xl">世界杯套餐示例</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-porcelain/58">套餐价格先保留待定，正式开赛前会按场次、人数和餐饮内容确认。</p>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {sets.map((set, index) => (
            <Reveal key={set.name} delay={index * 0.08}>
              <article className="flex min-h-[390px] flex-col border border-porcelain/12 bg-porcelain/[0.06] p-6 backdrop-blur">
                <div className="flex items-start justify-between gap-5">
                  <span className="text-xs uppercase tracking-[0.26em] text-gold">Set 0{index + 1}</span>
                  <span className="border border-gold/30 px-3 py-1 text-xs text-gold">{set.price}</span>
                </div>
                <h3 className="mt-8 text-2xl font-semibold leading-snug">{set.name}</h3>
                <p className="mt-2 text-lg text-gold">{set.cnName}</p>
                <p className="mt-4 text-sm text-porcelain/56">{set.fit}</p>
                <ul className="mt-8 space-y-3 text-sm text-porcelain/72">
                  {set.items.map((item) => (
                    <li key={item} className="flex gap-3 border-b border-porcelain/10 pb-3 last:border-b-0">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function MatchCalendar({ matches, selectedDate, onDateChange, onBook }) {
  const dates = useMemo(() => Array.from(new Set(matches.map((match) => match.date))), [matches]);
  const visibleMatches = selectedDate === "all" ? matches : matches.filter((match) => match.date === selectedDate);
  const recommendedCount = useMemo(() => matches.filter((match) => match.recommended).length, [matches]);

  return (
    <section id="worldcup-calendar" className="section-pad bg-porcelain">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal className="grid gap-7 md:grid-cols-[0.78fr_1.22fr] md:items-end">
          <div>
            <p className="eyebrow">Match Calendar</p>
            <h2 className="section-title">世界杯赛程日历</h2>
          </div>
          <p className="text-sm leading-relaxed text-coffee/58">
            已整理 {matches.length} 场赛程，按北京时间展示。推荐观赛场次和剩余座位会持续更新，最终以 DOMI 确认信息为准。
          </p>
        </Reveal>

        <Reveal className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            ["全部赛程", `${matches.length} 场`],
            ["推荐观赛", `${recommendedCount} 场`]
          ].map(([label, value]) => (
            <div key={label} className="border border-coffee/10 bg-cream/72 p-5">
              <span className="text-xs uppercase tracking-[0.22em] text-coffee/42">{label}</span>
              <strong className="mt-2 block font-display text-3xl text-cacao">{value}</strong>
            </div>
          ))}
        </Reveal>

        <Reveal className="mt-9 grid gap-4 md:grid-cols-[minmax(220px,280px)_1fr] md:items-end">
          <label className="field">
            <span>快速选择日期</span>
            <select name="matchDateFilter" value={selectedDate} onChange={(eventObject) => onDateChange(eventObject.target.value)}>
              <option value="all">全部 {matches.length} 场</option>
              {dates.map((date) => (
                <option key={date} value={date}>
                  {formatMatchDate(date)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => onDateChange("all")}
              className={`shrink-0 border px-4 py-3 text-sm transition ${
                selectedDate === "all" ? "border-coffee bg-coffee text-porcelain" : "border-coffee/15 bg-cream text-coffee/70 hover:border-gold"
              }`}
            >
              全部 {matches.length} 场
            </button>
            {dates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => onDateChange(date)}
                className={`shrink-0 border px-4 py-3 text-sm transition ${
                  selectedDate === date ? "border-coffee bg-coffee text-porcelain" : "border-coffee/15 bg-cream text-coffee/70 hover:border-gold"
                }`}
              >
                {formatMatchDate(date)}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4">
          {visibleMatches.map((match, index) => (
            <Reveal key={`${match.date}-${match.title}`} delay={Math.min(index, 8) * 0.025}>
              <article className="grid gap-5 border border-coffee/10 bg-cream/72 p-5 shadow-soft md:grid-cols-[0.85fr_1.2fr_0.75fr] md:items-center md:p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-leaf/70">{formatMatchDate(match.date)}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-coffee">{match.title}</h3>
                  <p className="mt-2 flex items-center gap-2 text-sm text-coffee/54">
                    <Clock3 className="h-4 w-4 text-gold" />
                    {match.time}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-coffee/54">对阵双方</p>
                  <p className="mt-2 text-xl font-semibold text-coffee">{match.teams}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="border border-coffee/10 bg-porcelain px-3 py-1.5 text-coffee/60">{match.phase}</span>
                    <span className="border border-gold/35 bg-gold/12 px-3 py-1.5 text-cacao">{match.tag}</span>
                    <span className="border border-leaf/25 bg-leaf/10 px-3 py-1.5 text-leaf">热度：{match.heat}</span>
                    {match.recommended && <span className="border border-coffee/10 bg-porcelain px-3 py-1.5 text-coffee/60">推荐观赛场次</span>}
                  </div>
                </div>
                <div className="md:text-right">
                  <p className="text-sm text-coffee/48">剩余座位</p>
                  <strong className="mt-1 block font-display text-4xl text-cacao">{match.seatsLeft}</strong>
                  <button
                    type="button"
                    disabled={!match.bookingOpen}
                    onClick={() => onBook(match)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-coffee px-5 py-3 text-sm font-semibold text-porcelain transition hover:bg-leaf disabled:cursor-not-allowed disabled:bg-coffee/25 md:w-auto"
                  >
                    {match.bookingOpen ? "预约此场" : "暂未开放"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PredictionGame({ games }) {
  return (
    <section className="section-pad bg-cream">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Match Games</p>
          <h2 className="section-title">
            不只是看球，
            <br />
            还有一点好玩的。
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {games.map((game, index) => {
            const Icon = gameIcons[index % gameIcons.length];
            return (
              <Reveal key={game.title} delay={index * 0.07}>
                <article className="min-h-[320px] border border-coffee/10 bg-porcelain p-6 shadow-soft md:p-7">
                  <div className="flex items-start justify-between gap-5">
                    <span className="grid h-12 w-12 place-items-center border border-gold/35 bg-gold/10 text-cacao">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-xs uppercase tracking-[0.24em] text-coffee/35">Play 0{index + 1}</span>
                  </div>
                  <h3 className="mt-7 text-2xl font-semibold text-coffee">{game.title}</h3>
                  <p className="mt-4 text-sm leading-loose text-coffee/62">{game.body}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {game.reward.map((item) => (
                      <span key={item} className="border border-leaf/20 bg-leaf/8 px-3 py-2 text-xs text-leaf">
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SpaceShowcase({ space }) {
  return (
    <section className="section-pad bg-[#151a14] text-porcelain">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-gold">Rooftop Space</p>
            <h2 className="mt-3 font-display text-4xl leading-tight tracking-normal md:text-6xl">空间展示</h2>
          </div>
          <p className="text-sm leading-relaxed text-porcelain/58">
            大屏、顶楼、夜景、桌位和轻食饮品一起构成活动氛围：热闹，但保持 DOMI 的体面与舒适。
          </p>
        </Reveal>
        <div className="mt-12 grid grid-cols-6 gap-3 md:gap-4">
          {space.map((item, index) => (
            <Reveal
              key={item.title}
              delay={index * 0.06}
              className={index === 0 ? "col-span-6 md:col-span-3 md:row-span-2" : index === 1 ? "col-span-6 md:col-span-3" : "col-span-3"}
            >
              <article className="group relative min-h-[220px] overflow-hidden border border-porcelain/10 bg-coffee md:min-h-[280px]">
                <img src={item.image} alt={item.title} className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#10130f]/88 via-[#10130f]/22 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-gold">{item.title}</p>
                  <p className="mt-3 text-sm leading-relaxed text-porcelain/72">{item.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingForm({ event, draft, setDraft, onSubmit }) {
  const dateOptions = useMemo(() => Array.from(new Set(event.matches.map((match) => match.date))), [event.matches]);
  const eventStartDate = event.matches[0]?.date ?? event.timeline.eventStart;
  const eventEndDate = event.matches[event.matches.length - 1]?.date ?? event.timeline.eventEnd;
  const selectableMatches = useMemo(
    () => (draft.bookingDate ? event.matches.filter((match) => match.date === draft.bookingDate) : event.matches),
    [draft.bookingDate, event.matches]
  );

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <section id="worldcup-booking" className="section-pad bg-porcelain">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-[0.82fr_1.18fr] md:px-8">
        <Reveal>
          <p className="eyebrow">Reservation</p>
          <h2 className="section-title">预约世界杯观赛座位</h2>
          <p className="mt-6 text-lg leading-loose text-coffee/64">
            提交后，DOMI 会通过手机或微信与你确认座位、套餐和包场细节。包场观赛可以继续补充人数与活动需求。
          </p>
          <div className="mt-10 space-y-4 text-sm text-coffee/70">
            <p className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gold" />
              {event.contact.address}
            </p>
            <p className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-gold" />
              {event.contact.phone}
            </p>
            <p className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-gold" />
              {eventStartDate} 至 {eventEndDate}
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <form
            className="grid gap-4 border border-coffee/10 bg-cream/75 p-5 shadow-soft backdrop-blur md:grid-cols-2 md:p-8"
            onSubmit={(formEvent) => {
              formEvent.preventDefault();
              onSubmit();
            }}
          >
            <label className="field">
              <span>姓名</span>
              <input required type="text" name="name" placeholder="你的称呼" />
            </label>
            <label className="field">
              <span>手机</span>
              <input required type="tel" name="phone" placeholder="用于确认座位" />
            </label>
            <label className="field">
              <span>微信</span>
              <input type="text" name="wechat" placeholder="方便 DOMI 联系" />
            </label>
            <label className="field">
              <span>预约日期</span>
              <select
                required
                name="bookingDate"
                value={draft.bookingDate}
                onChange={(eventObject) => {
                  const nextDate = eventObject.target.value;
                  setDraft((current) => {
                    const currentMatch = event.matches.find((match) => match.title === current.matchTitle);
                    return {
                      ...current,
                      bookingDate: nextDate,
                      matchTitle: currentMatch?.date === nextDate ? current.matchTitle : ""
                    };
                  });
                }}
              >
                <option value="">请选择日期</option>
                {dateOptions.map((date) => (
                  <option key={date} value={date}>
                    {date} {formatMatchDate(date)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>预约场次</span>
              <select
                required
                name="matchTitle"
                value={draft.matchTitle}
                onChange={(eventObject) => {
                  const match = event.matches.find((item) => item.title === eventObject.target.value);
                  setDraft((current) => ({
                    ...current,
                    matchTitle: eventObject.target.value,
                    bookingDate: match?.date ?? current.bookingDate
                  }));
                }}
              >
                <option value="">请选择场次</option>
                {selectableMatches.map((match) => (
                  <option key={`${match.date}-${match.title}`} value={match.title}>
                    {match.time}｜{match.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>人数</span>
              <input required min="1" type="number" name="people" value={draft.people} onChange={(eventObject) => updateDraft("people", eventObject.target.value)} />
            </label>
            <label className="field">
              <span>预约类型</span>
              <select name="bookingType" value={draft.bookingType} onChange={(eventObject) => updateDraft("bookingType", eventObject.target.value)}>
                {event.booking.types.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>是否需要餐饮套餐</span>
              <select name="catering" value={draft.catering} onChange={(eventObject) => updateDraft("catering", eventObject.target.value)}>
                {event.booking.cateringOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="field md:col-span-2">
              <span>备注</span>
              <textarea name="note" rows="4" placeholder="想预约的队伍、包场需求、餐饮偏好等" />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-3 bg-coffee px-6 py-4 text-sm font-semibold text-porcelain transition hover:bg-leaf md:col-span-2"
            >
              <Send className="h-5 w-5" />
              提交观赛预约
            </button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

export default function SportsViewingPage({ event }) {
  const [selectedDate, setSelectedDate] = useState("all");
  const [submitted, setSubmitted] = useState(false);
  const heroImages = event.hero.gallery ?? event.space ?? [];
  const [bookingDraft, setBookingDraft] = useState({
    bookingDate: "",
    matchTitle: "",
    people: "2",
    bookingType: event.booking.types[1],
    catering: event.booking.cateringOptions[0]
  });

  const selectProduct = (product) => {
    setBookingDraft((current) => ({
      ...current,
      bookingType: bookingTypeFromProduct(product.name),
      people: product.name.includes("单人") ? "1" : product.name.includes("包场") ? "10" : "4"
    }));
    scrollToBooking();
  };

  const selectMatch = (match) => {
    setBookingDraft((current) => ({
      ...current,
      bookingDate: match.date,
      matchTitle: match.title
    }));
    scrollToBooking();
  };

  return (
    <main className="min-h-screen overflow-hidden bg-cream text-coffee">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-porcelain/10 bg-[#10130f]/78 px-4 py-3 text-porcelain backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="/" className="group flex items-center gap-3" aria-label="返回 DOMI 首页">
            <span className="grid h-9 w-9 place-items-center border border-porcelain/40 font-display text-xl">D</span>
            <span>
              <strong className="block text-sm tracking-[0.18em] md:text-base">DOMI 多米花园</strong>
              <small className="block text-[10px] uppercase tracking-[0.24em] text-porcelain/60">{event.moduleName}</small>
            </span>
          </a>
          <div className="hidden items-center gap-7 text-sm text-porcelain/78 md:flex">
            <a href="#worldcup-packages" className="transition hover:text-gold">
              观赛套餐
            </a>
            <a href="#worldcup-calendar" className="transition hover:text-gold">
              赛事日历
            </a>
            <a href="#worldcup-booking" className="transition hover:text-gold">
              预约
            </a>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 border border-porcelain/28 bg-porcelain/8 px-4 py-2 text-xs tracking-[0.18em] text-porcelain transition hover:border-gold hover:text-gold"
          >
            <Home className="h-4 w-4" />
            首页
          </a>
        </div>
      </nav>

      <section className="relative min-h-[96svh] overflow-hidden bg-[#10130f] text-porcelain">
        <img src={event.hero.image} alt={event.hero.subtitle} className="absolute inset-0 h-full w-full object-cover opacity-54" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,19,15,0.92),rgba(16,19,15,0.64),rgba(16,19,15,0.35)),linear-gradient(180deg,rgba(16,19,15,0.46),rgba(16,19,15,0.16),rgba(16,19,15,0.96))]" />
        <div className="ambient-grain opacity-28" />
        <div className="city-light-band" />
        <div className="absolute right-[4vw] top-[16vh] z-10 hidden w-[min(42vw,590px)] lg:block">
          <HeroImageWall images={heroImages} variant="desktop" />
        </div>

        <div className="relative z-20 mx-auto flex min-h-[96svh] max-w-7xl flex-col justify-end px-5 pb-20 pt-32 md:px-8 md:pb-24 md:pt-40">
          <motion.p
            className="mb-5 text-xs uppercase tracking-[0.42em] text-gold md:text-sm"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.12 }}
          >
            {event.hero.eyebrow}
          </motion.p>
          <motion.h1
            className="max-w-full whitespace-nowrap font-display text-[9.8vw] leading-[0.96] tracking-normal sm:text-[3.6rem] md:text-[4rem] lg:text-[4.1rem] xl:text-[4.3rem]"
            initial={{ opacity: 0, y: 28, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.1, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {event.eventTitle}
          </motion.h1>
          <motion.p
            className="mt-7 max-w-2xl text-xl font-light leading-relaxed text-porcelain/88 md:text-3xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.42 }}
          >
            {event.hero.subtitle}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.52 }}
          >
            <HeroImageWall images={heroImages} />
          </motion.div>
          <motion.div
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.58 }}
          >
            {event.hero.ctas.map((cta) => (
              <a
                key={cta.label}
                href={cta.target}
                className={`inline-flex items-center justify-center gap-3 px-5 py-4 text-sm font-semibold transition ${
                  cta.variant === "primary"
                    ? "bg-porcelain text-coffee shadow-glow hover:bg-gold"
                    : cta.variant === "outline"
                      ? "border border-porcelain/38 text-porcelain hover:border-gold hover:text-gold"
                      : "border border-transparent bg-porcelain/8 text-porcelain/82 hover:text-gold"
                }`}
              >
                {cta.variant === "primary" ? <TicketCheck className="h-5 w-5" /> : cta.variant === "outline" ? <Building2 className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                {cta.label}
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="section-pad bg-porcelain">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <Reveal>
            <p className="eyebrow">{event.moduleName}</p>
            <h2 className="mt-3 font-display text-[7.4vw] leading-tight tracking-normal text-coffee sm:text-4xl md:text-5xl lg:text-[3.25rem] [&>span]:whitespace-nowrap">
              {copyLines(event.hero.headline)}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="border-l border-gold/45 pl-6 text-lg leading-loose text-coffee/68">{copyLines(event.hero.body)}</div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="border border-coffee/10 bg-cream p-5">
                <MonitorPlay className="h-6 w-6 text-gold" />
                <p className="mt-4 text-sm text-coffee/60">大屏观赛</p>
              </div>
              <div className="border border-coffee/10 bg-cream p-5">
                <GlassWater className="h-6 w-6 text-gold" />
                <p className="mt-4 text-sm text-coffee/60">特调与饮品</p>
              </div>
              <div className="border border-coffee/10 bg-cream p-5">
                <Gamepad2 className="h-6 w-6 text-gold" />
                <p className="mt-4 text-sm text-coffee/60">赛前赛后互动</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="worldcup-packages" className="section-pad bg-cream">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Viewing Products</p>
              <h2 className="section-title">世界杯运营产品卡</h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-coffee/60">
              从一个人的轻松观赛，到朋友桌和包场局，都保持屋顶花园的社交气质。
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {event.viewingProducts.map((product, index) => (
              <ViewingPackageCard key={product.name} product={product} index={index} onSelect={selectProduct} />
            ))}
          </div>
        </div>
      </section>

      <PackageSets sets={event.sets} />
      <MatchCalendar matches={event.matches} selectedDate={selectedDate} onDateChange={setSelectedDate} onBook={selectMatch} />
      <PredictionGame games={event.games} />
      <SpaceShowcase space={event.space} />
      <BookingForm event={event} draft={bookingDraft} setDraft={setBookingDraft} onSubmit={() => setSubmitted(true)} />

      <footer className="bg-[#10130f] px-5 py-12 text-porcelain md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-4xl">{event.moduleName}</h2>
            <p className="mt-4 text-sm leading-relaxed text-porcelain/65">
              地址：{event.contact.address}
              <br />
              联系方式：{event.contact.phone}
            </p>
          </div>
          <div className="text-left md:text-right">
            <div className="flex flex-wrap gap-3 md:justify-end">
              {["Rooftop", "Football Night", "Friends Table"].map((tag) => (
                <span key={tag} className="border border-porcelain/16 px-4 py-2 text-sm text-porcelain/66">
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-6 font-display text-2xl text-gold">Urban social night above Haikou.</p>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {submitted && (
          <motion.div
            className="fixed inset-0 z-[70] grid place-items-center bg-[#10130f]/68 px-5 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm border border-gold/30 bg-porcelain p-8 text-center text-coffee shadow-night"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mx-auto grid h-12 w-12 place-items-center bg-leaf text-porcelain">
                <BadgeCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold">预约已提交</h3>
              <p className="mt-3 whitespace-pre-line text-lg leading-relaxed text-coffee/70">{event.booking.success}</p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-7 inline-flex items-center justify-center gap-2 bg-coffee px-5 py-3 text-sm text-porcelain transition hover:bg-leaf"
              >
                知道了
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
