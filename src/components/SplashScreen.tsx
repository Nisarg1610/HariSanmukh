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

  // SVG progress halo around the icon
  const haloRadius = 52;
  const haloCircumference = 2 * Math.PI * haloRadius;
  const haloDashOffset = haloCircumference * (1 - progress / 100);

  useEffect(() => {
    if (mode !== 'loading') return;
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
          <div className={styles.iconRingWrap}>
            <svg
              viewBox="0 0 120 120"
              className={styles.haloSvg}
              aria-hidden="true"
            >
              <circle
                className={styles.haloTrack}
                cx="60"
                cy="60"
                r={haloRadius}
              />
              <circle
                className={styles.haloFill}
                cx="60"
                cy="60"
                r={haloRadius}
                style={{
                  strokeDasharray: haloCircumference,
                  strokeDashoffset: haloDashOffset,
                }}
              />
            </svg>
            <div className={styles.iconGlow}>
              <img src="/icon-256.png" alt="" className={styles.icon} />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.textBlock}>
        <div className={styles.heading}>{heading}</div>
        {mode === 'loading' && <div className={styles.subheading}>{subheading}</div>}
      </div>

      {mode === 'timeout' ? children : null}
    </main>
  );
}

