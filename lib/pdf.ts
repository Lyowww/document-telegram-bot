import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTokenWithPin, setBytesForToken } from './store';
import { saveDocumentMeta } from './documents';

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
  const day = d.getDay();
  if (day === 0) {
    d.setDate(d.getDate() - 2);
  } else if (day === 6) {
    d.setDate(d.getDate() - 1);
  }
  const hour = 8 + Math.floor(Math.random() * 11);
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  d.setHours(hour, minute, second, 0);
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
  return Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
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
  } catch {}

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
      } catch {}
    }
    return null;
  }

  const unicodeRegular = await tryEmbedUnicodeFont([
    'NotoSans-Regular.ttf',
    'DejaVuSans.ttf',
  ]);
  const unicodeBold = await tryEmbedUnicodeFont([
    'NotoSans-Bold.ttf',
    'DejaVuSans-Bold.ttf',
  ]);

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = unicodeRegular ?? helvetica;
  const fontBold = unicodeBold ?? unicodeRegular ?? helveticaBold;

  let y = page.getSize().height - margin;
  const replaceNonWinAnsiIfNeeded = (s: string): string => {
    // If we have a unicode-capable font, keep original text
    if (unicodeRegular || unicodeBold) return s;
    // Fallback: replace characters outside 0x00-0xFF (WinAnsi) to avoid encoding errors
    return Array.from(s)
      .map((ch) => (ch.codePointAt(0)! <= 0xff ? ch : '?'))
      .join('');
  };

  const line = (text: string, bold = false, size = 12) => {
    y -= size + 6;
    page.drawText(replaceNonWinAnsiIfNeeded(text), {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
      maxWidth: width - margin * 2,
      lineHeight: size + 4,
    });
  };

  line('Справка о несудимости — сведения', true, 16);
  line(`ФИО: ${input.lastName} ${input.firstName} ${input.middleName}`);
  line(`Дата рождения: ${input.birthDateDdMmYyyy}`);
  line(`ПИНФЛ: ${input.pinfl}`);
  line(`Документ №: ${docId}`);
  line(`Серийный №: ${serialNo}`);
  line(`Дата и время генерации: ${formatDate(generatedAt)} ${formatTime(generatedAt)}`);
  line(`(дублируется) ${formatDate(generatedAt)} ${formatTime(generatedAt)}`);
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
  const pin = generatePin();
  const token = createTokenWithPin(pin);
  const baseUrl = getBaseUrl();
  const verifyUrl = `${baseUrl}/verify/${token}`;

  // Read the HTML template and inject dynamic title
  const htmlPath = path.join(process.cwd(), 'public', 'first.html');
  let htmlContent = await fs.readFile(htmlPath, 'utf-8');
  const titleText = `${input.name} ${input.surname}`;
  htmlContent = htmlContent.replace(
    /<h3\s+id="title"[^>]*>[^<]*<\/h3>/i,
    `<h3 id="title">${titleText}</h3>`
  );

  // Convert HTML to PDF via Pdfcrowd API
  const pdfcrowdUser = process.env.PDFCROWD_USERNAME || 'demo';
  const pdfcrowdKey = process.env.PDFCROWD_APIKEY || 'demo';
  const basicAuth = Buffer.from(`${pdfcrowdUser}:${pdfcrowdKey}`, 'utf-8').toString('base64');

  const form = new FormData();
  form.append('content_viewport_width', 'balanced');
  const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
  form.append('file', htmlBlob, 'first.html');

  const response = await fetch('https://api.pdfcrowd.com/convert/24.04/', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Pdfcrowd conversion failed: ${response.status} ${response.statusText} ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  setBytesForToken(token, bytes);

  return {
    token,
    pin,
    bytes,
    fileName: `FIRST_${input.name}_${input.surname}_${Date.now()}.pdf`,
    verifyUrl,
    generatedAt: new Date(),
  };
}

export async function generateNosudFromHtml(input: NosudInput): Promise<GeneratedNosud> {
  // Generate identifiers and times per requirements
  const pin = generate4DigitPin();
  const token = createTokenWithPin(pin);
  const baseUrl = getBaseUrl();
  const verifyUrl = `${baseUrl}/verify/${token}`;
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
    scale: 6,
  });

  // Load HTML template and replace known anchors
  const htmlPath = path.join(process.cwd(), 'public', 'first.html');
  let htmlContent = await fs.readFile(htmlPath, 'utf-8');

  // Replace top-right timestamps/dates
  htmlContent = htmlContent.replace(
    />\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*</,
    `>${isoDate} ${hhmmss}<`,
  );
  htmlContent = htmlContent.replace(/>\s*\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}\s*</, `>${euDate} ${hhmm}<`);

  // Replace header meta
  htmlContent = htmlContent.replace(/>№\s*[^<]+</, `>№ ${guideId}<`);
  htmlContent = htmlContent.replace(/>Дата создания документа:\s*\d{4}-\d{2}-\d{2}</, `>Дата создания документа: ${isoDate}<`);
  htmlContent = htmlContent.replace(/>Номер заявки:\s*\d+</, `>Номер заявки: ${applicationNo}<`);

  // Replace recipient full name and pinfl in header
  const fullName = `${input.lastName} ${input.firstName} ${input.middleName}`.trim();
  htmlContent = htmlContent.replace(/>Документ выдан:\s*[^<]+</, `>Документ выдан: ${fullName}<`);
  htmlContent = htmlContent.replace(/>ПИНФЛ:\s*\d{14}</, `>ПИНФЛ: ${input.pinfl}<`);

  // Replace details section values (last/first/middle, birth date, pinfl)
  htmlContent = htmlContent
    .replace(/>MARDIYEV</g, `>${input.lastName}<`)
    .replace(/>XUSEN</g, `>${input.firstName}<`)
    .replace(/>MANSUROVICH</g, `>${input.middleName}<`)
    .replace(/>01\.09\.1998</g, `>${input.birthDateDdMmYyyy}<`)
    .replace(/>30109986180092</g, `>${input.pinfl}<`);

  // Swap the first embedded PNG data URL (QR) with our QR image
  htmlContent = htmlContent.replace(/src="data:image\/png;base64,[A-Za-z0-9+/=]+"/, `src="${qrDataUrl}"`);

  // Convert HTML to PDF via Pdfcrowd API
  const pdfcrowdUser = process.env.PDFCROWD_USERNAME || 'demo';
  const pdfcrowdKey = process.env.PDFCROWD_APIKEY || 'demo';
  const basicAuth = Buffer.from(`${pdfcrowdUser}:${pdfcrowdKey}`, 'utf-8').toString('base64');
  const form = new FormData();
  form.append('content_viewport_width', 'balanced');
  const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
  form.append('file', htmlBlob, 'nosud.html');
  const response = await fetch('https://api.pdfcrowd.com/convert/24.04/', {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth}` },
    body: form,
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Pdfcrowd conversion failed: ${response.status} ${response.statusText} ${errText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  setBytesForToken(token, bytes);

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


