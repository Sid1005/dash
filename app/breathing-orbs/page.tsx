"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  ChevronLeft,
  Wind,
  Info,
  Sparkles,
} from "lucide-react";
import {
  BREATH_PHASES,
  getBreathData,
  AuroraOrb,
  MandalaOrb,
  CosmicSwarmOrb,
  EchoOrb,
  useBreathingSound,
  BreathingPhase,
} from "./BreathingOrbs";

export default function BreathingOrbsPlayground() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeMs, setTimeMs] = useState(0);
  const [selectedOrb, setSelectedOrb] = useState<"aurora" | "mandala" | "swarm" | "echo">("aurora");
  const [isDark, setIsDark] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showInfo, setShowInfo] = useState(true);

  // Sound Synthesizer Hook
  const { updateSound } = useBreathingSound(soundEnabled);

  // Timer Ref
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  // Handle high-precision timer with requestAnimationFrame when playing
  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const deltaTime = time - previousTimeRef.current;
        setTimeMs((prev) => (prev + deltaTime) % 12000);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      previousTimeRef.current = null;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);

  // Extract breathing state parameters
  const { phase, phaseProgress, pressure } = getBreathData(timeMs);

  // Synchronize sound synthesizer parameters
  useEffect(() => {
    updateSound(phase.id, pressure);
  }, [timeMs, phase.id, pressure, soundEnabled]);

  // Restart timer helper
  const handleReset = () => {
    setTimeMs(0);
    previousTimeRef.current = null;
  };

  // Human readable time remaining in the current phase
  const phaseTimeRemaining = Math.max(
    0,
    Math.ceil((phase.end - (timeMs % 12000)) / 1000)
  );

  return (
    <div
      className={`min-height-screen w-full transition-colors duration-500 font-sans flex flex-col ${
        isDark
          ? "bg-slate-950 text-slate-100 selection:bg-blue-500/30"
          : "bg-[#dfdfd7] text-black selection:bg-yellow-200"
      }`}
      style={{
        minHeight: "100vh",
        background: isDark
          ? "radial-gradient(circle at center, #0f172a 0%, #020617 100%)"
          : "#dfdfd7",
      }}
    >
      {/* 1. STANDALONE NAVIGATION HEADER */}
      <header
        className={`w-full py-4 px-6 border-b flex items-center justify-between transition-colors duration-500 ${
          isDark ? "border-slate-800/80 bg-slate-950/40" : "border-black bg-[#dfdfd7]"
        }`}
        style={{
          backdropFilter: isDark ? "blur(12px)" : "none",
          WebkitBackdropFilter: isDark ? "blur(12px)" : "none",
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className={`flex items-center justify-center p-2 rounded-lg transition-colors border ${
              isDark
                ? "border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:text-white"
                : "border-black bg-white hover:bg-black/5"
            }`}
            style={{
              boxShadow: isDark ? "none" : "2px 2px 0px #000000",
            }}
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="mono uc font-bold text-xs tracking-widest text-blue-500">
                ORBS DEMO
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  isDark ? "bg-slate-800 text-slate-300" : "bg-black text-white"
                }`}
              >
                Physiological Sigh
              </span>
            </div>
            <h1 className="text-sm font-semibold tracking-tight">Breathing Orbs Playground</h1>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-lg border transition-all duration-300 ${
              soundEnabled
                ? isDark
                  ? "bg-blue-600/20 border-blue-500 text-blue-400"
                  : "bg-black border-black text-white"
                : isDark
                ? "border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                : "border-black bg-white hover:bg-black/5 text-black"
            }`}
            style={{
              boxShadow: isDark ? "none" : "3px 3px 0px #000000",
            }}
            title={soundEnabled ? "Mute synth pad" : "Enable synthesized sound pad"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-2.5 rounded-lg border transition-all duration-300 ${
              isDark
                ? "border-slate-800 hover:bg-slate-900 text-yellow-400"
                : "border-black bg-white hover:bg-black/5 text-black"
            }`}
            style={{
              boxShadow: isDark ? "none" : "3px 3px 0px #000000",
            }}
            title={isDark ? "Switch to light newsprint mode" : "Switch to dark ambient mode"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: INTERACTIVE VISUALIZER PLAYGROUND (Lg: 8 cols) */}
        <div className="col-span-1 lg:col-span-8 flex flex-col items-center gap-8 w-full">
          
          {/* THE ORB DISPLAYER */}
          <div
            className={`w-full aspect-[4/3] min-h-[400px] rounded-2xl border flex flex-col items-center justify-center relative transition-all duration-500 overflow-hidden ${
              isDark
                ? "border-slate-800 bg-slate-950/30"
                : "border-black bg-[#e4e4df]"
            }`}
            style={{
              boxShadow: isDark
                ? "0 4px 30px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.05)"
                : "6px 6px 0px #000000",
            }}
          >
            {/* Ambient Background Glow matching the active phase */}
            <div
              className="absolute w-96 h-96 rounded-full filter blur-[100px] opacity-15 transition-all duration-700 pointer-events-none"
              style={{
                background: isDark ? phase.colorDark : phase.colorLight,
              }}
            />

            {/* Orb Component Swapper */}
            <div className="z-10 transform scale-105 transition-transform duration-500">
              {selectedOrb === "aurora" && (
                <AuroraOrb pressure={pressure} isDark={isDark} phaseId={phase.id} />
              )}
              {selectedOrb === "mandala" && (
                <MandalaOrb pressure={pressure} isDark={isDark} phaseId={phase.id} />
              )}
              {selectedOrb === "swarm" && (
                <CosmicSwarmOrb pressure={pressure} isDark={isDark} phaseId={phase.id} />
              )}
              {selectedOrb === "echo" && (
                <EchoOrb pressure={pressure} isDark={isDark} phaseId={phase.id} />
              )}
            </div>

            {/* Floating Instructional Overlay */}
            <div className="absolute bottom-8 z-10 text-center px-6">
              <div
                className="mono uppercase text-xs tracking-[0.2em] font-extrabold transition-all duration-300"
                style={{
                  color: isDark ? phase.colorDark : phase.colorLight,
                  textShadow: isDark ? `0 0 12px ${phase.colorDark}40` : "none",
                }}
              >
                {phase.name}
              </div>
              <div className="text-xl font-light tracking-wide mt-1.5 min-h-[28px] max-w-md mx-auto">
                {phase.instruction}
              </div>
              <div className="mono text-[10px] mt-2 opacity-60">
                {phaseTimeRemaining}s remaining · {(timeMs / 1000).toFixed(1)}s elapsed
              </div>
            </div>

            {/* Dynamic visual indicator scale helper */}
            <div className="absolute top-6 right-6 mono text-[10px] opacity-40 select-none">
              pressure: {Math.round(pressure * 100)}%
            </div>
          </div>

          {/* PLAYHEAD TIMELINE PROGRESS BAR */}
          <div className="w-full flex flex-col gap-3">
            {/* Segment Labels */}
            <div className="grid grid-cols-12 gap-1 px-1">
              <div className="col-span-4 text-left">
                <span className="mono text-[9px] opacity-50 uppercase block">Inhale Deep</span>
                <span className="mono text-[10px] font-bold text-blue-500">4.0s</span>
              </div>
              <div className="col-span-1 text-center">
                <span className="mono text-[9px] opacity-50 uppercase block">Hold</span>
                <span className="mono text-[10px] font-bold text-amber-500">1.0s</span>
              </div>
              <div className="col-span-1 text-center">
                <span className="mono text-[9px] opacity-50 uppercase block">Sniff</span>
                <span className="mono text-[10px] font-bold text-rose-500">1.0s</span>
              </div>
              <div className="col-span-6 text-right">
                <span className="mono text-[9px] opacity-50 uppercase block">Exhale Sigh</span>
                <span className="mono text-[10px] font-bold text-emerald-500">6.0s</span>
              </div>
            </div>

            {/* Progress Bar Track */}
            <div
              className={`w-full h-4 rounded-full border relative overflow-hidden flex ${
                isDark ? "border-slate-800 bg-slate-950" : "border-black bg-white"
              }`}
            >
              {/* Playhead Marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 z-20 transition-all duration-75"
                style={{
                  left: `${(timeMs / 12000) * 100}%`,
                  background: isDark ? "#ffffff" : "#000000",
                  boxShadow: isDark ? "0 0 8px #ffffff" : "none",
                }}
              />

              {/* Segmented color tracks */}
              <div
                className="h-full relative transition-all duration-300"
                style={{
                  width: "33.33%", // 4s / 12s
                  background: "rgba(59, 130, 246, 0.12)",
                  borderRight: isDark ? "1px dashed rgba(255,255,255,0.15)" : "1px dashed #000000",
                }}
              />
              <div
                className="h-full relative transition-all duration-300"
                style={{
                  width: "8.33%", // 1s / 12s
                  background: "rgba(245, 158, 11, 0.1)",
                  borderRight: isDark ? "1px dashed rgba(255,255,255,0.15)" : "1px dashed #000000",
                }}
              />
              <div
                className="h-full relative transition-all duration-300"
                style={{
                  width: "8.33%", // 1s / 12s
                  background: "rgba(236, 72, 153, 0.12)",
                  borderRight: isDark ? "1px dashed rgba(255,255,255,0.15)" : "1px dashed #000000",
                }}
              />
              <div
                className="h-full relative transition-all duration-300"
                style={{
                  width: "50%", // 6s / 12s
                  background: "rgba(16, 185, 129, 0.08)",
                }}
              />

              {/* Live filling progress layer */}
              <div
                className="absolute left-0 top-0 bottom-0 mix-blend-normal pointer-events-none opacity-40 transition-all duration-75"
                style={{
                  width: `${(timeMs / 12000) * 100}%`,
                  background: isDark ? phase.colorDark : phase.colorLight,
                }}
              />
            </div>

            {/* Time markers */}
            <div className="flex justify-between px-1 mono text-[9px] opacity-40">
              <span>0.0s</span>
              <span>2.0s</span>
              <span>4.0s</span>
              <span>5.0s</span>
              <span>6.0s</span>
              <span>9.0s</span>
              <span>12.0s</span>
            </div>
          </div>

          {/* LOWER CONTROLLER BAR */}
          <div className="flex flex-wrap items-center justify-center gap-6 w-full">
            {/* Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border font-bold text-sm tracking-wide transition-all duration-200 select-none ${
                isDark
                  ? "border-slate-700 bg-slate-900 hover:bg-slate-800 text-white"
                  : "border-black bg-white hover:bg-black/5 text-black"
              }`}
              style={{
                boxShadow: isDark ? "none" : "4px 4px 0px #000000",
                transform: !isDark && isPlaying ? "none" : "translate(-2px, -2px)",
              }}
            >
              {isPlaying ? (
                <>
                  <Pause size={15} strokeWidth={2.5} /> PAUSE SESSION
                </>
              ) : (
                <>
                  <Play size={15} strokeWidth={2.5} /> RESUME SESSION
                </>
              )}
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all duration-200 select-none ${
                isDark
                  ? "border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300"
                  : "border-black bg-white hover:bg-black/5 text-black"
              }`}
              style={{
                boxShadow: isDark ? "none" : "4px 4px 0px #000000",
              }}
              title="Reset timer to beginning"
            >
              <RotateCcw size={14} /> RESET
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: CONTROL PANEL & SETTINGS (Lg: 4 cols) */}
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-6 w-full">
          
          {/* ORB SWITCHER CARD */}
          <div
            className={`border rounded-2xl p-6 transition-all duration-500 ${
              isDark ? "border-slate-800/80 bg-slate-950/40" : "border-black bg-[#e4e4df]"
            }`}
            style={{
              boxShadow: isDark ? "none" : "6px 6px 0px #000000",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-blue-500" />
              <h2 className="mono uc text-xs font-black tracking-wider">Select Orb Type</h2>
            </div>

            <div className="flex flex-col gap-3">
              {[
                {
                  id: "aurora",
                  name: "Aurora Glow",
                  desc: "Fluid, morphing glassmorphic color bubble.",
                },
                {
                  id: "mandala",
                  name: "Sacred Mandala",
                  desc: "Intricate rotating SVG geometric wireframe.",
                },
                {
                  id: "swarm",
                  name: "Cosmic Swarm",
                  desc: "Responsive HTML5 Canvas particle swarm.",
                },
                {
                  id: "echo",
                  name: "Minimal Echo",
                  desc: "Clean concentric fading ripple rings.",
                },
              ].map((orb) => {
                const active = selectedOrb === orb.id;
                return (
                  <button
                    key={orb.id}
                    onClick={() => setSelectedOrb(orb.id as any)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 flex flex-col gap-1 ${
                      active
                        ? isDark
                          ? "bg-slate-900 border-blue-500 text-white"
                          : "bg-white border-black text-black"
                        : isDark
                        ? "border-slate-900/60 bg-slate-950/20 text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                        : "border-transparent bg-black/5 text-slate-700 hover:bg-black/10"
                    }`}
                    style={{
                      borderWidth: active ? "2.5px" : "1.5px",
                    }}
                  >
                    <span className="font-bold text-sm flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          active ? "bg-blue-500" : "bg-transparent border border-current"
                        }`}
                      />
                      {orb.name}
                    </span>
                    <span className="text-xs opacity-80 leading-relaxed font-light">{orb.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* WHAT IS THE PHYSIOLOGICAL SIGH INFO CARD */}
          <div
            className={`border rounded-2xl p-6 transition-all duration-500 relative ${
              isDark ? "border-slate-800/80 bg-slate-950/20" : "border-black bg-[#e4e4df]"
            }`}
            style={{
              boxShadow: isDark ? "none" : "6px 6px 0px #000000",
            }}
          >
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="absolute top-6 right-6 text-slate-400 hover:text-current transition-colors"
              title="Toggle science info"
            >
              <Info size={16} />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Wind size={16} className="text-emerald-500" />
              <h2 className="mono uc text-xs font-black tracking-wider">The Science</h2>
            </div>

            {showInfo ? (
              <div className="text-xs font-light space-y-3 leading-relaxed transition-all duration-300">
                <p>
                  The <strong className="font-semibold text-blue-500">Physiological Sigh</strong> is a biological breathing pattern characterized by two inhales followed by a long exhale.
                </p>
                <p>
                  Typically, humans sigh automatically during sleep or under stress to re-inflate collapsed alveoli (air sacs) in the lungs.
                </p>
                <p>
                  Doing just <strong className="font-semibold">3-5 cycles</strong> consciously immediately triggers the parasympathetic nervous system:
                </p>
                <ul className="list-disc pl-4 space-y-1 opacity-95">
                  <li>
                    The first deep inhale (4s) fills the lungs.
                  </li>
                  <li>
                    The second fast inhale (1s) pops open collapsed alveoli, maximizing surface area.
                  </li>
                  <li>
                    The slow exhale (6s) triggers carbon dioxide offloading and lowers heart rate.
                  </li>
                </ul>
              </div>
            ) : (
              <div className="text-xs italic text-slate-400 py-4">Info minimized. Click the icon to view.</div>
            )}
          </div>

          {/* AUDIO SYNTH CARD */}
          <div
            className={`border rounded-2xl p-6 transition-all duration-500 ${
              isDark ? "border-slate-800/80 bg-slate-950/20" : "border-black bg-[#e4e4df]"
            }`}
            style={{
              boxShadow: isDark ? "none" : "6px 6px 0px #000000",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Volume2 size={16} className="text-rose-500" />
              <h2 className="mono uc text-xs font-black tracking-wider">Audio Feedback</h2>
            </div>
            <p className="text-xs leading-relaxed font-light opacity-95 mb-4">
              Real-time synthesizers using the Web Audio API create a low-frequency hum. The filter opens and volume swells on inhales and drifts into dark silence on exhales.
            </p>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-full py-2.5 rounded-xl border text-xs font-bold transition-all duration-300 select-none ${
                soundEnabled
                  ? isDark
                    ? "bg-rose-500/20 border-rose-500 text-rose-300"
                    : "bg-black border-black text-white"
                  : isDark
                  ? "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200"
                  : "border-black bg-white hover:bg-black/5 text-black"
              }`}
              style={{
                boxShadow: isDark ? "none" : "3px 3px 0px #000000",
              }}
            >
              {soundEnabled ? "DISABLE SYNTH DRONE" : "ENABLE SYNTH DRONE"}
            </button>
          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer
        className={`w-full py-8 text-center text-xs mt-auto border-t mono transition-colors duration-500 ${
          isDark ? "border-slate-900 text-slate-500 bg-slate-950/20" : "border-black/10 text-slate-500"
        }`}
      >
        Physiological Sigh (4s Inhale · 1s Hold · 1s Inhale · 6s Exhale) · Interactive Demos
      </footer>
    </div>
  );
}
