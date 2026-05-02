const Food = require('../models/Food');

/**
 * Selects 2-4 foods to make up a meal that matches the slotTarget.
 * Uses a heuristic of main, side, and extra based on the meal type.
 */
function selectMealFoods(options, slotTarget, mealType) {
  if (!options || options.length === 0) return [];

  // Categorize options into roles
  const mains = options.filter(f => f.category === 'grain' || (mealType !== 'breakfast' && f.category === 'protein'));
  const sides = options.filter(f => f.category === 'vegetable' || (mealType === 'breakfast' && f.category === 'dairy') || (mealType !== 'breakfast' && f.category === 'protein'));
  const extras = options.filter(f => f.category === 'fruit' || f.category === 'dairy' || f.category === 'nut' || f.category === 'snack');

  // Fallback if categorization fails
  if (mains.length === 0) mains.push(...options);
  if (sides.length === 0) sides.push(...options);

  const selectedFoods = [];
  let currentKcal = 0;

  // 1. Pick a main food (~55% of calories)
  const targetMainKcal = slotTarget * 0.55;
  const mainCandidates = mains.sort((a, b) => Math.abs(a.calories - targetMainKcal) - Math.abs(b.calories - targetMainKcal)).slice(0, 5);
  const mainPick = mainCandidates[Math.floor(Math.random() * mainCandidates.length)];
  
  if (mainPick) {
    const scale = targetMainKcal / mainPick.calories;
    selectedFoods.push(formatFoodPortion(mainPick, scale));
    currentKcal += Math.round(mainPick.calories * scale);
  }

  // 2. Pick a side food (~30% of calories)
  const targetSideKcal = slotTarget * 0.30;
  // Remove already selected food from sides
  const availableSides = sides.filter(f => f.name !== mainPick?.name);
  if (availableSides.length > 0) {
    const sideCandidates = availableSides.sort((a, b) => Math.abs(a.calories - targetSideKcal) - Math.abs(b.calories - targetSideKcal)).slice(0, 5);
    const sidePick = sideCandidates[Math.floor(Math.random() * sideCandidates.length)];
    if (sidePick) {
      const scale = targetSideKcal / sidePick.calories;
      selectedFoods.push(formatFoodPortion(sidePick, scale));
      currentKcal += Math.round(sidePick.calories * scale);
    }
  }

  // 3. Pick an extra food if it's breakfast or snack, or if we are short on calories (~15%)
  const targetExtraKcal = slotTarget - currentKcal;
  if ((mealType === 'breakfast' || mealType === 'snack' || targetExtraKcal > 50) && extras.length > 0) {
    const availableExtras = extras.filter(f => !selectedFoods.some(sf => sf.name === f.name));
    if (availableExtras.length > 0) {
      const extraCandidates = availableExtras.sort((a, b) => Math.abs(a.calories - targetExtraKcal) - Math.abs(b.calories - targetExtraKcal)).slice(0, 5);
      const extraPick = extraCandidates[Math.floor(Math.random() * extraCandidates.length)];
      if (extraPick) {
        const scale = targetExtraKcal / extraPick.calories;
        // Don't add tiny insignificant extras
        if (scale > 0.2) {
            selectedFoods.push(formatFoodPortion(extraPick, scale));
        }
      }
    }
  }
  
  return selectedFoods;
}

function formatFoodPortion(food, scale) {
  return {
    name: food.name,
    kcal: Math.round(food.calories * scale),
    protein: Math.round(food.protein * scale),
    carbs: Math.round(food.carbs * scale),
    fat: Math.round(food.fat * scale),
    portion: scale > 1.4 ? `Large (×${scale.toFixed(1)})` : scale < 0.6 ? `Small (×${scale.toFixed(1)})` : 'Standard'
  };
}

/**
 * Builds a single daily plan (Breakfast, Lunch, Snack, Dinner).
 */
