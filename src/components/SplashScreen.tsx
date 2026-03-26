'use client';
import React, { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';
type SplashMode = 'loading' | 'timeout';
export function SplashScreen({
  mode = 'loading',
  durationMs = 10_000,
  heading = 'Sanumkh',
  subheading = 'Preparing your dashboard',
  children,
}: {
  mode?: SplashMode;
  durationMs?: number;
  heading?: string;
  subheading?: string;
  children?: React.ReactNode;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (mode !== 'loading') return;
    setProgress(0);
    const start = performance.now();
    const max = 98; // leave a little headroom; page switch happens on completion
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      // Ease-out curve for a calmer feel
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.min(max, eased * max));
    };
    tick();
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, [mode, durationMs]);
  return (
    <main
      className={styles.root}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className={styles.rings} aria-hidden="true">
        <span className={styles.ring1} />
        <span className={styles.ring2} />
        <span className={styles.ring3} />
      </div>
      <div className={styles.stack} aria-hidden="true">
        <div className={`${styles.layer} ${styles.layerBack}`} />
        <div className={`${styles.layer} ${styles.layerMid}`} />
        <div className={`${styles.layer} ${styles.layerFront}`}>
          <div className={styles.iconGlow}>
            <img src="/icon-256.png" alt="" className={styles.icon} />
          </div>
        </div>
      </div>
      <div className={styles.textBlock}>
        <div className={styles.heading}>{heading}</div>
        {mode === 'loading' && <div className={styles.subheading}>{subheading}</div>}
      </div>
      {mode === 'loading' ? (
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.progressMeta}>
            <span className={styles.progressPct}>{Math.round(progress)}%</span>
            <span className={styles.progressStatus}>Loading</span>
          </div>
        </div>
      ) : (
        children
      )}
    </main>
  );
}
