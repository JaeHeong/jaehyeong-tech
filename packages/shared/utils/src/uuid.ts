import * as crypto from 'crypto';

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}
