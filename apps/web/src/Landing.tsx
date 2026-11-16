import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  Database,
  FileText,
  Layers,
  Map,
  MapPinned,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { api } from "./api";
import type {
  Language,
  OperationsUI,
  Page,
  PublicLayer,
  Region,
} from "./types";
import { EmergencyNotice, PublicMap, usePublicConfig } from "./Portal";

function LandingBrand() {
  return (
    <a className="landing-brand" href="#top" aria-label="FVV GIS Uzbekistan">
      <span className="landing-brand-mark" aria-hidden="true">
        <Map size={22} />
        <i />
      </span>
      <span>
        <strong>
          FVV<em>GIS</em>
        </strong>
        <small>UZBEKISTAN</small>
      </span>
    </a>
  );
}

/** Decorative topographic panel: contour lines and status beacons, no data meaning. */
function HeroArt() {
  const rings = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox="0 0 520 440" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="hero-glow" cx="58%" cy="44%" r="62%">
            <stop offset="0" stopColor="#b7edc8" stopOpacity="0.28" />
            <stop offset="1" stopColor="#b7edc8" stopOpacity="0" />
          </radialGradient>
          <pattern
            id="hero-dots"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="1.5"
              cy="1.5"
              r="1.1"
              fill="#d4efdb"
              fillOpacity="0.16"
            />
          </pattern>
        </defs>
        <rect width="520" height="440" fill="url(#hero-dots)" />
        <rect width="520" height="440" fill="url(#hero-glow)" />
        {rings.map((i) => (
          <path
            key={i}
            d={`M ${70 - i * 26} ${250 + i * 9}
                C ${120 - i * 18} ${120 - i * 22}, ${300 + i * 6} ${70 - i * 24}, ${400 + i * 22} ${160 - i * 6}
                S ${520 + i * 10} ${330 + i * 18}, ${330 + i * 4} ${370 + i * 20}
                S ${40 - i * 30} ${380 + i * 12}, ${70 - i * 26} ${250 + i * 9} Z`}
            fill="none"
            stroke="#b7edc8"
            strokeOpacity={0.5 - i * 0.06}
            strokeWidth={i === 0 ? 1.6 : 1}
          />
        ))}
        <path
          d="M40 120 L180 170 L260 140 L360 210 L470 190"
          fill="none"
          stroke="#e9f8ee"
          strokeOpacity="0.35"
          strokeWidth="1.4"
          strokeDasharray="5 7"
        />
      </svg>
      <span className="beacon beacon-ok" style={{ left: "34%", top: "38%" }} />
      <span
        className="beacon beacon-warn"
        style={{ left: "66%", top: "30%" }}
      />
      <span className="beacon beacon-ok" style={{ left: "58%", top: "62%" }} />
      <span
        className="beacon beacon-fault"
        style={{ left: "24%", top: "66%" }}
      />
    </div>
  );
}

