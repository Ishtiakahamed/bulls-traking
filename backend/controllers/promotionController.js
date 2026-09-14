const { getActivePromotions, createPromotionOrder } = require('../services/promotionService');

function handleGetPromotions(req, res, next) {
  try {
    const promotions = getActivePromotions();
    res.json({ success: true, count: promotions.length, data: promotions });
  } catch (err) {
    next(err);
  }
}

function handleCreatePromotionOrder(req, res, next) {
  try {
    const result = createPromotionOrder(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleGetPromotions,
  handleCreatePromotionOrder
};
