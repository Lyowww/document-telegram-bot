import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, hasToken } from '@/lib/store';

export async function POST(request: NextRequest) {
  try {
    const { token, pin } = (await request.json()) as { token?: string; pin?: string };
    if (!token || !pin) {
      return NextResponse.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400 });
    }
    if (!hasToken(token)) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    const ok = verifyPin(token, pin);
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'INVALID_PIN' }, { status: 200 });
    }
    return NextResponse.json({ ok: true, fileUrl: `/api/file/${token}` });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}


