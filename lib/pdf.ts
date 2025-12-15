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
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0) {
    d.setDate(d.getDate() - 2);
  } else if (dayOfWeek === 6) {
    d.setDate(d.getDate() - 1);
  }
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
  // 8 groups of 4 chars (mix of digits/letters), lower-case as in sample
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

function buildQrLayer(qrDataUrl: string, placement: QrPlacement): string {
  const coords = [
    placement.left ? `left: ${placement.left} !important` : '',
    placement.right ? `right: ${placement.right} !important` : '',
    placement.top ? `top: ${placement.top} !important` : '',
    placement.bottom ? `bottom: ${placement.bottom} !important` : '',
  ].filter(Boolean)
  const base = ['position: absolute !important', ...coords, `width: ${placement.width} !important`, `height: ${placement.height} !important`].join('; ') + ';'
  const sharedMax = `max-width: ${placement.width} !important; max-height: ${placement.height} !important;`
  const coverStyle = `${base} ${sharedMax} background: #fff !important; z-index: 9998 !important;`
  const qrStyle = `${base} ${sharedMax} clip: unset !important; clip-path: none !important; overflow: visible !important; z-index: 9999 !important;`
  return `        <div class="pdf24_qr_cover" style="${coverStyle}"></div>
        <img src="${qrDataUrl}" alt="" class="pdf24_04 pdf24_qr" style="${qrStyle}" />`
}

const FIRST_QR_PLACEMENT: QrPlacement = { left: '40.65em', bottom: '100px', width: '7em', height: '7em' }
const RIGHT_QR_PLACEMENT: QrPlacement = { left: '40.65em', top: '41.33em', width: '7em', height: '7em' }
// const APOSTILLE_QR_PLACEMENT: QrPlacement = { left: '32.9em', top: '34.9em', width: '6.2em', height: '6.2em' }

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

export async function generateNosudPdf(input: NosudInput): Promise<GeneratedNosud> {
  const adminInfo = process.env.ADMIN_INFO || '';
  const { docId, serialNo } = generateIds();
  const pin = generatePin();
  const token = createTokenWithPin(pin);
  const baseUrl = getBaseUrl();
  const verifyUrl = `${baseUrl}/verify/${token}`;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 6,
  });

  const templatePath = path.join(process.cwd(), 'public', 'pdfs', 'first.pdf');
  let templateBytes: Uint8Array | null = null;
  try {
    const buf = await fs.readFile(templatePath);
    templateBytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch { }

  const generatedAt = pickBusinessDate(new Date());

  let pdfDoc: PDFDocument;
  if (templateBytes) {
    pdfDoc = await PDFDocument.load(templateBytes);
  } else {
    pdfDoc = await PDFDocument.create();
  }

  // Use existing first page if present (to overlay text on the template), otherwise create one
  const page = pdfDoc.getPageCount() > 0 ? pdfDoc.getPage(0) : pdfDoc.addPage([595.28, 841.89]);
  const { width } = page.getSize();
  const margin = 50;
  // Try to embed a Unicode font that supports Cyrillic to avoid WinAnsi issues
  async function tryEmbedUnicodeFont(candidates: string[]): Promise<PDFFont | null> {
    for (const file of candidates) {
      try {
        const p = path.join(process.cwd(), 'public', 'fonts', file);
        const bytes = await fs.readFile(p).catch(() => null);
        if (bytes) {
          return await pdfDoc.embedFont(new Uint8Array(bytes));
        }
      } catch { }
    }
    return null;
  }

  const unicodeRegular = await tryEmbedUnicodeFont([
    'NotoSans-Regular.ttf',
    'DejaVuSans.ttf',
  ]);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const font = unicodeRegular ?? helvetica

  let y = page.getSize().height - margin
  const replaceNonWinAnsiIfNeeded = (s: string): string => {
    if (unicodeRegular) return s
    return Array.from(s)
      .map((ch) => (ch.codePointAt(0)! <= 0xff ? ch : '?'))
      .join('')
  }

  const line = (text: string, bold = false, size = 12) => {
    y -= size + 6
    page.drawText(replaceNonWinAnsiIfNeeded(text), {
      x: margin,
      y,
      size,
      font: font,
      color: rgb(0, 0, 0),
      maxWidth: width - margin * 2,
      lineHeight: size + 4,
    })
  }

  line('Справка о несудимости — сведения', false, 16)
  line(`ФИО: ${input.lastName} ${input.firstName} ${input.middleName}`)
  line(`Дата рождения: ${input.birthDateDdMmYyyy}`)
  line(`ПИНФЛ: ${input.pinfl}`)
  line(`Документ №: ${docId}`)
  line(`Серийный №: ${serialNo}`)
  line(`Дата и время генерации: ${formatDate(generatedAt)} Время до 18:00`)
  line(`(дублируется) ${formatDate(generatedAt)} Время до 18:00`)
  if (adminInfo) {
    line(`Информация админа: ${adminInfo}`);
  }
  line(`PIN-код для доступа: ${pin}`);
  line(`Сканируйте QR-код или перейдите по ссылке: ${verifyUrl}`, false, 10);

  const qrPng = await pdfDoc.embedPng(qrDataUrl);
  const qrSize = 140;
  page.drawImage(qrPng, {
    x: width - margin - qrSize,
    y: margin,
    width: qrSize,
    height: qrSize,
  });

  const bytes = await pdfDoc.save();
  setBytesForToken(token, bytes);

  return {
    token,
    pin,
    bytes,
    fileName: `NOSUD_${docId}.pdf`,
    verifyUrl,
    generatedAt,
    docId,
    serialNo,
  };
}

