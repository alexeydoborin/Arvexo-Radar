import React from "react";
import { Particles } from "./Particles";
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const ease = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const useLayout = () => {
  const { width, height, fps } = useVideoConfig();
  return { width, height, fps, v: height > width };
};

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="badge">{children}</div>;

const Browser: React.FC<{ src: string; frame: number; label: string; width: number }> = ({ src, frame, label, width }) => {
  const { fps } = useLayout();
  const enter = spring({ frame: Math.max(0, frame), fps, config: { damping: 18, stiffness: 90 } });
  return (
    <div className="browser" style={{ width, opacity: enter, scale: `${0.92 + enter * 0.08}`, translate: `0 ${42 * (1 - enter)}px` }}>
      <div className="browserTop"><span /><span /><span /><b>{label}</b></div>
      <Img src={staticFile(src)} className="screen" />
    </div>
  );
};

const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = Math.min(ease(frame, 0, 10), 1 - ease(frame, durationInFrames - 10, durationInFrames));
  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

const Heading: React.FC<{ tag: string; title: React.ReactNode; sub?: React.ReactNode; align?: "left" | "center"; size?: number }> = ({ tag, title, sub, align = "left", size }) => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const s = size ?? (v ? 92 : 72);
  return (
    <div style={{ textAlign: align, opacity: ease(frame, 4, 24), translate: `0 ${20 * (1 - ease(frame, 4, 24))}px`, position: "relative", zIndex: 3 }}>
      <Badge>{tag}</Badge>
      <h2 style={{ fontSize: s, lineHeight: 0.98, letterSpacing: -s * 0.065, fontWeight: 500, margin: `${v ? 34 : 24}px 0 ${v ? 28 : 20}px` }}>{title}</h2>
      {sub && <p style={{ fontSize: v ? 34 : 22, lineHeight: 1.45, color: "#a6aab7", margin: 0 }}>{sub}</p>}
    </div>
  );
};

const Countup: React.FC<{ to: number; from: number; dur: number; suffix?: string; sign?: string }> = ({ to, from, dur, suffix = "", sign = "" }) => {
  const frame = useCurrentFrame();
  const value = to * ease(frame, from, from + dur);
  return <>{sign}{fmt(value)}{suffix}</>;
};

/* 1 — hook */
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  return (
    <Scene>
      <div className="introMark"><Img src={staticFile("arvexo-mark-v5.png")} /></div>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: 60 }}>
        <div style={{ opacity: ease(frame, 20, 50), zIndex: 2 }}>
          <Badge>ARVEXO RADAR</Badge>
          <h1 style={{ fontSize: v ? 128 : 108, lineHeight: 0.94, letterSpacing: -7, margin: "30px 0 24px", fontWeight: 500 }}>AI должен<br />давать эффект.</h1>
          <p style={{ color: "#a7abb8", fontSize: v ? 36 : 26, lineHeight: 1.5, margin: 0 }}>Измеряем то, что работает.<br />Масштабируем то, что работает.</p>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/* 2 — problem */
const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const s = v ? 84 : 92;
  return (
    <Scene>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: 70 }}>
        <div style={{ zIndex: 2 }}>
          <div style={{ fontSize: v ? 44 : 38, color: "#6f7686", letterSpacing: -1, opacity: ease(frame, 4, 24) * (1 - 0.55 * ease(frame, 60, 80)), textDecoration: frame > 55 ? "line-through" : "none", textDecorationColor: "#ff5d69" }}>
            Токены · Latency · Error rate
          </div>
          <h2 style={{ fontSize: s, lineHeight: 1, letterSpacing: -s * 0.06, fontWeight: 500, margin: "44px 0 0", opacity: ease(frame, 70, 100), translate: `0 ${24 * (1 - ease(frame, 70, 100))}px` }}>
            Но окупается<br />ли <span style={{ color: "#91b5ff" }}>AI?</span>
          </h2>
          <p style={{ fontSize: v ? 34 : 24, color: "#a6aab7", marginTop: 40, opacity: ease(frame, 120, 150), lineHeight: 1.45 }}>
            Вопрос IT-директора, на который<br />обычные дашборды не отвечают.
          </p>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/* 3 — visibility */
