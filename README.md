This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Telegram Bot Webhook Setup

1. Create a bot via `@BotFather` and copy the token.
2. Copy `.env.example` to `.env.local` and set `TELEGRAM_BOT_TOKEN` and optionally `TELEGRAM_WEBHOOK_SECRET`.
3. Deploy your app to a public HTTPS URL and set the webhook:

```bash
TOKEN="<your_bot_token>"
APP_URL="<your_public_app_url>" # e.g. https://your-domain.com
SECRET="<same_as_TELEGRAM_WEBHOOK_SECRET>"

curl -s "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -d "url=${APP_URL}/api/telegram" \
  -d "secret_token=${SECRET}"
```

4. Test by sending `/admin` to your bot. You should see the main menu with three buttons.

### Flows Implemented
- `/admin`: Shows a welcome message and three selection buttons.
- `1️⃣ Справка о несудимости`: Prompts for comma-separated input and validates format. If invalid, shows a warning with the required format. On valid input, no further action is taken (add your logic where marked in code).
- `2️⃣ Нотариус`: Reserved; no behavior implemented (stub state only).
- `3️⃣ Апостиль`: Prompts for comma-separated input and validates format. If invalid, shows a warning. On valid input, no further action is taken (add your logic where marked in code).
