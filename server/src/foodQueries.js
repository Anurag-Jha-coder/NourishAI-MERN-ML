const Food = require('./models/Food');

/**
 * SAMPLE QUERY 1: Get weight-loss foods
 * Finds low-calorie foods with the weight-loss tag, sorted by protein (desc)
 */
async function getWeightLossFoods() {
  const foods = await Food.find({
    health_tags: 'weight-loss',
    calories: { $lt: 150 },
    category: { $in: ['vegetable', 'protein', 'fruit'] }
  })
  .sort({ protein: -1 })
  .limit(10);
  
  return foods;
}

/**
 * SAMPLE QUERY 2: Get high-protein Indian foods
 * Finds foods mapped to Indian regions with high protein content
 */
async function getHighProteinIndianFoods() {
  const foods = await Food.find({
    region: { $in: ['india', 'north_india', 'south_india'] },
    health_tags: 'high-protein',
    protein: { $gt: 15 } // Greater than 15g protein
  })
  .sort({ protein: -1 })
  .limit(10);
  
  return foods;
}

/**
 * SAMPLE QUERY 3: Get breakfast items under 300 calories
 * Perfect for generating the morning meal plan
 */
async function getLowCalorieBreakfast() {
  const foods = await Food.find({
    meal_type: 'breakfast',
    calories: { $lt: 300 },
    diet_type: { $in: ['veg', 'vegan'] } // Example: user is vegetarian
  })
  .sort({ calories: 1 })
  .limit(10);
  
  return foods;
}

/**
 * SAMPLE QUERY 4: Get a balanced diabetic-friendly dinner
 * Low carb, low sugar, high fiber options for dinner
 */
async function getDiabeticFriendlyDinner() {
  const foods = await Food.find({
    meal_type: 'dinner',
    glycemic_index: 'low',
    health_tags: 'diabetes-friendly'
  })
  .sort({ fiber: -1 })
  .limit(10);
  
  return foods;
}

module.exports = {
  getWeightLossFoods,
  getHighProteinIndianFoods,
  getLowCalorieBreakfast,
  getDiabeticFriendlyDinner
};
