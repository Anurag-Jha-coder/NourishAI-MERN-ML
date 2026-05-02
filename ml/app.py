"""
app.py  —  NourishAI ML Microservice
────────────────────────────────────────────────────────────────
Flask REST API that serves predictions from trained ML models.
"""

import os, json, joblib, traceback
import numpy as np
from flask import Flask, request, jsonify

# ── Load models ───────────────────────────────────────────────
BASE    = os.path.dirname(__file__)
MDL_DIR = os.path.join(BASE, 'models')

print("Loading ML models…")
macro_regressor = joblib.load(os.path.join(MDL_DIR, 'macro_regressor.pkl'))
classifier      = joblib.load(os.path.join(MDL_DIR, 'diet_classifier.pkl'))
scaler          = joblib.load(os.path.join(MDL_DIR, 'scaler.pkl'))
label_encoder   = joblib.load(os.path.join(MDL_DIR, 'label_encoder.pkl'))
feature_names   = joblib.load(os.path.join(MDL_DIR, 'feature_names.pkl'))

with open(os.path.join(MDL_DIR, 'model_metrics.json')) as f:
    model_metrics = json.load(f)

print("✅ All models loaded")

app = Flask(__name__)

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    return jsonify({
        'status':   'ok',
        'service':  'NourishAI ML Microservice',
        'models':   ['macro_regressor (XGBoost)', 'diet_classifier (XGBoost)'],
        'metrics_summary': {
            'macro_regression_r2':    model_metrics.get('regression', {}).get('r2'),
            'classifier_accuracy':    model_metrics.get('classification', {}).get('accuracy'),
        }
    })

