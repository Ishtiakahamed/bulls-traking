const config = require('../../config/default');

/**
 * Algorithmic Hot Score Calculation (Section 13)
 * Formula: volume_score + momentum_score + price_change_score + activity_score
 */
function calculateHotScore(token) {
  const weights = config.hotScoreWeights;

  const volume = token.volume_24h || 0;
  const change24h = Math.abs(token.change_24h || 0);
  const change1h = Math.abs(token.change_1h || 0);
  const marketCap = token.market_cap || 1;

  // 1. Volume Score (logarithmic scaling, max 100)
  const volScore = Math.min(100, (Math.log10(Math.max(1, volume)) / 8) * 100);

  // 2. Momentum Score (short-term 1h and 24h velocity)
  const momentumScore = Math.min(100, (change1h * 5) + (change24h * 1.5));

  // 3. Price Change Score (magnitude of 24h price action)
  const priceChangeScore = Math.min(100, change24h * 2);

  // 4. Turnover / Activity Ratio (24h volume relative to market cap)
  const turnoverRatio = marketCap > 0 ? (volume / marketCap) : 0;
  const activityScore = Math.min(100, turnoverRatio * 200);

  // Composite Weighted Hot Score
  const score = (
    (volScore * weights.volumeWeight) +
    (momentumScore * weights.momentumWeight) +
    (priceChangeScore * weights.priceChangeWeight) +
    (activityScore * weights.activityWeight)
  );

  return parseFloat(Math.min(99.9, Math.max(10.0, score)).toFixed(1));
}

module.exports = {
  calculateHotScore
};
