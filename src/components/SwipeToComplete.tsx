'use client';
import { useRef, useState, useEffect } from 'react';

interface SwipeButtonProps {
  onSwipeComplete: () => void;
  streak?: { current: number; longest: number } | null;
}

export function SwipeToComplete({ onSwipeComplete, streak }: SwipeButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const draggingRef = useRef(false);
  const posRef = useRef(0);

  const THUMB_SIZE = 44;
  const PADDING = 4;

  function getMax() {
    if (!containerRef.current) return 0;
    return containerRef.current.offsetWidth - THUMB_SIZE - PADDING * 2;
  }

  function clamp(x: number) {
    return Math.max(0, Math.min(x, getMax()));
  }

  function handleStart(clientX: number) {
    draggingRef.current = true;
    setDragging(true);
    startXRef.current = clientX;
    currentXRef.current = posRef.current;
  }

  function handleMove(clientX: number) {
    if (!draggingRef.current) return;
    const dx = clientX - startXRef.current;
    const next = clamp(currentXRef.current + dx);
    posRef.current = next;
    setPos(next);
    startXRef.current = clientX;
    currentXRef.current = next;
  }

  function handleRelease() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const max = getMax();
    if (posRef.current >= max * 0.85) {
      setPos(max);
      setTimeout(() => {
        setDone(true);
        onSwipeComplete();
      }, 200);
    } else {
      posRef.current = 0;
      setPos(0);
      currentXRef.current = 0;
    }
  }

  // Attach touchstart with { passive: false } so preventDefault works.
  // React JSX onTouchStart is always passive in modern browsers.
  useEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      handleStart(e.touches[0].clientX);
    };
    thumb.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => thumb.removeEventListener('touchstart', onTouchStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Done state: show streak banner where the swipe button was ──
  if (done) {
    const newStreak = streak ? streak.current : null;
    const isOnFire = newStreak !== null && newStreak >= 3;

    if (newStreak !== null && newStreak >= 1) {
      return (
        <div
          className="w-full mt-4 rounded-[14px] flex items-center gap-3 px-4 py-3"
          style={{
            background: isOnFire
              ? 'linear-gradient(135deg, #ff4500 0%, #ff8c00 50%, #ffd700 100%)'
              : 'linear-gradient(135deg, #ff6b00 0%, #ffb347 100%)',
            minHeight: 52,
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>🔥</span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-black text-white leading-none">
              {newStreak} Day{newStreak !== 1 ? 's' : ''} Streak!
            </p>
            <p className="text-[11px] text-white/75 mt-0.5">
              {isOnFire ? "You're on fire! Keep going 🔥" : newStreak === 1 ? 'First one! Keep it up 🙏' : 'Seva streak — complete daily!'}
            </p>
          </div>
          {streak && (
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Best</p>
              <p className="text-[15px] font-black text-white/90">{streak.longest}</p>
            </div>
          )}
        </div>
      );
    }

    // No streak data yet (table not set up) — fall back to simple done state
    return (
      <div
        className="w-full mt-4 py-3 rounded-[14px] flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--green-bg)', border: '2px solid rgba(45,158,107,0.4)', minHeight: 52 }}
      >
        <span className="text-sm font-extrabold" style={{ color: '#1A6340' }}>Seva Done ✓</span>
      </div>
    );
  }

  const max = typeof window !== 'undefined' ? getMax() : 200;
  const progress = max > 0 ? pos / max : 0;

  return (
    <div
      ref={containerRef}
      className="w-full mt-4 rounded-[14px] relative overflow-hidden select-none"
      style={{ height: 52, background: 'linear-gradient(135deg, var(--green), #248256)', touchAction: 'none' }}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleRelease}
    >
      {/* Fill overlay */}
      <div
        className="absolute inset-y-0 left-0 rounded-[14px] pointer-events-none"
        style={{ width: pos + THUMB_SIZE + PADDING, backgroundColor: 'rgba(255,255,255,0.12)' }}
      />

      {/* Label */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 pointer-events-none"
        style={{ opacity: 1 - progress * 1.8 }}
      >
        <span className="text-right text-[13px] font-extrabold text-white/85 tracking-wide">
          Swipe to mark done →
        </span>
      </div>

      {/* Thumb — ref used for non-passive touchstart */}
      <div
        ref={thumbRef}
        className="absolute top-[4px] flex items-center justify-center bg-white rounded-[10px] cursor-grab active:cursor-grabbing"
        style={{
          left: pos + PADDING,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          transition: dragging ? 'none' : 'left 0.25s ease',
        }}
        onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX); }}
      >
        <span className="text-lg">🙏</span>
      </div>
    </div>
  );
}