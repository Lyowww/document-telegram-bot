import { NextResponse } from 'next/server';
import {
  TelegramUpdate,
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  mainMenuKeyboard,
  backKeyboard,
  getState,
  setState,
  validateNosudInput,
  validateApostilleInput,
  validateFirstInput,
  validateSecondInput,
  MESSAGES,
  sendDocument,
} from '@/lib/telegram';
import { generateNosudFromHtml, parseNosudText, generateFirstPdf, parseFirstText, generateNotaryPdf } from '@/lib/pdf';
import { generateThirdPdf, parseThirdText } from '@/lib/pdf2';
import { generateSecondPdf, parseSecondText } from '@/lib/pdf3';

export const runtime = 'nodejs';

const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET as string | undefined;

const ALLOWED_USER_IDS = [
  1297828858,
  766811959,
  1650034270,
  912958981,
  7510625398,
]

function isUserAllowed(userId: number | undefined): boolean {
  if (!userId) return false
  return ALLOWED_USER_IDS.includes(userId)
}

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
      const cq = update.callback_query
      const userId = cq.from?.id
      if (!isUserAllowed(userId)) {
        return NextResponse.json({ ok: true })
      }
      const chatId = cq.message?.chat.id;
      const messageId = cq.message?.message_id;
      const data = cq.data;
      if (chatId && messageId && data) {
        switch (data) {
          case 'MENU_NOSUD': {
            setState(chatId, { mode: 'AWAIT_NOSUD_INPUT' });
            await editMessageText(chatId, messageId, MESSAGES.nosudPrompt, { reply_markup: backKeyboard() });
            break;
          }
          case 'MENU_NOTARY': {
            try {
              const defaultInput = {
                notaryName: 'АЗИЗОВА ИНТИЗОРА ХУСЕНОВНА',
                translatorName: 'ТОХИРОВА НИГИНА САМЕЕВНА',
              };
              const pdf = await generateSecondPdf(defaultInput);
              await sendDocument(chatId, pdf.bytes, pdf.fileName);
              await sendMessage(chatId, MESSAGES.welcome, { reply_markup: mainMenuKeyboard() });
              setState(chatId, { mode: 'IDLE' });
            } catch (err: any) {
              await editMessageText(chatId, messageId, `Ошибка при генерации документа: ${err?.message ?? 'неизвестная ошибка'}`, { reply_markup: backKeyboard() });
            }
            break;
          }
          case 'MENU_APOSTILLE': {
            setState(chatId, { mode: 'AWAIT_APOSTILLE_INPUT' });
            await editMessageText(chatId, messageId, MESSAGES.apostillePrompt, { reply_markup: backKeyboard() });
            break;
          }
          case 'BACK_TO_MENU': {
            setState(chatId, { mode: 'IDLE' });
            await editMessageText(chatId, messageId, MESSAGES.welcome, { reply_markup: mainMenuKeyboard() });
            break;
          }
        }
        await answerCallbackQuery(cq.id);
      }
      return NextResponse.json({ ok: true });
    }

    if (update.message && update.message.text) {
      const userId = update.message.from?.id
      if (!isUserAllowed(userId)) {
        return NextResponse.json({ ok: true })
      }
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

      if (text === '/nosud' || text.toLowerCase() === 'nosud') {
        setState(chatId, { mode: 'AWAIT_NOSUD_INPUT' });
        await sendMessage(chatId, MESSAGES.nosudPrompt, { reply_markup: backKeyboard() });
        return NextResponse.json({ ok: true });
      }

      if (text === '/notary' || text.toLowerCase() === 'notary') {
        setState(chatId, { mode: 'AWAIT_SECOND_INPUT' });
        await sendMessage(chatId, MESSAGES.secondPrompt, { reply_markup: backKeyboard() });
        return NextResponse.json({ ok: true });
      }

      if (text === '/apostille' || text.toLowerCase() === 'apostille') {
        setState(chatId, { mode: 'AWAIT_APOSTILLE_INPUT' });
        await sendMessage(chatId, MESSAGES.apostillePrompt, { reply_markup: backKeyboard() });
        return NextResponse.json({ ok: true });
      }

      const state = getState(chatId);

      if (state.mode === 'IDLE' && validateFirstInput(text)) {
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
        if (!validateNosudInput(text)) {
          await sendMessage(chatId, MESSAGES.nosudInvalid, { reply_markup: backKeyboard() });
        } else {
          try {
            const parsed = parseNosudText(text);
            const pdf = await generateNosudFromHtml(parsed);
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

      if (state.mode === 'AWAIT_SECOND_INPUT') {
        if (!validateSecondInput(text)) {
          await sendMessage(chatId, MESSAGES.secondInvalid, { reply_markup: backKeyboard() });
        } else {
          try {
            const parsed = parseSecondText(text);
            const pdf = await generateSecondPdf(parsed);
            await sendDocument(chatId, pdf.bytes, pdf.fileName);
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
          try {
            const parsed = parseThirdText(text);
            const pdf = await generateThirdPdf(parsed);
            await sendDocument(chatId, pdf.bytes, pdf.fileName);
            await sendMessage(chatId, MESSAGES.welcome, { reply_markup: mainMenuKeyboard() });
            setState(chatId, { mode: 'IDLE' });
          } catch (err: any) {
            await sendMessage(chatId, `Ошибка при отправке документа: ${err?.message ?? 'неизвестная ошибка'}`);
          }
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


