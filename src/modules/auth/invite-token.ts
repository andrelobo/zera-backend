import { createHash, randomBytes } from 'crypto';

export function generateInviteToken() {
  return randomBytes(32).toString('base64url');
}

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function getInviteTtlMs() {
  const hours = Number(process.env.USER_INVITE_TTL_HOURS ?? '72');
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 72;
  return safeHours * 60 * 60 * 1000;
}

export function buildInviteUrl(token: string) {
  const rawBase = (process.env.FRONTEND_APP_URL ?? process.env.FRONTEND_URL ?? '').trim();
  if (!rawBase) return null;

  try {
    const url = new URL('/accept-invite', rawBase.endsWith('/') ? rawBase : `${rawBase}/`);
    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    return null;
  }
}
