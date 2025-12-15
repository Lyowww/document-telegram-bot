import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, hasToken } from '@/lib/store';
import { verifyPinForToken, findDocumentByToken } from '@/lib/documents';

function getDomainForDocumentType(type?: string): string {
  switch (type) {
    case 'FIRST':
      return 'davreestr-docrepository.online';
    case 'APOSTILLE':
      return 'davreestr-docrepository.online';
    case 'NOTARY':
      return 'gov-info.online';
    case 'NOSUD':
    default:
      return 'davreestr-docrepository.online';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, pin } = (await request.json()) as { token?: string; pin?: string };
    if (!token || !pin) {
      return NextResponse.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400 });
    }
    // First, try persistent store (MongoDB)
    const doc = await findDocumentByToken(token);
    if (doc) {
      const okDb = await verifyPinForToken(token, pin);
      if (!okDb) {
        return NextResponse.json({ ok: false, error: 'INVALID_PIN' }, { status: 200 });
      }
      const domain = getDomainForDocumentType(doc.type);
      const fileUrl = `https://${domain}/api/file/${token}`;
      return NextResponse.json({ ok: true, fileUrl, type: doc.type });
    } else {
      // Fall back to in-memory token existence
      if (!hasToken(token)) {
        return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
      }
      const ok = verifyPin(token, pin);
      if (!ok) {
        return NextResponse.json({ ok: false, error: 'INVALID_PIN' }, { status: 200 });
      }
      const fileUrl = `/api/file/${token}`;
      return NextResponse.json({ ok: true, fileUrl });
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}


