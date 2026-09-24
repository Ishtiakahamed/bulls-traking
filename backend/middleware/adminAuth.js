/**
 * Bulls Traking — Centralized Admin Authentication Middleware
 * Enforces timing-safe comparison, returning 401 when key is missing and 403 when invalid.
 */

const crypto = require('crypto');

function verifyAdminSecret(providedKey) {
  const secret = process.env.ADMIN_API_KEY || 'Ishtiak734@';
  if (!secret || !providedKey || typeof providedKey !== 'string') return false;
  const a = Buffer.from(providedKey);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requireAdminAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key || req.query.key;

  if (!adminKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: valid x-admin-key header required'
    });
  }

  if (!verifyAdminSecret(adminKey)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: invalid x-admin-key'
    });
  }

  next();
}

module.exports = {
  verifyAdminSecret,
  requireAdminAuth
};
