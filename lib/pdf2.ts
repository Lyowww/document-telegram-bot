import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'
import QRCode from 'qrcode'
import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { createTokenWithPin, setBytesForToken } from './store'
import { saveDocumentMeta } from './documents'

export type NosudInput = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDateDdMmYyyy: string;
  pinfl: string;
};

export type GeneratedNosud = {
  token: string;
  pin: string;
  bytes: Uint8Array;
  fileName: string;
  verifyUrl: string;
  generatedAt: Date;
  docId: string;
  serialNo: string;
};

function getBaseUrl(): string {
  const env = process.env.APP_BASE_URL?.replace(/\/$/, '');
  if (env) return env;
  return 'http://localhost:3000';
}

function getVerifyDomainForType(type: 'FIRST' | 'NOSUD' | 'APOSTILLE' | 'NOTARY'): string {
  switch (type) {
    case 'FIRST':
      return 'https://davreestr-docrepository.online';
    case 'APOSTILLE':
      return 'https://davreestr-docrepository.online';
    case 'NOTARY':
      return 'https://gov-info.online';
    case 'NOSUD':
    default:
      return 'https://davreestr-docrepository.online';
  }
}

function generatePin(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
}

function generate4DigitPin(): string {
  const n = Math.floor(Math.random() * 10_000);
  return n.toString().padStart(4, '0');
}

function pickBusinessDate(now = new Date()): Date {
  const d = new Date(now);
  const daysAgo = Math.floor(Math.random() * 365);
  d.setDate(d.getDate() - daysAgo);
  const hour = 8 + Math.floor(Math.random() * 11);
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  d.setHours(hour, minute, second, 0);
  return d;
}

function pickWeekdayDate(now = new Date()): Date {
  const d = new Date(now);
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0) {
    d.setDate(d.getDate() - 2);
  } else if (dayOfWeek === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function generateIds(): { docId: string; serialNo: string } {
  const yyyymmdd = formatDate(new Date()).split('.').reverse().join('');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const docId = `UZ-NOSUD-${yyyymmdd}-${rand}`;
  const serialNo = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return { docId, serialNo };
}

function generateGuideId(): string {
  const group = () =>
    Array.from({ length: 4 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  return `${group()}-${group()}-${group()}-${group()}-${group()}-${group()}-${group()}-${group()}`;
}

function generateApplicationNo(): string {
  return Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
}

type QrPlacement = {
  left?: string
  right?: string
  top?: string
  bottom?: string
  width: string
  height: string
}

function buildPlacementStyles(placement: QrPlacement): { base: string; sharedMax: string } {
  const coords = [
    placement.left ? `left: ${placement.left} !important` : '',
    placement.right ? `right: ${placement.right} !important` : '',
    placement.top ? `top: ${placement.top} !important` : '',
    placement.bottom ? `bottom: ${placement.bottom} !important` : '',
  ].filter(Boolean)
  const base = ['position: absolute !important', ...coords, `width: ${placement.width} !important`, `height: ${placement.height} !important`].join('; ') + ';'
  const sharedMax = `max-width: ${placement.width} !important; max-height: ${placement.height} !important;`
  return { base, sharedMax }
}

function buildCoverLayer(placement: QrPlacement): string {
  const { base, sharedMax } = buildPlacementStyles(placement)
  const coverStyle = `${base} ${sharedMax} background: #fff !important; z-index: 9998 !important;`
  return `        <div class="pdf24_qr_cover" style="${coverStyle}"></div>`
}

const THIRD_QR_LEGACY_COVER: QrPlacement = { right: '150px', top: '340px', width: '8.975em', height: '9.075em' }

async function htmlToPdf(htmlContent: string): Promise<Uint8Array> {
  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    })
    const page = await browser.newPage()
    
    page.setDefaultNavigationTimeout(120000)
    page.setDefaultTimeout(120000)
    
    await page.setContent(htmlContent, {
      waitUntil: 'load',
      timeout: 120000,
    })
    
    await page.addStyleTag({
      content: `
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          font-family: Arial, sans-serif !important;
        }
        html, body {
          height: auto !important;
          overflow: visible !important;
          page-break-after: avoid !important;
          page-break-inside: avoid !important;
          font-family: Arial, sans-serif !important;
        }
        .pf {
          page-break-after: avoid !important;
          page-break-inside: avoid !important;
          break-after: avoid !important;
          break-inside: avoid !important;
          height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
        }
        #page-container {
          height: 100vh !important;
          max-height: 100vh !important;
        }
        * {
          page-break-after: avoid !important;
          page-break-inside: avoid !important;
        }
        @page {
          size: A4;
          margin: 0;
        }
        img {
          display: block !important;
          visibility: visible !important;
          max-width: 100% !important;
          opacity: 1 !important;
        }
        .pdf24_04 {
          clip: unset !important;
          clip-path: none !important;
          overflow: visible !important;
        }
        .pdf24_qr_cover {
          position: absolute !important;
          background: #ffffff !important;
          z-index: 9998 !important;
        }
        .pdf24_qr {
          position: absolute !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 9999 !important;
        }
        .bi {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        [style*="background-image"], [style*="background:"] {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          background-image: inherit !important;
        }
      `
    })
    
    await page.evaluateHandle(() => document.fonts.ready)
    
    await page.evaluate(() => {
      const images = document.querySelectorAll('img')
      return Promise.all(
        Array.from(images).map((img: HTMLImageElement) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = resolve
            setTimeout(resolve, 1000)
          })
        })
      )
    })
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      timeout: 120000,
      scale: 1,
      pageRanges: '1',
    })
    
    return new Uint8Array(pdfBuffer)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

