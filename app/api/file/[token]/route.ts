import { NextResponse } from 'next/server';
import { getBytesByToken } from '@/lib/store';

type Params = { params: { token: string } };

export async function GET(_: Request, { params }: Params) {
  const { token } = params;
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


