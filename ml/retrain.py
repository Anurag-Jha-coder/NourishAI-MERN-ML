"""
retrain.py  —  NourishAI Incremental Retraining Module
────────────────────────────────────────────────────────────────
Called by POST /retrain in app.py.

Steps:
  1. Load base synthetic/real CSV dataset
  2. Fetch all Feedback docs from MongoDB via pymongo
  3. Transform feedback → 13-feature training rows
  4. Assign sample_weight=2.0 to feedback rows, 1.0 to base rows
  5. Retrain RandomForestRegressor (macros) + XGBClassifier (diet_category)
  6. Save new .pkl files; back up old ones with a timestamp suffix
  7. Update model_metrics.json with new R² and accuracy

Returns a dict with retrain results (used by /retrain endpoint).
"""

import os, json, shutil, joblib, traceback
from datetime import datetime

import numpy  as np
import pandas as pd

from pymongo                      import MongoClient
from sklearn.model_selection      import train_test_split
from sklearn.preprocessing        import LabelEncoder
from sklearn.ensemble             import RandomForestRegressor
from sklearn.metrics              import r2_score, accuracy_score
from xgboost                      import XGBClassifier

# ── Paths ────────────────────────────────────────────────────────
BASE    = os.path.dirname(__file__)
MDL_DIR = os.path.join(BASE, 'models')

REAL_DATA_PATH  = os.path.join(BASE, 'data', 'real_diet_dataset.csv')
SYNTH_DATA_PATH = os.path.join(BASE, 'data', 'diet_dataset.csv')

# ── Feature / target schema (must match train_models.py exactly) ─
FEATURES = [
    'age', 'gender', 'weight_kg', 'height_cm', 'bmi',
    'activity_level', 'goal_encoded', 'condition_encoded', 'region_encoded',
    'bmi_sq', 'age_activity', 'weight_height', 'age_group'
]
TARGET_REG   = ['protein_pct', 'carbs_pct', 'fat_pct']
TARGET_CLASS = 'diet_category'

# ── Encoding maps (must match app.py / train_models.py) ──────────
GOAL_MAP = {'loss': -1, 'maintain': 0, 'gain': 1}
COND_MAP = {'none': 0, 'diabetes': 1, 'hypertension': 2, 'thyroid': 3, 'pcos': 4}
REG_MAP  = {'north_india': 0, 'south_india': 1, 'west_india': 2, 'east_india': 3}
GEN_MAP  = {'f': 0, 'm': 1, 'female': 0, 'male': 1, '0': 0, '1': 1}

# Diet-category → macro % heuristics (fallback when cat unknown)
CAT_MACRO_DEFAULTS = {
    'weight_loss':  (30, 40, 30),
    'muscle_gain':  (35, 45, 20),
    'maintenance':  (25, 50, 25),
    'medical_diet': (25, 45, 30),
}


