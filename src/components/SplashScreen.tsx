'use client';

import React, { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

type SplashMode = 'loading' | 'timeout';

export function SplashScreen({
  mode = 'loading',
  durationMs = 10000,
  heading = 'HariSanumkh',
  children,
}: {
  mode?: SplashMode;
  durationMs?: number;
  heading?: string;
  children?: React.ReactNode;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (mode !== 'loading') return;

    const start = performance.now();
    const max = 98;

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.min(max, eased * max));
    };

    tick();
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, [mode, durationMs]);

  return (
    <main className={styles.root}>
      
      {/* Rings (optional - you can remove if you want ultra clean) */}
      <div className={styles.rings} aria-hidden="true">
        <span className={styles.ring1} />
        <span className={styles.ring2} />
        <span className={styles.ring3} />
      </div>

      {/* Logo */}
      <div className={styles.stack}>
        <div className={styles.iconGlow}>
          <img src="/icon-256.png" alt="logo" className={styles.icon} />
        </div>
      </div>

      {/* Text */}
      <div className={styles.textBlock}>
        <div className={styles.heading}>{heading}</div>

        {mode === 'loading' && (
          <div className={styles.subheading}>
            Loading Dashboard<span className={styles.dots}></span>
          </div>
        )}
      </div>

      {mode === 'timeout' ? children : null}
    </main>
  );
}