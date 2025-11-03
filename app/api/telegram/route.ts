import { NextResponse } from 'next/server';
import {
  TelegramUpdate,
  sendMessage,
  answerCallbackQuery,
  mainMenuKeyboard,
  backKeyboard,
  getState,
  setState,
  validateNosudInput,
  validateApostilleInput,
  validateFirstInput,
  MESSAGES,
  sendDocument,
} from '@/lib/telegram';
import { generateNosudPdf, parseNosudText, generateFirstPdf, parseFirstText } from '@/lib/pdf';

export const runtime = 'nodejs';

const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET as string | undefined;

export async function POST(request: Request) {
  if (SECRET_TOKEN) {
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    if (header !== SECRET_TOKEN) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' }, { status: 500 });
  }

  const update = (await request.json()) as TelegramUpdate;

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id;
      const data = cq.data;
      if (chatId && data) {
        switch (data) {
          case 'MENU_NOSUD': {
            setState(chatId, { mode: 'AWAIT_NOSUD_INPUT' });
            await sendMessage(chatId, MESSAGES.firstPrompt, { reply_markup: backKeyboard() });
            break;
          }
          case 'MENU_NOTARY': {
            setState(chatId, { mode: 'AWAIT_NOTARY_INPUT' });
            break;
          }
          case 'MENU_APOSTILLE': {
            setState(chatId, { mode: 'AWAIT_APOSTILLE_INPUT' });
            await sendMessage(chatId, MESSAGES.apostillePrompt, { reply_markup: backKeyboard() });
            break;
          }
          case 'BACK_TO_MENU': {
            setState(chatId, { mode: 'IDLE' });
            await sendMessage(chatId, MESSAGES.welcome, { reply_markup: mainMenuKeyboard() });
            break;
          }
        }
        await answerCallbackQuery(cq.id);
      }
      return NextResponse.json({ ok: true });
    }

    if (update.message && update.message.text) {
      const { chat, text } = update.message;
      const chatId = chat.id;

      if (text === '/admin') {
        setState(chatId, { mode: 'IDLE' });
        await sendMessage(chatId, MESSAGES.welcome, { reply_markup: mainMenuKeyboard() });
        return NextResponse.json({ ok: true });
      }

      if (text === '/start') {
        setState(chatId, { mode: 'IDLE' });
        await sendMessage(chatId, MESSAGES.welcome, { reply_markup: mainMenuKeyboard() });
        return NextResponse.json({ ok: true });
      }

      const state = getState(chatId);

      if (state.mode !== 'AWAIT_APOSTILLE_INPUT' && validateFirstInput(text)) {
        try {
          const parsed = parseFirstText(text);
          const pdf = await generateFirstPdf(parsed);
          await sendDocument(chatId, pdf.bytes, pdf.fileName, {
            caption: `Документ сформирован. PIN: ${pdf.pin}\nQR-ссылка: ${pdf.verifyUrl}`,
            reply_markup: backKeyboard(),
          });
          await sendMessage(chatId, MESSAGES.welcome, { reply_markup: mainMenuKeyboard() });
          setState(chatId, { mode: 'IDLE' });
        } catch (err: any) {
          await sendMessage(chatId, `Ошибка при отправке документа: ${err?.message ?? 'неизвестная ошибка'}`);
        }
        return NextResponse.json({ ok: true });
      }
      if (state.mode === 'AWAIT_NOSUD_INPUT') {
        if (!validateFirstInput(text)) {
          await sendMessage(chatId, MESSAGES.firstInvalid, { reply_markup: backKeyboard() });
        } else {
          await sendMessage(chatId, "Документ First сформирован");
          try {
            const parsed = parseFirstText(text);
            const pdf = await generateFirstPdf(parsed);
            await sendDocument(chatId, pdf.bytes, pdf.fileName, {
              caption: `Документ сформирован. PIN: ${pdf.pin}\nQR-ссылка: ${pdf.verifyUrl}`,
              reply_markup: backKeyboard(),
            });
            await sendMessage(chatId, MESSAGES.welcome, { reply_markup: mainMenuKeyboard() });
            setState(chatId, { mode: 'IDLE' });
          } catch (err: any) {
            await sendMessage(chatId, `Ошибка при отправке документа: ${err?.message ?? 'неизвестная ошибка'}`);
          }
        }
        return NextResponse.json({ ok: true });
      }

      if (state.mode === 'AWAIT_APOSTILLE_INPUT') {
        if (!validateApostilleInput(text)) {
          await sendMessage(chatId, MESSAGES.apostilleInvalid, { reply_markup: backKeyboard() });
        } else {
          setState(chatId, { mode: 'IDLE' });
        }
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}


