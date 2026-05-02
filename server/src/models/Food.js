const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    unique: true 
  },
  calories: { 
    type: Number, 
    required: true 
  },
  protein: { 
    type: Number, 
    required: true 
  },
  carbs: { 
    type: Number, 
    required: true 
  },
  fat: { 
    type: Number, 
    required: true 
  },
  fiber: { 
    type: Number, 
    default: 0 
  },
  sugar: { 
    type: Number, 
    default: 0 
  },
  category: { 
    type: String, 
    enum: ['grain', 'protein', 'vegetable', 'fruit', 'dairy', 'snack', 'beverage', 'spice', 'oil', 'nut', 'other'],
    required: true 
  },
  diet_type: { 
    type: String, 
    enum: ['veg', 'non-veg', 'vegan'],
    required: true 
  },
  region: { 
    type: String, 
    enum: ['india', 'north_india', 'south_india', 'east_india', 'west_india', 'global'],
    default: 'global'
  },
  meal_type: { 
    type: [String], 
    enum: ['breakfast', 'lunch', 'dinner', 'snack', 'beverage'],
    required: true
  },
  health_tags: { 
    type: [String],
    index: true 
  },
  glycemic_index: { 
    type: String, 
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, { timestamps: true });

// Add indexes for fast querying based on user preferences and diet goals
foodSchema.index({ calories: 1 });
foodSchema.index({ protein: -1 });
foodSchema.index({ carbs: 1 });
foodSchema.index({ category: 1 });
foodSchema.index({ diet_type: 1 });
foodSchema.index({ region: 1 });

module.exports = mongoose.model('Food', foodSchema);
