/** Bare hostname for WebAuthn rpID (no protocol or trailing slash). */
export function getRpId(): string {
  const raw = process.env.NEXT_PUBLIC_APP_DOMAIN ?? '';
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();
}

export function getExpectedOrigin(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return url.replace(/\/$/, '');
}