export function parseNosudText(input: string): NosudInput {
  const [lastName, firstName, middleName, birthDateDdMmYyyy, pinfl] = input
    .split(',')
    .map((p) => p.trim());
  return { lastName, firstName, middleName, birthDateDdMmYyyy, pinfl };
}

export type FirstInput = {
  name: string;
  surname: string;
  [key: string]: string; // Allow additional fields
};

export type GeneratedFirst = {
  token: string;
  pin: string;
  bytes: Uint8Array;
  fileName: string;
  verifyUrl: string;
  generatedAt: Date;
};

export function parseFirstText(input: string): FirstInput {
  const parts = input.split(',').map((p) => p.trim());
  const [name, surname, ...rest] = parts;
  const result: FirstInput = { name, surname };
  // Add any additional fields if provided
  rest.forEach((part, index) => {
    result[`field${index + 1}`] = part;
  });
  return result;
}

export async function generateFirstPdf(input: FirstInput): Promise<GeneratedFirst> {
  const pin = generate4DigitPin();
  const token = createTokenWithPin(pin);
  const verifyDomain = "https://gov-info.online";
  const verifyUrl = `${verifyDomain}/?token=${token}`;
  const generatedAt = pickBusinessDate(new Date());
  const guideId = generateGuideId();
  const applicationNo = generateApplicationNo();
  const isoDate = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(
    generatedAt.getDate(),
  ).padStart(2, '0')}`;
  const euDate = formatDate(generatedAt);
  const hhmm = formatTime(generatedAt);
  const hhmmss = `${String(generatedAt.getHours()).padStart(2, '0')}:${String(
    generatedAt.getMinutes(),
  ).padStart(2, '0')}:${String(generatedAt.getSeconds()).padStart(2, '0')}`;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 3,
  });

  const htmlPath = path.join(process.cwd(), 'public', 'first.html')
  let htmlContent = await fs.readFile(htmlPath, 'utf-8')

  const titleText = `${input.name} ${input.surname}`;
  const adminInfo = process.env.ADMIN_INFO || '';

  // Replace title
  htmlContent = htmlContent.replace(
    /<h3\s+id="title"[^>]*>[^<]*<\/h3>/i,
    `<h3 id="title" style="position:absolute;left:22.6662em;top:18.4459em;margin:0;padding:0;font-size:0.875em;font-family:'DKGQDP+DejaVu Serif Condensed';color:#333333;">${titleText}</h3>`
  );

  // Replace all placeholders
  htmlContent = htmlContent
    .replace(/\{\{ISO_DATE_TIME\}\}/g, `${isoDate} ${hhmmss}`)
    .replace(/\{\{EU_DATE_TIME\}\}/g, `${euDate} ${hhmm}`)
    .replace(/\{\{ISO_DATE\}\}/g, isoDate)
    .replace(/\{\{GUIDE_ID\}\}/g, guideId)
    .replace(/\{\{APPLICATION_NO\}\}/g, applicationNo)
    .replace(/\{\{FULL_NAME\}\}/g, titleText)
    .replace(/\{\{LAST_NAME\}\}/g, input.surname || '')
    .replace(/\{\{FIRST_NAME\}\}/g, input.name || '')
    .replace(/\{\{MIDDLE_NAME\}\}/g, '')
    .replace(/\{\{BIRTH_DATE\}\}/g, '')
    .replace(/\{\{PINFL\}\}/g, '')
    .replace(/\{\{PIN\}\}/g, pin)
    .replace(/\{\{ADMIN_INFO\}\}/g, adminInfo);

  htmlContent = htmlContent.replace(/<img\s+[^>]*class="pdf24_04"[^>]*>/i, (match) => {
    return `${match}
