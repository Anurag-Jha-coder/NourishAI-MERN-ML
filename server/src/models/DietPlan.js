const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  name:    String,
  kcal:    Number,
  protein: Number,
  carbs:   Number,
  fat:     Number,
  portion: String,
}, { _id: false });

const mealSchema = new mongoose.Schema({
  type:      { type: String, enum: ['breakfast','lunch','snack','dinner'] },
  foods:     [foodItemSchema],
  totalKcal: Number,
}, { _id: false });

const dietPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  profile: {
    name:             String,
    age:              Number,
    gender:           String,
    weight:           Number,
    height:           Number,
    activityLevel:    Number,
    goal:             { type: String, enum: ['loss','maintain','gain'] },
    region:           String,
    health_condition: { type: String, default: 'none' },
    dietType:         String,
    allergies:        [String],
  },

  // ML outputs
  bmi:          Number,
  bmiCategory:  String,
  baseKcal:     Number,
  targetKcal:   Number,
  dietCategory: String,          // weight_loss / muscle_gain / maintenance / medical_diet
  mlSource:     String,          // 'ml_model' | 'fallback_formula'

  // The 3 plan variants generated
  plans: [{
    title:        String,
    meals:        [mealSchema],
    totalProtein: Number,
    totalCarbs:   Number,
    totalFat:     Number,
    totalKcal:    Number,
  }],

  // Feedback
  rating:             { type: Number, min: 1, max: 5, default: null },
  feedback:           { type: String, default: '' },
  isSaved:            { type: Boolean, default: false },
  feedback_submitted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('DietPlan', dietPlanSchema);
