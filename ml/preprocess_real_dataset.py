import os
import requests
import zipfile
import pandas as pd
import numpy as np
from io import BytesIO

# UCI Obesity Dataset URL
DATASET_URL = "https://archive.ics.uci.edu/static/public/544/estimation+of+obesity+levels+based+on+eating+habits+and+physical+condition.zip"
BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, 'data')
OUT_PATH = os.path.join(DATA_DIR, 'real_diet_dataset.csv')

def fetch_and_preprocess():
    print("Downloading UCI Obesity dataset...")
    response = requests.get(DATASET_URL)
    response.raise_for_status()
    
    with zipfile.ZipFile(BytesIO(response.content)) as z:
        # Extract the CSV file
        csv_filename = [f for f in z.namelist() if f.endswith('.csv')][0]
        with z.open(csv_filename) as f:
            raw_df = pd.read_csv(f)
            
    print(f"Downloaded raw dataset with {len(raw_df)} rows. Processing...")
    
    # Clean column names
    raw_df.columns = raw_df.columns.str.strip()
    
    # ── 1. Map to our 13-feature schema ──────────────────────────
    df = pd.DataFrame()
    
    df['age'] = raw_df['Age'].astype(int)
    # Gender: Female=0, Male=1
    df['gender'] = (raw_df['Gender'] == 'Male').astype(int)
    df['weight_kg'] = raw_df['Weight'].round(1)
    df['height_cm'] = (raw_df['Height'] * 100).round(1)
    df['bmi'] = (df['weight_kg'] / (raw_df['Height'] ** 2)).round(2)
    
    # Map physical activity (FAF) to our activity levels
    # FAF is 0 to 3 in dataset. Map roughly to 1.2 to 1.9
    df['activity_level'] = np.select(
        [raw_df['FAF'] < 1, raw_df['FAF'] < 2, raw_df['FAF'] < 2.5],
        [1.2, 1.375, 1.55],
        default=1.725
    )
    
    # ── 2. Derive Targets based on Obesity Level (NObeyesdad) ──────
    # NObeyesdad categories: Insufficient_Weight, Normal_Weight, Overweight_Level_I, Overweight_Level_II, Obesity_Type_I, Obesity_Type_II, Obesity_Type_III
    
    conditions = [
        raw_df['NObeyesdad'].str.contains('Obesity'),
        raw_df['NObeyesdad'].str.contains('Overweight'),
        raw_df['NObeyesdad'].str.contains('Insufficient'),
        raw_df['NObeyesdad'].str.contains('Normal')
    ]
    
    df['diet_category'] = np.select(
        conditions,
        ['medical_diet', 'weight_loss', 'muscle_gain', 'maintenance'],
        default='maintenance'
    )
    
    # Derive goals and conditions for feature completeness
    df['goal'] = np.select(
        conditions,
        ['loss', 'loss', 'gain', 'maintain'],
        default='maintain'
    )
    df['goal_encoded'] = np.select([df['goal'] == 'loss', df['goal'] == 'maintain', df['goal'] == 'gain'], [-1, 0, 1])
    
    # Randomly assign health conditions with higher probability for obesity categories
    np.random.seed(42)
    N = len(df)
    conditions_list = ['none', 'diabetes', 'hypertension', 'thyroid', 'pcos']
    
    health_conditions = []
    for cat in df['diet_category']:
        if cat == 'medical_diet':
            probs = [0.3, 0.3, 0.2, 0.1, 0.1]
        else:
            probs = [0.8, 0.05, 0.05, 0.05, 0.05]
        health_conditions.append(np.random.choice(conditions_list, p=probs))
        
    df['health_condition'] = health_conditions
    
    cond_map = {'none': 0, 'diabetes': 1, 'hypertension': 2, 'thyroid': 3, 'pcos': 4}
    df['condition_encoded'] = df['health_condition'].map(cond_map)
    
    # Region assignment (uniform)
    regions = ['north_india', 'south_india', 'west_india', 'east_india']
    df['region'] = np.random.choice(regions, N)
    reg_map = {'north_india': 0, 'south_india': 1, 'west_india': 2, 'east_india': 3}
    df['region_encoded'] = df['region'].map(reg_map)
    
    # ── 3. Macros Formulation based on Category ────────────────────
    # Baseline: 30% P, 45% C, 25% F
    protein_pct = np.full(N, 30)
    carbs_pct   = np.full(N, 45)
    fat_pct     = np.full(N, 25)
    
    # Adjustments
    protein_pct = np.where(df['goal'] == 'gain', protein_pct + 10, protein_pct)
    carbs_pct   = np.where(df['goal'] == 'gain', carbs_pct + 5, carbs_pct)
    fat_pct     = np.where(df['goal'] == 'gain', fat_pct - 15, fat_pct)
    
    protein_pct = np.where(df['goal'] == 'loss', protein_pct + 5, protein_pct)
    carbs_pct   = np.where(df['goal'] == 'loss', carbs_pct - 10, carbs_pct)
    fat_pct     = np.where(df['goal'] == 'loss', fat_pct + 5, fat_pct)
    
    carbs_pct = np.where((df['health_condition'] == 'diabetes') | (df['health_condition'] == 'pcos'), carbs_pct - 10, carbs_pct)
    protein_pct = np.where((df['health_condition'] == 'diabetes') | (df['health_condition'] == 'pcos'), protein_pct + 5, protein_pct)
    fat_pct = np.where((df['health_condition'] == 'diabetes') | (df['health_condition'] == 'pcos'), fat_pct + 5, fat_pct)
    
    fat_pct = np.where(df['health_condition'] == 'hypertension', fat_pct - 5, fat_pct)
    carbs_pct = np.where(df['health_condition'] == 'hypertension', carbs_pct + 5, carbs_pct)
    
    # Add noise
    protein_pct = protein_pct + np.random.randint(-2, 3, N)
    carbs_pct = carbs_pct + np.random.randint(-2, 3, N)
    fat_pct = 100 - (protein_pct + carbs_pct)
    
    df['protein_pct'] = protein_pct.astype(int)
    df['carbs_pct'] = carbs_pct.astype(int)
    df['fat_pct'] = fat_pct.astype(int)
    
    # Save
    os.makedirs(DATA_DIR, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)
    print(f"DONE! Real dataset saved to {OUT_PATH} ({len(df)} rows)")

if __name__ == '__main__':
    fetch_and_preprocess()
