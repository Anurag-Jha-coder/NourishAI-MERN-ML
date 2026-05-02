import os, json, joblib
import numpy  as np
import pandas as pd

from sklearn.model_selection     import train_test_split, cross_val_score
from sklearn.preprocessing       import StandardScaler, LabelEncoder
from sklearn.ensemble            import RandomForestRegressor
from xgboost                     import XGBClassifier
from sklearn.metrics             import r2_score, accuracy_score, classification_report

BASE      = os.path.dirname(__file__)
REAL_DATA_PATH = os.path.join(BASE, 'data', 'real_diet_dataset.csv')
SYNTH_DATA_PATH = os.path.join(BASE, 'data', 'diet_dataset.csv')

if os.path.exists(REAL_DATA_PATH):
    print("Using REAL dataset (UCI Obesity)...")
    DATA_PATH = REAL_DATA_PATH
else:
    print("Using SYNTHETIC dataset...")
    DATA_PATH = SYNTH_DATA_PATH

MDL_DIR   = os.path.join(BASE, 'models')
os.makedirs(MDL_DIR, exist_ok=True)

df = pd.read_csv(DATA_PATH)

df['bmi_sq']         = df['bmi'] ** 2               
df['age_activity']   = df['age'] * df['activity_level']   
df['weight_height']  = df['weight_kg'] / df['height_cm']  
df['age_group']      = pd.cut(df['age'], bins=[0, 25, 35, 45, 55, 100], labels=[0, 1, 2, 3, 4]).astype(int)

FEATURES = [
    'age', 'gender', 'weight_kg', 'height_cm', 'bmi',
    'activity_level', 'goal_encoded', 'condition_encoded', 'region_encoded',
    'bmi_sq', 'age_activity', 'weight_height', 'age_group'
]

# Macros (Multi-output)
TARGET_REG   = ['protein_pct', 'carbs_pct', 'fat_pct']
TARGET_CLASS = 'diet_category'

X = df[FEATURES]
y_reg   = df[TARGET_REG]
y_class = df[TARGET_CLASS]

joblib.dump(FEATURES, os.path.join(MDL_DIR, 'feature_names.pkl'))

le = LabelEncoder()
y_class_enc = le.fit_transform(y_class)
joblib.dump(le, os.path.join(MDL_DIR, 'label_encoder.pkl'))

X_train, X_test, yr_train, yr_test, yc_train, yc_test = train_test_split(
    X, y_reg, y_class_enc, test_size=0.20, random_state=42
)

scaler  = StandardScaler()
Xtr_sc  = scaler.fit_transform(X_train)
Xte_sc  = scaler.transform(X_test)
joblib.dump(scaler, os.path.join(MDL_DIR, 'scaler.pkl'))

# ── 1. REGRESSION: Macros ────────────────────────────────────
print("Training Macro Regressor...")
best_rf_reg = RandomForestRegressor(n_estimators=200, max_depth=15, min_samples_leaf=3, n_jobs=-1, random_state=42)
best_rf_reg.fit(X_train, yr_train)
preds = best_rf_reg.predict(X_test)
r2   = r2_score(yr_test, preds)

joblib.dump(best_rf_reg, os.path.join(MDL_DIR, 'macro_regressor.pkl'))
print(f"Saved macro_regressor.pkl (R²: {r2:.4f})")

# ── 2. CLASSIFICATION: Diet Category ────────────────────────
print("Training XGBClassifier...")
clf = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05,
    n_jobs=-1,
    random_state=42
)
clf.fit(Xtr_sc, yc_train)
yc_pred = clf.predict(Xte_sc)

acc = accuracy_score(yc_test, yc_pred)
print(f"Saved XGBClassifier (Accuracy: {acc:.4f})")
joblib.dump(clf, os.path.join(MDL_DIR, 'diet_classifier.pkl'))

metrics = {
    'classification': {'accuracy': round(acc, 4)},
    'regression': {'r2': round(r2, 4)},
    'dataset': {'features': FEATURES, 'target_reg': TARGET_REG, 'classes': list(le.classes_)}
}
with open(os.path.join(MDL_DIR, 'model_metrics.json'), 'w') as f:
    json.dump(metrics, f, indent=2)
