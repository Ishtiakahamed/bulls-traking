const express = require('express');
const router = express.Router();
const { processSubmission, getSubmissionById } = require('../backend/services/submissionService');

router.post('/submissions', async (req, res) => {
  try {
    const result = await processSubmission(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get(['/submissions/:id/status', '/submissions/:id'], (req, res) => {
  try {
    const status = getSubmissionById(req.params.id);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