const ShotScene: React.FC<{ src: string; label: string; tag: string; title: React.ReactNode; sub: React.ReactNode; reverse?: boolean; extra?: React.ReactNode }> = ({ src, label, tag, title, sub, reverse, extra }) => {
  const frame = useCurrentFrame();
  const { v, width } = useLayout();
  const shotW = v ? width - 100 : 960;
  return (
    <Scene>
      <AbsoluteFill style={{ flexDirection: v ? "column" : reverse ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: v ? 70 : 80, padding: v ? "120px 50px" : "0 110px" }}>
        <div style={{ width: v ? "100%" : 640, flexShrink: 0 }}>
          <Heading tag={tag} title={title} sub={sub} />
          {extra}
        </div>
        <div style={{ position: "relative", zIndex: 2 }}>
          <Browser src={src} frame={frame - 8} label={label} width={shotW} />
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Overview: React.FC = () => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const Metric: React.FC<{ label: string; value: string; at: number; style: React.CSSProperties }> = ({ label, value, at, style }) => (
    <div className="metricFloat" style={{ opacity: ease(frame, at, at + 25), ...style }}>
      <small>{label}</small><strong>{value}</strong><em>demo</em>
    </div>
  );
  return (
    <>
      <ShotScene src="radar-overview.png" label="Radar · Overview" tag="01 · VISIBILITY" title={<>Видеть, что<br />работает.</>} sub={<>Короткий ответ для руководителя:<br />что происходит с AI сегодня.</>} />
      <Sequence layout="none">
        <AbsoluteFill style={{ zIndex: 5, pointerEvents: "none" }}>
          <Metric label="MAU" value="642" at={40} style={v ? { left: 60, bottom: 260 } : { left: 700, top: 250 }} />
          <Metric label="AI-запросы" value="28 400" at={65} style={v ? { right: 60, bottom: 120 } : { left: 760, top: 640 }} />
        </AbsoluteFill>
      </Sequence>
    </>
  );
};

/* 4 — value chain */
const Value: React.FC = () => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const box: React.CSSProperties = { padding: v ? "30px 36px" : "26px 30px", border: "1px solid #2d3545", background: "rgba(8,10,16,.84)", borderRadius: 16, minWidth: v ? 640 : 270, textAlign: "left" };
  const label: React.CSSProperties = { display: "block", color: "#a7adbb", fontSize: v ? 28 : 17 };
  const val: React.CSSProperties = { display: "block", fontSize: v ? 68 : 42, letterSpacing: -2, marginTop: 6, fontWeight: 700 };
  const arrow = (at: number) => <i style={{ fontSize: 34, color: "#8491a9", fontStyle: "normal", opacity: ease(frame, at, at + 12) }}>{v ? "↓" : "→"}</i>;
  return (
    <Scene>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: v ? 40 : 50, padding: 50 }}>
        <Heading align="center" tag="02 · BUSINESS VALUE" title={<>От использования<br />к окупаемости.</>} size={v ? 84 : 64} />
        <div style={{ display: "flex", flexDirection: v ? "column" : "row", alignItems: "center", gap: v ? 18 : 30, zIndex: 3 }}>
          <div style={{ ...box, opacity: ease(frame, 30, 50) }}><span style={label}>Затраты A</span><b style={val}><Countup from={30} dur={40} to={1170000} suffix="&nbsp;₽" /></b></div>
          {arrow(70)}
          <div style={{ ...box, opacity: ease(frame, 75, 95) }}><span style={label}>Экономия B</span><b style={val}><Countup from={75} dur={40} to={2269167} suffix="&nbsp;₽" /></b></div>
          {arrow(120)}
          <div style={{ ...box, opacity: ease(frame, 125, 145), borderColor: "#355789", background: "rgba(16,32,57,.82)" }}><span style={label}>ROI</span><b style={{ ...val, color: "#83adff" }}><Countup from={125} dur={40} to={94} suffix="%" /></b></div>
        </div>
        <div style={{ color: "#a6acba", fontSize: v ? 28 : 19, textAlign: "center", opacity: ease(frame, 170, 195), zIndex: 3, lineHeight: 1.5 }}>
          Net Benefit <b style={{ color: "#f1f4fa" }}>+1&nbsp;099&nbsp;167&nbsp;₽</b><br />FTE Saved 5,67 — эквивалент времени, не сокращения
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/* 5 — bars: honest numbers */
type Row = { name: string; value: number; text: string; note?: string };
const BarsScene: React.FC<{ tag: string; title: React.ReactNode; sub: React.ReactNode; rows: Row[]; max: number; signed?: boolean; footer?: React.ReactNode }> = ({ tag, title, sub, rows, max, signed, footer }) => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const rowH = v ? 118 : 76;
  return (
    <Scene>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: v ? 60 : 40, padding: v ? "0 50px" : "0 200px" }}>
        <Heading align="center" tag={tag} title={title} sub={sub} size={v ? 80 : 60} />
        <div style={{ width: "100%", maxWidth: 1400, display: "flex", flexDirection: "column", gap: 14, zIndex: 3 }}>
          {rows.map((r, i) => {
            const at = 30 + i * 18;
            const k = ease(frame, at, at + 30);
            const neg = r.value < 0;
            const half = signed ? 50 : 100;
            const w = (Math.abs(r.value) / max) * half * k;
            return (
              <div key={r.name} style={{ height: rowH, display: "flex", alignItems: "center", gap: 20, opacity: ease(frame, at - 6, at + 10) }}>
                <div style={{ width: v ? 300 : 250, fontSize: v ? 32 : 24, color: "#dfe3ee", lineHeight: 1.15 }}>
                  {r.name}
                  {r.note && <div style={{ fontSize: v ? 22 : 15, color: "#ff8b94", marginTop: 4 }}>{r.note}</div>}
                </div>
                <div style={{ flex: 1, height: v ? 44 : 34, position: "relative", background: "rgba(255,255,255,.04)", borderRadius: 8 }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 8, width: `${w}%`, left: signed ? (neg ? `${50 - w}%` : "50%") : 0, background: neg ? "linear-gradient(90deg,#ff5d69,#c93d4a)" : "linear-gradient(90deg,#3f7cf0,#8bb2ff)" }} />
                  {signed && <div style={{ position: "absolute", left: "50%", top: -6, bottom: -6, width: 2, background: "#3b4251" }} />}
                </div>
                <div style={{ width: v ? 200 : 180, textAlign: "right", fontSize: v ? 32 : 26, fontWeight: 700, color: neg ? "#ff8b94" : "#a9c6ff", opacity: k }}>{r.text}</div>
              </div>
            );
          })}
        </div>
        {footer && <div style={{ color: "#a6acba", fontSize: v ? 30 : 20, textAlign: "center", opacity: ease(frame, 130, 160), zIndex: 3, lineHeight: 1.5 }}>{footer}</div>}
      </AbsoluteFill>
    </Scene>
  );
};

