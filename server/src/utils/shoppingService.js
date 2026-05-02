const Food = require('../models/Food');

// Conversion map: generic food terms to units
const UNIT_CONVERSIONS = {
  'rice': { unit: 'grams', perUnit: 1 },
  'roti': { unit: 'pieces', perUnit: 40 }, // 40g per piece
  'chapati': { unit: 'pieces', perUnit: 40 },
  'dal': { unit: 'grams', perUnit: 1 }, // raw dal
  'milk': { unit: 'litres', perUnit: 1000 },
  'curd': { unit: 'grams', perUnit: 1 },
  'paneer': { unit: 'grams', perUnit: 1 },
  'chicken': { unit: 'grams', perUnit: 1 },
  'egg': { unit: 'pieces', perUnit: 50 }, // 50g per egg
  'oil': { unit: 'litres', perUnit: 900 },
  'apple': { unit: 'pieces', perUnit: 150 },
  'banana': { unit: 'pieces', perUnit: 120 },
};

// Hardcoded price map (price per 100g or per piece/litre depending on base unit)
// We will store prices per 100g for gram-based items, per piece for piece-based, etc.
const PRICE_MAP_INR = {
  'rice': 6,       // 60 per kg -> 6 per 100g
  'roti': 5,       // 5 per piece
  'chapati': 5,    // 5 per piece
  'dal': 12,       // 120 per kg -> 12 per 100g
  'milk': 60,      // 60 per litre
  'curd': 10,      // 100 per kg -> 10 per 100g
  'paneer': 35,    // 350 per kg -> 35 per 100g
  'chicken': 25,   // 250 per kg -> 25 per 100g
  'egg': 7,        // 7 per piece
  'oil': 150,      // 150 per litre
  'apple': 20,     // 20 per piece
  'banana': 5,     // 5 per piece
  'default_grams': 10,  // fallback: 10 INR per 100g
  'default_pieces': 10, // fallback: 10 INR per piece
  'default_litres': 100 // fallback: 100 INR per litre
};

// Map typical words to categories
function guessCategory(foodName) {
  const n = foodName.toLowerCase();
  if (n.includes('chicken') || n.includes('egg') || n.includes('mutton') || n.includes('fish') || n.includes('prawn')) return 'proteins';
  if (n.includes('paneer') || n.includes('milk') || n.includes('curd') || n.includes('lassi') || n.includes('buttermilk')) return 'dairy';
  if (n.includes('rice') || n.includes('roti') || n.includes('chapati') || n.includes('naan') || n.includes('dalia') || n.includes('oats') || n.includes('bread') || n.includes('poha')) return 'grains';
  if (n.includes('dal') || n.includes('chana') || n.includes('rajma') || n.includes('chole') || n.includes('moong')) return 'proteins'; // plant proteins
  if (n.includes('apple') || n.includes('banana') || n.includes('fruit')) return 'fruits';
  if (n.includes('oil') || n.includes('butter') || n.includes('ghee')) return 'fats';
  if (n.includes('masala') || n.includes('spice')) return 'spices';
  if (n.includes('water') || n.includes('tea') || n.includes('coffee') || n.includes('juice')) return 'beverages';
  return 'vegetables'; // fallback
}

exports.generateShoppingList = async (dietPlan) => {
  // 1. Loop all meals in all 3 plans, extract food items with estimated grams
  const rawItems = [];
  
  const plansToLoop = dietPlan.plans && dietPlan.plans.length > 0 ? dietPlan.plans : [{ meals: dietPlan.meals }];

  for (const plan of plansToLoop) {
    if (!plan.meals) continue;
    for (const meal of plan.meals) {
      for (const food of meal.foods) {
        // Estimate grams based on macros: (protein + carbs + fat) * 2.5 for cooked weight
        const dryWeight = (food.protein || 0) + (food.carbs || 0) + (food.fat || 0);
        let estimatedGrams = Math.round(dryWeight * 2.5);
        if (estimatedGrams < 10) estimatedGrams = 100; // fallback if macros are missing

        rawItems.push({
          name: food.name,
          grams: estimatedGrams
        });
      }
    }
  }

  // 2. Aggregate duplicates by summing grams
  const aggregatedMap = {};
  for (const item of rawItems) {
    // clean up name slightly to aggregate variations
    const cleanName = item.name.toLowerCase().replace(/\([^)]*\)/g, '').trim();
    if (!aggregatedMap[cleanName]) {
      aggregatedMap[cleanName] = { name: item.name, grams: 0, cleanName };
    }
    aggregatedMap[cleanName].grams += item.grams;
  }

  // 3 & 4. Convert grams to purchase units & group by category
  const groupedItems = [];
  let totalCost = 0;

  for (const key in aggregatedMap) {
    const item = aggregatedMap[key];
    let unit = 'grams';
    let quantity = item.grams;
    let matchedKey = 'default_grams';

    // Find if we have a conversion for this item
    for (const convKey in UNIT_CONVERSIONS) {
      if (item.cleanName.includes(convKey)) {
        unit = UNIT_CONVERSIONS[convKey].unit;
        quantity = Math.ceil(item.grams / UNIT_CONVERSIONS[convKey].perUnit);
        matchedKey = convKey;
        break;
      }
    }

    // 5. Estimate cost
    let cost = 0;
    if (unit === 'grams') {
      const pricePer100g = PRICE_MAP_INR[matchedKey] || PRICE_MAP_INR['default_grams'];
      cost = (quantity / 100) * pricePer100g;
    } else if (unit === 'pieces') {
      const pricePerPiece = PRICE_MAP_INR[matchedKey] || PRICE_MAP_INR['default_pieces'];
      cost = quantity * pricePerPiece;
    } else if (unit === 'litres') {
      const pricePerLitre = PRICE_MAP_INR[matchedKey] || PRICE_MAP_INR['default_litres'];
      cost = quantity * pricePerLitre;
    } else {
      cost = (quantity / 100) * PRICE_MAP_INR['default_grams']; // fallback
    }

    cost = Math.round(cost);
    totalCost += cost;

    groupedItems.push({
      food_name: item.name,
      quantity: quantity,
      unit: unit,
      category: guessCategory(item.cleanName),
      region: dietPlan.profile?.region || 'global',
      estimated_cost_inr: cost,
      is_purchased: false
    });
  }

  return {
    items: groupedItems,
    total_estimated_cost: totalCost
  };
};
