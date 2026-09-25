'use strict';

const express = require('express');
const router = express.Router();
const { queryOne } = require('../../database/db');
const { requestTelegram, verifyWebhookSecret, getConfig } = require('../services/telegramPrimaryStore');
const { activatePromotionOrder } = require('../../services/adminService');
const { activateBannerOrder } = require('../services/bannerService');

function allowedAdmin(userId) {
  const raw = process.env.TELEGRAM_ADMIN_USER_IDS || '';
  return raw.split(',').map(v => v.trim()).filter(Boolean).includes(String(userId));
}

async function reply(chatId, text, replyTo) {
  if (!chatId) return;
  try {
    await requestTelegram('sendMessage', {
      chat_id: chatId,
      text,
      reply_parameters: replyTo ? { message_id: Number(replyTo) } : undefined,
      disable_web_page_preview: true
    });
  } catch (err) {
    console.warn('[Telegram Bot Reply]', err.message);
  }
}

router.post('/telegram/webhook', async (req, res) => {
  const providedSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (!verifyWebhookSecret(providedSecret)) {
    return res.status(401).json({ success: false, error: 'Invalid Telegram webhook secret' });
  }
  res.sendStatus(200);

  const update = req.body || {};
  const message = update.message || update.edited_message;
  if (!message || !message.text) return;
  const fromId = message.from && message.from.id;
  if (!allowedAdmin(fromId)) {
    await reply(message.chat && message.chat.id, 'Unauthorized. This bot accepts commands only from configured administrators.', message.message_id);
    return;
  }

  const match = message.text.trim().match(/^\/(activate|approve|reject)\s+(promotion|banner)\s+(\d+)(?:\s+(.+))?$/i);
  if (!match) {
    await reply(message.chat && message.chat.id, 'Commands: /activate promotion <order_id> [note] or /activate banner <order_id> [note]', message.message_id);
    return;
  }
  const [, action, kind, id, note = 'Manual Telegram settlement verified'] = match;
  try {
    if (action.toLowerCase() === 'reject') {
      const table = kind.toLowerCase() === 'promotion' ? 'promotion_orders' : 'banner_orders';
      const exists = queryOne(`SELECT id FROM ${table} WHERE id = ?`, [Number(id)]);
      if (!exists) throw new Error(`Order #${id} not found`);
      if (table === 'promotion_orders') {
        require('../../database/db').execute("UPDATE promotion_orders SET payment_status = 'rejected', order_status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [Number(id)]);
      } else {
        require('../../database/db').execute("UPDATE banner_orders SET payment_status = 'rejected', approval_status = 'rejected' WHERE id = ?", [Number(id)]);
      }
      await reply(message.chat.id, `Order #${id} rejected.`, message.message_id);
      return;
    }
    const result = kind.toLowerCase() === 'promotion'
      ? activatePromotionOrder(`telegram:${fromId}`, Number(id))
      : activateBannerOrder(Number(id), `telegram:${fromId}`, note, 'telegram');
    await reply(message.chat.id, `${kind} order #${id} ${result.alreadyActive ? 'was already active' : 'is now active'}.`, message.message_id);
  } catch (err) {
    await reply(message.chat && message.chat.id, `Activation failed: ${err.message}`, message.message_id);
  }
});

router.get('/telegram/status', (req, res) => {
  const config = getConfig();
  res.json({
    success: true,
    configured: Boolean(config.token && config.chatId),
    required: config.required,
    webhookConfigured: Boolean(config.webhookSecret),
    mode: 'telegram_primary_immutable_ledger'
  });
});

module.exports = router;
