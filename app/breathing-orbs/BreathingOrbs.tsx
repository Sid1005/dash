"use client";

import React, { useEffect, useRef, useState } from "react";

// Types
export type BreathingPhase = "inhale1" | "hold" | "inhale2" | "exhale";

export interface PhaseConfig {
  id: BreathingPhase;
  name: string;
  duration: number; // in ms
  start: number; // in ms
  end: number; // in ms
  instruction: string;
  colorLight: string;
  colorDark: string;
  bgGlowLight: string;
  bgGlowDark: string;
}

export const BREATH_PHASES: PhaseConfig[] = [
  {
    id: "inhale1",
    name: "Inhale (Deep)",
    duration: 4000,
    start: 0,
    end: 4000,
    instruction: "Breathe in deeply through your nose...",
    colorLight: "#3b82f6", // Blue
    colorDark: "#60a5fa",
    bgGlowLight: "rgba(59, 130, 246, 0.15)",
    bgGlowDark: "rgba(96, 165, 250, 0.2)",
  },
  {
    id: "hold",
    name: "Hold",
    duration: 1000,
    start: 4000,
    end: 5000,
    instruction: "Hold and capture the stillness.",
    colorLight: "#f59e0b", // Amber
    colorDark: "#fbbf24",
    bgGlowLight: "rgba(245, 158, 11, 0.12)",
    bgGlowDark: "rgba(251, 191, 36, 0.18)",
  },
  {
    id: "inhale2",
    name: "Sniff (Sharp)",
    duration: 1000,
    start: 5000,
    end: 6000,
    instruction: "Take one quick, final sniff to top off!",
    colorLight: "#ec4899", // Rose/Pink
    colorDark: "#f472b6",
    bgGlowLight: "rgba(236, 72, 153, 0.18)",
    bgGlowDark: "rgba(244, 114, 182, 0.22)",
  },
  {
    id: "exhale",
    name: "Exhale (Sigh)",
    duration: 6000,
    start: 6000,
    end: 12000,
    instruction: "Sigh out slowly through your mouth...",
    colorLight: "#10b981", // Emerald
    colorDark: "#34d399",
    bgGlowLight: "rgba(16, 185, 129, 0.12)",
    bgGlowDark: "rgba(52, 211, 153, 0.18)",
  },
];

// Helper to get current pressure & ratio
export function getBreathData(timeMs: number) {
  const t = timeMs % 12000;
  let phase: PhaseConfig = BREATH_PHASES[0];
  let phaseProgress = 0;
  let pressure = 0; // 0 to 1

  if (t < 4000) {
    phase = BREATH_PHASES[0];
    phaseProgress = t / 4000;
    pressure = phaseProgress * 0.75; // reaches 0.75
  } else if (t >= 4000 && t < 5000) {
    phase = BREATH_PHASES[1];
    phaseProgress = (t - 4000) / 1000;
    pressure = 0.75; // flat hold
  } else if (t >= 5000 && t < 6000) {
    phase = BREATH_PHASES[2];
    phaseProgress = (t - 5000) / 1000;
    pressure = 0.75 + phaseProgress * 0.25; // swells rapidly to 1.0
  } else {
    phase = BREATH_PHASES[3];
    phaseProgress = (t - 6000) / 6000;
    pressure = 1.0 - phaseProgress; // decays slowly to 0.0
  }

  return {
    time: t,
    phase,
    phaseProgress,
    pressure,
  };
}