def engineer_features(data: dict):
    goal_map = {'loss': -1, 'maintain': 0, 'gain': 1}
    cond_map = {'none': 0, 'diabetes': 1, 'hypertension': 2, 'thyroid': 3, 'pcos': 4}
    reg_map  = {'north_india': 0, 'south_india': 1, 'west_india': 2, 'east_india': 3}
    gen_map  = {'f': 0, 'm': 1, 'female': 0, 'male': 1, '0': 0, '1': 1}

    age      = float(data.get('age',      30))
    gender   = float(gen_map.get(str(data.get('gender', 'f')).lower(), 0))
    weight   = float(data.get('weight',   65))
    height   = float(data.get('height',   165))
    activity = float(data.get('activity', 1.55))

    goal_raw  = str(data.get('goal', 'maintain')).lower()
    cond_raw  = str(data.get('health_condition', 'none')).lower()
    reg_raw   = str(data.get('region', 'north_india')).lower()

    bmi      = round(weight / (height / 100) ** 2, 2)
    goal_enc = goal_map.get(goal_raw,  0)
    cond_enc = cond_map.get(cond_raw,  0)
    reg_enc  = reg_map.get(reg_raw,    0)

    bmi_sq        = bmi ** 2
    age_activity  = age * activity
    weight_height = weight / height
    age_group     = min(int((age - 18) // 10), 4)

    features = np.array([[
        age, gender, weight, height, bmi,
        activity, goal_enc, cond_enc, reg_enc,
        bmi_sq, age_activity, weight_height, age_group
    ]])

    return features, bmi, age, gender, weight, height, activity, goal_raw, cond_raw

def calculate_calories(age, gender, weight, height, activity, goal):
    # Mifflin-St Jeor Equation
    if gender == 1:
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5
    else:
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161
    
    tdee = bmr * activity
    
    if goal == 'loss':
        return tdee - 500
    elif goal == 'gain':
        return tdee + 300
    return tdee

def build_advice(bmi, diet_category, calories, goal, health_condition):
    bmi_note = (
        "Your BMI is below the healthy range — a calorie surplus is recommended." if bmi < 18.5 else
        "Your BMI is in the healthy range. Focus on maintaining it." if bmi < 25 else
        "Your BMI is above the healthy range. A moderate deficit is recommended." if bmi < 30 else
        "Your BMI indicates obesity. A structured deficit with medical supervision is advised."
    )
    goal_note = {
        'loss':     f"For weight loss, your target of {int(calories)} kcal/day creates a safe deficit.",
        'maintain': f"Your maintenance target is {int(calories)} kcal/day.",
        'gain':     f"For muscle gain, your target of {int(calories)} kcal/day includes a calorie surplus.",
    }.get(goal, '')
    cond_note = {
        'diabetes':     "Diabetic diet: prioritise low-GI foods, complex carbs, limit simple sugars.",
        'hypertension': "Hypertension diet: reduce sodium, increase potassium-rich foods.",
        'thyroid':      "Thyroid diet: avoid raw cruciferous vegetables in excess, ensure iodine.",
        'pcos':         "PCOS diet: low-GI, anti-inflammatory foods; limit processed carbs.",
        'none':         "",
    }.get(health_condition, "")
    return {'bmi_advice': bmi_note, 'goal_advice': goal_note, 'condition_advice': cond_note}

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'error': 'No JSON body provided'}), 400

        features, bmi, age, gender, weight, height, activity, goal_raw, cond_raw = engineer_features(data)

        # 1. Physics Calculation: Calorie baseline
        calories_raw = calculate_calories(age, gender, weight, height, activity, goal_raw)
        calories     = round(np.clip(calories_raw, 1000, 4500))

        # 2. ML Prediction: Diet Category (XGBoost)
        # XGBoost requires scaled features (because we trained with Xtr_sc)
        features_scaled = scaler.transform(features)
        cat_enc      = classifier.predict(features_scaled)[0]
        diet_cat     = label_encoder.inverse_transform([cat_enc])[0]

        proba        = classifier.predict_proba(features_scaled)[0]
        confidence   = round(float(np.max(proba)) * 100, 1)

        # 3. ML Prediction: Macros (XGBoost)
        # XGBoost was trained on features
        macros_pred = macro_regressor.predict(features)[0]
        protein_pct = float(macros_pred[0])
        carbs_pct   = float(macros_pred[1])
        fat_pct     = float(macros_pred[2])

        # Normalize to 100%
        total_pct = protein_pct + carbs_pct + fat_pct
        protein_pct = round((protein_pct / total_pct) * 100)
        carbs_pct   = round((carbs_pct / total_pct) * 100)
        fat_pct     = 100 - (protein_pct + carbs_pct)

        protein_g = round((calories * protein_pct / 100) / 4)
        carbs_g   = round((calories * carbs_pct   / 100) / 4)
        fat_g     = round((calories * fat_pct     / 100) / 9)

        advice = build_advice(bmi, diet_cat, calories, goal_raw, cond_raw)

        return jsonify({
            'success':       True,
            'bmi':           round(bmi, 1),
            'calories':      calories,
            'diet_category': diet_cat,
            'confidence':    confidence,
            'macros': {
                'protein_g':    protein_g,
                'carbs_g':      carbs_g,
                'fat_g':        fat_g,
                'protein_pct':  protein_pct,
                'carbs_pct':    carbs_pct,
                'fat_pct':      fat_pct,
            },
            'advice':        advice,
            'model':         'XGBoost',
            'model_r2':      model_metrics.get('regression', {}).get('r2'),
            'model_mae':     None,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/retrain', methods=['POST', 'OPTIONS'])
def retrain():
    """
    POST /retrain
    Triggered by the Node.js retrainQueue when feedback threshold is crossed.
    Body: { "min_samples": 50 }
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        global macro_regressor, classifier, model_metrics

        body        = request.get_json(force=True) or {}
        min_samples = int(body.get('min_samples', 50))
        mongo_uri   = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/nourishai')

        print(f'[/retrain] Starting retrain (min_samples={min_samples})…')

        # Import here to avoid circular load issues at startup
        from retrain import run_retrain
        result = run_retrain(mongo_uri=mongo_uri, min_samples=min_samples)

        if result.get('success'):
            # ── Hot-reload models into memory ────────────────
            print('[/retrain] Hot-reloading models…')
            macro_regressor = joblib.load(os.path.join(MDL_DIR, 'macro_regressor.pkl'))
            classifier      = joblib.load(os.path.join(MDL_DIR, 'diet_classifier.pkl'))
            with open(os.path.join(MDL_DIR, 'model_metrics.json')) as f:
                model_metrics = json.load(f)
            print('[/retrain] ✅ Models hot-reloaded.')

        status_code = 200 if result.get('success') else 500
        return jsonify(result), status_code

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('ML_PORT', 5001))
    print(f"🤖 ML Service running on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
