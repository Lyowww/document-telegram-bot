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
  MESSAGES,
  sendDocument,
} from '@/lib/telegram';
import { generateNosudPdf, parseNosudText } from '@/lib/pdf';

export const runtime = 'nodejs';

const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET as string | undefined;

export async function POST(request: Request) {
  // Optional security: verify Telegram secret token header if provided
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
    // Handle callback buttons
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id;
      const data = cq.data;
      if (chatId && data) {
        switch (data) {
          case 'MENU_NOSUD': {
            setState(chatId, { mode: 'AWAIT_NOSUD_INPUT' });
            await sendMessage(chatId, MESSAGES.nosudPrompt, { reply_markup: backKeyboard() });
            break;
          }
          case 'MENU_NOTARY': {
            setState(chatId, { mode: 'AWAIT_NOTARY_INPUT' });
            // Intentionally no message; user will implement later.
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

    // Handle messages
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

      // Fallback: process valid NOSUD input even if state was lost (e.g., serverless cold start)
      if (state.mode !== 'AWAIT_APOSTILLE_INPUT' && validateNosudInput(text)) {
        try {
          const parsed = parseNosudText(text);
          const pdf = await generateNosudPdf(parsed);
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
        if (!validateNosudInput(text)) {
          await sendMessage(chatId, MESSAGES.nosudInvalid, { reply_markup: backKeyboard() });
        } else {
          await sendMessage(chatId, "Справка о несудимости сформирована");
          try {
            const parsed = parseNosudText(text);
            const pdf = await generateNosudPdf(parsed);
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
          // Correct format received for "Апостиль".
          // TODO: implement your logic here (generation, storage, etc.)
          // You can change this comment to your processing implementation.
          setState(chatId, { mode: 'IDLE' });
        }
        return NextResponse.json({ ok: true });
      }

      // If user is in IDLE or NOTARY flow, do nothing special
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