// ----------------------------------------------------
// 1. AURORA GLOW ORB (Fluid CSS Gradients & Blur)
// ----------------------------------------------------
export function AuroraOrb({ pressure, isDark, phaseId }: { pressure: number; isDark: boolean; phaseId: BreathingPhase }) {
  const colorMap = {
    inhale1: isDark ? "rgba(96, 165, 250, 0.85)" : "rgba(59, 130, 246, 0.8)", // Sky blue
    hold: isDark ? "rgba(251, 191, 36, 0.85)" : "rgba(245, 158, 11, 0.8)",    // Warm gold
    inhale2: isDark ? "rgba(244, 114, 182, 0.9)" : "rgba(236, 72, 153, 0.85)", // Rose/Magenta
    exhale: isDark ? "rgba(52, 211, 153, 0.85)" : "rgba(16, 185, 129, 0.8)",  // Emerald green
  };

  const scale = 0.45 + pressure * 0.55;
  const pulseFreq = phaseId === "hold" ? 0.08 : 0;
  const scalePulse = scale + Math.sin(Date.now() / 250) * pulseFreq * 0.02;

  const currentMainColor = colorMap[phaseId];
  const ambientGlow = isDark
    ? `0 0 80px 20px ${currentMainColor}`
    : `0 0 50px 10px ${currentMainColor}`;

  return (
    <div className="relative w-72 h-72 flex items-center justify-center select-none">
      {/* Background radial glow */}
      <div
        className="absolute w-72 h-72 rounded-full transition-colors duration-700 blur-[60px] opacity-40"
        style={{
          background: currentMainColor,
          transform: `scale(${scalePulse * 1.2})`,
        }}
      />

      {/* Main glass orb container */}
      <div
        className="w-56 h-56 rounded-full border border-white/20 relative flex items-center justify-center overflow-hidden transition-shadow duration-300"
        style={{
          transform: `scale(${scalePulse})`,
          boxShadow: `${ambientGlow}, inset 10px 15px 30px rgba(255,255,255,0.4), inset -15px -20px 40px rgba(0,0,0,0.15), 0 10px 30px rgba(0,0,0,0.2)`,
          background: isDark
            ? "radial-gradient(circle at 35% 30%, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.75) 100%)"
            : "radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.7) 0%, rgba(226, 232, 240, 0.6) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Shifting inner plasma core */}
        <div
          className="absolute w-36 h-36 rounded-full filter blur-[20px] mix-blend-screen opacity-70 animate-pulse"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${currentMainColor} 0%, rgba(255,255,255,0) 70%)`,
            transform: "translate(-10px, -10px) rotate(15deg)",
          }}
        />

        {/* Secondary secondary light highlight (keeps it dimensional) */}
        <div
          className="absolute w-24 h-24 rounded-full filter blur-[15px] mix-blend-screen opacity-50"
          style={{
            background: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
            top: "10%",
            left: "15%",
          }}
        />

        {/* Dynamic center highlight */}
        <div
          className="absolute w-12 h-12 rounded-full border border-white/30 transition-transform duration-100"
          style={{
            transform: `scale(${0.6 + pressure * 0.4})`,
            background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.1) 80%)",
            boxShadow: "0 0 15px rgba(255,255,255,0.5)",
          }}
        />

        {/* Soft geometric ring overlay */}
        <div className="absolute inset-5 rounded-full border border-dashed border-white/10 animate-[spin_40s_linear_infinite]" />
        <div className="absolute inset-10 rounded-full border border-dotted border-white/15 animate-[spin_25s_linear_infinite_reverse]" />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. SACRED GEOMETRIC MANDALA ORB (SVG Wireframe)
// ----------------------------------------------------
export function MandalaOrb({ pressure, isDark, phaseId }: { pressure: number; isDark: boolean; phaseId: BreathingPhase }) {
  const [rotation, setRotation] = useState(0);

  // Rotate faster during inhale/hold, slower during exhale
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;

    const animate = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      // Determine rotation speed multiplier based on phase
      let speedMult = 0.02; // default
      if (phaseId === "inhale1") speedMult = 0.05;
      else if (phaseId === "hold") speedMult = 0.08;
      else if (phaseId === "inhale2") speedMult = 0.12;
      else speedMult = 0.015; // slow drift during exhale

      setRotation((prev) => (prev + delta * speedMult) % 360);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [phaseId]);

  const colorMap = {
    inhale1: isDark ? "#60a5fa" : "#2563eb",
    hold: isDark ? "#fbbf24" : "#d97706",
    inhale2: isDark ? "#f472b6" : "#db2777",
    exhale: isDark ? "#34d399" : "#059669",
  };

  const activeColor = colorMap[phaseId];
  const scale = 0.4 + pressure * 0.6;
  const strokeWidth = isDark ? 1.25 : 1.75;
  const secondaryColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";

  return (
    <div className="w-72 h-72 flex items-center justify-center select-none">
      <svg
        width="260"
        height="260"
        viewBox="0 0 200 200"
        className="transition-transform duration-100"
        style={{
          transform: `scale(${scale})`,
        }}
      >
        <defs>
          <radialGradient id="mandala-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={activeColor} stopOpacity={isDark ? "0.2" : "0.1"} />
            <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient background glow inside SVG */}
        <circle cx="100" cy="100" r="90" fill="url(#mandala-glow)" />

        {/* Rotating outer rings */}
        <g transform={`rotate(${rotation} 100 100)`}>
          {/* Static background geometry */}
          <circle cx="100" cy="100" r="85" fill="none" stroke={secondaryColor} strokeWidth={strokeWidth * 0.5} />
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeDasharray="4 8"
            opacity="0.6"
          />

          {/* Orbiting mandala nodes (8 petal symmetry) */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const cx = 100 + 55 * Math.cos(rad);
            const cy = 100 + 55 * Math.sin(rad);
            return (
              <g key={angle}>
                {/* Petal overlapping circles */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="25"
                  fill="none"
                  stroke={activeColor}
                  strokeWidth={strokeWidth * 0.75}
                  opacity="0.35"
                />
                {/* Outer joint lines */}
                <line
                  x1="100"
                  y1="100"
                  x2={cx}
                  y2={cy}
                  stroke={secondaryColor}
                  strokeWidth={strokeWidth * 0.5}
                />
                <circle cx={cx} cy={cy} r="3.5" fill={activeColor} />
              </g>
            );
          })}
        </g>

        {/* Reverse rotating inner geometry */}
        <g transform={`rotate(${-rotation * 1.5} 100 100)`}>
          <polygon
            points="100,60 135,120 65,120"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
            opacity="0.6"
          />
          <polygon
            points="100,140 135,80 65,80"
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
            opacity="0.6"
          />
          <circle cx="100" cy="100" r="40" fill="none" stroke={activeColor} strokeWidth={strokeWidth * 1.5} />
        </g>

        {/* Central Core Pulsing Spheres */}
        <circle
          cx="100"
          cy="100"
          r={12 + pressure * 8}
          fill="none"
          stroke={activeColor}
          strokeWidth={strokeWidth * 2.5}
          style={{
            boxShadow: `0 0 10px ${activeColor}`,
          }}
        />
        <circle cx="100" cy="100" r="6" fill={activeColor} />
      </svg>
    </div>
  );
}

// ----------------------------------------------------
// 3. COSMIC SWARM ORB (HTML5 Canvas Particles)
// ----------------------------------------------------
interface SwarmParticle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  angle: number;
  radius: number;
  speed: number;
  size: number;
  alpha: number;
  color: string;
}

export function CosmicSwarmOrb({ pressure, isDark, phaseId }: { pressure: number; isDark: boolean; phaseId: BreathingPhase }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<SwarmParticle[]>([]);
  const phaseRef = useRef<BreathingPhase>(phaseId);

  // Update ref to avoid closing over stale state in draw loop
  useEffect(() => {
    phaseRef.current = phaseId;
  }, [phaseId]);

  // Color mapping
  const colorMap = {
    inhale1: isDark ? "147, 197, 253" : "59, 130, 246", // Blue
    hold: isDark ? "252, 211, 77" : "245, 158, 11",     // Gold
    inhale2: isDark ? "244, 114, 182" : "236, 72, 153",  // Pink
    exhale: isDark ? "110, 231, 183" : "16, 185, 129",   // Emerald
  };

  // Initialize particles once
  useEffect(() => {
    const particles: SwarmParticle[] = [];
    const count = 180;
    const baseColor = colorMap[phaseRef.current];

    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count + Math.random() * 0.1;
      const radius = 40 + Math.random() * 45;
      particles.push({
        x: 100 + Math.cos(angle) * radius,
        y: 100 + Math.sin(angle) * radius,
        originX: 100,
        originY: 100,
        angle: angle,
        radius: radius,
        speed: 0.01 + Math.random() * 0.02,
        size: 1 + Math.random() * 2,
        alpha: 0.15 + Math.random() * 0.7,
        color: baseColor,
      });
    }
    particlesRef.current = particles;
  }, []);

  // Update and render animation frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;

    const draw = () => {
      const activeColorStr = colorMap[phaseRef.current];
      
      // Motion blur trail
      if (isDark) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.15)"; // Deep slate
      } else {
        ctx.fillStyle = "rgba(223, 223, 215, 0.15)"; // Newsprint background
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw center core anchor
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + pressure * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${activeColorStr}, ${0.25 + pressure * 0.55})`;
      ctx.fill();

      // Update and draw particles
      const particles = particlesRef.current;
      particles.forEach((p, idx) => {
        // Orbit dynamics
        let speed = p.speed;
        let radiusOffset = 0;

        // Modulate dynamics per phase
        if (phaseRef.current === "inhale1") {
          // Spiraling outwards
          speed = p.speed * 1.5;
          radiusOffset = pressure * 45;
        } else if (phaseRef.current === "hold") {
          // Static, vibrating perfect orbit ring
          speed = p.speed * 2.2;
          radiusOffset = 30 + Math.sin(Date.now() / 150 + idx) * 2.5;
        } else if (phaseRef.current === "inhale2") {
          // Sharp outward spike
          speed = p.speed * 3.5;
          radiusOffset = 45 + pressure * 30;
        } else {
          // Exhale: drifting back inwards slowly
          speed = p.speed * 0.7;
          radiusOffset = pressure * 35;
        }

        p.angle += speed;
        const targetRadius = p.radius + radiusOffset;
        const targetX = cx + Math.cos(p.angle) * targetRadius;
        const targetY = cy + Math.sin(p.angle) * targetRadius;

        // Smooth interpolation
        p.x += (targetX - p.x) * 0.12;
        p.y += (targetY - p.y) * 0.12;

        // Render glow particles
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.8 + pressure * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${activeColorStr}, ${p.alpha})`;
        ctx.fill();

        // Connect nearby particles during Hold to make it look like a web/matrix
        if (phaseRef.current === "hold" && idx % 7 === 0) {
          const nextP = particles[(idx + 1) % particles.length];
          const dist = Math.hypot(p.x - nextP.x, p.y - nextP.y);
          if (dist < 40) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(nextP.x, nextP.y);
            ctx.strokeStyle = `rgba(${activeColorStr}, 0.14)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [pressure, isDark]);

  return (
    <div className="w-72 h-72 flex items-center justify-center select-none relative">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="rounded-full"
        style={{
          boxShadow: isDark
            ? "inset 0 0 25px rgba(255,255,255,0.03), 0 0 40px rgba(0,0,0,0.12)"
            : "inset 0 0 20px rgba(0,0,0,0.05), 0 0 20px rgba(0,0,0,0.05)",
        }}
      />
    </div>
  );
}

// ----------------------------------------------------
// 4. MINIMAL ECHO ORB (Zen Concentric Ripples)
// ----------------------------------------------------
export function EchoOrb({ pressure, isDark, phaseId }: { pressure: number; isDark: boolean; phaseId: BreathingPhase }) {
  const [ripples, setRipples] = useState<{ id: number; scale: number; opacity: number }[]>([]);
  const nextRippleId = useRef(0);
  const scale = 0.35 + pressure * 0.65;

  const colorMap = {
    inhale1: isDark ? "#60a5fa" : "#3b82f6",
    hold: isDark ? "#fbbf24" : "#f59e0b",
    inhale2: isDark ? "#f472b6" : "#ec4899",
    exhale: isDark ? "#34d399" : "#10b981",
  };
  const activeColor = colorMap[phaseId];

  // Spawn ripples at phase transitions or intervals
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (phaseId === "inhale1" || phaseId === "exhale") {
      interval = setInterval(() => {
        const id = nextRippleId.current++;
        setRipples((prev) => [...prev, { id, scale: 0.35 + pressure * 0.65, opacity: 0.6 }]);
      }, 1200);
    } else if (phaseId === "inhale2") {
      // Rapid ripples on double-sniff
      interval = setInterval(() => {
        const id = nextRippleId.current++;
        setRipples((prev) => [...prev, { id, scale: 0.75, opacity: 0.8 }]);
      }, 400);
    } else if (phaseId === "hold") {
      // Standing harmonic ring
      const id = nextRippleId.current++;
      setRipples((prev) => [...prev, { id, scale: 0.75, opacity: 0.5 }]);
    }

    return () => clearInterval(interval);
  }, [phaseId, pressure]);

  // Animate and garbage collect ripples
  useEffect(() => {
    const handle = setInterval(() => {
      setRipples((prev) =>
        prev
          .map((r) => ({
            ...r,
            scale: r.scale + 0.015,
            opacity: r.opacity - 0.012,
          }))
          .filter((r) => r.opacity > 0)
      );
    }, 16);

    return () => clearInterval(handle);
  }, []);

  return (
    <div className="w-72 h-72 flex items-center justify-center select-none relative">
      {/* Concentric ripples rendering */}
      {ripples.map((r) => (
        <div
          key={r.id}
          className="absolute rounded-full border border-solid pointer-events-none"
          style={{
            width: "200px",
            height: "200px",
            borderColor: activeColor,
            transform: `scale(${r.scale})`,
            opacity: Math.max(0, r.opacity),
            transition: "border-color 0.4s",
          }}
        />
      ))}

      {/* Main Core solid circle */}
      <div
        className="w-48 h-48 rounded-full flex items-center justify-center relative transition-shadow duration-500"
        style={{
          transform: `scale(${scale})`,
          background: `radial-gradient(circle at 35% 30%, ${activeColor} 0%, ${
            isDark ? "#1e293b" : "#ffffff"
          } 100%)`,
          boxShadow: isDark
            ? `0 0 45px rgba(${phaseId === "inhale1" ? "96,165,250" : phaseId === "hold" ? "251,191,36" : phaseId === "inhale2" ? "244,114,182" : "52,211,153"}, 0.28)`
            : `0 0 25px rgba(0,0,0,0.1), 0 10px 15px rgba(0,0,0,0.05)`,
          border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1.5px solid rgba(0,0,0,0.85)",
        }}
      >
        <div
          className="w-8 h-8 rounded-full border border-dashed opacity-30 animate-spin"
          style={{ borderColor: isDark ? "#ffffff" : "#000000" }}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 5. WEB AUDIO SYNTHESIZER PAD HOOK
// ----------------------------------------------------
export function useBreathingSound(isEnabled: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Audio node refs
  const osc1Ref = useRef<OscillatorNode | null>(null);
  const osc2Ref = useRef<OscillatorNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize Audio
  const initAudio = () => {
    if (audioCtxRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      // Create master nodes
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 220; // very low warm tone
      filter.Q.value = 1.0;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.0; // start silent

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // Connect nodes
      filter.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(ctx.destination);

      // Oscillators (Warm ambient chord structure)
      // Base root node: C3 (130.81 Hz) - deep hum
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 130.81;

      // Harmonious fifth or tenth: G3 (196 Hz) / E4 (329.63 Hz) - warm pad
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.value = 196.0;

      osc1.connect(filter);
      osc2.connect(filter);

      osc1.start();
      osc2.start();

      // Store refs
      audioCtxRef.current = ctx;
      osc1Ref.current = osc1;
      osc2Ref.current = osc2;
      filterRef.current = filter;
      gainNodeRef.current = gainNode;
    } catch (e) {
      console.warn("Failed to initialize Web Audio API:", e);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try {
          osc1Ref.current?.stop();
          osc2Ref.current?.stop();
          audioCtxRef.current.close();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Update volume and filters dynamically based on breathing phase
  const updateSound = (phaseId: BreathingPhase, pressure: number) => {
    if (!isEnabled) {
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(0.0, audioCtxRef.current?.currentTime || 0, 0.15);
      }
      return;
    }

    initAudio(); // Auto init if enabled

    const ctx = audioCtxRef.current;
    const gain = gainNodeRef.current;
    const filter = filterRef.current;
    const osc1 = osc1Ref.current;
    const osc2 = osc2Ref.current;

    if (!ctx || !gain || !filter || !osc1 || !osc2) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const t = ctx.currentTime;

    // Glide parameters based on breath pressure
    if (phaseId === "inhale1") {
      // Swelling volume and opening filter
      gain.gain.setTargetAtTime(0.12 + pressure * 0.18, t, 0.1);
      filter.frequency.setTargetAtTime(150 + pressure * 280, t, 0.12);
      
      // Dynamic pitch glide: minor rise in fundamental frequency
      osc1.frequency.setTargetAtTime(130.81 + pressure * 1.5, t, 0.2);
      osc2.frequency.setTargetAtTime(196.0 + pressure * 2.2, t, 0.2);
    } else if (phaseId === "hold") {
      // Warm, stable hum with a slow vibrato
      gain.gain.setTargetAtTime(0.25, t, 0.15);
      filter.frequency.setTargetAtTime(320 + Math.sin(t * 8) * 15, t, 0.1);
    } else if (phaseId === "inhale2") {
      // Sharp boost: open filter and louder gain
      gain.gain.setTargetAtTime(0.35, t, 0.05);
      filter.frequency.setTargetAtTime(580, t, 0.08);
      osc1.frequency.setTargetAtTime(132.81, t, 0.08);
      osc2.frequency.setTargetAtTime(200.0, t, 0.08);
    } else {
      // Exhale: smooth fading volume and closing filter
      const vol = Math.max(0.02, 0.28 * (1 - (1 - pressure)));
      gain.gain.setTargetAtTime(vol * 0.8, t, 0.25);
      filter.frequency.setTargetAtTime(120 + pressure * 180, t, 0.3);
      
      // Decelerate frequencies back to grounding base values
      osc1.frequency.setTargetAtTime(130.81, t, 0.35);
      osc2.frequency.setTargetAtTime(196.0, t, 0.35);
    }
  };

  return { updateSound };
}