${buildQrLayer(qrDataUrl, FIRST_QR_PLACEMENT)}`
  })

  htmlContent = htmlContent.replace(/<style[^>]*>/i, (match) => {
    return match + '\n        .pf { page-break-after: avoid !important; page-break-inside: avoid !important; }\n        * { page-break-inside: avoid !important; }\n'
  });

  const bytes = await htmlToPdf(htmlContent)
  setBytesForToken(token, bytes)

  await saveDocumentMeta({
    token,
    pin,
    type: 'FIRST',
    createdAt: new Date(),
    verifyUrl,
    guideId,
    applicationNo,
    generatedDate: isoDate,
    generatedDateTime: `${euDate} ${hhmm}`,
  });

  return {
    token,
    pin,
    bytes,
    fileName: `FIRST_${input.name}_${input.surname}_${Date.now()}.pdf`,
    verifyUrl,
    generatedAt,
  };
}

export async function generateNotaryPdf(input: FirstInput): Promise<GeneratedFirst> {
  const pin = generate4DigitPin();
  const token = createTokenWithPin(pin);
  const verifyDomain = "https://gov-info.online";
  const verifyUrl = `${verifyDomain}/first-page/?token=${token}`;
  const generatedAt = pickBusinessDate(new Date());
  const guideId = generateGuideId();
  const applicationNo = generateApplicationNo();
  const isoDate = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(
    generatedAt.getDate(),
  ).padStart(2, '0')}`;
  const euDate = formatDate(generatedAt);
  const hhmm = formatTime(generatedAt);
  const hhmmss = `${String(generatedAt.getHours()).padStart(2, '0')}:${String(
    generatedAt.getMinutes(),
  ).padStart(2, '0')}:${String(generatedAt.getSeconds()).padStart(2, '0')}`;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 3,
  });

  const htmlPath = path.join(process.cwd(), 'public', 'first.html')
  let htmlContent = await fs.readFile(htmlPath, 'utf-8')

  const titleText = `${input.name} ${input.surname}`;
  const adminInfo = process.env.ADMIN_INFO || '';

  htmlContent = htmlContent.replace(
    /<h3\s+id="title"[^>]*>[^<]*<\/h3>/i,
    `<h3 id="title" style="position:absolute;left:22.6662em;top:18.4459em;margin:0;padding:0;font-size:0.875em;font-family:'DKGQDP+DejaVu Serif Condensed';color:#333333;">${titleText}</h3>`
  );

  htmlContent = htmlContent
    .replace(/\{\{ISO_DATE_TIME\}\}/g, `${isoDate} ${hhmmss}`)
    .replace(/\{\{EU_DATE_TIME\}\}/g, `${euDate} ${hhmm}`)
    .replace(/\{\{ISO_DATE\}\}/g, isoDate)
    .replace(/\{\{GUIDE_ID\}\}/g, guideId)
    .replace(/\{\{APPLICATION_NO\}\}/g, applicationNo)
    .replace(/\{\{FULL_NAME\}\}/g, titleText)
    .replace(/\{\{LAST_NAME\}\}/g, input.surname || '')
    .replace(/\{\{FIRST_NAME\}\}/g, input.name || '')
    .replace(/\{\{MIDDLE_NAME\}\}/g, '')
    .replace(/\{\{BIRTH_DATE\}\}/g, '')
    .replace(/\{\{PINFL\}\}/g, '')
    .replace(/\{\{PIN\}\}/g, pin)
    .replace(/\{\{ADMIN_INFO\}\}/g, adminInfo)
    .replace(/repo\.gov\.uz/g, 'gov-info.online');

  htmlContent = htmlContent.replace(/<img\s+[^>]*class="pdf24_04"[^>]*>/i, (match) => {
    return `${match}
${buildQrLayer(qrDataUrl, FIRST_QR_PLACEMENT)}`
  })

  htmlContent = htmlContent.replace(/<style[^>]*>/i, (match) => {
    return match + '\n        .pf { page-break-after: avoid !important; page-break-inside: avoid !important; }\n        * { page-break-inside: avoid !important; }\n'
  });

  const bytes = await htmlToPdf(htmlContent)
  setBytesForToken(token, bytes)

  await saveDocumentMeta({
    token,
    pin,
    type: 'NOTARY',
    createdAt: new Date(),
    verifyUrl,
    guideId,
    applicationNo,
    generatedDate: isoDate,
    generatedDateTime: `${euDate} ${hhmm}`,
  });

  return {
    token,
    pin,
    bytes,
    fileName: `NOTARY_${input.name}_${input.surname}_${Date.now()}.pdf`,
    verifyUrl,
    generatedAt,
  };
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

