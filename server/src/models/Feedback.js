const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  dietPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DietPlan',
    required: true,
    index: true,
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },

  foods_eaten:   { type: [String], default: [] },
  foods_skipped: { type: [String], default: [] },

  goal_progress: {
    weight_change_kg: { type: Number, default: null },   // optional, can be negative
    energy_level:     { type: Number, min: 1, max: 5, default: null },
    hunger_level:     { type: Number, min: 1, max: 5, default: null },
  },

  // Denormalised copy of the user profile at submission time (used for ML retraining)
  profile_snapshot: {
    age:              Number,
    gender:           String,
    weight:           Number,
    height:           Number,
    activity:         Number,
    goal:             String,
    health_condition: { type: String, default: 'none' },
    region:           String,
    dietType:         String,
  },

  actual_diet_category: { type: String, default: null },   // optional override

  created_at: { type: Date, default: Date.now },
});

// Compound index so we can quickly query feedback per user+profile type
feedbackSchema.index({ user: 1, 'profile_snapshot.goal': 1, 'profile_snapshot.dietType': 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
