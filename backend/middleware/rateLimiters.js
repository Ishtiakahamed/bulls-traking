const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

function isAdmin(req) {
  const secret = process.env.ADMIN_API_KEY;
  if (!secret) return false;
  const providedKey = req.headers['x-admin-key'] || req.headers['x-admin-token'] || req.query.admin_key || req.query.key || req.query.secret;
  if (!providedKey || typeof providedKey !== 'string') return false;
  const a = Buffer.from(providedKey);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const standardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 requests/minute/IP — generous for normal browsing/polling
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isAdmin(req) || process.env.NODE_ENV === 'test',
  message: { success: false, error: 'Too many requests, please try again in a minute.' }
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 requests/minute/IP — for endpoints that are expensive or writable
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isAdmin(req),
  message: { success: false, error: 'Too many requests for this resource, please try again later.' }
});

module.exports = {
  standardLimiter,
  strictLimiter
};