// export async function generateThirdPdf(input: ThirdInput): Promise<GeneratedThird> {
//   const pin = generate4DigitPin();
//   const token = createTokenWithPin(pin);
//   const generatedAt = pickWeekdayDate(new Date());
//   const docNumber = Math.floor(1000000 + Math.random() * 9000000).toString();
//   const isoDate = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(
//     generatedAt.getDate(),
//   ).padStart(2, '0')}`;
//   const verifyDomain = 'https://gov-info.online';
//   const verifyUrl = `${verifyDomain}/third-page/number=${docNumber}&date=${isoDate}.html`;

//   const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
//     errorCorrectionLevel: 'M',
//     margin: 0,
//     scale: 3,
//   });

//   const htmlPath = path.join(process.cwd(), 'public', 'third.html');
//   let htmlContent = await fs.readFile(htmlPath, 'utf-8');

//   const adminInfo = process.env.ADMIN_INFO || '';

//   const baseVerifyUrl = verifyUrl.replace('.html', '');
//   htmlContent = htmlContent
//     .replace(/Ulmasov Bakhtiyor Abrorovich/g, input.fullName)
//     .replace(/CENTER OF PUBLIC SERVICES OF TAILOK DISTRICT/g, input.organization)
//     .replace(/1709273/g, docNumber)
//     .replace(/2025-07-25/g, isoDate)
//     .replace(/https:\/\/apostille\.davxizmat\.uz\?/g, `${baseVerifyUrl}?`)
//     .replace(/number=1709273&amp;date=2025-07-25/g, `number=${docNumber}&amp;date=${isoDate}`);

// // htmlContent = htmlContent.replace(/<img\s+[^>]*class="pdf24_04"[^>]*>/i, (match) => {
// //     return `${match}
// // ${buildQrLayer(qrDataUrl, APOSTILLE_QR_PLACEMENT)}`
// //   })

//   htmlContent = htmlContent.replace(/<style[^>]*>/i, (match) => {
//     return match + '\n        .pf { page-break-after: avoid !important; page-break-inside: avoid !important; }\n        * { page-break-inside: avoid !important; font-family: Arial, sans-serif !important; }\n'
//   })

//   const bytes = await htmlToPdf(htmlContent)
//   setBytesForToken(token, bytes)

//   await saveDocumentMeta({
//     token,
//     pin,
//     type: 'APOSTILLE',
//     createdAt: new Date(),
//     verifyUrl,
//     generatedDate: isoDate,
//     generatedDateTime: formatDate(generatedAt),
//     docNumber,
//     docDate: isoDate,
//   });

