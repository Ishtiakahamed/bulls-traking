const express = require('express');
const router = express.Router();
const {
  handleGetPromotions,
  handleCreatePromotionOrder,
  handleGetPromotionOrder,
  handleGetPackages,
  handleVerifyTransaction,
  handleGatewayWebhook
} = require('../controllers/promotionController');
const { strictLimiter } = require('../middleware/rateLimiters');

router.get(['/promoted', '/promotions', '/promotions/active', '/promotion/active'], handleGetPromotions);
router.get('/promotions/packages', handleGetPackages);
router.get('/promotions/orders/:id', handleGetPromotionOrder);
router.post('/promotions/order', strictLimiter, handleCreatePromotionOrder);
router.post('/promotions/orders', strictLimiter, handleCreatePromotionOrder);
router.post('/promotions/verify-tx', handleVerifyTransaction);
router.post('/promotions/webhook', handleGatewayWebhook);

module.exports = router;
