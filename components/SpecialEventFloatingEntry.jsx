"use client";

import { ArrowRight, CalendarDays, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import worldcupEvent from "../data/specialEvents/worldcup.json";

function dateInChina(date, endOfDay = false) {
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return Date.parse(`${date}T${time}+08:00`);
}

export function getSpecialEventDisplayMode(event, now = new Date()) {
  const current = now.getTime();
  const preheatStart = dateInChina(event.timeline.preheatStart);
  const eventStart = dateInChina(event.timeline.eventStart);
  const eventEnd = dateInChina(event.timeline.eventEnd, true);

  if (current >= eventStart && current <= eventEnd) return "live";
  if (current >= preheatStart && current < eventStart) return "preheat";
  if (current > eventEnd && event.timeline.postEventMode === "recap") return "recap";
  return "hidden";
}

export default function SpecialEventFloatingEntry() {
  const [mode, setMode] = useState("hidden");

  useEffect(() => {
    setMode(getSpecialEventDisplayMode(worldcupEvent));
  }, []);

  if (mode === "hidden") return null;

  const label = mode === "recap" ? "精彩回顾" : worldcupEvent.entry.cta;

  return (
    <a
      href={worldcupEvent.route}
      className="fixed bottom-20 left-5 right-5 z-50 flex items-center gap-3 border border-gold/35 bg-[#10130f]/88 px-4 py-3 text-porcelain shadow-night backdrop-blur-xl transition hover:border-gold hover:bg-[#151a14] md:left-auto md:w-[min(calc(100vw-2.5rem),21rem)]"
      aria-label={`${worldcupEvent.entry.title} ${worldcupEvent.entry.subtitle}`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center border border-gold/45 bg-gold/10 text-gold">
        {mode === "live" ? <Trophy className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] uppercase tracking-[0.24em] text-gold/80">{worldcupEvent.entry.eyebrow}</span>
        <strong className="mt-1 block text-sm leading-tight">{worldcupEvent.entry.title}</strong>
        <span className="mt-0.5 block text-xs text-porcelain/68">{worldcupEvent.entry.subtitle}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gold">
        {label}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}
