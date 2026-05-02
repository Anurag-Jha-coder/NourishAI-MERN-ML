const Feedback       = require('../models/Feedback');
const DietPlan       = require('../models/DietPlan');
const { addToQueue } = require('../utils/retrainQueue');

const RETRAIN_THRESHOLD = 50; // trigger retrain check after this many total docs

/**
 * POST /api/feedback
 * Saves detailed feedback and optionally triggers model retraining.
 */
exports.submitFeedback = async (req, res) => {
  try {
    const {
      dietPlanId,
      rating,
      foods_eaten    = [],
      foods_skipped  = [],
      goal_progress  = {},
      actual_diet_category,
    } = req.body;

    // ── Validation ─────────────────────────────────────────
    if (!dietPlanId) {
      return res.status(400).json({ success: false, message: 'dietPlanId is required.' });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'rating must be a number from 1 to 5.' });
    }

    // Validate optional goal_progress fields
    const { weight_change_kg, energy_level, hunger_level } = goal_progress;
    if (energy_level !== undefined && (energy_level < 1 || energy_level > 5)) {
      return res.status(400).json({ success: false, message: 'energy_level must be 1–5.' });
    }
    if (hunger_level !== undefined && (hunger_level < 1 || hunger_level > 5)) {
      return res.status(400).json({ success: false, message: 'hunger_level must be 1–5.' });
    }

    // ── Fetch the diet plan to build profile_snapshot ──────
    const plan = await DietPlan.findOne({ _id: dietPlanId, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Diet plan not found or not yours.' });
    }

    // Check not already submitted
    if (plan.feedback_submitted) {
      return res.status(409).json({ success: false, message: 'Feedback already submitted for this plan.' });
    }

    // Build denormalised profile snapshot from the saved plan
    const p = plan.profile || {};
    const profile_snapshot = {
      age:              p.age,
      gender:           p.gender,
      weight:           p.weight,
      height:           p.height,
      activity:         p.activityLevel || p.activity,
      goal:             p.goal,
      health_condition: p.health_condition || 'none',
      region:           p.region,
      dietType:         p.dietType,
    };

    // ── Save Feedback doc ──────────────────────────────────
    const feedback = await Feedback.create({
      user:     req.user._id,
      dietPlan: dietPlanId,
      rating,
      foods_eaten,
      foods_skipped,
      goal_progress: {
        weight_change_kg: weight_change_kg ?? null,
        energy_level:     energy_level     ?? null,
        hunger_level:     hunger_level     ?? null,
      },
      profile_snapshot,
      actual_diet_category: actual_diet_category || null,
    });

    // ── Mark feedback_submitted on the DietPlan ────────────
    await DietPlan.findByIdAndUpdate(dietPlanId, { feedback_submitted: true });

    // ── Check threshold → trigger retrain ──────────────────
    // Count feedback with a matching profile type (goal + dietType) for this user
    const profileFeedbackCount = await Feedback.countDocuments({
      'profile_snapshot.goal':     profile_snapshot.goal,
      'profile_snapshot.dietType': profile_snapshot.dietType,
    });

    const totalCount = await Feedback.countDocuments();

    console.log(
      `[Feedback] New submission. Profile-type count: ${profileFeedbackCount}, ` +
      `Total: ${totalCount}, Threshold: ${RETRAIN_THRESHOLD}`
    );

    if (totalCount >= RETRAIN_THRESHOLD) {
      console.log('[Feedback] Threshold crossed — queueing retrain.');
      await addToQueue({ triggeredBy: 'feedback_threshold', totalCount });
    }

    return res.status(201).json({
      success: true,
      message: 'Feedback saved. Thank you!',
      data: { feedbackId: feedback._id },
    });

  } catch (err) {
    console.error('submitFeedback error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
