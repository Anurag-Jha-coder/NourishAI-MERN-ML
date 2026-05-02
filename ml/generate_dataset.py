"""
generate_dataset.py
────────────────────────────────────────────────────────────────
Generates a realistic synthetic dataset for diet prediction.

Features used:
  age, gender, weight_kg, height_cm, bmi, activity_level,
  goal_encoded, health_condition_encoded, region_encoded

Target variables:
  protein_pct, carbs_pct, fat_pct → regression targets (optimized macros)
  diet_category                   → classification target (weight_loss / maintenance / etc)
"""

import numpy as np
import pandas as pd
import os

np.random.seed(42)
N = 10_000

# ── 1. Demographics ──────────────────────────────────────────
age    = np.random.randint(18, 70, N)
gender = np.random.choice([0, 1], N)          # 0 = Female, 1 = Male

height = np.where(
    gender == 1,
    np.random.normal(168, 7, N),
    np.random.normal(157, 6, N)
).clip(145, 200)

weight = (height - 100) + np.random.normal(0, 12, N)
weight = weight.clip(38, 130)
bmi = (weight / (height / 100) ** 2).round(2)

# ── 2. Activity level (PAL multiplier) ───────────────────────
activity_choices = [1.2, 1.375, 1.55, 1.725, 1.9]
activity_weights = [0.30, 0.30, 0.25, 0.10, 0.05]
activity = np.random.choice(activity_choices, N, p=activity_weights)

# ── 3. Health goal ────────────────────────────────────────────
goal_choices = ['loss', 'maintain', 'gain']
goal_weights = [0.50, 0.30, 0.20]
goal         = np.random.choice(goal_choices, N, p=goal_weights)
goal_encoded = np.select([goal == 'loss', goal == 'maintain', goal == 'gain'], [-1, 0, 1])

# ── 4. Health conditions ──────────────────────────────────────
condition_choices  = ['none', 'diabetes', 'hypertension', 'thyroid', 'pcos']
condition_weights  = [0.55, 0.18, 0.14, 0.08, 0.05]
health_condition   = np.random.choice(condition_choices, N, p=condition_weights)
condition_encoded  = np.select(
    [health_condition == 'none', health_condition == 'diabetes',
     health_condition == 'hypertension', health_condition == 'thyroid', health_condition == 'pcos'],
    [0, 1, 2, 3, 4]
)

region_choices = ['north_india', 'south_india', 'west_india', 'east_india']
region         = np.random.choice(region_choices, N, p=[0.35, 0.30, 0.20, 0.15])
region_encoded = np.select(
    [region == 'north_india', region == 'south_india', region == 'west_india', region == 'east_india'],
    [0, 1, 2, 3]
)

# ── 5. Target Variables ───────────────────────────────────────
diet_category = np.select(
    [
        (bmi < 18.5) | (goal == 'gain'),
        (goal == 'loss') & (bmi >= 25),
        health_condition != 'none',
        (goal == 'maintain') & (bmi >= 18.5) & (bmi < 25)
    ],
    ['muscle_gain', 'weight_loss', 'medical_diet', 'maintenance'],
    default='maintenance'
)

# Macro calculation based on physiology
# Baseline macros: 30% P, 40% C, 30% F
protein_pct = np.full(N, 30)
carbs_pct   = np.full(N, 40)
fat_pct     = np.full(N, 30)

# Goal adjustments
protein_pct = np.where(goal == 'gain', protein_pct + 10, protein_pct)
carbs_pct   = np.where(goal == 'gain', carbs_pct + 10, carbs_pct)
fat_pct     = np.where(goal == 'gain', fat_pct - 20, fat_pct)

protein_pct = np.where(goal == 'loss', protein_pct + 5, protein_pct)
carbs_pct   = np.where(goal == 'loss', carbs_pct - 10, carbs_pct)
fat_pct     = np.where(goal == 'loss', fat_pct + 5, fat_pct)

# Condition adjustments
# Diabetes / PCOS -> Lower carbs, higher protein/fat
carbs_pct = np.where((health_condition == 'diabetes') | (health_condition == 'pcos'), carbs_pct - 15, carbs_pct)
protein_pct = np.where((health_condition == 'diabetes') | (health_condition == 'pcos'), protein_pct + 10, protein_pct)
fat_pct = np.where((health_condition == 'diabetes') | (health_condition == 'pcos'), fat_pct + 5, fat_pct)

# Hypertension / Thyroid -> Moderate carbs
fat_pct = np.where(health_condition == 'hypertension', fat_pct - 5, fat_pct)
carbs_pct = np.where(health_condition == 'hypertension', carbs_pct + 5, carbs_pct)

# Add some realistic variance (+- 2%)
protein_pct = protein_pct + np.random.randint(-2, 3, N)
carbs_pct = carbs_pct + np.random.randint(-2, 3, N)

# Ensure sum is 100%
fat_pct = 100 - (protein_pct + carbs_pct)

# Assemble
df = pd.DataFrame({
    'age':                 age.astype(int),
    'gender':              gender.astype(int),
    'weight_kg':           weight.round(1),
    'height_cm':           height.round(1),
    'bmi':                 bmi,
    'activity_level':      activity,
    'goal':                goal,
    'goal_encoded':        goal_encoded.astype(int),
    'health_condition':    health_condition,
    'condition_encoded':   condition_encoded.astype(int),
    'region':              region,
    'region_encoded':      region_encoded.astype(int),
    'protein_pct':         protein_pct.astype(int),
    'carbs_pct':           carbs_pct.astype(int),
    'fat_pct':             fat_pct.astype(int),
    'diet_category':       diet_category,
})

out_path = os.path.join(os.path.dirname(__file__), 'data', 'diet_dataset.csv')
df.to_csv(out_path, index=False)
print(f"✅ Dataset saved → {out_path}")
