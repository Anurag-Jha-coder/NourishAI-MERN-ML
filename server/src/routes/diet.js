const router   = require('express').Router();
const { generate, savePlan, addFeedback, mlStatus, markFeedbackSubmitted } = require('../controllers/dietController');
const { protect } = require('../middleware/auth');

const optionalAuth = (req, res, next) => {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return protect(req, res, next);
  next();
};

router.get('/ml-status',           mlStatus);
router.post('/generate',           optionalAuth, generate);
router.post('/save',               protect, savePlan);
router.post('/:id/feedback',       protect, addFeedback);
router.patch('/:id/mark-feedback', protect, markFeedbackSubmitted);

module.exports = router;
