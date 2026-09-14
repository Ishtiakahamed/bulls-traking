const { processSubmission, getSubmissionById } = require('../services/submissionService');

async function handleCreateSubmission(req, res, next) {
  try {
    const result = await processSubmission(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function handleGetSubmission(req, res, next) {
  try {
    const submission = getSubmissionById(req.params.id);
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    res.json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleCreateSubmission,
  handleGetSubmission
};
