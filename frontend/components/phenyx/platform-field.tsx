"use client";

import { useEffect, useRef, useState } from "react";

const DESKTOP_ICONS = [
  "spotify", "chatgpt", "tiktok", "youtube", "instagram", "pinterest",
  "claude", "reddit", "netflix", "gemini", "linkedin", "strava",
] as const;
const MOBILE_ICONS = ["spotify", "chatgpt", "youtube", "instagram", "pinterest", "claude"] as const;

type IconKey = (typeof DESKTOP_ICONS)[number];
type MotionState = "arriving" | "idle" | "leaving" | "returning";
type Point = { x: number; y: number; weight?: number };

interface Body {
  box: HTMLDivElement;
  aura: HTMLSpanElement;
  x: number;
  y: number;
  past: Point[];
  vx: number;
  vy: number;
  wobble: number;
  wobbleRate: number;
  phase: number;
  phaseTwo: number;
  bornAt: number;
  state: MotionState;
  stateAt: number;
  moving: boolean;
  next?: Point;
}

const LABELS: Partial<Record<IconKey, string>> = {
  chatgpt: "ChatGPT",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function iconsForWidth(width: number): IconKey[] {
  if (width <= 760) return [...MOBILE_ICONS];
  if (width <= 980) return [...DESKTOP_ICONS.slice(0, 7)];
  return [...DESKTOP_ICONS];
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function hash(value: number) {
  const result = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return result - Math.floor(result);
}

export function PlatformField({ prefersReducedMotion = false }: { prefersReducedMotion?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef(new Map<IconKey, HTMLDivElement>());
  const [icons, setIcons] = useState<IconKey[]>([...DESKTOP_ICONS]);

  useEffect(() => {
    const sync = () => {
      const next = iconsForWidth(window.innerWidth);
      setIcons((current) => current.join() === next.join() ? current : next);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    const field = containerRef.current;
    if (!field) return;

    let width = field.clientWidth || 640;
    let height = field.clientHeight || 360;
    const isMobile = window.innerWidth <= 760;
    const size = isMobile ? 50 : 54;
    const radius = size / 2;
    const speed = isMobile ? 5 : 7.5;
    const drift = isMobile ? 5 : 8;
    const padding = radius + 8;
    let idealDistance = Math.min(120, Math.sqrt(((width - padding * 2) * (height - padding * 2)) / (icons.length * 1.7)));
    const distanceFloor = size + drift * 2 + 8;
    const minimumJump = Math.min(180, Math.hypot(width - padding * 2, height - padding * 2) * 0.3);
    const pointer = { x: -10000, y: -10000 };
    const cleanups: Array<() => void> = [];
    const bodies: Body[] = [];
    let animationFrame = 0;
    let sizeTick = 0;
    let lastFrame = performance.now();

    const randomBetween = (low: number, high: number) => low + Math.random() * (high - low);
    const pickPosition = (others: Point[], memory: Point[], jumpDistance: number): Point => {
      let candidates: Array<Point & { score?: number }> = [];
      let hardDistance = idealDistance;
      let jump = jumpDistance;
      for (let pass = 0; pass < 8 && candidates.length === 0; pass += 1) {
        for (let attempt = 0; attempt < 420; attempt += 1) {
          const candidate = { x: randomBetween(padding, width - padding), y: randomBetween(padding, height - padding) };
          const clearsBodies = others.every((other) => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= hardDistance);
          const clearsJump = !jump || !memory.length || Math.hypot(candidate.x - memory[0].x, candidate.y - memory[0].y) >= jump;
          if (clearsBodies && clearsJump) candidates.push(candidate);
        }
        hardDistance = Math.max(distanceFloor, hardDistance * 0.9);
        jump *= 0.8;
      }
      if (!candidates.length) return { x: randomBetween(padding, width - padding), y: randomBetween(padding, height - padding) };
      candidates.forEach((candidate) => {
        candidate.score = memory.length
          ? Math.min(...memory.map((point) => Math.hypot(candidate.x - point.x, candidate.y - point.y) * (point.weight ?? 1)))
          : Math.random();
      });
      candidates.sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
      const best = candidates.slice(0, Math.max(1, Math.min(22, Math.round(candidates.length * 0.26))));
      return best[Math.floor(Math.random() * best.length)];
    };
    const place = (body: Body) => {
      body.box.style.left = `${body.x - radius}px`;
      body.box.style.top = `${body.y - radius}px`;
    };

    icons.forEach((key, index) => {
      const box = elementRefs.current.get(key);
      const aura = box?.querySelector<HTMLSpanElement>(".landing-vnext__platform-aura");
      if (!box || !aura) return;
      const position = pickPosition(bodies, [], 0);
      const angle = hash(index * 17 + 3) * Math.PI * 2;
      const body: Body = {
        box, aura, x: position.x, y: position.y, past: [{ ...position }],
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        wobble: hash(index * 23 + 7) * Math.PI * 2,
        wobbleRate: 0.000041 + hash(index * 29 + 11) * 0.000022,
        phase: 1.31 * index, phaseTwo: 0.77 * index + 2.2,
        bornAt: performance.now() + 200 + index * 230,
        state: prefersReducedMotion ? "idle" : "arriving", stateAt: 0, moving: false,
      };
      place(body);
      bodies.push(body);

      if (!prefersReducedMotion) {
        const onEnter = () => {
          if (body.moving || body.state !== "idle") return;
          const others = bodies.filter((candidate) => candidate !== body).map(({ x, y }) => ({ x, y }));
          const memory: Point[] = [{ x: body.x, y: body.y, weight: 1.15 }]
            .concat(body.past.slice(-3).reverse().map((point, memoryIndex) => ({ ...point, weight: 1.1 - memoryIndex * 0.25 })))
            .concat(pointer.x > -1000 ? [{ ...pointer, weight: 1.35 }] : []);
          body.next = pickPosition(others, memory, minimumJump);
          body.moving = true;
          body.state = "leaving";
          body.stateAt = performance.now();
        };
        box.addEventListener("mouseenter", onEnter);
        cleanups.push(() => box.removeEventListener("mouseenter", onEnter));
      }
    });

    const onPointerMove = (event: MouseEvent) => {
      const rect = field.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onPointerLeave = () => { pointer.x = -10000; pointer.y = -10000; };
    field.addEventListener("mousemove", onPointerMove);
    field.addEventListener("mouseleave", onPointerLeave);
    cleanups.push(
      () => field.removeEventListener("mousemove", onPointerMove),
      () => field.removeEventListener("mouseleave", onPointerLeave),
    );

    if (prefersReducedMotion) {
      bodies.forEach((body) => {
        body.box.style.opacity = "1";
        body.box.style.transform = "none";
        body.aura.style.opacity = "0";
      });
      return () => cleanups.forEach((cleanup) => cleanup());
    }

    const frame = (now: number) => {
      const fieldRect = field.getBoundingClientRect();
      if (fieldRect.bottom <= 0 || fieldRect.top >= window.innerHeight) {
        lastFrame = now;
        animationFrame = requestAnimationFrame(frame);
        return;
      }
      const delta = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      sizeTick += 1;
      if (sizeTick % 20 === 0) {
        const nextWidth = field.clientWidth;
        const nextHeight = field.clientHeight;
        if (nextWidth && nextHeight && (nextWidth !== width || nextHeight !== height)) {
          const scaleX = nextWidth / width;
          const scaleY = nextHeight / height;
          bodies.forEach((body) => { body.x *= scaleX; body.y *= scaleY; });
          width = nextWidth;
          height = nextHeight;
          idealDistance = Math.min(120, Math.sqrt(((width - padding * 2) * (height - padding * 2)) / (icons.length * 1.7)));
        }
      }

      bodies.forEach((body) => {
        if (body.state === "leaving" || body.state === "returning") return;
        const turn = Math.sin(now * body.wobbleRate + body.wobble) * 0.34 * delta;
        const cosine = Math.cos(turn);
        const sine = Math.sin(turn);
        const nextVelocityX = body.vx * cosine - body.vy * sine;
        body.vy = body.vx * sine + body.vy * cosine;
        body.vx = nextVelocityX;
        let pressing = 0;
        let separationX = 0;
        let separationY = 0;
        const separationRadius = idealDistance * 1.12;
        bodies.forEach((other) => {
          if (other === body) return;
          const differenceX = body.x - other.x;
          const differenceY = body.y - other.y;
          const distance = Math.hypot(differenceX, differenceY);
          if (distance > 0 && distance < separationRadius) {
            pressing += 1;
            const force = (1 - distance / separationRadius) ** 2 * 30 * delta;
            separationX += differenceX / distance * force;
            separationY += differenceY / distance * force;
          }
        });
        if (pressing >= 2) {
          body.vx = body.vx * 0.9 + separationX * 0.35;
          body.vy = body.vy * 0.9 + separationY * 0.35;
        } else {
          body.vx += separationX;
          body.vy += separationY;
        }
        body.x += body.vx * delta;
        body.y += body.vy * delta;
        if (body.x < padding) { body.x = padding; body.vx = Math.abs(body.vx); }
        if (body.x > width - padding) { body.x = width - padding; body.vx = -Math.abs(body.vx); }
        if (body.y < padding) { body.y = padding; body.vy = Math.abs(body.vy); }
        if (body.y > height - padding) { body.y = height - padding; body.vy = -Math.abs(body.vy); }
        const currentSpeed = Math.hypot(body.vx, body.vy) || 1;
        const maximumSpeed = speed * 1.15;
        if (currentSpeed > maximumSpeed) {
          body.vx = body.vx / currentSpeed * maximumSpeed;
          body.vy = body.vy / currentSpeed * maximumSpeed;
        }
        body.vx *= 0.985;
        body.vy *= 0.985;
        const dampedSpeed = Math.hypot(body.vx, body.vy) || 1;
        const cruiseSpeed = speed * 0.9;
        if (dampedSpeed < cruiseSpeed) {
          const gain = 1 + Math.min(0.06, (cruiseSpeed - dampedSpeed) / cruiseSpeed * 0.12);
          body.vx *= gain;
          body.vy *= gain;
        }
      });

      const hardDistance = size + 16;
      for (let pass = 0; pass < 2; pass += 1) {
        for (let left = 0; left < bodies.length; left += 1) {
          for (let right = left + 1; right < bodies.length; right += 1) {
            const first = bodies[left];
            const second = bodies[right];
            if (first.state === "leaving" || second.state === "leaving") continue;
            let differenceX = second.x - first.x;
            let differenceY = second.y - first.y;
            let distance = Math.hypot(differenceX, differenceY);
            if (distance === 0) { differenceX = 0.6; differenceY = 0.4; distance = 0.72; }
            if (distance < hardDistance) {
              const shift = (hardDistance - distance) * 0.4;
              const unitX = differenceX / distance;
              const unitY = differenceY / distance;
              first.x -= unitX * shift;
              first.y -= unitY * shift;
              second.x += unitX * shift;
              second.y += unitY * shift;
            }
          }
        }
        bodies.forEach((body) => {
          body.x = Math.max(padding, Math.min(width - padding, body.x));
          body.y = Math.max(padding, Math.min(height - padding, body.y));
        });
      }

      bodies.forEach((body) => {
        if (body.state !== "leaving") place(body);
        let opacity = 1;
        let scale = 1;
        let glow = 0;
        if (body.state === "arriving") {
          const progress = Math.min(1, Math.max(0, (now - body.bornAt) / 2100));
          opacity = 1 - (1 - progress) ** 3;
          scale = 0.74 + 0.26 * smoothstep(progress);
          glow = Math.sin(progress * Math.PI) * 0.42;
          if (progress >= 1) body.state = "idle";
        } else if (body.state === "leaving") {
          const progress = Math.min(1, (now - body.stateAt) / 950);
          opacity = 1 - progress ** 2;
          scale = 1 - 0.28 * progress ** 2;
          glow = Math.sin(progress * Math.PI) * 0.3;
          if (progress >= 1 && body.next) {
            body.past.push({ x: body.x, y: body.y });
            if (body.past.length > 4) body.past.shift();
            body.x = body.next.x;
            body.y = body.next.y;
            place(body);
            const angle = Math.random() * Math.PI * 2;
            body.vx = Math.cos(angle) * speed;
            body.vy = Math.sin(angle) * speed;
            body.state = "returning";
            body.stateAt = now;
          }
        } else if (body.state === "returning") {
          const progress = Math.min(1, (now - body.stateAt) / 1700);
          opacity = smoothstep(progress);
          scale = 0.72 + 0.28 * smoothstep(progress);
          glow = Math.sin(progress * Math.PI) * 0.46;
          if (progress >= 1) { body.state = "idle"; body.moving = false; }
        } else {
          scale = 1 + Math.sin(now * 0.000105 + body.phase) * 0.006;
          glow = 0.1 + Math.sin(now * 0.000082 + body.phaseTwo) * 0.045;
        }
        body.box.style.opacity = opacity.toFixed(3);
        body.box.style.transform = `scale(${scale.toFixed(4)})`;
        body.aura.style.opacity = glow.toFixed(3);
      });
      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationFrame);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [icons, prefersReducedMotion]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-visible">
      {icons.map((icon) => (
        <div
          key={icon}
          ref={(element) => {
            if (element) elementRefs.current.set(icon, element);
            else elementRefs.current.delete(icon);
          }}
          className="landing-vnext__platform-icon"
          role="img"
          aria-label={LABELS[icon] ?? `${icon[0].toUpperCase()}${icon.slice(1)}`}
        >
          <span className="landing-vnext__platform-aura" aria-hidden="true" />
          <span className="landing-vnext__platform-glyph"><PlatformIcon icon={icon} /></span>
        </div>
      ))}
    </div>
  );
}

function PlatformIcon({ icon }: { icon: IconKey }) {
  switch (icon) {
    case "chatgpt":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 24a6.05 6.05 0 0 0 5.77-4.21 5.98 5.98 0 0 0 3.99-2.9 6.05 6.05 0 0 0-.74-7.07Zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5ZM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.15.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 19.95A4.5 4.5 0 0 1 3.6 18.3ZM2.34 7.9a4.49 4.49 0 0 1 2.35-1.97v5.67a.77.77 0 0 0 .38.66l5.82 3.36-2.02 1.17a.08.08 0 0 1-.07 0L4 14a4.5 4.5 0 0 1-1.66-6.1Zm16.6 3.86-5.83-3.4 2.02-1.16a.08.08 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.68a.79.79 0 0 0-.4-.65Zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.41 9.24V6.9a.07.07 0 0 1 .03-.06l4.83-2.79a4.49 4.49 0 0 1 6.67 4.65ZM8.31 12.86l-2.02-1.17a.08.08 0 0 1-.04-.06V6.06a4.49 4.49 0 0 1 7.36-3.45l-.14.08L8.7 5.45a.79.79 0 0 0-.39.68v6.73Zm1.1-2.37 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5v-3Z" /></svg>;
    case "claude":
      return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">{Array.from({ length: 12 }, (_, index) => <path key={index} d="M12 12 L12 2.4" transform={`rotate(${index * 30} 12 12)`} />)}</svg>;
    case "gemini":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5c.62 5.5 4.38 9.26 9.88 9.88v1.24c-5.5.62-9.26 4.38-9.88 9.88h-1.24c-.62-5.5-4.38-9.26-9.88-9.88v-1.24c5.5-.62 9.26-4.38 9.88-9.88H12Z" /></svg>;
    case "spotify":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M16.9 16.35a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.81-.87 7.08-.5 9.72 1.11.29.18.38.56.21.85Z" fill="#080808" /><path d="M18.2 13.44a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33.36.23.48.7.25 1.07Z" fill="#080808" /><path d="M18.31 10.42c-3.23-1.92-8.55-2.09-11.63-1.16a.93.93 0 1 1-.54-1.79c3.54-1.07 9.42-.87 13.13 1.34a.93.93 0 1 1-.96 1.61Z" fill="#080808" /></svg>;
    case "instagram":
      return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><rect x="3" y="3" width="18" height="18" rx="5.2" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="3.9" stroke="currentColor" strokeWidth="1.7" /><circle cx="17.1" cy="6.9" r="1.15" fill="currentColor" /></svg>;
    case "linkedin":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.03-1.85-3.03-1.85 0-2.14 1.44-2.14 2.93v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" /></svg>;
    case "youtube":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.58 7.19a2.51 2.51 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.51 2.51 0 0 0-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.51 2.51 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81Z" fill="currentColor" /><path d="M10 15.02 15.2 12 10 8.98v6.04Z" fill="#080808" /></svg>;
    case "pinterest":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2a9.8 9.8 0 0 0-3.57 18.93c-.03-.78 0-1.74.2-2.58l1.03-4.39s-.26-.52-.26-1.3c0-1.22.7-2.13 1.58-2.13.74 0 1.1.56 1.1 1.22 0 .74-.47 1.86-.71 2.9-.2.88.44 1.59 1.3 1.59 1.56 0 2.61-2 2.61-4.36 0-1.8-1.22-3.16-3.44-3.16-2.5 0-4.06 1.87-4.06 3.95 0 .72.21 1.22.53 1.61.15.18.17.25.12.45l-.17.69c-.06.22-.25.3-.46.22-1.28-.52-1.88-1.92-1.88-3.48 0-2.58 2.18-5.67 6.48-5.67 3.45 0 5.71 2.5 5.71 5.17 0 3.53-1.96 6.15-4.86 6.15-.97 0-1.87-.52-2.18-1.11l-.6 2.31c-.22.83-.64 1.8-1.03 2.5.78.24 1.61.37 2.47.37a9.8 9.8 0 1 0 0-19.6Z" /></svg>;
    case "tiktok":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.1v12.42a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .76-5.07V9.71a5.69 5.69 0 0 0-.76-.05 5.69 5.69 0 1 0 5.69 5.74V9.01a7.35 7.35 0 0 0 4.29 1.37V7.28a4.29 4.29 0 0 1-3.23-1.46Z" /></svg>;
    case "reddit":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 11.82a2.2 2.2 0 0 0-3.73-1.58 10.79 10.79 0 0 0-5.86-1.86l1-4.7 3.27.7a1.57 1.57 0 1 0 .17-1.02l-3.86-.82a.5.5 0 0 0-.6.39l-1.13 5.44a10.79 10.79 0 0 0-5.94 1.87A2.2 2.2 0 1 0 3.1 14.1c-.03.22-.05.44-.5.66 0 3.36 3.93 6.09 8.78 6.09s8.78-2.73 8.78-6.09c0-.22-.02-.44-.05-.65A2.2 2.2 0 0 0 22 11.82ZM7.28 13.4a1.57 1.57 0 1 1 3.14 0 1.57 1.57 0 0 1-3.14 0Zm8.8 4.16c-1.08 1.08-3.14 1.16-3.75 1.16s-2.68-.08-3.75-1.16a.41.41 0 0 1 .58-.58c.68.68 2.14.92 3.17.92s2.49-.24 3.17-.92a.41.41 0 1 1 .58.58Zm-.29-2.6a1.57 1.57 0 1 1 0-3.14 1.57 1.57 0 0 1 0 3.14Z" /></svg>;
    case "netflix":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.4 2h3.94l5.32 15.06V2h3.94v20h-3.83L9.34 6.44V22H5.4V2Z" /></svg>;
    case "strava":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.6 2 3.4 14.1h3.7L9.6 9l2.5 5.1h3.6L9.6 2Z" /><path fill="rgba(175,198,242,.58)" d="M16.1 14.1 14.5 17l-1.6-2.9h-2.6L14.5 22l4.2-7.9h-2.6Z" /></svg>;
  }
}
