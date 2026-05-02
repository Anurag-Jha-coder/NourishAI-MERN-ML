const router = require('express').Router();
const { getHistory, getPlan, deletePlan } = require('../controllers/historyController');
const { protect } = require('../middleware/auth');

router.use(protect);           // all history routes require login

router.get('/',       getHistory);
router.get('/:id',    getPlan);
router.delete('/:id', deletePlan);

module.exports = router;
