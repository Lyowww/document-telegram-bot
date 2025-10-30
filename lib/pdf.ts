import { PDFDocument, StandardFonts, rgb, PDFEmbeddedFont } from 'pdf-lib';
import QRCode from 'qrcode';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTokenWithPin, setBytesForToken } from './store';

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
  async function tryEmbedUnicodeFont(candidates: string[]): Promise<PDFEmbeddedFont | null> {
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


