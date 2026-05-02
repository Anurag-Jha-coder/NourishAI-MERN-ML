const DietPlan          = require('../models/DietPlan');
const { getPrediction } = require('../utils/mlService');
const { filterAndBuild } = require('../utils/dietEngine');

exports.generate = async (req, res) => {
  try {
    const profile = req.body;
    const required = ['age', 'gender', 'weight', 'height', 'activity', 'goal', 'region', 'dietType'];
    for (const field of required) {
      if (profile[field] === undefined || profile[field] === '')
        return res.status(400).json({ success: false, message: `Missing field: ${field}` });
    }
    profile.allergies        = profile.allergies        || [];
    profile.health_condition = profile.health_condition || 'none';
    const mlResult = await getPrediction(profile);

    const plans = await filterAndBuild({
      targetKcal: mlResult.calories,
      dietType:   profile.dietType,
      allergies:  profile.allergies,
      region:     profile.region,
      healthCondition: profile.health_condition
    });

    const bmiCategory = mlResult.bmi < 18.5 ? 'Underweight' :
                        mlResult.bmi < 25   ? 'Normal'      :
                        mlResult.bmi < 30   ? 'Overweight'  : 'Obese';

    const responseData = {
      bmi: mlResult.bmi, bmiCategory,
      calories: mlResult.calories,
      dietCategory: mlResult.diet_category,
      confidence: mlResult.confidence,
      macros: mlResult.macros,
      advice: mlResult.advice,
      mlSource: mlResult.model || 'Formula',
      mlAvailable: !!mlResult.ml_available,
      modelR2: mlResult.model_r2  || null,
      modelMAE: mlResult.model_mae || null,
      plans: plans.plans,
      totalStats: plans.totalStats,
      profile,
    };

    if (req.user) {
      const saved = await DietPlan.create({
        user: req.user._id, profile,
        bmi: mlResult.bmi, bmiCategory,
        baseKcal: mlResult.calories, targetKcal: mlResult.calories,
        plans: plans.plans,
        mlSource: mlResult.model || 'Formula', dietCategory: mlResult.diet_category,
      });
      responseData.planId = saved._id;
    }
    return res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.savePlan = async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await DietPlan.findOneAndUpdate(
      { _id: planId, user: req.user._id }, { isSaved: true }, { new: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.json({ success: true, data: plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addFeedback = async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const plan = await DietPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id }, { rating, feedback }, { new: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.json({ success: true, data: plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.mlStatus = async (req, res) => {
  const http = require('http');
  const r = http.get(
    `http://${process.env.ML_HOST||'localhost'}:${process.env.ML_PORT||5001}/health`,
    (resp) => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => { try { res.json({ ml_online: true, info: JSON.parse(d) }); } catch { res.json({ ml_online: false }); } });
    }
  );
  r.on('error', () => res.json({ ml_online: false }));
  r.setTimeout(3000, () => { r.destroy(); res.json({ ml_online: false }); });
};

/**
 * PATCH /api/diet/:id/mark-feedback
 * Flips feedback_submitted = true on the plan.
 * Called by FeedbackWidget after a successful POST /api/feedback.
 */
exports.markFeedbackSubmitted = async (req, res) => {
  try {
    const plan = await DietPlan.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { feedback_submitted: true },
      { new: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.json({ success: true, feedback_submitted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

