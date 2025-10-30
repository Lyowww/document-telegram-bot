import crypto from 'node:crypto';

export type DocumentRecord = {
  pin: string;
  bytes?: Uint8Array;
  createdAt: number;
};

const tokenToRecord = new Map<string, DocumentRecord>();

export function createTokenWithPin(pin: string): string {
  const token = crypto.randomUUID();
  tokenToRecord.set(token, { pin, createdAt: Date.now() });
  return token;
}

export function setBytesForToken(token: string, bytes: Uint8Array): void {
  const record = tokenToRecord.get(token);
  if (!record) {
    tokenToRecord.set(token, { pin: '', bytes, createdAt: Date.now() });
    return;
  }
  record.bytes = bytes;
}

export function verifyPin(token: string, pin: string): boolean {
  const record = tokenToRecord.get(token);
  if (!record) return false;
  return record.pin === pin;
}

export function getBytesByToken(token: string): Uint8Array | undefined {
  const record = tokenToRecord.get(token);
  return record?.bytes;
}

export function hasToken(token: string): boolean {
  return tokenToRecord.has(token);
}


