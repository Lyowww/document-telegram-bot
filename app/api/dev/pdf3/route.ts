import { NextResponse } from 'next/server'
import { generateSecondPdf, parseSecondText } from '@/lib/pdf3'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const text = url.searchParams.get('text') || ''

  try {
    const parsed = parseSecondText(text)
    const pdf = await generateSecondPdf(parsed)
    return new Response(Buffer.from(pdf.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdf.fileName}"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'failed to generate pdf' },
      { status: 500 },
    )
  }
}

