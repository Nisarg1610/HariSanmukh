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

/**
 * Prefer the browser's Origin so WebAuthn works on localhost and custom domains
 * without relying only on env vars.
 */
export function getWebAuthnFromRequest(request: Request): {
  origin: string;
  rpID: string;
} {
  const originHeader = request.headers.get('origin');
  const referer = request.headers.get('referer');

  let origin = getExpectedOrigin();

  if (originHeader) {
    origin = originHeader.replace(/\/$/, '');
  } else if (referer) {
    try {
      origin = new URL(referer).origin;
    } catch {
      /* ignore invalid referer */
    }
  }

  let rpID = getRpId();
  if (origin) {
    try {
      rpID = new URL(origin).hostname;
    } catch {
      /* ignore */
    }
  }

  if (!rpID && origin.includes('localhost')) {
    rpID = 'localhost';
  }

  return { origin, rpID };
}