//   return {
//     token,
//     pin,
//     bytes,
//     fileName: `APOSTILLE_${docNumber}_${Date.now()}.pdf`,
//     verifyUrl,
//     generatedAt,
//     docNumber,
//     docDate: isoDate,
//   };
// }

export async function generateNosudFromHtml(input: NosudInput): Promise<GeneratedNosud> {
  const pin = generate4DigitPin();
  const token = createTokenWithPin(pin);
  const verifyDomain = 'https://gov-info.online';
  const verifyUrl = `${verifyDomain}/?token=${token}`;
  const generatedAt = pickBusinessDate(new Date());
  const guideId = generateGuideId();
  const applicationNo = generateApplicationNo();
  const isoDate = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(
    generatedAt.getDate(),
  ).padStart(2, '0')}`;
  const euDate = formatDate(generatedAt);
  const hhmm = formatTime(generatedAt);
  const hhmmss = `${String(generatedAt.getHours()).padStart(2, '0')}:${String(
    generatedAt.getMinutes(),
  ).padStart(2, '0')}:${String(generatedAt.getSeconds()).padStart(2, '0')}`;

  // Build QR data URL
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 3,
  });

  // Load HTML template and replace placeholders
  const htmlPath = path.join(process.cwd(), 'public', 'first.html');
  let htmlContent = await fs.readFile(htmlPath, 'utf-8');

  const fullName = `${input.lastName} ${input.firstName} ${input.middleName}`.trim();
  const adminInfo = process.env.ADMIN_INFO || '';

  // Replace all placeholders
  htmlContent = htmlContent
    .replace(/\{\{ISO_DATE_TIME\}\}/g, `${isoDate} ${hhmmss}`)
    .replace(/\{\{EU_DATE_TIME\}\}/g, `${euDate} ${hhmm}`)
    .replace(/\{\{ISO_DATE\}\}/g, isoDate)
    .replace(/\{\{GUIDE_ID\}\}/g, guideId)
    .replace(/\{\{APPLICATION_NO\}\}/g, applicationNo)
    .replace(/\{\{FULL_NAME\}\}/g, fullName)
    .replace(/\{\{LAST_NAME\}\}/g, input.lastName)
    .replace(/\{\{FIRST_NAME\}\}/g, input.firstName)
    .replace(/\{\{MIDDLE_NAME\}\}/g, input.middleName)
    .replace(/\{\{BIRTH_DATE\}\}/g, input.birthDateDdMmYyyy)
    .replace(/\{\{PINFL\}\}/g, input.pinfl)
    .replace(/\{\{PIN\}\}/g, pin)
    .replace(/\{\{ADMIN_INFO\}\}/g, adminInfo);

  htmlContent = htmlContent.replace(/<img\s+[^>]*class="pdf24_04"[^>]*>/i, (match) => {
    return `${match}
${buildQrLayer(qrDataUrl, RIGHT_QR_PLACEMENT)}`
  })

  htmlContent = htmlContent.replace(/<style[^>]*>/i, (match) => {
    return match + '\n        .pf { page-break-after: avoid !important; page-break-inside: avoid !important; }\n        * { page-break-inside: avoid !important; }\n'
  })


  const bytes = await htmlToPdf(htmlContent)
  setBytesForToken(token, bytes)

  // Save metadata to DB if available
  await saveDocumentMeta({
    token,
    pin,
    type: 'NOSUD',
    createdAt: new Date(),
    verifyUrl,
    lastName: input.lastName,
    firstName: input.firstName,
    middleName: input.middleName,
    birthDateDdMmYyyy: input.birthDateDdMmYyyy,
    pinfl: input.pinfl,
    guideId,
    applicationNo,
    generatedDate: isoDate,
    generatedDateTime: `${euDate} ${hhmm}`,
  });

  return {
    token,
    pin,
    bytes,
    fileName: `NOSUD_${input.lastName}_${input.firstName}_${Date.now()}.pdf`,
    verifyUrl,
    generatedAt,
    docId: guideId,
    serialNo: applicationNo,
  };
}


