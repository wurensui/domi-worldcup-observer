"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowDown,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Gift,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Send,
  Volume2,
  VolumeX
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const navItems = [
  ["首页", "#home"],
  ["节令产品", "#duanwu"],
  ["产品预订", "#booking"],
  ["企业团购", "#corporate"],
  ["世界杯专场", "/worldcup"],
  ["DOMI空间", "#space"],
  ["联系我们", "#booking"]
];

const heroFrames = [
  { src: "/images/product-zongzi.jpg", tone: "Dragon Boat zongzi product" },
  { src: "/images/product-anti-inflammatory-juice.jpg", tone: "Anti-inflammatory vegetable juice" },
  { src: "/images/product-sea-salt-roll.jpg", tone: "Handmade sea salt rolls" },
  { src: "/images/product-dubai-chocolate.png", tone: "Dubai pistachio chocolate" }
];

const storySlides = [
  { src: "/images/product-zongzi.jpg", label: "多米粽", caption: "粽叶、糯米、咸蛋黄和黑猪肉，是端午最直接的节令记忆。" },
  { src: "/images/product-anti-inflammatory-juice.jpg", label: "抗炎果蔬汁", caption: "甜菜根、姜、浆果与柑橘，做成清晨可以分享的一瓶鲜活。" },
  { src: "/images/product-sea-salt-roll.jpg", label: "海盐卷", caption: "柔软面包、海盐晶粒和黄油香气，给午后留一点松弛。" },
  { src: "/images/product-dubai-chocolate.png", label: "迪拜巧克力", caption: "开心果、巧克力与酥脆夹心，适合做一份有记忆点的甜品礼物。" },
  { src: "/images/product-dubai-cookie-mochi-ball.png", label: "迪拜软曲奇巧克力球", caption: "可可外层、麻薯口感与开心果香气，做成适合分享的四枚小盒。" }
];

const reservableProducts = [
  {
    name: "多米粽",
    badge: "端午限定",
    desc: "海南黑猪肉 × 咸蛋黄 × 手工包制",
    price: "¥168 / 份",
    img: "/images/product-zongzi.jpg"
  },
  {
    name: "抗炎果蔬汁",
    badge: "清晨轻养",
    desc: "甜菜根 × 姜 × 浆果 × 柑橘",
    price: "单瓶 / 套装可订",
    img: "/images/product-anti-inflammatory-juice.jpg"
  },
  {
    name: "海盐卷",
    badge: "下午茶手作",
    desc: "手作面包 × 海盐晶粒 × 黄油香",
    price: "按盒预订",
    img: "/images/product-sea-salt-roll.jpg"
  },
  {
    name: "迪拜巧克力",
    badge: "新品甜品",
    desc: "开心果夹心 × 巧克力 × 酥脆口感",
    price: "¥268 / 份",
    img: "/images/product-dubai-chocolate.png",
    cta: "预订迪拜巧克力"
  },
  {
    name: "迪拜软曲奇巧克力（麻薯）球",
    badge: "新品小盒",
    desc: "可可外层 × 麻薯口感 × 开心果香",
    price: "¥88 / 4个",
    img: "/images/product-dubai-cookie-mochi-ball.png",
    cta: "预订巧克力球"
  }
];

const stats = [
  { display: "80+", label: "端午预订礼盒" },
  { display: "19F", label: "海口顶楼花园" },
  { display: "试营业中", label: "城市客人陆续到访" }
];

const reviews = [
  "终于有一家不像传统餐厅的地方。",
  "送客户很体面。",
  "海口少见这么有节日感的品牌。",
  "像在上海或东京的小店。"
];

const duanwuTarget = new Date("2026-06-19T10:00:00+08:00").getTime();
const reservationFormName = "domi-reservation";
const reservationEndpoint = process.env.NEXT_PUBLIC_RESERVATION_ENDPOINT || "/api/reservations";

function encodeFormData(formData) {
  return new URLSearchParams(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  ).toString();
}

function getCountdown() {
  const distance = Math.max(0, duanwuTarget - Date.now());
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  const minute = 60 * 1000;
  return {
    days: Math.floor(distance / day),
    hours: Math.floor((distance % day) / hour),
    minutes: Math.floor((distance % hour) / minute),
    seconds: Math.floor((distance % minute) / 1000)
  };
}

