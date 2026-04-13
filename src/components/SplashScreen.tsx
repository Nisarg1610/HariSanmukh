'use client';
import React from 'react';
import styles from './SplashScreen.module.css';
type SplashMode = 'loading' | 'timeout';
export function SplashScreen({
  mode = 'loading',
  heading = 'HariPrabodham',
  subheading = 'Loading your dashboard',
  children,
}: {
  mode?: SplashMode;
  heading?: string;
  subheading?: string;
  children?: React.ReactNode;
}) {
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
      {/* Calm rings */}
      <div className={styles.rings} aria-hidden="true">
        <span className={styles.ring1} />
        <span className={styles.ring2} />
        <span className={styles.ring3} />
      </div>

      {/* Logo intro */}
      <div className={styles.stack} aria-hidden="true">
        <div className={`${styles.layer} ${styles.layerBack}`} />
        <div className={`${styles.layer} ${styles.layerMid}`} />
        <div className={`${styles.layer} ${styles.layerFront}`}>
          <div className={styles.iconGlow}>
            <img src="/icon-256.png" alt="" className={styles.icon} />
          </div>
        </div>
      </div>

      {/* Text sequence */}
      <div className={styles.textBlock}>
        <div className={styles.heading}>{heading}</div>
        {mode === 'loading' && (
          <div className={styles.subheading}>
            {subheading}
            <span className={styles.dots} aria-hidden="true">
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
          </div>
        )}
        {mode === 'timeout' ? children : null}
      </div>
    </main>
  );
}
