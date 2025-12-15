import { getCollection } from './db';

export type DocumentType = 'NOSUD' | 'FIRST' | 'APOSTILLE' | 'NOTARY';

export type DocumentMeta = {
  token: string;
  pin: string; // For simplicity; can be hashed later
  type: DocumentType;
  createdAt: Date;
  verifyUrl: string;
  // Specific to NOSUD
  lastName?: string;
  firstName?: string;
  middleName?: string;
  birthDateDdMmYyyy?: string;
  pinfl?: string;
  guideId?: string;
  applicationNo?: string;
  generatedDate?: string; // YYYY-MM-DD
  generatedDateTime?: string; // DD.MM.YYYY HH:MM
  docNumber?: string;
  docDate?: string;
  notaryName?: string;
  translatorName?: string;
};

export async function saveDocumentMeta(meta: DocumentMeta): Promise<void> {
  try {
    const col = await getCollection<DocumentMeta>('documents');
    await col.insertOne(meta);
  } catch {
    // Fail silently if Mongo is not configured or unavailable
  }
}

export async function findDocumentByToken(token: string): Promise<DocumentMeta | null> {
  try {
    const col = await getCollection<DocumentMeta>('documents');
    return await col.findOne({ token });
  } catch {
    return null;
  }
}

export async function verifyPinForToken(token: string, pin: string): Promise<boolean> {
  try {
    const col = await getCollection<DocumentMeta>('documents');
    const doc = await col.findOne({ token }, { projection: { pin: 1 } });
    if (!doc) return false;
    return doc.pin === pin;
  } catch {
    return false;
  }
}

export async function findDocumentByNumberAndDate(docNumber: string, docDate: string): Promise<DocumentMeta | null> {
  try {
    const col = await getCollection<DocumentMeta>('documents');
    return await col.findOne({ docNumber, docDate, type: 'APOSTILLE' });
  } catch {
    return null;
  }
}


