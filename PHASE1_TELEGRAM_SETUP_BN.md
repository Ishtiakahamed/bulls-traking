# Phase 1: Telegram Primary Ledger Setup

## উদ্দেশ্য

Bulls Traking-এর নতুন promotion এবং banner order প্রথমে Telegram private group-এ immutable bot message হিসেবে লেখা হবে। Website সেই message-এর `chat_id`, `message_id` এবং SHA-256 record hash সংরক্ষণ করবে। Admin Telegram command বা protected admin page ব্যবহার করে order activate করতে পারবেন। Payment settlement manual Telegram workflow-এই থাকবে।

## প্রয়োজনীয় Telegram setup

1. BotFather দিয়ে একটি bot তৈরি করুন।
2. Bot-কে private group-এ **administrator** করুন। Bot-এর message post এবং message read/update করার প্রয়োজনীয় permission দিন।
3. Private group-এর chat ID সংগ্রহ করুন।
4. Admin Telegram user ID সংগ্রহ করুন। Username নয়, numeric user ID ব্যবহার করুন।
5. Hosting environment-এ নিচের secret values configure করুন। এগুলো GitHub, chat বা frontend code-এ commit করবেন না।

```env
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_PRIMARY_CHAT_ID=YOUR_PRIVATE_GROUP_CHAT_ID
TELEGRAM_ADMIN_USER_IDS=123456789,987654321
TELEGRAM_WEBHOOK_SECRET=LONG_RANDOM_SECRET
TELEGRAM_PRIMARY_REQUIRED=true
```

## Webhook configure

Website deploy করার পর `YOUR_DEPLOYED_DOMAIN` দিয়ে নিচের command চালান:

```bash
curl -sS -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{
    "url":"https://YOUR_DEPLOYED_DOMAIN/api/telegram/webhook",
    "secret_token":"YOUR_TELEGRAM_WEBHOOK_SECRET",
    "allowed_updates":["message","edited_message"]
  }'
```

Token বা secret shell history-তে না রাখাই ভালো। নিরাপদ CI/CD secret বা hosting environment variable ব্যবহার করুন।

## Bot command

শুধুমাত্র `TELEGRAM_ADMIN_USER_IDS`-এ থাকা user command চালাতে পারবেন:

```text
/activate promotion 123 payment settled manually
/activate banner 456 payment settled manually
/approve promotion 123
/approve banner 456
/reject promotion 123 reason here
/reject banner 456 reason here
```

প্রতিটি activation idempotent। একই order আবার activate করলে নতুন promotion period তৈরি হবে না। Payment না মিটলে order `pending` থাকবে এবং public active API-তে দেখা যাবে না।

## গুরুত্বপূর্ণ সীমা

Telegram Bot API একটি সাধারণ SQL database-এর মতো group-এর পুরোনো সব message query করার সুবিধা দেয় না। তাই এই implementation-এ:

- প্রত্যেক order-এর immutable structured message তৈরি হয়।
- Message ID এবং record hash order record-এর সঙ্গে সংরক্ষিত হয়।
- Status transition আলাদা admin audit log-এ সংরক্ষিত হয়।
- ভুল করে original message delete করলে order reconciliation অসম্পূর্ণ হতে পারে; তাই group message delete permission সীমিত রাখুন।
- `TELEGRAM_PRIMARY_REQUIRED=true` production-এ সেট করলে bot বা group unavailable হলে নতুন order তৈরি হবে না।

## Health checks

```text
GET /api/telegram/status
POST /api/telegram/webhook
```

`/api/telegram/status`-এ `configured: true`, `required: true` এবং `webhookConfigured: true` দেখা গেলে integration configuration সম্পূর্ণ হয়েছে।

## Phase 1 removed pages

নিচের page, navigation, frontend renderer, active API route এবং obsolete tests সরানো হয়েছে:

- Hot Tokens / Hot Coins
- Watchlist
- Alpha Signals
- Contract Scanner

Shared token security validation এবং Telegram ingest service রাখা হয়েছে, কারণ retained token-submission ও background ingestion workflow এগুলো ব্যবহার করে।

## Local verification

```bash
npm install --no-audit --no-fund
npm test
```

Local environment-এ Telegram credentials না থাকলে `GET /api/telegram/status` configured false দেখাবে; production-এ credentials configure করার পর এটি true হবে।