export type ThirdInput = {
  fullName: string;
  organization: string;
};

export type GeneratedThird = {
  token: string;
  pin: string;
  bytes: Uint8Array;
  fileName: string;
  verifyUrl: string;
  generatedAt: Date;
  docNumber: string;
  docDate: string;
};

export function parseThirdText(input: string): ThirdInput {
  const parts = input.split(',').map((p) => p.trim());
  const [fullName, organization] = parts;
  return { fullName, organization };
}

export async function generateThirdPdf(input: ThirdInput): Promise<GeneratedThird> {
  const pin = generate4DigitPin();
  const token = createTokenWithPin(pin);
  const generatedAt = pickWeekdayDate(new Date());
  const docNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
  const isoDate = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(
    generatedAt.getDate(),
  ).padStart(2, '0')}`;
  const verifyDomain = getVerifyDomainForType('APOSTILLE');
  const verifyUrl = `${verifyDomain}?number=${docNumber}&date=${isoDate}`;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 3,
  })

  const htmlPath = path.join(process.cwd(), 'public', 'third.html')
  let htmlContent = await fs.readFile(htmlPath, 'utf-8')

  const verifyUrlHtmlAttr = verifyUrl.replace(/&/g, '&amp;')
  const [verifyBase2, verifyQuery2] = verifyUrl.split('?')
  const verifyUrlVisible =
    verifyQuery2
      ? `${verifyBase2}?<br>${verifyQuery2.replace(/&/g, '&amp;')}`
      : verifyBase2

  htmlContent = htmlContent
    .replace(/Ulmasov Bakhtiyor Abrorovich/g, input.fullName)
    .replace(/CENTER OF PUBLIC SERVICES OF TAILOK DISTRICT/g, input.organization)
    .replace(
      'href="https://apostille.davxizmat.uz?number=1709273&amp;date=2025-07-25"',
      `href="${verifyUrlHtmlAttr}"`,
    )
    .replace(
      'https://apostille.davxizmat.uz?<br>number=1709273&amp;date=2025-07-25',
      verifyUrlVisible,
    )
    .replace(/1709273/g, docNumber)
    .replace(/2025-07-25/g, isoDate)

  const thirdQrImg = `<img src="${qrDataUrl}" alt="" style="width:7em;height:7em;object-fit:contain;" />`
  htmlContent = htmlContent.replace(/<span\s+class="third-qr-slot"[^>]*><\/span>/i, match => {
    return match.replace('></span>', `>${thirdQrImg}</span>`)
  })

  htmlContent = htmlContent.replace(/<style[^>]*>/i, match => {
    return (
      match +
      '\n        .pf { page-break-after: avoid !important; page-break-inside: avoid !important; }\n        * { page-break-inside: avoid !important; font-family: Arial, sans-serif !important; }\n        .third-qr-slot img { margin-top: -130px !important; margin-left: -10px !important; }\n'
    )
  })

  const bytes = await htmlToPdf(htmlContent)
  setBytesForToken(token, bytes)

  await saveDocumentMeta({
    token,
    pin,
    type: 'APOSTILLE',
    createdAt: new Date(),
    verifyUrl,
    generatedDate: isoDate,
    generatedDateTime: formatDate(generatedAt),
    docNumber,
    docDate: isoDate,
  });

  return {
    token,
    pin,
    bytes,
    fileName: `APOSTILLE_${docNumber}_${Date.now()}.pdf`,
    verifyUrl,
    generatedAt,
    docNumber,
    docDate: isoDate,
  };
}

