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

  const dotsCount = 12;
  const activeDots = Math.max(0, Math.min(dotsCount, Math.round((progress / 100) * dotsCount)));

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
          <div className={styles.orbitWrap}>
            {Array.from({ length: dotsCount }).map((_, i) => {
              const angle = (2 * Math.PI * i) / dotsCount;
              const orbitRadius = 58;
              const x = Math.cos(angle) * orbitRadius;
              const y = Math.sin(angle) * orbitRadius;
              const isActive = i < activeDots;
              return (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className={`${styles.orbitDot} ${isActive ? styles.dotActive : ''}`}
                  style={{
                    // Used by CSS for stable position while animation scales.
                    ['--tx' as any]: `${x}px`,
                    ['--ty' as any]: `${y}px`,
                    transitionDelay: `${i * 35}ms`,
                  }}
                />
              );
            })}
          </div>
            <div className={styles.iconGlow}>
              <img src="/icon-256.png" alt="" className={styles.icon} />
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