function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 34, filter: "blur(16px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Countdown() {
  const [time, setTime] = useState(null);

  useEffect(() => {
    setTime(getCountdown());
    const timer = window.setInterval(() => setTime(getCountdown()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const displayTime = time ?? { days: "--", hours: "--", minutes: "--", seconds: "--" };

  return (
    <div className="grid grid-cols-4 border border-coffee/10 bg-porcelain/80 text-center shadow-soft backdrop-blur">
      {[
        ["DAYS", displayTime.days],
        ["HRS", displayTime.hours],
        ["MIN", displayTime.minutes],
        ["SEC", displayTime.seconds]
      ].map(([label, value]) => (
        <div key={label} className="border-r border-coffee/10 px-2 py-4 last:border-r-0">
          <strong className="block font-display text-2xl text-coffee md:text-4xl">
            {typeof value === "number" ? String(value).padStart(2, "0") : value}
          </strong>
          <span className="mt-1 block text-[10px] tracking-[0.28em] text-coffee/40">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function DomiLanding() {
  const [frame, setFrame] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(reservableProducts[0].name);
  const [selectedEnterprise, setSelectedEnterprise] = useState("否");
  const audioRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.22], [0, 110]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0.35]);

  const activeFrame = heroFrames[frame % heroFrames.length];
  const activeStory = storySlides[storyIndex % storySlides.length];

  const stopAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.nodes.forEach((node) => {
      try {
        node.stop?.();
        node.disconnect?.();
      } catch {
        node.disconnect?.();
      }
    });
    audio.ctx.close();
    audioRef.current = null;
    setSoundOn(false);
  };

  const toggleAudio = async () => {
    if (soundOn) {
      stopAudio();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.035;
    master.connect(ctx.destination);

    const low = ctx.createOscillator();
    low.type = "sine";
    low.frequency.value = 174;
    const high = ctx.createOscillator();
    high.type = "triangle";
    high.frequency.value = 261.63;
    const pad = ctx.createGain();
    pad.gain.value = 0.22;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.18;
    }
    const breeze = ctx.createBufferSource();
    breeze.buffer = buffer;
    breeze.loop = true;
    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = "bandpass";
    breezeFilter.frequency.value = 520;
    breezeFilter.Q.value = 0.45;
    const breezeGain = ctx.createGain();
    breezeGain.gain.value = 0.16;

    low.connect(pad);
    high.connect(pad);
    pad.connect(filter);
    filter.connect(master);
    breeze.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(master);

    low.start();
    high.start();
    breeze.start();
    await ctx.resume();

    audioRef.current = { ctx, nodes: [low, high, breeze, master, pad, filter, breezeFilter, breezeGain] };
    setSoundOn(true);
  };

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const timer = window.setInterval(() => setFrame((value) => value + 1), 5200);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const timer = window.setInterval(() => setStoryIndex((value) => value + 1), 4300);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  useEffect(() => () => stopAudio(), []);

  const productTags = useMemo(() => ["手工制作", "海南风味", "节日送礼", "限量预订"], []);

  const handleProductReserve = (productName) => {
    setSelectedProduct(productName);
    setSelectedEnterprise("否");
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCorporateReserve = () => {
    setSelectedProduct("多米粽");
    setSelectedEnterprise("是");
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleReservationSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("form-name", reservationFormName);
    formData.set("product", selectedProduct);
    formData.set("enterprise", selectedEnterprise);
    formData.set("source", "DOMI Seasonal H5");
    formData.set("submittedAt", new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }));

    setSubmitStatus("submitting");
    setSubmitError("");

    try {
      const isNetlifyHost = window.location.hostname.includes("netlify.app");

      if (isNetlifyHost) {
        const response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeFormData(formData)
        });

        if (!response.ok) {
          throw new Error("Reservation submission failed");
        }
      } else {
        const response = await fetch(reservationEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeFormData(formData)
        });

        if (!response.ok) {
          throw new Error("Reservation submission failed");
        }
      }

      setSubmitted(true);
      form.reset();
      setSelectedProduct(reservableProducts[0].name);
      setSelectedEnterprise("否");
    } catch {
      setSubmitError("提交暂时没有成功，请稍后再试，或直接通过微信 / 电话联系 DOMI。");
    } finally {
      setSubmitStatus("idle");
    }
  };

  return (
    <main id="home" className="min-h-screen overflow-hidden bg-cream text-coffee">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-coffee/25 px-4 py-3 text-porcelain backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="#home" className="group flex items-center gap-3" aria-label="DOMI 多米花园 首页">
            <span className="grid h-9 w-9 place-items-center border border-porcelain/40 font-display text-xl">D</span>
            <span>
              <strong className="block text-sm tracking-[0.18em] md:text-base">DOMI 多米花园</strong>
              <small className="block text-[10px] uppercase tracking-[0.24em] text-porcelain/60">Seasonal handcraft</small>
            </span>
          </a>
          <div className="hidden items-center gap-7 text-sm text-porcelain/80 md:flex">
            {navItems.map(([label, href]) => (
              <a key={label} href={href} className="transition hover:text-gold">
                {label}
              </a>
            ))}
          </div>
          <a
            href="#booking"
            className="inline-flex items-center gap-2 border border-porcelain/35 bg-porcelain/10 px-4 py-2 text-xs tracking-[0.18em] text-porcelain transition hover:border-gold hover:text-gold"
          >
            <Gift className="h-4 w-4" />
            预订
          </a>
        </div>
      </nav>

      <button
        type="button"
        onClick={toggleAudio}
        className="fixed bottom-5 right-5 z-50 grid h-12 w-12 place-items-center border border-coffee/15 bg-porcelain/80 text-coffee shadow-soft backdrop-blur-xl transition hover:border-gold hover:text-gold"
        aria-label={soundOn ? "关闭环境音" : "开启环境音"}
      >
        {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </button>

      <section className="relative min-h-[100svh] overflow-hidden bg-coffee text-porcelain">
        <motion.div className="absolute inset-0" style={{ y: heroY, opacity: heroOpacity }}>
          <AnimatePresence mode="wait">
            <motion.img
              key={activeFrame.src}
              src={activeFrame.src}
              alt={activeFrame.tone}
              className="h-full w-full object-cover"
              initial={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1.12, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.08, filter: "blur(10px)" }}
              transition={{ duration: 1.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </AnimatePresence>
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(43,33,27,0.82),rgba(43,33,27,0.42),rgba(43,33,27,0.12)),linear-gradient(180deg,rgba(43,33,27,0.4),rgba(43,33,27,0.18),rgba(43,33,27,0.82))]" />
        <div className="ambient-grain" />
        <div className="absolute right-6 top-28 hidden h-64 w-px bg-gradient-to-b from-transparent via-gold/80 to-transparent md:block" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pb-24 pt-36 md:px-8 md:pb-20">
          <motion.p
            className="mb-5 text-xs uppercase tracking-[0.42em] text-gold md:text-sm"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.2 }}
          >
            HAIKOU SEASONAL HANDCRAFT SPACE
          </motion.p>
          <motion.h1
            className="max-w-5xl font-display text-[10.2vw] leading-[0.95] tracking-normal md:text-7xl lg:text-8xl"
            initial={{ opacity: 0, y: 30, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.3, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            今年端午，
            <br />
            别再送‘公司味’的礼盒了。
          </motion.h1>
          <motion.p
            className="mt-8 max-w-3xl text-xl font-light leading-relaxed text-porcelain/90 md:text-3xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.62 }}
          >
            海南黑猪肉 × 咸蛋黄 × 手工包制｜多米粽，把节日做得体面一点。
          </motion.p>
          <motion.div
            className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-3"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.82 }}
          >
            <a
              href="#booking"
              onClick={(event) => {
                event.preventDefault();
                handleProductReserve("多米粽");
              }}
              className="inline-flex items-center justify-center gap-3 bg-porcelain px-6 py-4 text-sm font-semibold text-coffee shadow-glow transition hover:bg-gold hover:text-coffee"
            >
              <Gift className="h-5 w-5" />
              立即预订多米粽
            </a>
            <a
              href="#corporate"
              className="inline-flex items-center justify-center gap-3 border border-porcelain/40 px-6 py-4 text-sm font-semibold text-porcelain transition hover:border-gold hover:text-gold"
            >
              <Building2 className="h-5 w-5" />
              企业团购 / 客户送礼
            </a>
            <a
              href="/worldcup"
              className="inline-flex items-center justify-center gap-3 border border-gold/50 bg-[#10130f]/45 px-6 py-4 text-sm font-semibold text-porcelain shadow-glow transition hover:bg-gold hover:text-coffee"
            >
              <ChevronRight className="h-5 w-5" />
              世界杯屋顶观赛
            </a>
          </motion.div>
        </div>

        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-porcelain/60">
          SCROLL TO EXPLORE
          <ArrowDown className="h-4 w-4 animate-soft-bob text-gold" />
        </div>
      </section>

      <section id="duanwu" className="section-pad relative overflow-hidden bg-porcelain">
        <div className="absolute left-0 top-0 h-full w-1/3 bg-leaf/5" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:grid-cols-[1.05fr_0.95fr] md:px-8">
          <Reveal className="relative">
            <div className="product-stage">
              <img
                src="/images/product-zongzi.jpg"
                alt="黑猪肉咸蛋黄多米粽产品图"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(43,33,27,0.08),rgba(43,33,27,0.02)),linear-gradient(180deg,rgba(255,253,248,0.04),rgba(43,33,27,0.28))]" />
              <div className="golden-ray" />
              <div className="steam steam-one" />
              <div className="steam steam-two" />
              <div className="steam steam-three" />
              <div className="product-plaque">
                <span>端午限定</span>
                <strong>多米粽礼盒</strong>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative z-10">
            <p className="eyebrow">Dragon Boat Limited</p>
            <h2 className="section-title">端午限定｜多米粽</h2>
            <p className="mt-4 text-lg leading-relaxed text-coffee/70">海南黑猪肉 × 咸蛋黄 × 手工包制</p>

            <div className="mt-8 border border-coffee/10 bg-cream/70 p-6 shadow-soft backdrop-blur md:p-8">
              <div className="flex items-start justify-between gap-6 border-b border-coffee/10 pb-6">
                <div>
                  <p className="text-sm tracking-[0.2em] text-leaf">DOMI FESTIVE BOX</p>
                  <h3 className="mt-3 text-2xl font-semibold">黑猪肉咸蛋黄粽 × 8</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-coffee/50">价格</span>
                  <strong className="block font-display text-4xl text-cacao">¥168</strong>
                  <small className="text-coffee/50">/ 份</small>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {productTags.map((tag) => (
                  <span key={tag} className="border border-leaf/20 bg-leaf/10 px-3 py-2 text-xs text-leaf">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid gap-3 border border-gold/25 bg-porcelain/55 p-4 text-sm text-coffee/68 sm:grid-cols-3">
                {[
                  ["今日可订：", "30份"],
                  ["已预订：", "80份"],
                  ["接单状态", "端午前限量接单中"]
                ].map(([label, value]) => (
                  <div key={label} className="border-l border-gold/45 pl-3">
                    <span className="block text-[10px] uppercase tracking-[0.22em] text-coffee/42">{label}</span>
                    <strong className="mt-2 block text-base font-semibold text-cacao">{value}</strong>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Countdown />
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  data-reserve-product="多米粽"
                  onClick={() => handleProductReserve("多米粽")}
                  className="inline-flex items-center justify-center gap-3 bg-coffee px-5 py-4 text-sm font-semibold text-porcelain transition hover:bg-leaf"
                >
                  <PackageCheck className="h-5 w-5" />
                  立即预订
                </button>
                <button
                  type="button"
                  data-reserve-product="多米粽企业团购"
                  onClick={() => document.getElementById("corporate")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="inline-flex items-center justify-center gap-3 border border-coffee/20 px-5 py-4 text-sm font-semibold text-coffee transition hover:border-gold hover:text-cacao"
                >
                  <Building2 className="h-5 w-5" />
                  企业团购
                </button>
              </div>
            </div>
          </Reveal>
        </div>
        <div className="relative z-10 mx-auto mt-14 max-w-7xl px-5 md:px-8">
          <Reveal className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Available for Reservation</p>
              <h3 className="mt-3 text-3xl font-semibold leading-tight text-coffee md:text-5xl">五款节令产品，均可预订。</h3>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-coffee/60">
              多米粽、抗炎果蔬汁、海盐卷、迪拜巧克力与迪拜软曲奇巧克力（麻薯）球，都保留手作与分享感，适合自用、下午茶、节日送礼和小型团购。
            </p>
          </Reveal>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {reservableProducts.map((product, index) => (
              <Reveal key={product.name} delay={index * 0.06}>
                <motion.article
                  data-product={product.name}
                  className="group overflow-hidden border border-coffee/10 bg-cream shadow-soft"
                  whileHover={{ y: -6, scale: 1.01 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-coffee xl:aspect-[3/4]">
                    <img src={product.img} alt={`DOMI ${product.name}产品图`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-coffee/58 via-coffee/5 to-transparent" />
                    <span className="absolute left-4 top-4 border border-gold/40 bg-coffee/35 px-3 py-2 text-xs tracking-[0.18em] text-gold backdrop-blur">
                      {product.badge}
                    </span>
                  </div>
                  <div className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-2xl font-semibold leading-tight text-coffee xl:text-xl">{product.name}</h4>
                        <p className="mt-3 text-sm leading-relaxed text-coffee/60">{product.desc}</p>
                      </div>
                      <strong className="whitespace-nowrap font-display text-xl text-cacao xl:text-lg">{product.price}</strong>
                    </div>
                    <button
                      type="button"
                      data-reserve-product={product.name}
                      onClick={() => handleProductReserve(product.name)}
                      className="mt-6 inline-flex w-full items-center justify-center gap-3 bg-coffee px-5 py-4 text-sm font-semibold text-porcelain transition hover:bg-leaf"
                    >
                      <PackageCheck className="h-5 w-5" />
                      {product.cta ?? `预订${product.name}`}
                    </button>
                  </div>
                </motion.article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="worldcup-entry" className="section-pad relative overflow-hidden bg-[#10130f] text-porcelain">
        <div className="absolute inset-0 opacity-50">
          <img src="/images/worldcup-beer-hero.jpg" alt="DOMI 世界杯屋顶观赛季" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,19,15,0.94),rgba(16,19,15,0.68),rgba(16,19,15,0.32)),linear-gradient(180deg,rgba(16,19,15,0.22),rgba(16,19,15,0.9))]" />
        </div>
        <div className="ambient-grain opacity-25" />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 md:grid-cols-[0.88fr_1.12fr] md:px-8">
          <Reveal>
            <p className="eyebrow text-gold">DOMI WORLD CUP NIGHTS</p>
            <h2 className="mt-4 font-display text-[11vw] leading-[0.95] tracking-normal text-porcelain md:text-6xl lg:text-7xl">
              世界杯屋顶
              <br />
              观赛季
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-loose text-porcelain/74">
              在海口 19F，和朋友一起看一场有氛围的球。大屏、夜风、啤酒、小食与竞猜互动，适合好友桌、包场观赛和城市夜生活打卡。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="/worldcup"
                className="inline-flex items-center justify-center gap-3 bg-porcelain px-6 py-4 text-sm font-semibold text-coffee shadow-glow transition hover:bg-gold"
              >
                <ChevronRight className="h-5 w-5" />
                进入世界杯专题
              </a>
              <a
                href="/worldcup#worldcup-booking"
                className="inline-flex items-center justify-center gap-3 border border-gold/45 px-6 py-4 text-sm font-semibold text-gold transition hover:bg-gold hover:text-coffee"
              >
                <Gift className="h-5 w-5" />
                预约观赛座位
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="grid grid-cols-6 gap-3 md:gap-4">
              <img src="/images/worldcup-beer-hero.jpg" alt="屋顶大屏观赛" className="col-span-6 h-[280px] w-full object-cover shadow-night md:h-[390px]" />
              <img src="/images/worldcup-beer-cheers.jpg" alt="好友举杯看球" className="col-span-3 h-40 w-full object-cover md:h-56" />
              <img src="/images/worldcup-beer-table.jpg" alt="世界杯观赛桌位" className="col-span-3 h-40 w-full object-cover md:h-56" />
            </div>
          </Reveal>
        </div>
      </section>

      <section id="corporate" className="section-pad relative overflow-hidden bg-cream">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-10 md:grid-cols-[0.92fr_1.08fr]">
            <Reveal className="self-center">
              <p className="eyebrow">Corporate Gift</p>
              <h2 className="section-title">DOMI 企业节令礼赠方案</h2>
              <p className="mt-6 max-w-2xl text-lg leading-loose text-coffee/68">
                适合员工福利、客户答谢、酒店前台代售、商务拜访与节日送礼。
              </p>
              <p className="mt-6 max-w-xl text-base leading-loose text-coffee/58">
                不做堆满话术的促销礼盒，DOMI 把端午礼赠放回真实场景：见客户时拿得出手，给员工时不敷衍，放在酒店前台也有海口本地的节令质感。
              </p>
              <div className="mt-9 flex flex-wrap gap-3 text-sm text-coffee/70">
                {["员工福利", "客户答谢", "酒店代售", "商务拜访", "节日送礼"].map((item) => (
                  <span key={item} className="border border-leaf/15 bg-porcelain/60 px-4 py-3 shadow-[0_14px_35px_rgba(43,33,27,0.05)]">
                    {item}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <article className="grid overflow-hidden border border-coffee/10 bg-porcelain shadow-soft md:grid-cols-[0.9fr_1.1fr]">
                <div className="relative min-h-[320px] bg-coffee md:min-h-[460px]">
                  <img src="/images/product-zongzi.jpg" alt="多米粽礼盒产品图" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(43,33,27,0.05),rgba(43,33,27,0.58))]" />
                  <span className="absolute left-5 top-5 border border-gold/45 bg-coffee/40 px-3 py-2 text-xs uppercase tracking-[0.22em] text-gold backdrop-blur">
                    Dragon Boat Gift
                  </span>
                </div>
                <div className="flex flex-col justify-between p-6 md:p-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-leaf/70">Core Product</p>
                    <h3 className="mt-4 text-3xl font-semibold leading-tight text-coffee">多米粽礼盒</h3>
                    <p className="mt-4 text-lg leading-relaxed text-coffee/65">海南黑猪肉咸蛋黄粽 × 8</p>
                  </div>
                  <div className="mt-10 border-t border-coffee/10 pt-6">
                    <span className="text-xs uppercase tracking-[0.24em] text-coffee/42">Price</span>
                    <div className="mt-2 flex items-end gap-2">
                      <strong className="font-display text-5xl text-cacao">168元</strong>
                      <span className="pb-2 text-sm text-coffee/48">/ 份</span>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-coffee/55">可按数量确认自提、配送与礼赠交付节奏。</p>
                  </div>
                </div>
              </article>
            </Reveal>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ["手工包制", "不是流水线礼盒，更有温度。", PackageCheck],
              ["送礼体面", "适合客户、朋友、员工福利。", Gift],
              ["海口本地", "支持本地配送 / 到店自提。", MapPin],
              ["可批量预订", "适合公司团购、酒店前台代售。", Building2]
            ].map(([title, copy, Icon], index) => (
              <Reveal key={title} delay={index * 0.05}>
                <article className="h-full border border-coffee/10 bg-porcelain/72 p-5 shadow-[0_20px_55px_rgba(43,33,27,0.08)] backdrop-blur transition duration-500 hover:-translate-y-1 hover:border-gold/45 md:p-6">
                  <div className="grid h-11 w-11 place-items-center border border-gold/35 bg-gold/10 text-cacao">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-coffee">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-coffee/62">{copy}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.08}>
            <div className="mt-8 grid gap-0 overflow-hidden border border-coffee/10 bg-coffee text-porcelain shadow-night md:grid-cols-[1fr_0.78fr]">
              <div className="p-6 md:p-8">
                <p className="text-xs uppercase tracking-[0.3em] text-gold">Suitable For</p>
                <h3 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">适合谁订</h3>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {["公司员工福利", "客户关系维护", "酒店前台伴手礼", "美业 / 教培 / 私域社群团购", "节日前商务拜访"].map((item) => (
                    <p key={item} className="flex items-start gap-3 border-t border-porcelain/12 pt-4 text-sm leading-relaxed text-porcelain/74">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      {item}
                    </p>
                  ))}
                </div>
              </div>
              <div className="border-t border-porcelain/12 bg-porcelain/7 p-6 md:border-l md:border-t-0 md:p-8">
                <p className="text-sm leading-loose text-porcelain/70">
                  需要给客户、员工或渠道伙伴准备端午礼盒，可以先留下数量和送礼场景。DOMI 会尽快与你确认礼盒数量、配送方式和交付时间。
                </p>
                <p className="mt-4 border-l border-gold/60 pl-4 text-sm leading-relaxed text-gold/90">
                  10份起适合团队福利，30份以上建议提前锁定制作档期。
                </p>
                <a
                  href="#booking"
                  onClick={(event) => {
                    event.preventDefault();
                    handleCorporateReserve();
                  }}
                  className="mt-8 inline-flex w-full items-center justify-center gap-3 bg-gold px-6 py-4 text-sm font-semibold text-coffee transition hover:bg-porcelain"
                >
                  <Phone className="h-5 w-5" />
                  咨询企业团购
                </a>
                <p className="mt-5 flex items-center gap-3 text-sm text-porcelain/60">
                  <MessageCircle className="h-4 w-4 text-gold" />
                  微信 / 电话：+86 13976010101
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-pad bg-cream">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-[1.15fr_0.85fr] md:px-8">
          <Reveal>
            <div className="relative min-h-[520px] overflow-hidden border border-coffee/10 bg-coffee shadow-soft">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeStory.src}
                  src={activeStory.src}
                  alt={activeStory.label}
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                />
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-coffee/80 via-coffee/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-porcelain md:p-8">
                <p className="text-xs uppercase tracking-[0.32em] text-gold">Handcraft Story</p>
                <h3 className="mt-3 text-3xl font-semibold">{activeStory.label}</h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-porcelain/75">{activeStory.caption}</p>
                <div className="mt-5 flex gap-2">
                  {storySlides.map((slide, index) => (
                    <button
                      key={slide.label}
                      type="button"
                      onClick={() => setStoryIndex(index)}
                      className={`h-1.5 transition-all ${index === storyIndex % storySlides.length ? "w-10 bg-gold" : "w-5 bg-porcelain/35"}`}
                      aria-label={`查看${slide.label}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="self-center">
            <p className="eyebrow">Made by Hands</p>
            <h2 className="section-title">
              不是流水线，
              <br />
              是节日里的手作温度。
            </h2>
            <div className="mt-8 space-y-5 text-lg leading-loose text-coffee/70">
              <p>我们不想只做一个“好吃的粽子”。</p>
              <p>
                我们想把端午，
                <br />
                做成一份有温度、
                <br />
                有地方味、
                <br />
                有手作感的海口礼物。
              </p>
            </div>
            <div className="mt-9 grid grid-cols-2 gap-3 text-sm text-coffee/70">
              {["多米粽", "抗炎果蔬汁", "海盐卷", "迪拜巧克力", "麻薯巧克力球", "手作甜品"].map((item) => (
                <span key={item} className="border-b border-coffee/15 py-3">
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="space" className="section-pad relative overflow-hidden bg-coffee text-porcelain">
        <div className="absolute inset-0 opacity-20">
          <img src="/images/product-sea-salt-roll.jpg" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(43,33,27,0.92),rgba(43,33,27,0.82))]" />
        <div className="ambient-grain opacity-35" />

        <div className="relative mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="eyebrow text-gold">DOMI Space</p>
              <h2 className="section-title text-porcelain">
                不只是空间，
                <br />
                也是节令产品的相遇。
              </h2>
              <p className="mt-7 max-w-md text-lg leading-loose text-porcelain/70">
                DOMI 的空间感会落在具体产品里：一只粽子、一瓶果蔬汁、一个海盐卷、一份迪拜巧克力，都要有可以被拍下、被送出、被记住的节令质感。
              </p>
              <div className="mt-10 grid gap-6 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="border-l border-gold/60 pl-5">
                    <strong className="block font-display text-3xl leading-tight text-porcelain md:text-5xl lg:text-6xl">
                      {stat.display}
                    </strong>
                    <span className="mt-2 block text-sm text-porcelain/60">{stat.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid grid-cols-6 gap-3 md:gap-4">
                <img
                  src="/images/product-zongzi.jpg"
                  alt="DOMI 多米粽产品图"
                  className="col-span-6 h-[300px] w-full object-cover shadow-night md:h-[390px]"
                />
                <img src="/images/product-anti-inflammatory-juice.jpg" alt="DOMI 抗炎果蔬汁产品图" className="col-span-3 h-48 w-full object-cover md:h-60" />
                <div className="col-span-3 flex min-h-48 flex-col justify-between border border-gold/25 bg-porcelain/8 p-5 backdrop-blur md:min-h-60 md:p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-gold">Product Preview</p>
                    <h3 className="mt-4 text-2xl font-semibold">节令产品短片｜预留模块</h3>
                  </div>
                  <div className="video-strip">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <img src="/images/product-sea-salt-roll.jpg" alt="DOMI 海盐卷产品图" className="col-span-3 h-48 w-full object-cover md:h-64" />
                <img src="/images/product-dubai-chocolate.png" alt="DOMI 迪拜巧克力产品图" className="col-span-3 h-48 w-full object-cover md:h-64" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section-pad bg-porcelain">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-[1.05fr_0.95fr] md:px-8">
          <Reveal>
            <div className="grid grid-cols-6 gap-3 md:gap-4">
              <img src="/images/product-zongzi.jpg" alt="DOMI 多米粽探店产品图" className="col-span-6 h-[300px] w-full object-cover shadow-soft md:h-[420px]" />
              <img src="/images/product-sea-salt-roll.jpg" alt="DOMI 海盐卷下午茶产品图" className="col-span-2 h-44 w-full object-cover md:h-56" />
              <img src="/images/product-anti-inflammatory-juice.jpg" alt="DOMI 抗炎果蔬汁产品图" className="col-span-2 h-44 w-full object-cover md:h-56" />
              <img src="/images/product-dubai-cookie-mochi-ball.png" alt="DOMI 迪拜软曲奇巧克力麻薯球产品图" className="col-span-2 h-44 w-full object-cover md:h-56" />
            </div>
          </Reveal>

          <Reveal delay={0.12} className="self-center">
            <p className="eyebrow">Visit DOMI</p>
            <h2 className="section-title">海口顶楼节令手作空间</h2>
            <p className="mt-7 text-lg leading-loose text-coffee/68">
              这里不只是买粽子，也适合探店、打卡、下午茶、节日送礼和企业团购。DOMI 希望把每个节日做成值得被拍下、被分享、被记住的生活片段。
            </p>
            <div className="mt-8 grid gap-3 text-sm text-coffee/68 sm:grid-cols-2">
              {["探店打卡", "下午茶手作", "节日送礼", "企业团购"].map((item) => (
                <span key={item} className="border-l border-gold/60 bg-cream/70 px-4 py-3">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#booking"
                className="inline-flex items-center justify-center gap-3 bg-coffee px-6 py-4 text-sm font-semibold text-porcelain transition hover:bg-leaf"
              >
                <MapPin className="h-5 w-5" />
                预约到店 / 预订礼盒
              </a>
              <a
                href="#corporate"
                className="inline-flex items-center justify-center gap-3 border border-coffee/20 px-6 py-4 text-sm font-semibold text-coffee transition hover:border-gold hover:text-cacao"
              >
                <Gift className="h-5 w-5" />
                查看企业礼赠
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-pad bg-cream">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Haikou Voices</p>
              <h2 className="section-title">来自海口的分享</h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-coffee/60">
              简洁、体面、有场景感，是 DOMI 想留在客人心里的第一层记忆。
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {reviews.map((review, index) => (
              <Reveal key={review} delay={index * 0.07}>
                <article className="min-h-56 border border-coffee/10 bg-porcelain p-6 shadow-soft">
                  <MessageCircle className="h-5 w-5 text-gold" />
                  <p className="mt-8 text-xl leading-relaxed text-coffee">“{review}”</p>
                  <span className="mt-8 block text-xs uppercase tracking-[0.24em] text-coffee/40">DOMI Guest</span>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="booking" className="section-pad bg-porcelain">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-[0.85fr_1.15fr] md:px-8">
          <Reveal>
            <p className="eyebrow">Reservation</p>
            <h2 className="section-title">预订你的节令产品</h2>
            <p className="mt-6 text-lg leading-loose text-coffee/65">
              多米粽、抗炎果蔬汁、海盐卷、迪拜巧克力、迪拜软曲奇巧克力（麻薯）球均可预订。提交后，DOMI 会通过手机或微信与你确认数量、自提/配送和企业团购细节。
            </p>
            <div className="mt-10 space-y-4 text-sm text-coffee/70">
              <p className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-gold" />
                美豪丽致酒店（骑楼店）19楼
              </p>
              <p className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gold" />
                +86 13976010101
              </p>
              <p className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-gold" />
                节令产品预订中
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mb-4 border border-gold/25 bg-cream/75 p-5 text-sm leading-loose text-coffee/68 shadow-[0_18px_45px_rgba(43,33,27,0.07)] md:p-6">
              留下数量和时间，我们会帮你确认当天是否还能接单。端午前手作产能有限，建议提前预订。
            </div>
            <form
              name={reservationFormName}
              method="POST"
              action="/"
              data-netlify="true"
              netlify-honeypot="bot-field"
              className="grid gap-4 border border-coffee/10 bg-cream/75 p-5 shadow-soft backdrop-blur md:grid-cols-2 md:p-8"
              onSubmit={handleReservationSubmit}
            >
              <input type="hidden" name="form-name" value={reservationFormName} />
              <input type="hidden" name="source" value="DOMI Seasonal H5" />
              <input type="hidden" name="submittedAt" value="" />
              <p className="hidden">
                <label>
                  请勿填写
                  <input name="bot-field" tabIndex="-1" autoComplete="off" />
                </label>
              </p>
              <label className="field md:col-span-2">
                <span>预订产品</span>
                <select name="product" required value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}>
                  {reservableProducts.map((product) => (
                    <option key={product.name} value={product.name}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>姓名</span>
                <input required type="text" name="name" placeholder="你的称呼" />
              </label>
              <label className="field">
                <span>手机号</span>
                <input required type="tel" name="phone" placeholder="用于确认订单" />
              </label>
              <label className="field">
                <span>微信号</span>
                <input type="text" name="wechat" placeholder="方便 DOMI 联系" />
              </label>
              <label className="field">
                <span>数量</span>
                <input min="1" defaultValue="1" type="number" name="quantity" />
              </label>
              <label className="field">
                <span>自提 / 配送</span>
                <select name="delivery" defaultValue="自提">
                  <option>自提</option>
                  <option>配送</option>
                </select>
              </label>
              <label className="field">
                <span>是否企业团购</span>
                <select name="enterprise" value={selectedEnterprise} onChange={(event) => setSelectedEnterprise(event.target.value)}>
                  <option>否</option>
                  <option>是</option>
                </select>
              </label>
              <label className="field md:col-span-2">
                <span>备注</span>
                <textarea name="note" rows="4" placeholder="口味、送礼时间、企业需求等" />
              </label>
              <button
                type="submit"
                disabled={submitStatus === "submitting"}
                className="md:col-span-2 inline-flex items-center justify-center gap-3 bg-coffee px-6 py-4 text-sm font-semibold text-porcelain transition hover:bg-leaf disabled:cursor-wait disabled:bg-coffee/55"
              >
                <Send className="h-5 w-5" />
                {submitStatus === "submitting" ? "正在提交" : "提交预订"}
              </button>
              {submitError && (
                <p role="alert" className="md:col-span-2 text-sm leading-relaxed text-cacao">
                  {submitError}
                </p>
              )}
            </form>
          </Reveal>
        </div>
      </section>

      <footer className="bg-coffee px-5 py-12 text-porcelain md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-4xl">DOMI 多米花园</h2>
            <p className="mt-4 text-sm leading-relaxed text-porcelain/65">
              地址：美豪丽致酒店（骑楼店）19楼
              <br />
              联系方式：+86 13976010101
            </p>
          </div>
          <div className="text-left md:text-right">
            <div className="flex gap-3 md:justify-end">
              {["小红书", "微信", "抖音"].map((social) => (
                <a key={social} href="#home" className="border border-porcelain/20 px-4 py-2 text-sm text-porcelain/70 transition hover:border-gold hover:text-gold">
                  {social}
                </a>
              ))}
            </div>
            <p className="mt-6 font-display text-2xl text-gold">Every season deserves a memory.</p>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {submitted && (
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center bg-coffee/60 px-5 backdrop-blur"
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
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-leaf text-porcelain">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold">感谢你的预订，</h3>
              <p className="mt-2 text-lg text-coffee/70">DOMI 会尽快联系你。</p>
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
