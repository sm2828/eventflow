import React, { useState, useEffect, useRef, useCallback } from "react";
import { Event } from "../lib/api";
import { StatusBadge } from "./StatusBadge";

interface Props {
  events: Event[]; // sorted oldest-first for replay
  onExit: () => void;
}

const SPEEDS = [0.5, 1, 2, 5] as const;

type AnimatedEvent = Event & {
  _displayStatus: Event["status"];
  _step: number; // 0=queued 1=processing 2=done
};

// Simulated state machine: QUEUED -> PROCESSING -> final status
function nextStep(e: AnimatedEvent): AnimatedEvent {
  if (e._step === 0) {
    return { ...e, _displayStatus: "PROCESSING", _step: 1 };
  }
  if (e._step === 1) {
    return { ...e, _displayStatus: e.status, _step: 2 };
  }
  return e;
}

export function ReplayMode({ events, onExit }: Props) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [cursor, setCursor] = useState(0); // which event we're "at"
  const [visible, setVisible] = useState<AnimatedEvent[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const BASE_DELAY = 800; // ms between events at 1x

  const animateEvent = useCallback(
    (e: Event) => {
      const delay = BASE_DELAY / speed;
      let anim: AnimatedEvent = { ...e, _displayStatus: "QUEUED", _step: 0 };

      setVisible((v) => [anim, ...v].slice(0, 50));

      animTimerRef.current = setTimeout(() => {
        anim = nextStep(anim);
        setVisible((v) => v.map((x) => (x.id === anim.id ? anim : x)));

        animTimerRef.current = setTimeout(() => {
          anim = nextStep(anim);
          setVisible((v) => v.map((x) => (x.id === anim.id ? anim : x)));
        }, delay);
      }, delay);
    },
    [speed]
  );

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setCursor((c) => {
        if (c >= sorted.length) {
          setPlaying(false);
          return c;
        }
        animateEvent(sorted[c]);
        return c + 1;
      });
    }, BASE_DELAY / speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, animateEvent, sorted.length]);

  const reset = () => {
    setPlaying(false);
    setCursor(0);
    setVisible([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
  };

  const progress = sorted.length > 0 ? Math.min((cursor / sorted.length) * 100, 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117" }}>
      {/* Header */}
      <div style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 8, padding: "16px 20px",
        marginBottom: 20,
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e1e4e8" }}>
              ▶ Replay Mode
            </div>
            <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>
              Replaying {sorted.length} historical events from oldest to newest
            </div>
          </div>
          <button
            onClick={onExit}
            style={{
              padding: "6px 16px", borderRadius: 6, fontSize: 13,
              border: "1px solid #30363d", background: "transparent",
              color: "#e1e4e8", cursor: "pointer",
            }}
          >
            ✕ Exit Replay
          </button>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, background: "#21262d", borderRadius: 4, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 4,
            background: "linear-gradient(90deg, #58a6ff, #3fb950)",
            width: `${progress}%`,
            transition: "width 0.3s ease",
          }} />
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setPlaying((p) => !p)}
            style={{
              padding: "6px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600,
              border: "1px solid",
              borderColor: playing ? "#f85149" : "#3fb950",
              background: playing ? "rgba(248,81,73,0.12)" : "rgba(63,185,80,0.12)",
              color: playing ? "#f85149" : "#3fb950",
              cursor: "pointer",
            }}
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>

          <button
            onClick={reset}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 13,
              border: "1px solid #30363d", background: "transparent",
              color: "#8b949e", cursor: "pointer",
            }}
          >
            ↺ Reset
          </button>

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#8b949e" }}>Speed:</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  padding: "3px 10px", fontSize: 12, borderRadius: 20,
                  border: "1px solid",
                  borderColor: speed === s ? "#d29922" : "#30363d",
                  background: speed === s ? "rgba(210,153,34,0.12)" : "transparent",
                  color: speed === s ? "#d29922" : "#8b949e",
                  cursor: "pointer",
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          <span style={{ fontSize: 12, color: "#484f58", marginLeft: "auto" }}>
            {cursor} / {sorted.length} events played
          </span>
        </div>
      </div>

      {/* Stream */}
      {visible.length === 0 && !playing && (
        <div style={{
          textAlign: "center", padding: 64, color: "#484f58", fontSize: 14,
        }}>
          Press Play to start the replay
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((e) => (
          <ReplayRow key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}

function ReplayRow({ event }: { event: AnimatedEvent }) {
  const isNew = event._step === 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "#161b22",
      border: `1px solid ${isNew ? "#58a6ff44" : "#21262d"}`,
      borderRadius: 6, padding: "10px 14px",
      animation: isNew ? "slideIn 0.3s ease" : "none",
      transition: "border-color 0.4s",
    }}>
      <code style={{ fontSize: 11, color: "#8b949e", minWidth: 72 }}>
        {event.id.slice(0, 8)}…
      </code>
      <code style={{
        background: "#21262d", padding: "2px 8px",
        borderRadius: 4, fontSize: 12, color: "#79c0ff",
        minWidth: 160,
      }}>
        {event.type}
      </code>
      <StatusBadge status={event._displayStatus} />
      <span style={{ fontSize: 11, color: "#484f58", marginLeft: "auto" }}>
        {new Date(event.createdAt).toLocaleString()}
      </span>
    </div>
  );
}
