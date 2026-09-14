const express = require('express');
const router = express.Router();
const { handleCreateSubmission, handleGetSubmission } = require('../controllers/submissionController');

router.post('/submissions', handleCreateSubmission);
router.get('/submissions/:id', handleGetSubmission);

module.exports = router;
