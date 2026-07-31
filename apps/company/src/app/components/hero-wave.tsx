"use client";

import { useEffect, useRef } from "react";

interface PointerState {
  active: boolean;
  x: number;
  y: number;
}

interface WavePointOptions {
  centerY: number;
  pointer: PointerState;
  pointerRadius: number;
  row: number;
  time: number;
  x: number;
}

interface WaveFieldOptions {
  centerY: number;
  gap: number;
  pointer: PointerState;
  pointerRadius: number;
  time: number;
  width: number;
}

function drawWavePoint(
  context: CanvasRenderingContext2D,
  { centerY, pointer, pointerRadius, row, time, x }: WavePointOptions
) {
  const wave =
    Math.sin(x * 0.008 + time + row * 0.28) * (44 + row * 1.5) +
    Math.sin(x * 0.0028 - time * 0.55) * 34;
  const baseY = centerY + wave + row * 18;
  const dx = pointer.x - x;
  const dy = pointer.y - baseY;
  const distance = Math.hypot(dx, dy);
  const influence = pointer.active
    ? Math.max(0, 1 - distance / pointerRadius)
    : 0;
  const y = baseY - dy * influence * 0.2;
  const distanceFromCenter = Math.abs(row) / 12;
  const alpha = 0.1 + (1 - distanceFromCenter) * 0.12 + influence * 0.72;
  const radius = 0.75 + (1 - distanceFromCenter) * 0.35 + influence * 1.75;

  context.beginPath();
  context.fillStyle = `rgba(${96 + influence * 150}, ${
    153 + influence * 95
  }, 255, ${alpha})`;
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawPointerGlow(
  context: CanvasRenderingContext2D,
  pointer: PointerState,
  pointerRadius: number,
  width: number,
  height: number
) {
  const glow = context.createRadialGradient(
    pointer.x,
    pointer.y,
    0,
    pointer.x,
    pointer.y,
    pointerRadius
  );
  glow.addColorStop(0, "rgba(224, 239, 255, .36)");
  glow.addColorStop(0.28, "rgba(91, 151, 255, .2)");
  glow.addColorStop(0.58, "rgba(59, 130, 246, .08)");
  glow.addColorStop(1, "rgba(59, 130, 246, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

function drawWaveField(
  context: CanvasRenderingContext2D,
  { centerY, gap, pointer, pointerRadius, time, width }: WaveFieldOptions
) {
  for (let row = -11; row <= 11; row += 1) {
    for (let x = -20; x <= width + 20; x += gap) {
      drawWavePoint(context, {
        centerY,
        pointer,
        pointerRadius,
        row,
        time,
        x,
      });
    }
  }
}

export function HeroWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const pointer = { x: -1000, y: -1000, active: false };
    let width = 0;
    let height = 0;
    let frame = 0;
    let animationId = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
      pointer.x = -1000;
      pointer.y = -1000;
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const time = reducedMotion ? 0 : frame * 0.008;
      const mobile = width < 700;
      const gap = mobile ? 16 : 11;
      const centerY = height * 0.57;
      const pointerRadius = mobile ? 130 : 210;

      drawWaveField(context, {
        centerY,
        gap,
        pointer,
        pointerRadius,
        time,
        width,
      });

      if (pointer.active) {
        drawPointerGlow(context, pointer, pointerRadius, width, height);
      }

      frame += 1;
      if (!reducedMotion) {
        animationId = requestAnimationFrame(draw);
      }
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas className="hero-wave" ref={canvasRef} />;
}
