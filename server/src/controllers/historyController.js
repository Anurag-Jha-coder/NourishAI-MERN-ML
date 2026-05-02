const DietPlan = require('../models/DietPlan');

// GET /api/history
exports.getHistory = async (req, res) => {
  try {
    const plans = await DietPlan.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('profile bmi bmiCategory targetKcal baseKcal plans isSaved rating feedback createdAt');

    res.json({ success: true, count: plans.length, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/history/:id
exports.getPlan = async (req, res) => {
  try {
    const plan = await DietPlan.findOne({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/history/:id
exports.deletePlan = async (req, res) => {
  try {
    const plan = await DietPlan.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.json({ success: true, message: 'Plan deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
