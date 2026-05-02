const router = require('express').Router();
const { submitFeedback } = require('../controllers/feedbackController');
const { protect } = require('../middleware/auth');

// POST /api/feedback
router.post('/', protect, submitFeedback);

module.exports = router;
