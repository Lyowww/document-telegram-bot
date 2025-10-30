import { NextRequest, NextResponse } from 'next/server';
import { getBytesByToken } from '@/lib/store';

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const bytes = getBytesByToken(token);
  if (!bytes) {
    return new NextResponse('Not found', { status: 404 });
  }
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="document.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}


