'use client';
import { useRef, useState } from 'react';

interface SwipeButtonProps {
  onSwipeComplete: () => void;
}

export function SwipeToComplete({ onSwipeComplete }: SwipeButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

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
    setDragging(true);
    startXRef.current = clientX;
    currentXRef.current = pos;
  }

  function handleMove(clientX: number) {
    if (!dragging) return;
    const dx = clientX - startXRef.current;
    const next = clamp(currentXRef.current + dx);
    setPos(next);
    startXRef.current = clientX;
    currentXRef.current = next;
  }

  function handleRelease() {
    if (!dragging) return;
    setDragging(false);
    const max = getMax();
    if (pos >= max * 0.85) {
      setPos(max);
      setTimeout(() => {
        setDone(true);
        onSwipeComplete();
      }, 200);
    } else {
      setPos(0);
      currentXRef.current = 0;
    }
  }

  if (done) {
    return (
      <div className="w-full mt-4 py-3 rounded-[14px] flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--green-bg)', border: '2px solid rgba(45,158,107,0.4)' }}>
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
      <div className="absolute inset-y-0 left-0 rounded-[14px] pointer-events-none"
        style={{ width: pos + THUMB_SIZE + PADDING, backgroundColor: 'rgba(255,255,255,0.12)' }} />

      {/* Label */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 pointer-events-none"
        style={{ opacity: 1 - progress * 1.8 }}
      >
        <span className="text-right text-[13px] font-extrabold text-white/85 tracking-wide">
          Mark Done →
        </span>
      </div>
      {/* Thumb */}
      <div
        className="absolute top-[4px] flex items-center justify-center bg-white rounded-[10px] cursor-grab active:cursor-grabbing"
        style={{ left: pos + PADDING, width: THUMB_SIZE, height: THUMB_SIZE, transition: dragging ? 'none' : 'left 0.25s ease' }}
        onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX); }}
        onTouchStart={(e) => { e.preventDefault(); handleStart(e.touches[0].clientX); }}
      >
        <span className="text-lg">🙏</span>
      </div>
    </div>
  );
}