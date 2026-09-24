const express = require('express');
const router = express.Router();
const { getNewPairs, discoverGeckoTerminalPools } = require('../services/newPairsService');
const { pollNewLaunches } = require('../services/stonkfunService');

router.get('/new-pairs', async (req, res) => {
  try {
    const { chain, source, limit, offset, page, refresh } = req.query;
    if (refresh === '1' || refresh === 'true') {
      try {
        await Promise.allSettled([
          Promise.race([
            pollNewLaunches(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
          ]),
          Promise.race([
            discoverGeckoTerminalPools(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
          ])
        ]);
      } catch (_) {}
    }
    const status = req.query.status || req.query.tab || 'latest';
    const result = getNewPairs({ chain, status, source, limit, offset, page });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
