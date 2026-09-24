const express = require('express');
const router = express.Router();
const { handleCreateSubmission, handleGetSubmission } = require('../controllers/submissionController');
const { strictLimiter } = require('../middleware/rateLimiters');

router.post('/submissions', strictLimiter, handleCreateSubmission);
router.get(['/submissions/:id', '/submissions/:id/status'], handleGetSubmission);

module.exports = router;
