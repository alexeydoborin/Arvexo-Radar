"use client";

/* eslint-disable @next/next/no-img-element -- decorative marketing images served from /public */
import {
  ArrowRight, ArrowsOutCardinal, ArrowUpRight, BracketsCurly, CaretDown, CaretLeft, CaretRight,
  CirclesFour, Command, Cube, Desktop, List, Moon, Play, Sparkle, Sun, X,
} from "@phosphor-icons/react";
import { Manrope } from "next/font/google";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/LogoMark";
import { ParticleField } from "@/components/ParticleField";
import "../app/landing.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

const nav = [
  { label: "Платформа", href: "#платформа", menu: true },
  { label: "Сценарии", href: "#сценарии", menu: true },
  { label: "Методика", href: "#методика", menu: false },
  { label: "Компания", href: "#компания", menu: false },
  { label: "Ресурсы", href: "#ресурсы", menu: true },
];

const products: { title: string; description: string; image: string; tone: string; catalog?: boolean }[] = [
  { title: "Обзор Radar", description: "Единая картина использования ИИ — от запросов до экономии времени.", image: "/assets/radar-overview.png", tone: "image-light" },
  { title: "ROI и стоимость", description: "Свяжите затраты, внедрение и измеримый эффект в одном контуре.", image: "/assets/radar-roi.png", tone: "image-dark" },
  { title: "Knowledge Discovery", description: "Находите сильные сценарии и превращайте их в практики компании.", image: "/assets/radar-practices.png", tone: "image-light" },
  { title: "AI Best Practices", description: "Проверяйте, публикуйте и масштабируйте подтверждённые способы работы.", image: "/assets/radar-overview.png", tone: "image-light", catalog: true },
];

const cases = [
  { name: "Финансы", title: "Проверенные сценарии для финансовой функции", metric: "+146 ч", image: "/assets/radar-roi.png" },
  { name: "Операции", title: "Карта повторяющихся сценариев и узких мест", metric: "84%", image: "/assets/radar-practices.png" },
  { name: "Продукт", title: "Видимость использования AI-инструментов", metric: "12 480", image: "/assets/radar-overview.png" },
];

const insights = [
  { title: "Какие AI-сценарии дают эффект", type: "Исследование", image: "/assets/radar-practices.png" },
  { title: "Как считать ROI без ложной точности", type: "Методика", image: "/assets/radar-roi.png" },
  { title: "Паттерны внедрения в командах", type: "Практики", image: "/assets/radar-overview.png" },
];

const ECOSYSTEM = "https://arvexo.ru";
const COOKIE_KEY = "radar-cookies-accepted";
const THEME_KEY = "radar-theme";

type Theme = "light" | "dark";

