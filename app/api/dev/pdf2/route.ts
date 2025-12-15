import { NextResponse } from 'next/server'
import { generateThirdPdf, parseThirdText } from '@/lib/pdf2'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const text = url.searchParams.get('text') || ''

  try {
    const parsed = parseThirdText(text)
    const pdf = await generateThirdPdf(parsed)
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

