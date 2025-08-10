import { randomBytes } from 'crypto';

export function generateTOTPSecret(): string {
  const buffer = randomBytes(20);
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function generateTOTPUrl(secret: string, username: string, issuer: string): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });

  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?${params}`;
}