def _encode_feedback_row(fb: dict) -> dict | None:
    """Transform a MongoDB Feedback document into a feature + target row dict."""
    try:
        snap = fb.get('profile_snapshot', {})
        gp   = fb.get('goal_progress', {})

        age    = float(snap.get('age',      30))
        gender = float(GEN_MAP.get(str(snap.get('gender', 'f')).lower(), 0))
        weight = float(snap.get('weight',   65))
        height = float(snap.get('height',   165))
        act    = float(snap.get('activity', 1.55))

        goal_raw = str(snap.get('goal', 'maintain')).lower()
        cond_raw = str(snap.get('health_condition', 'none')).lower()
        reg_raw  = str(snap.get('region', 'north_india')).lower()

        bmi = round(weight / (height / 100) ** 2, 2)

        goal_enc = GOAL_MAP.get(goal_raw,  0)
        cond_enc = COND_MAP.get(cond_raw,  0)
        reg_enc  = REG_MAP.get(reg_raw,    0)

        bmi_sq        = bmi ** 2
        age_activity  = age * act
        weight_height = weight / height
        age_group     = min(int((age - 18) // 10), 4)

        # Use actual_diet_category if provided, else infer from goal
        cat = fb.get('actual_diet_category') or {
            'loss': 'weight_loss', 'gain': 'muscle_gain', 'maintain': 'maintenance'
        }.get(goal_raw, 'maintenance')

        # Macro targets from known category defaults
        prot_pct, carb_pct, fat_pct = CAT_MACRO_DEFAULTS.get(cat, (25, 50, 25))

        # Apply small signal from energy/hunger feedback
        energy  = gp.get('energy_level')
        hunger  = gp.get('hunger_level')
        if energy is not None and energy < 3:
            carb_pct = min(carb_pct + 5, 60)
        if hunger is not None and hunger > 3:
            prot_pct = min(prot_pct + 5, 45)
        total = prot_pct + carb_pct + fat_pct
        prot_pct = round(prot_pct / total * 100)
        carb_pct = round(carb_pct / total * 100)
        fat_pct  = 100 - prot_pct - carb_pct

        return {
            'age': age, 'gender': gender,
            'weight_kg': weight, 'height_cm': height, 'bmi': bmi,
            'activity_level': act,
            'goal_encoded': goal_enc, 'condition_encoded': cond_enc, 'region_encoded': reg_enc,
            'bmi_sq': bmi_sq, 'age_activity': age_activity,
            'weight_height': weight_height, 'age_group': age_group,
            'protein_pct': prot_pct, 'carbs_pct': carb_pct, 'fat_pct': fat_pct,
            'diet_category': cat,
        }
    except Exception as e:
        print(f'[retrain] Skipping malformed feedback doc: {e}')
        return None


def _backup_models(timestamp: str):
    """Rename current .pkl files to .pkl.bak.<timestamp> before overwriting."""
    for fname in ['macro_regressor.pkl', 'diet_classifier.pkl']:
        src = os.path.join(MDL_DIR, fname)
        if os.path.exists(src):
            dst = src + f'.bak.{timestamp}'
            shutil.copy2(src, dst)
            print(f'[retrain] Backed up {fname} → {os.path.basename(dst)}')


def run_retrain(mongo_uri: str = None, min_samples: int = 50) -> dict:
    """
    Main retraining entry point.

    Args:
        mongo_uri:   MongoDB connection string (defaults to env MONGODB_URI or localhost)
        min_samples: minimum number of feedback docs required (guard)

    Returns:
        dict with keys: success, message, metrics, counts
    """
    try:
        # ── 1. Load base dataset ──────────────────────────────
        data_path = REAL_DATA_PATH if os.path.exists(REAL_DATA_PATH) else SYNTH_DATA_PATH
        print(f'[retrain] Loading base dataset: {data_path}')
        base_df = pd.read_csv(data_path)

        # Compute derived features if not present
        if 'bmi_sq' not in base_df.columns:
            base_df['bmi_sq']        = base_df['bmi'] ** 2
            base_df['age_activity']  = base_df['age'] * base_df['activity_level']
            base_df['weight_height'] = base_df['weight_kg'] / base_df['height_cm']
            base_df['age_group']     = pd.cut(
                base_df['age'], bins=[0, 25, 35, 45, 55, 100], labels=[0, 1, 2, 3, 4]
            ).astype(int)

        base_df['_sample_weight'] = 1.0   # base rows weight

        # ── 2. Fetch Feedback from MongoDB ───────────────────
        uri = (
            mongo_uri
            or os.environ.get('MONGODB_URI')
            or 'mongodb://localhost:27017/nourishai'
        )
        print(f'[retrain] Connecting to MongoDB: {uri[:40]}…')
        client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        db     = client.get_default_database()
        raw_fb = list(db['feedbacks'].find({}))
        client.close()

        print(f'[retrain] Fetched {len(raw_fb)} feedback documents.')
        if len(raw_fb) < min_samples:
            return {
                'success': False,
                'message': f'Only {len(raw_fb)} feedback docs — need {min_samples}.',
                'counts':  {'feedback': len(raw_fb), 'base': len(base_df)},
            }

        # ── 3. Transform feedback → rows ──────────────────────
        fb_rows = [_encode_feedback_row(fb) for fb in raw_fb]
        fb_rows = [r for r in fb_rows if r is not None]

        fb_df = pd.DataFrame(fb_rows)
        fb_df['_sample_weight'] = 2.0    # feedback rows weighted 2×

        # ── 4. Combine ─────────────────────────────────────────
        all_cols = FEATURES + TARGET_REG + [TARGET_CLASS, '_sample_weight']
        combined = pd.concat(
            [base_df[all_cols], fb_df[all_cols]],
            ignore_index=True
        )
        combined = combined.dropna(subset=FEATURES + TARGET_REG + [TARGET_CLASS])

        print(f'[retrain] Combined dataset size: {len(combined)} '
              f'(base={len(base_df)}, feedback={len(fb_df)})')

        X       = combined[FEATURES].values
        y_reg   = combined[TARGET_REG].values
        y_class_raw = combined[TARGET_CLASS].values
        weights = combined['_sample_weight'].values

        # ── 5. Label encode diet_category ─────────────────────
        le = joblib.load(os.path.join(MDL_DIR, 'label_encoder.pkl'))
        # Only keep rows whose category is in the original encoder classes
        valid_mask   = np.isin(y_class_raw, le.classes_)
        X            = X[valid_mask]
        y_reg        = y_reg[valid_mask]
        y_class_raw  = y_class_raw[valid_mask]
        weights      = weights[valid_mask]

        y_class = le.transform(y_class_raw)

        # ── 6. Train/test split ────────────────────────────────
        (X_tr, X_te,
         yr_tr, yr_te,
         yc_tr, yc_te,
         w_tr,  _) = train_test_split(
            X, y_reg, y_class, weights,
            test_size=0.20, random_state=42
        )

        # Scale using the existing scaler (do NOT refit — avoids distribution drift)
        scaler    = joblib.load(os.path.join(MDL_DIR, 'scaler.pkl'))
        Xtr_sc    = scaler.transform(X_tr)
        Xte_sc    = scaler.transform(X_te)

        # ── 7. Retrain models ──────────────────────────────────
        print('[retrain] Training RandomForestRegressor (macros)…')
        rf = RandomForestRegressor(
            n_estimators=200, max_depth=15,
            min_samples_leaf=3, n_jobs=-1, random_state=42
        )
        rf.fit(X_tr, yr_tr, sample_weight=w_tr)
        r2 = r2_score(yr_te, rf.predict(X_te))

        print(f'[retrain] RF R²: {r2:.4f}')

        print('[retrain] Training XGBClassifier (diet category)…')
        clf = XGBClassifier(
            n_estimators=200, max_depth=6,
            learning_rate=0.05, n_jobs=-1, random_state=42
        )
        clf.fit(Xtr_sc, yc_tr, sample_weight=w_tr)
        acc = accuracy_score(yc_te, clf.predict(Xte_sc))

        print(f'[retrain] XGB Accuracy: {acc:.4f}')

        # ── 8. Back up old models + save new ones ─────────────
        ts = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        _backup_models(ts)

        joblib.dump(rf,  os.path.join(MDL_DIR, 'macro_regressor.pkl'))
        joblib.dump(clf, os.path.join(MDL_DIR, 'diet_classifier.pkl'))
        print('[retrain] ✅ New models saved.')

        # ── 9. Update model_metrics.json ──────────────────────
        metrics_path = os.path.join(MDL_DIR, 'model_metrics.json')
        with open(metrics_path) as f:
            metrics = json.load(f)

        metrics['regression']['r2']          = round(r2, 4)
        metrics['classification']['accuracy'] = round(acc, 4)
        metrics['last_retrain']               = datetime.utcnow().isoformat() + 'Z'
        metrics['dataset']['total_rows']      = int(len(combined))
        metrics['dataset']['feedback_rows']   = int(len(fb_df))

        with open(metrics_path, 'w') as f:
            json.dump(metrics, f, indent=2)

        return {
            'success': True,
            'message': 'Retrain complete.',
            'metrics': {
                'regression_r2':       round(r2, 4),
                'classifier_accuracy': round(acc, 4),
            },
            'counts': {
                'base':     len(base_df),
                'feedback': len(fb_df),
                'total':    len(combined),
            },
            'timestamp': ts,
        }

    except Exception:
        tb = traceback.format_exc()
        print('[retrain] ❌ Error during retraining:\n', tb)
        return {'success': False, 'message': tb}
