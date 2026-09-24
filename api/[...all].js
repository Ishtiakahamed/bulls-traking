/**
 * Bulls Traking — Vercel Serverless Function Catch-All Entrypoint
 * Handles all /api/* sub-routes (e.g. /api/home, /api/tokens, /api/banners/active, /api/promotions, etc.)
 * Natively mapped by Vercel serverless file-system routing without internal rewrites
 */
const handler = require('./index');

module.exports = (req, res) => {
  return handler(req, res);
};
