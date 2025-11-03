/*
  Lightweight Telegram helpers for webhook-based bots.
  No external deps; uses global fetch available in Next.js runtime.
*/

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: { id: number; is_bot?: boolean; first_name?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number };
    };
    from: { id: number };
  };
};

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

function getTelegramApiBase(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN as string | undefined;
  if (!token) {
    // Throw to ensure callers don't silently no-op when token is missing
    throw new Error('Missing TELEGRAM_BOT_TOKEN');
  }
  return `https://api.telegram.org/bot${token}`;
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: { reply_markup?: InlineKeyboardMarkup; parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2' }
): Promise<void> {
  const api = getTelegramApiBase();
  const res = await fetch(`${api}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: options?.reply_markup,
      parse_mode: options?.parse_mode,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram sendMessage failed: ${res.status} ${res.statusText} ${body}`);
  }
}

export async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  const api = getTelegramApiBase();
  const res = await fetch(`${api}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram answerCallbackQuery failed: ${res.status} ${res.statusText} ${body}`);
  }
}

export async function sendDocument(
  chatId: number,
  bytes: Uint8Array,
  fileName: string,
  options?: { caption?: string; reply_markup?: InlineKeyboardMarkup }
): Promise<void> {
  const api = getTelegramApiBase();
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (options?.caption) form.append('caption', options.caption);
  if (options?.reply_markup) form.append('reply_markup', JSON.stringify(options.reply_markup));
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: 'application/pdf' });
  form.append('document', blob, fileName);
  const res = await fetch(`${api}/sendDocument`, {
    method: 'POST',
    body: form as any,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram sendDocument failed: ${res.status} ${res.statusText} ${body}`);
  }
}

export function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '1️⃣Справка о несудимости', callback_data: 'MENU_NOSUD' },
      ],
      [
        { text: '2️⃣Нотариус', callback_data: 'MENU_NOTARY' },
      ],
      [
        { text: '3️⃣Апостиль', callback_data: 'MENU_APOSTILLE' },
      ],
      [
        { text: '4️⃣First', callback_data: 'MENU_FIRST' },
      ],
    ],
  };
}

export function backKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: '🔙Назад', callback_data: 'BACK_TO_MENU' }]],
  };
}

// Simple per-chat state kept in-memory. Suitable for single-instance deployments.
// For serverless multi-instance, replace with durable storage (KV/DB).
type UserState =
  | { mode: 'IDLE' }
  | { mode: 'AWAIT_NOSUD_INPUT' }
  | { mode: 'AWAIT_APOSTILLE_INPUT' }
  | { mode: 'AWAIT_NOTARY_INPUT' } // reserved for future use
  | { mode: 'AWAIT_FIRST_INPUT' };

const chatIdToState = new Map<number, UserState>();

export function setState(chatId: number, state: UserState): void {
  chatIdToState.set(chatId, state);
}

export function getState(chatId: number): UserState {
  return chatIdToState.get(chatId) ?? { mode: 'IDLE' };
}

// Validators
const PINFL_REGEX = /^\d{14}$/;
const DATE_DDMMYYYY_REGEX = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}$/;

export function validateNosudInput(input: string): boolean {
  // Expect: LASTNAME, FIRSTNAME, MIDDLENAME, DD.MM.YYYY, PINFL
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 5) return false;
  const [last, first, middle, date, pinfl] = parts;
  if (!last || !first || !middle) return false;
  if (!DATE_DDMMYYYY_REGEX.test(date)) return false;
  if (!PINFL_REGEX.test(pinfl)) return false;
  return true;
}

export function validateApostilleInput(input: string): boolean {
  // Expect: Full Name, Organization
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return false;
  const [fullName, org] = parts;
  if (!fullName || !org) return false;
  // minimal additional sanity: name must include space(s)
  if (!/\s+/.test(fullName)) return false;
  return true;
}

export function validateFirstInput(input: string): boolean {
  // Expect: Name, Surname (at minimum)
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  const [name, surname] = parts;
  if (!name || !surname) return false;
  return true;
}

export const MESSAGES = {
  welcome:
    '👋 Добро пожаловать в бот генерации документов!\n\nВыберите, пожалуйста, тип документа, который хотите сформировать:',
  nosudPrompt:
    '📄Пожалуйста, введите через запятую следующие данные: Фамилия, Имя, Отчество, Дата рождения, ПИНФЛ\n\nПример: MARDIYEV, XUSEN, MANSUROVICH, 27.03.2000, 30109986180092',
  nosudInvalid:
    '⚠️Неверный формат. Введите все данные через запятую: Фамилия, Имя, Отчество, Дата рождения (ДД.ММ.ГГГГ), ПИНФЛ\n\nПример: MARDIYEV, XUSEN, MANSUROVICH, 27.03.2000, 30109986180092',
  apostillePrompt:
    '📄Пожалуйста, введите через запятую следующие данные: Ф.И.О. лица, подписавшего документ, и название организации\n\nПример: Ulmasov Bakhtiyor Abrorovich, CENTER OF PUBLIC SERVICES OF TAILOK DISTRICT',
  apostilleInvalid:
    '⚠️Неверный формат. Введите данные через запятую: Ф.И.О., Организация\n\nПример: Ulmasov Bakhtiyor Abrorovich, CENTER OF PUBLIC SERVICES OF TAILOK DISTRICT',
  firstPrompt:
    '📄Пожалуйста, введите через запятую следующие данные: Имя, Фамилия (и другие данные при необходимости)\n\nПример: John, Doe',
  firstInvalid:
    '⚠️Неверный формат. Введите данные через запятую: Имя, Фамилия\n\nПример: John, Doe',
};


