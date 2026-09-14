const express = require('express');
const router = express.Router();
const { handleGetPromotions, handleCreatePromotionOrder } = require('../controllers/promotionController');

router.get('/promoted', handleGetPromotions);
router.post('/promotions/order', handleCreatePromotionOrder);

module.exports = router;
