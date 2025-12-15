import { NextRequest, NextResponse } from 'next/server'
import { findDocumentByNumberAndDate } from '@/lib/documents'
import { getBytesByToken } from '@/lib/store'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const number = url.searchParams.get('number')
  const date = url.searchParams.get('date')

  if (!number || !date) {
    return new NextResponse('Missing number or date', { status: 400 })
  }

  try {
    const doc = await findDocumentByNumberAndDate(number, date)
    if (!doc) {
      return new NextResponse('Document not found', { status: 404 })
    }

    const bytes = getBytesByToken(doc.token)
    if (!bytes) {
      return new NextResponse('PDF not found', { status: 404 })
    }

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Apostille_No_${number}_from_${date}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse('Internal server error', { status: 500 })
  }
}

