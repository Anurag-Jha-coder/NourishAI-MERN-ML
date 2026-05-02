const router = require('express').Router();
const { generateList, togglePurchased, exportPDF } = require('../controllers/shoppingController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/generate', generateList);
router.patch('/:listId/toggle/:itemIndex', togglePurchased);
router.get('/:listId/export', exportPDF);

module.exports = router;
