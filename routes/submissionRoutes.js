const express = require('express');
const router = express.Router();
const { createSubmission, getSubmissionStatus } = require('../services/submissionService');

router.post('/submissions', (req, res) => {
  try {
    const result = createSubmission(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/submissions/:id/status', (req, res) => {
  try {
    const status = getSubmissionStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
