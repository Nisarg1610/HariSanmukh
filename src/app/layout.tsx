import type { Metadata, Viewport } from 'next';
import { OAuthCallback } from '@/components/OAuthCallback';
import './globals.css';
import { Figtree } from "next/font/google";
import { cn } from "@/lib/utils";

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans' });

const APP_NAME = 'HariPrabodham';
const APP_DESCRIPTION = 'Manage ghar-mandir more nicely and effectively.';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '64x64' },
      { url: '/icon-256.png', sizes: '256x256', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", figtree.variable)}>
      <head>
        <meta name="google-site-verification" content="Dm_xILAdu7FiSD2jC0FXa4tGOMSU8lao_m-BUE6jWSs" />
        {/* ✅ Must be first — prevents dark mode flash */}
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const theme = localStorage.getItem('hs_theme');
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              } else if (theme === 'light') {
                document.documentElement.classList.remove('dark');
              } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          `
        }} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/icon-256.png" sizes="256x256" type="image/png" />
        <link rel="icon" href="/icon-512.png" sizes="512x512" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* iOS Splash Screens — gives a native app launch feel */}
        {/* iPhone SE, 6, 7, 8 */}
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/icon-512.png" />
        {/* iPhone X, XS, 11 Pro */}
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/icon-512.png" />
        {/* iPhone XR, 11 */}
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/icon-512.png" />
        {/* iPhone 12, 13, 14 */}
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/icon-512.png" />
        {/* iPhone 14 Pro, 15, 15 Pro */}
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/icon-512.png" />
        {/* iPhone 14 Plus, 15 Plus */}
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/icon-512.png" />
        {/* iPad */}
        <link rel="apple-touch-startup-image" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" href="/icon-512.png" />

        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
                  reg.update();
                }).catch(function(err) {});
              });
            }
          `
        }} />
      </head>
      <body>
        {/* Floating gradient orbs — behind all pages (see globals.css .bubble-bg) */}
        <div className="bubble-bg" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
        <div className="app-shell">
          <OAuthCallback />
          {children}
        </div>
      </body>
    </html>
  );
}
