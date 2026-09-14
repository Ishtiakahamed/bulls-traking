const express = require('express');
const router = express.Router();
const { getPresales } = require('../services/presaleService');

router.get('/presales', (req, res) => {
  try {
    const { launchpad, chain } = req.query;
    const presales = getPresales({ launchpad, chain });
    res.json({ success: true, count: presales.length, data: presales });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