async function buildSinglePlan(query, targetKcal, safeAllergies) {
  const splits = { breakfast: 0.25, lunch: 0.35, snack: 0.10, dinner: 0.30 };
  const meals = [];
  let totalProtein = 0, totalCarbs = 0, totalFat = 0, totalKcal = 0;

  const allergyMap = {
    lactose: 'contains-lactose',
    gluten: 'contains-gluten',
    nuts: 'contains-nuts',
    soy: 'contains-soy'
  };
  const activeAllergenTags = safeAllergies.map(a => allergyMap[a] || a);

  for (const [mealType, ratio] of Object.entries(splits)) {
    const slotTarget = targetKcal * ratio;
    
    const mealQuery = { ...query, meal_type: mealType };

    // Find foods for this meal slot
    let foods = await Food.find(mealQuery).limit(100);

    // Fallback: Drop regional constraint if no foods found
    if (foods.length < 5 && mealQuery.region) {
      delete mealQuery.region;
      foods = await Food.find(mealQuery).limit(100);
    }

    // Fallback: Drop simplicity constraint if still nothing
    if (foods.length < 3 && mealQuery.$expr) {
      delete mealQuery.$expr;
      delete mealQuery.name;
      foods = await Food.find(mealQuery).limit(100);
    }

    // Filter out allergens
    if (activeAllergenTags.length > 0) {
      foods = foods.filter(f => !f.health_tags.some(tag => activeAllergenTags.includes(tag)));
    }

    // Pick best fit combination
    const selectedFoods = selectMealFoods(foods, slotTarget, mealType);
    
    if (selectedFoods.length > 0) {
      const mealKcal = selectedFoods.reduce((sum, f) => sum + f.kcal, 0);
      const mealProtein = selectedFoods.reduce((sum, f) => sum + f.protein, 0);
      const mealCarbs = selectedFoods.reduce((sum, f) => sum + f.carbs, 0);
      const mealFat = selectedFoods.reduce((sum, f) => sum + f.fat, 0);

      meals.push({
        type: mealType,
        totalKcal: mealKcal,
        foods: selectedFoods
      });

      totalProtein += mealProtein;
      totalCarbs   += mealCarbs;
      totalFat     += mealFat;
      totalKcal    += mealKcal;
    }
  }
  
  return { 
    meals, 
    totalProtein: Math.round(totalProtein), 
    totalCarbs: Math.round(totalCarbs), 
    totalFat: Math.round(totalFat), 
    totalKcal: Math.round(totalKcal) 
  };
}

async function filterAndBuild({ targetKcal, dietType, allergies, region, healthCondition }) {
  const safeAllergies = Array.isArray(allergies) ? allergies : [];

  // Base exclusion query (exclude beef, pork, and highly complex names)
  const baseQuery = {
    $expr: { $lt: [{ $strLenCP: "$name" }, 50] },
    name: { 
      $not: /beef|pork|veal|.*,.*,.*|\(.*,.*/i 
    }
  };

  // Health Condition specific filtering
  if (healthCondition === 'diabetes' || healthCondition === 'pcos') {
    baseQuery.glycemic_index = { $in: ['low', 'medium'] }; // Strictly avoid high GI foods
  } else if (healthCondition === 'hypertension') {
    // Exclude high-sodium/processed keywords
    baseQuery.name = { 
      $not: /beef|pork|veal|.*,.*,.*|\(.*,.*|chips|namkeen|pickle|canned|salted|processed|biscuit/i 
    };
  } else if (healthCondition === 'thyroid') {
    // Exclude raw cruciferous vegetables known to impact thyroid
    baseQuery.name = { 
      $not: /beef|pork|veal|.*,.*,.*|\(.*,.*|broccoli|cauliflower|cabbage|kale|brussels sprout|bok choy/i 
    };
  }

  if (dietType === 'vegan') {
    baseQuery.diet_type = 'vegan';
  } else if (dietType === 'veg' || dietType === 'eggetarian') {
    baseQuery.diet_type = { $in: ['veg', 'vegan'] };
  }

  // Plan 1: Regional Plan (Strictly matches the user's selected region)
  const plan1 = await buildSinglePlan({ ...baseQuery, region }, targetKcal, safeAllergies);
  plan1.title = "Regional Plan";

  // Plan 2: Global Option 1 (Drops the region constraint, picks globally)
  const plan2 = await buildSinglePlan(baseQuery, targetKcal, safeAllergies);
  plan2.title = "Global Plan 1";

  // Plan 3: Global Option 2 (Another variation)
  const plan3 = await buildSinglePlan(baseQuery, targetKcal, safeAllergies);
  plan3.title = "Global Plan 2";

  return {
    plans: [plan1, plan2, plan3],
    totalStats: {
      totalProtein: plan1.totalProtein,
      totalCarbs:   plan1.totalCarbs,
      totalFat:     plan1.totalFat,
      totalKcal:    plan1.totalKcal,
    },
  };
}

module.exports = { filterAndBuild };
