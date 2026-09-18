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

router.get('/promoted', handleGetPromotions);
router.get('/promotions', handleGetPromotions);
router.get('/promotions/packages', handleGetPackages);
router.get('/promotions/orders/:id', handleGetPromotionOrder);
router.post('/promotions/order', handleCreatePromotionOrder);
router.post('/promotions/orders', handleCreatePromotionOrder);
router.post('/promotions/verify-tx', handleVerifyTransaction);
router.post('/promotions/webhook', handleGatewayWebhook);

module.exports = router;
