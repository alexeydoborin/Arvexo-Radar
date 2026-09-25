"use client";

import {
  ArrowRight, ArrowsOutCardinal, ArrowUpRight, BracketsCurly, CaretDown, CaretLeft, CaretRight,
  CirclesFour, Command, Cube, Desktop, List, Moon, Sparkle, Sun, X,
} from "@phosphor-icons/react";
import { Manrope } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
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

const products: { title: string; description: string; image: string; alt: string; tone: string; catalog?: boolean }[] = [
  { title: "Обзор Radar", description: "Единая картина использования ИИ — от запросов до экономии времени.", image: "/assets/radar-overview.png", tone: "image-light", alt: "Дашборд Arvexo Radar: обзор использования ИИ, запросов и сэкономленного времени" },
  { title: "ROI и стоимость", description: "Свяжите затраты, внедрение и измеримый эффект в одном контуре.", image: "/assets/radar-roi.png", tone: "image-dark", alt: "Экран Arvexo Radar с расчётом ROI и стоимости внедрения ИИ" },
  { title: "Knowledge Discovery", description: "Находите сильные сценарии и превращайте их в практики компании.", image: "/assets/radar-practices.png", tone: "image-light", alt: "Экран Arvexo Radar с найденными сценариями и лучшими практиками использования ИИ" },
  { title: "AI Best Practices", description: "Проверяйте, публикуйте и масштабируйте подтверждённые способы работы.", image: "/assets/radar-overview.png", tone: "image-light", alt: "Каталог проверенных практик внедрения ИИ в Arvexo Radar", catalog: true },
];

const cases = [
  { name: "Финансы", title: "Проверенные сценарии для финансовой функции", metric: "+146 ч", image: "/assets/radar-roi.png", alt: "Экран Radar с ROI и экономией часов для финансовой функции" },
  { name: "Операции", title: "Карта повторяющихся сценариев и узких мест", metric: "84%", image: "/assets/radar-practices.png", alt: "Экран Radar с картой повторяющихся сценариев и узких мест" },
  { name: "Продукт", title: "Видимость использования AI-инструментов", metric: "12 480", image: "/assets/radar-overview.png", alt: "Экран Radar с обзором использования ИИ-инструментов продуктовой командой" },
];

const ECOSYSTEM = "https://arvexo.ru";
const COOKIE_KEY = "radar-cookies-accepted";
const THEME_KEY = "radar-theme";

type Theme = "light" | "dark";

export function Landing({ research }: { research?: ReactNode }) {
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
        // This runs after hydration so the server and initial client markup match.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(stored);
        return;
      }
    } catch {
      /* fall through to the system preference */
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      // Read browser-only preference after hydration to avoid a server/client mismatch.
      setTheme("dark");
    }
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
      if (window.localStorage.getItem(COOKIE_KEY) !== "1") {
        // Cookie preference is browser-only and intentionally applied after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCookieVisible(true);
      }
    } catch {
      // Storage may be unavailable; keep the consent notice usable.
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
        <p className="hero-sub">Аналитика промптов и эффективности ИИ: классификация запросов, ROI и лучшие практики.</p>
        <div className="rp-hero-actions">
          <Link className="primary-action" href="/auth/login"><Desktop size={18} weight="regular" />Открыть Radar</Link>
          <a className="secondary-action" href="#сценарии">Посмотреть сценарии</a>
        </div>
      </section>

      <div className="icon-rail" aria-hidden="true"><span><Sparkle /></span><span><Command /></span><span><CirclesFour /></span><span><Sparkle /></span><span><ArrowsOutCardinal /></span><span><BracketsCurly /></span><span><Cube /></span><span><Sparkle /></span></div>

      <section className="about-section" id="о-radar">
        <div className="section-label">Что такое Arvexo Radar</div>
        <h2>Аналитика промптов и эффективности ИИ для компаний</h2>
        <p>Arvexo Radar — сервис аналитики запросов к ИИ-агентам. Он классифицирует промпты по сценариям, показывает, где ИИ действительно экономит время, и связывает затраты на внедрение с измеримым эффектом — ROI.</p>
        <ul>
          <li><b>Классификация запросов.</b> Автоматически группирует промпты сотрудников по задачам и функциям компании.</li>
          <li><b>Оценка эффективности и ROI.</b> Считает сэкономленное время, стоимость использования и окупаемость ИИ-инструментов.</li>
          <li><b>Поиск устойчивых сценариев.</b> Находит повторяющиеся практики, которые стабильно дают результат.</li>
          <li><b>Лучшие практики внедрения.</b> Позволяет проверить, опубликовать и масштабировать рабочие способы использования ИИ на всю компанию.</li>
        </ul>
      </section>

      <section className="platform-section" id="платформа">
        <div className="section-label">Платформа Radar</div>
        {products.map((product) => <article className="product-row" key={product.title}>
          <div className="product-copy"><h2>{product.title}</h2><p>{product.description}</p>{product.catalog && <Link className="secondary-action" href="/app">Открыть каталог</Link>}</div>
          <Image
            className={`product-image ${product.tone}`}
            src={product.image}
            alt={product.alt}
            width={1536}
            height={1024}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </article>)}
      </section>

      <section className="cases-section" id="сценарии">
        <div className="two-col-heading"><h2>Создан для команд,<br />которые внедряют ИИ</h2><p>Radar помогает увидеть реальный эффект, сравнить сценарии и безопасно передать работающие практики всей компании.</p></div>
        <div className="case-gallery">
          {cases.map((item, index) => <button key={item.name} className={index === caseIndex ? "case-card active" : "case-card"} type="button" onClick={() => setCaseIndex(index)}><Image src={item.image} alt={item.alt} width={1536} height={1024} sizes="(max-width: 760px) 90vw, 33vw" /><span>{item.name}</span></button>)}
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

      {research}

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