export function Landing() {
  const [cookieVisible, setCookieVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [caseIndex, setCaseIndex] = useState(0);
  const [audienceHover, setAudienceHover] = useState<"team" | "company" | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const activeCase = cases[caseIndex];

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
        return;
      }
    } catch {
      /* fall through to the system preference */
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: the choice lasts for this visit only */
    }
  };

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COOKIE_KEY) !== "1") setCookieVisible(true);
    } catch {
      setCookieVisible(true);
    }
  }, []);

  const acceptCookies = () => {
    setCookieVisible(false);
    try {
      window.localStorage.setItem(COOKIE_KEY, "1");
    } catch {
      /* storage unavailable: the notice just shows again next visit */
    }
  };

  return (
    <main className={`radar-page ${manrope.className}`} data-theme={theme}>
      <div className="hero-particles"><ParticleField mode="main" theme={theme} /></div>

      <header className="site-header">
        <a className="rp-brand" href="#top" aria-label="ARVEXO Radar — главная">
          <LogoMark />
          <span><strong>ARVEXO</strong> Radar</span>
        </a>
        <nav aria-label="Основная навигация">
          {nav.map((item) => <a key={item.label} href={item.href}>{item.label}{item.menu && <CaretDown size={14} weight="regular" />}</a>)}
        </nav>
        <div className="header-actions">
          <button className="theme-toggle" type="button" aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"} onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <Link className="login" href="/auth/login">Войти <ArrowUpRight size={16} weight="bold" /></Link>
        </div>
        <button className="mobile-menu" type="button" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}><List size={20} weight="bold" /></button>
      </header>

      {menuOpen && <aside className="mobile-drawer" aria-label="Мобильное меню">
        <div className="drawer-top">
          <span className="rp-brand"><LogoMark /><span><strong>ARVEXO</strong> Radar</span></span>
          <button type="button" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        {nav.map((item) => <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}<CaretDown size={17} /></a>)}
        <Link className="secondary-action" href="/auth/login" onClick={() => setMenuOpen(false)}>Войти в Radar</Link>
      </aside>}

      <section className="rp-hero" id="top" aria-labelledby="hero-title">
        <div className="hero-brand" aria-hidden="true">
          <LogoMark />
          <span>ARVEXO Radar</span>
        </div>
        <h1 id="hero-title">Видьте эффект ИИ<br />в масштабе компании.</h1>
        <div className="rp-hero-actions">
          <Link className="primary-action" href="/auth/login"><Desktop size={18} weight="regular" />Открыть Radar</Link>
          <a className="secondary-action" href="#сценарии">Посмотреть сценарии</a>
        </div>
      </section>

      <section className="intro-film" aria-label="Короткое введение Radar">
        <div className="film-content"><Link href="/app"><Play size={18} weight="fill" />Смотреть демо</Link></div>
      </section>

      <div className="icon-rail" aria-hidden="true"><span><Sparkle /></span><span><Command /></span><span><CirclesFour /></span><span><Sparkle /></span><span><ArrowsOutCardinal /></span><span><BracketsCurly /></span><span><Cube /></span><span><Sparkle /></span></div>

      <section className="platform-section" id="платформа">
        <div className="section-label">Платформа Radar</div>
        {products.map((product) => <article className="product-row" key={product.title}>
          <div className="product-copy"><h2>{product.title}</h2><p>{product.description}</p>{product.catalog && <Link className="secondary-action" href="/app">Открыть каталог</Link>}</div>
          <img className={`product-image ${product.tone}`} src={product.image} alt="" />
        </article>)}
      </section>

      <section className="cases-section" id="сценарии">
        <div className="two-col-heading"><h2>Создан для команд,<br />которые внедряют ИИ</h2><p>Radar помогает увидеть реальный эффект, сравнить сценарии и безопасно передать работающие практики всей компании.</p></div>
        <div className="case-gallery">
          {cases.map((item, index) => <button key={item.name} className={index === caseIndex ? "case-card active" : "case-card"} type="button" onClick={() => setCaseIndex(index)}><img src={item.image} alt="" /><span>{item.name}</span></button>)}
        </div>
        <div className="case-detail">
          <div><b>{activeCase.name}</b><p>{activeCase.title}</p><Link href="/app">Смотреть кейс <ArrowRight size={16} /></Link></div>
          <strong>{activeCase.metric}</strong>
          <div className="carousel-controls">
            <button type="button" aria-label="Предыдущий кейс" onClick={() => setCaseIndex((caseIndex + cases.length - 1) % cases.length)}><CaretLeft size={18} /></button>
            <button type="button" aria-label="Следующий кейс" onClick={() => setCaseIndex((caseIndex + 1) % cases.length)}><CaretRight size={18} /></button>
          </div>
        </div>
      </section>

      <section className="audience-section" id="компания">
        <article className="rp-audience-card audience-card-team" onPointerEnter={() => setAudienceHover("team")} onPointerLeave={() => setAudienceHover(null)}>
          <ParticleField mode="morph" shape="braces" theme={theme} hovered={audienceHover === "team"} />
          <div className="rp-audience-content"><span>Для команд</span><h2>Видьте, что<br /><em>работает</em></h2><p>От сценария до подтверждённого эффекта.</p><Link className="primary-action" href="/auth/login">Открыть Radar</Link></div>
        </article>
        <article className="rp-audience-card audience-card-company" onPointerEnter={() => setAudienceHover("company")} onPointerLeave={() => setAudienceHover(null)}>
          <ParticleField mode="morph" shape="flower" theme={theme} hovered={audienceHover === "company"} />
          <div className="rp-audience-content"><span>Для компаний</span><h2>Масштабируйте<br /><em>эффект</em></h2><p>Единая методика для AI, FinOps и knowledge sharing.</p><a className="secondary-action" href={ECOSYSTEM}>Узнать больше</a></div>
        </article>
      </section>

      <section className="insights-section" id="ресурсы">
        <div className="insights-heading"><h2>Новые исследования</h2><a className="secondary-action" href={ECOSYSTEM}>Все материалы</a></div>
        <div className="insights-grid">
          {insights.map((item) => <article className="rp-insight-card" key={item.title}><img src={item.image} alt="" /><span>{item.type}</span><h3>{item.title}</h3><a href={ECOSYSTEM}>Читать <ArrowRight size={15} /></a></article>)}
        </div>
      </section>

      <section className="final-cta" id="методика">
        <ParticleField mode="main" theme="dark" />
        <div className="final-content"><h2>Эффект ИИ<br />становится видимым.</h2><p>Подключите Radar и начните измерять то, что работает.</p><Link href="/auth/login">Открыть Radar <ArrowRight size={17} /></Link></div>
      </section>

      <footer>
        <div className="footer-links">
          <div><span>ARVEXO Radar</span><p>Измеряем то, что работает.</p></div>
          <div><b>Платформа</b><a href="#платформа">Обзор</a><a href="#сценарии">Сценарии</a><a href="#методика">Методика</a></div>
          <div><b>Ресурсы</b><a href="#ресурсы">Исследования</a><a href="#компания">Для компаний</a><a href={ECOSYSTEM}>Экосистема Arvexo</a></div>
        </div>
        <div className="footer-word">Radar</div>
      </footer>

      {cookieVisible && <div className="cookie-bar" role="status">
        <p>Radar использует cookies для улучшения сервиса и анализа использования.</p>
        <button type="button" onClick={acceptCookies}>Понятно</button>
      </div>}
    </main>
  );
}
