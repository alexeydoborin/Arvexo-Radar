"use client";

import { useEffect, useRef } from "react";
import { createParticleField, type ParticleField as Field, type ParticleMode } from "@/lib/particles";

type Props = {
  mode?: ParticleMode;
  shape?: "braces" | "flower";
  theme?: "light" | "dark";
  hovered?: boolean;
};

export function ParticleField({ mode = "main", shape, theme = "light", hovered = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<Field | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let field: Field | null = null;
    try {
      field = createParticleField(container, { mode, shape, theme, reducedMotion });
    } catch (error) {
      console.warn("Particle field unavailable", error);
    }
    fieldRef.current = field;
    return () => {
      field?.destroy();
      fieldRef.current = null;
    };
  }, [mode, shape, theme]);

  useEffect(() => {
    fieldRef.current?.setHovered(hovered);
  }, [hovered]);

  return <div ref={containerRef} className="particle-container" aria-hidden="true" />;
}