export default function Landing({
  ui,
  dark,
  onToggleDark,
  onLanguage,
  onSignIn,
}: {
  ui: OperationsUI;
  dark: boolean;
  onToggleDark: () => void;
  onLanguage: (language: Language) => void;
  onSignIn: () => void;
}) {
  const { language, t, copy } = ui;
  const config = usePublicConfig();
  const layers = useQuery({
    queryKey: ["public-layers"],
    queryFn: () => api<Page<PublicLayer>>("/public/gis/layers"),
    staleTime: 60000,
  });
  const regions = useQuery({
    queryKey: ["regions"],
    queryFn: () => api<Page<Region>>("/gis/regions"),
    staleTime: 300000,
  });
  const publicObjects = layers.data?.items.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const stats: { value?: number; label: string; icon: typeof Map }[] = [
    { value: publicObjects, label: copy("Ommaviy obyekt"), icon: MapPinned },
    { value: layers.data?.total, label: copy("Kategoriya"), icon: Layers },
    { value: regions.data?.total, label: copy("Hudud"), icon: Map },
  ];
  const steps = [
    {
      icon: Map,
      title: copy("Xaritani ko‘ring"),
      body: copy(
        "Ommaga nashr qilingan obyektlarni hudud, kategoriya va holat bo‘yicha toping.",
      ),
    },
    {
      icon: FileText,
      title: copy("Murojaat yuboring"),
      body: copy(
        "Nosozlikni tasvirlang, joylashuvni belgilang va kerak bo‘lsa rasm biriktiring.",
      ),
    },
    {
      icon: BellRing,
      title: copy("Holatini kuzating"),
      body: copy(
        "Murojaatingiz qabul qilinishi va ko‘rib chiqilishini shaxsiy kabinetda kuzating.",
      ),
    },
  ];
  const principles = [
    {
      icon: Database,
      title: copy("Faqat ommaviy ma’lumot"),
      body: copy(
        "Bosh sahifada ichki pasport, xodim yoki maxfiy maydonlar ko‘rsatilmaydi.",
      ),
    },
    {
      icon: ShieldCheck,
      title: copy("Ruxsatlar serverda"),
      body: copy(
        "Har bir so‘rov rol va hudud bo‘yicha serverda tekshiriladi va auditda qayd etiladi.",
      ),
    },
    {
      icon: Phone,
      title: copy("Shoshilinch holat uchun 112"),
      body: copy(
        "Sayt rasmiy dispetcherlikka ulanmagan. Xavf bo‘lsa darhol 112 ga qo‘ng‘iroq qiling.",
      ),
    },
  ];
  return (
    <div className="landing" id="top">
      <header className="landing-header">
        <div className="landing-header-inner">
          <LandingBrand />
          <nav className="landing-nav" aria-label={copy("Asosiy navigatsiya")}>
            <a href="#xarita">{t("publicMap")}</a>
            <a href="#qanday">{copy("Qanday ishlaydi")}</a>
            <a href="#tamoyillar">{copy("Tamoyillar")}</a>
          </nav>
          <div className="landing-actions">
            <button
              className="landing-icon"
              aria-label={copy("Theme")}
              onClick={onToggleDark}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <select
              className="landing-language"
              aria-label={copy("Language")}
              value={language}
              onChange={(e) => onLanguage(e.target.value as Language)}
            >
              <option value="uz">UZ</option>
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
            <button className="landing-signin" onClick={onSignIn}>
              <UserRound size={17} />
              <span>{copy("Kirish")}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="landing-chip">
              <i />
              {copy("Mustaqil GIS platforma · O‘zbekiston")}
            </span>
            <h1>
              {copy("Infratuzilma holati")}
              <span>{copy("bitta xaritada.")}</span>
            </h1>
            <p>
              {copy(
                "Ommaviy obyektlarni ko‘ring, nosozlik haqida murojaat yuboring va uning ko‘rib chiqilishini kuzating.",
              )}
            </p>
            <div className="landing-cta">
              <button className="cta-primary" onClick={onSignIn}>
                <FileText size={19} />
                {copy("Murojaat yuborish")}
                <ArrowRight size={18} />
              </button>
              <a className="cta-secondary" href="#xarita">
                <Map size={19} />
                {copy("Xaritani ochish")}
              </a>
            </div>
            <dl className="landing-stats">
              {stats.map((item) => (
                <div key={item.label}>
                  <dt>
                    <item.icon size={16} />
                    {item.label}
                  </dt>
                  <dd>{item.value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroArt />
        </div>
      </section>

      <main className="landing-main">
        <div className="landing-emergency">
          <EmergencyNotice ui={ui} />
        </div>

        <section
          className="landing-section"
          id="xarita"
          aria-labelledby="xarita-title"
        >
          <div className="section-head">
            <span className="section-kicker">01 · {t("publicMap")}</span>
            <h2 id="xarita-title">{copy("Ommaviy obyektlar xaritasi")}</h2>
            <p>
              {copy(
                "Obyektni tanlang, holati va oxirgi yangilanish sanasini ko‘ring. Ko‘rinmayotgan obyekt mavjud emas degani emas.",
              )}
            </p>
          </div>
          <PublicMap ui={ui} />
        </section>

        <section
          className="landing-section"
          id="qanday"
          aria-labelledby="qanday-title"
        >
          <div className="section-head">
            <span className="section-kicker">
              02 · {copy("Qanday ishlaydi")}
            </span>
            <h2 id="qanday-title">{copy("Uch qadamda murojaat")}</h2>
          </div>
          <ol className="step-grid">
            {steps.map((step, index) => (
              <li key={step.title} className="step-card">
                <span className="step-number">0{index + 1}</span>
                <span className="step-icon">
                  <step.icon size={22} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="landing-cta-band">
            <div>
              <strong>{copy("Murojaat yuborishga tayyormisiz?")}</strong>
              <span>
                {copy("Hisob yarating yoki telefon raqamingiz bilan kiring.")}
              </span>
            </div>
            <button className="cta-primary" onClick={onSignIn}>
              {copy("Boshlash")}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <section
          className="landing-section"
          id="tamoyillar"
          aria-labelledby="tamoyillar-title"
        >
          <div className="section-head">
            <span className="section-kicker">03 · {copy("Tamoyillar")}</span>
            <h2 id="tamoyillar-title">{copy("Ochiq, xavfsiz va halol")}</h2>
          </div>
          <div className="principle-grid">
            {principles.map((item) => (
              <article key={item.title} className="principle-card">
                <item.icon size={22} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <LandingBrand />
            <p>{t("independent")}</p>
          </div>
          <div className="landing-footer-links">
            <a href="#xarita">{t("publicMap")}</a>
            <a href="#qanday">{copy("Qanday ishlaydi")}</a>
            <button onClick={onSignIn}>{copy("Kirish")}</button>
            <a href="tel:112">112</a>
          </div>
          <div className="landing-footer-meta">
            <span>
              {copy("Operator")}: {config.data?.operator_name || "—"}
            </span>
            <span>
              © {new Date().getFullYear()} FVV GIS Uzbekistan · EPSG:4326
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
