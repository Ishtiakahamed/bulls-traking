'use strict';

const https = require('https');
const crypto = require('crypto');
const { execute, queryOne } = require('../../database/db');

function getConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_PRIMARY_CHAT_ID || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    required: process.env.TELEGRAM_PRIMARY_REQUIRED === 'true'
  };
}

function isConfigured() {
  const { token, chatId } = getConfig();
  return Boolean(token && chatId);
}

function requestTelegram(method, payload) {
  const { token } = getConfig();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 10000
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch (_) {
          return reject(new Error(`Telegram returned invalid JSON (${res.statusCode})`));
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300 || !parsed.ok) {
          return reject(new Error(parsed.description || `Telegram API error (${res.statusCode})`));
        }
        resolve(parsed.result);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Telegram API request timed out')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function stableRecordHash(kind, record) {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ kind, record }))
    .digest('hex');
}

function formatRecord(kind, record, hash) {
  const safe = {
    schema: 'bulls-traking.telegram-primary.v1',
    kind,
    record,
    record_hash: hash,
    created_at: new Date().toISOString()
  };
  return [
    `BT_PRIMARY_RECORD ${kind}`,
    `hash: ${hash}`,
    '```json',
    JSON.stringify(safe, null, 2),
    '```'
  ].join('\n');
}

async function appendRecord(kind, record, { replyToMessageId = null } = {}) {
  const config = getConfig();
  const hash = stableRecordHash(kind, record);
  if (!isConfigured()) {
    if (config.required) throw new Error('Telegram primary store is required but not configured');
    return { configured: false, status: 'not_configured', recordHash: hash };
  }
  const payload = {
    chat_id: config.chatId,
    text: formatRecord(kind, record, hash),
    disable_web_page_preview: true
  };
  if (replyToMessageId) payload.reply_parameters = { message_id: Number(replyToMessageId) };
  const sent = await requestTelegram('sendMessage', payload);
  const messageId = sent.message_id;
  return {
    configured: true,
    status: 'sent',
    chatId: String(config.chatId),
    messageId: Number(messageId),
    recordHash: hash,
    telegramDate: sent.date || null
  };
}

function saveOrderTelegramReference(table, orderId, result) {
  if (!result || !result.configured || !result.messageId) return;
  const allowed = new Set(['promotion_orders', 'banner_orders']);
  if (!allowed.has(table)) throw new Error('Invalid Telegram order table');
  execute(`UPDATE ${table}
    SET telegram_chat_id = ?, telegram_message_id = ?, telegram_record_hash = ?, telegram_sync_status = 'sent'
    WHERE id = ?`, [result.chatId, result.messageId, result.recordHash, orderId]);
}

function getOrderReference(table, orderId) {
  const allowed = new Set(['promotion_orders', 'banner_orders']);
  if (!allowed.has(table)) throw new Error('Invalid Telegram order table');
  return queryOne(`SELECT telegram_chat_id, telegram_message_id, telegram_record_hash, telegram_sync_status FROM ${table} WHERE id = ?`, [orderId]);
}

function verifyWebhookSecret(provided) {
  const expected = getConfig().webhookSecret;
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  getConfig,
  isConfigured,
  appendRecord,
  saveOrderTelegramReference,
  getOrderReference,
  verifyWebhookSecret,
  requestTelegram
};