const Models: React.FC = () => (
  <BarsScene
    tag="03 · МОДЕЛИ И АГЕНТЫ" max={815000} signed
    title={<>Что окупается,<br />а что нет.</>} sub="Net Benefit по агентам · demo"
    rows={[
      { name: "Агент договоров", value: 815000, text: "ROI 302%" },
      { name: "Report Copilot", value: 666667, text: "ROI 185%" },
      { name: "CRM-ассистент", value: -190000, text: "ROI −59%", note: "убыточен" },
      { name: "Навигатор знаний", value: -192500, text: "−192 500 ₽", note: "недостаточно данных" },
    ]}
    footer={<>Radar не «рисует зелёное».<br />Он показывает, что масштабировать — и что чинить.</>}
  />
);

const Departments: React.FC = () => (
  <BarsScene
    tag="04 · ПОДРАЗДЕЛЕНИЯ" max={217}
    title={<>Интерес — не<br />эффект.</>} sub="ROI по подразделениям · demo"
    rows={[
      { name: "Юридический отдел", value: 217, text: "217%" },
      { name: "Финансы", value: 126, text: "126%" },
      { name: "ИТ", value: 55, text: "55%" },
      { name: "Продажи", value: 43, text: "43%" },
      { name: "HR", value: 20, text: "20%" },
    ]}
    footer={<>У HR интерес высокий,<br />а подтверждено benchmark только 34% экономии.</>}
  />
);

