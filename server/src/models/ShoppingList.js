const mongoose = require('mongoose');

const shoppingItemSchema = new mongoose.Schema({
  food_name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { 
    type: String, 
    enum: ['grams', 'pieces', 'cups', 'litres', 'tablespoons'],
    required: true
  },
  category: { 
    type: String, 
    enum: ['vegetables', 'grains', 'proteins', 'dairy', 'fats', 'spices', 'fruits', 'beverages'],
    required: true
  },
  region: { type: String },
  estimated_cost_inr: { type: Number, default: 0 },
  is_purchased: { type: Boolean, default: false }
}, { _id: false });

const shoppingListSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dietPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'DietPlan', required: true },
  week_number: { type: Number, default: 1 },
  items: [shoppingItemSchema],
  total_estimated_cost: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ShoppingList', shoppingListSchema);
