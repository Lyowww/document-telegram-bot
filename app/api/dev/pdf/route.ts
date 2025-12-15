import { NextResponse } from 'next/server'
import { generateFirstPdf, generateNosudFromHtml, parseFirstText, parseNosudText } from '@/lib/pdf'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') || 'first').toUpperCase()
  const text = url.searchParams.get('text') || ''

  try {
    if (type === 'NOSUD') {
      const parsed = parseNosudText(text)
      const pdf = await generateNosudFromHtml(parsed)
      return new Response(Buffer.from(pdf.bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${pdf.fileName}"`,
        },
      })
    } else {
      const parsed = parseFirstText(text)
      const pdf = await generateFirstPdf(parsed)
      return new Response(Buffer.from(pdf.bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${pdf.fileName}"`,
        },
      })
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'failed to generate pdf' },
      { status: 500 },
    )
  }
}