/* 6 — knowledge sharing */
const Practices: React.FC = () => {
  const frame = useCurrentFrame();
  const chip = (t: string, at: number, active?: boolean) => (
    <span style={{ border: `1px solid ${active ? "#5986c6" : "#303747"}`, borderRadius: 999, padding: "9px 16px", color: active ? "#cfe0ff" : "#808898", background: active ? "#162a49" : "transparent", opacity: ease(frame, at, at + 12) }}>{t}</span>
  );
  return (
    <ShotScene
      reverse src="radar-practices.png" label="Radar · Knowledge Sharing" tag="05 · KNOWLEDGE SHARING"
      title={<>Масштабировать<br />эффект.</>} sub={<>Radar находит успешные сценарии,<br />проверяет их и превращает в практики.</>}
      extra={<div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 34, fontSize: 20, flexWrap: "wrap", position: "relative", zIndex: 3 }}>{chip("detected", 60)}<b style={{ color: "#5888d3" }}>→</b>{chip("review", 90)}<b style={{ color: "#5888d3" }}>→</b>{chip("published", 120, true)}</div>}
    />
  );
};

/* 7 — trust */
const Trust: React.FC = () => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const statuses: [string, string][] = [["actual", "#7fe0a3"], ["estimate", "#ffd27a"], ["mixed", "#a9c6ff"], ["demo", "#ff8b94"]];
  return (
    <Scene>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 46, padding: 60, textAlign: "center" }}>
        <Heading align="center" tag="06 · ДОВЕРИЕ" title={<>Каждая цифра —<br />с формулой.</>} sub="Источник и статус у каждого показателя" size={v ? 84 : 64} />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", zIndex: 3 }}>
          {statuses.map(([t, c], i) => (
            <span key={t} style={{ border: `1px solid ${c}`, color: c, borderRadius: 10, padding: v ? "14px 26px" : "10px 22px", fontSize: v ? 32 : 24, fontWeight: 700, opacity: ease(frame, 30 + i * 10, 45 + i * 10) }}>{t}</span>
          ))}
        </div>
        <div style={{ color: "#a6acba", fontSize: v ? 30 : 21, lineHeight: 1.5, opacity: ease(frame, 80, 105), zIndex: 3 }}>
          Не читает содержимое промптов.<br />Не оценивает сотрудников.
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

/* 8 — outro */
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  return (
    <Scene>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: 50 }}>
        <div style={{ zIndex: 2, opacity: ease(frame, 10, 35) }}>
          <Badge>ARVEXO RADAR</Badge>
          <h1 style={{ fontSize: v ? 96 : 84, lineHeight: 1.02, letterSpacing: -5, margin: "30px 0 24px", fontWeight: 500 }}>Visibility.<br />Business Value.<br /><span style={{ color: "#91b5ff" }}>Knowledge Sharing.</span></h1>
          <p style={{ color: "#a7abb8", fontSize: v ? 36 : 25, lineHeight: 1.5, margin: 0 }}>Не просто видеть AI.<br />Понимать, что масштабировать.</p>
        </div>
      </AbsoluteFill>
      <div className="url" style={{ opacity: ease(frame, 60, 85), bottom: v ? 200 : 58, fontSize: v ? 40 : 22 }}>radar.arvexo.ru</div>
    </Scene>
  );
};

export const RadarDemo: React.FC = () => (
  <AbsoluteFill className="film" style={{ background: "#000" }}><Particles />
    <Sequence durationInFrames={150}><Intro /></Sequence>
    <Sequence from={150} durationInFrames={180}><Problem /></Sequence>
    <Sequence from={330} durationInFrames={210}><Overview /></Sequence>
    <Sequence from={540} durationInFrames={240}><Value /></Sequence>
    <Sequence from={780} durationInFrames={210}><Models /></Sequence>
    <Sequence from={990} durationInFrames={180}><Departments /></Sequence>
    <Sequence from={1170} durationInFrames={240}><Practices /></Sequence>
    <Sequence from={1410} durationInFrames={150}><Trust /></Sequence>
    <Sequence from={1560} durationInFrames={240}><Outro /></Sequence>
  </AbsoluteFill>
);
