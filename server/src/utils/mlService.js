/**
 * mlService.js
 * ─────────────────────────────────────────────────────────────
 * Calls the Python Flask ML microservice for calorie prediction
 * and diet category classification.
 *
 * Falls back to the Harris-Benedict formula if the ML service
 * is unavailable, so the Node app never crashes.
 */

const http = require('http');
const https = require('https');

const ML_HOST = process.env.ML_HOST || 'localhost';
const ML_PORT = process.env.ML_PORT || 5001;

/**
 * Send a POST request to the ML service.
 * Returns parsed JSON or throws.
 */
function callML(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const isLocal = ML_HOST === 'localhost' || ML_HOST === '127.0.0.1';
    const client = isLocal ? http : https;
    const port = isLocal ? ML_PORT : 443;
    
    const options = {
      hostname: ML_HOST,
      port:     port,
      path,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 5000,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('ML service returned invalid JSON'));
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('ML service timeout')); });
    req.on('error',   (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

/**
 * Harris-Benedict fallback (used if ML service is down).
 */
function fallbackCalories(profile) {
  const { age, gender, weight, height, activity, goal, health_condition } = profile;

  let bmr;
  if (gender === 'm' || gender === 1) {
    bmr = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  } else {
    bmr = 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
  }

  const tdee = bmr * parseFloat(activity);
  const goalAdj = goal === 'loss' ? -400 : goal === 'gain' ? 400 : 0;
  const condAdj = { diabetes: -150, hypertension: -100, thyroid: -200, pcos: -250 }[health_condition] || 0;
  const bmi = weight / Math.pow(height / 100, 2);
  const bmiAdj = bmi < 18.5 ? 300 : bmi < 25 ? 0 : bmi < 30 ? -200 : -400;

  return Math.round(Math.max(1000, Math.min(4500, tdee + goalAdj + condAdj + bmiAdj)));
}

/**
 * Main export: getPrediction
 * ─────────────────────────────────────────────────────────────
 * @param {Object} profile  - user profile from the request body
 * @returns {Object}        - { calories, diet_category, bmi, macros, source, ... }
 */
async function getPrediction(profile) {
  const bmi = parseFloat(
    (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1)
  );

  try {
    // Call ML microservice
    const result = await callML('/predict', {
      age:              profile.age,
      gender:           profile.gender,
      weight:           profile.weight,
      height:           profile.height,
      activity:         profile.activity,
      goal:             profile.goal,
      health_condition: profile.health_condition || 'none',
      region:           profile.region,
    });

    if (!result.success) throw new Error(result.error || 'ML prediction failed');

    return {
      ...result,
      source: 'ml_model',
      ml_available: true,
    };

  } catch (err) {
    // Graceful fallback
    console.warn(`⚠️  ML service unavailable (${err.message}). Using fallback.`);

    const calories = fallbackCalories(profile);
    const goal = profile.goal || 'maintain';

    const dietCategory =
      bmi < 18.5 || goal === 'gain' ? 'muscle_gain' :
      goal === 'loss' && bmi >= 25  ? 'weight_loss' :
      (profile.health_condition && profile.health_condition !== 'none') ? 'medical_diet' :
      'maintenance';

    const splits = {
      weight_loss:  { protein_pct: 35, carbs_pct: 35, fat_pct: 30 },
      muscle_gain:  { protein_pct: 40, carbs_pct: 40, fat_pct: 20 },
      maintenance:  { protein_pct: 30, carbs_pct: 45, fat_pct: 25 },
      medical_diet: { protein_pct: 25, carbs_pct: 50, fat_pct: 25 },
    };
    const split = splits[dietCategory];

    return {
      success:       true,
      bmi,
      calories,
      diet_category: dietCategory,
      confidence:    null,
      macros: {
        protein_g:   Math.round((calories * split.protein_pct / 100) / 4),
        carbs_g:     Math.round((calories * split.carbs_pct   / 100) / 4),
        fat_g:       Math.round((calories * split.fat_pct     / 100) / 9),
        ...split,
      },
      advice: {
        bmi_advice:       bmi < 18.5 ? 'BMI below healthy range — calorie surplus added.' :
                          bmi < 25   ? 'BMI in healthy range.' :
                          bmi < 30   ? 'BMI above healthy range — deficit applied.' :
                                       'Obese BMI — larger deficit applied.',
        goal_advice:      `Target: ${calories} kcal/day for ${goal}.`,
        condition_advice: '',
      },
      source:        'fallback_formula',
      ml_available:  false,
    };
  }
}

module.exports = { getPrediction };
