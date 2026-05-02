import pandas as pd
import numpy as np
import os
import re

BASE = os.path.dirname(__file__)
INPUT_CSV = os.path.join(BASE, 'usda_raw', 'Indian_Food_Nutrition_Processed.csv')
OUTPUT_CSV = os.path.join(BASE, 'enriched_indian_foods.csv')

print("Loading Indian Food Nutrition dataset...")
df = pd.read_csv(INPUT_CSV)

# ── 1. Map columns to MongoDB schema ────────────────────────────
df = df.rename(columns={
    'Dish Name': 'name',
    'Calories (kcal)': 'calories',
    'Protein (g)': 'protein',
    'Carbohydrates (g)': 'carbs',
    'Fats (g)': 'fat',
    'Fibre (g)': 'fiber',
    'Free Sugar (g)': 'sugar'
})

# Normalize names (lowercase)
df['name'] = df['name'].str.lower().str.strip()

# ── 2. AI Inference Logic ───────────────────────────────────────
def infer_region(name):
    name = str(name).lower()
    
    # South India
    if any(w in name for w in ['dosa', 'idli', 'sambar', 'vada', 'uttapam', 'rasam', 'upma', 'payasam', 'chettinad', 'malabar', 'kerala', 'andhra', 'madras', 'bisi bele', 'appam', 'pongal', 'mysore', 'hyderabadi']):
        return 'south_india'
        
    # West India
    if any(w in name for w in ['poha', 'dhokla', 'pav bhaji', 'vada pav', 'thepla', 'khandvi', 'gujarati', 'maharashtrian', 'goan', 'bombay', 'misal', 'puran poli', 'shrikhand', 'modak', 'khakhra', 'farsan']):
        return 'west_india'
        
    # East India
    if any(w in name for w in ['rosogolla', 'rasgulla', 'sandesh', 'machher', 'mustard fish', 'litti', 'chokha', 'bengali', 'odisha', 'bihari', 'assamese', 'momos', 'thukpa', 'pitha', 'machh', 'ilish', 'mishti']):
        return 'east_india'
        
    # North India (Default for most generic Punjabi/Mughlai dishes)
    if any(w in name for w in ['chole', 'bhature', 'rajma', 'paneer tikka', 'tandoori', 'makhani', 'naan', 'paratha', 'korma', 'rogan josh', 'kashmiri', 'punjabi', 'aloo gobi', 'palak paneer', 'dal makhani', 'kadai', 'sarson', 'saag', 'kulcha', 'kofta', 'tikka']):
        return 'north_india'
        
    # Default to north_india if it's a generic Indian dish that doesn't strongly map
    return 'north_india'

def infer_category(name):
    name = str(name)
    if any(w in name for w in ['chicken', 'mutton', 'fish', 'egg', 'pork', 'beef', 'paneer', 'soya', 'dal', 'chana', 'rajma']):
        return 'protein'
    elif any(w in name for w in ['rice', 'roti', 'paratha', 'naan', 'dosa', 'idli', 'poha', 'upma', 'wheat', 'bread', 'oats']):
        return 'grain'
    elif any(w in name for w in ['sabzi', 'palak', 'aloo', 'gobi', 'bhindi', 'baingan', 'veg']):
        return 'vegetable'
    elif any(w in name for w in ['milk', 'curd', 'yogurt', 'lassi', 'buttermilk']):
        return 'dairy'
    elif any(w in name for w in ['apple', 'mango', 'banana', 'orange', 'fruit']):
        return 'fruit'
    elif any(w in name for w in ['tea', 'coffee', 'juice', 'drink', 'water', 'cooler']):
        return 'beverage'
    elif any(w in name for w in ['biscuit', 'cake', 'cookie', 'chips', 'snack', 'namkeen']):
        return 'snack'
    return 'other'

def infer_diet(name):
    name = str(name)
    if any(w in name for w in ['chicken', 'mutton', 'fish', 'pork', 'beef', 'egg']):
        return 'non-veg'
    elif any(w in name for w in ['paneer', 'milk', 'curd', 'yogurt', 'ghee', 'butter', 'cheese']):
        return 'veg'
    return 'vegan'

def infer_meals(cat):
    if cat == 'beverage': return "['beverage']"
    if cat == 'snack': return "['snack']"
    if cat == 'grain': return "['breakfast', 'lunch', 'dinner']"
    return "['lunch', 'dinner']"

def get_gi(row):
    # GI estimation based on fiber/sugar/carbs
    if row['sugar'] > 15: return 'high'
    if row['fiber'] > 5 and row['carbs'] < 20: return 'low'
    if row['carbs'] > 40 and row['fiber'] < 3: return 'high'
    return 'medium'

def get_tags(row):
    tags = []
    if row['protein'] > 15: tags.append('high-protein')
    if row['calories'] < 150: tags.append('weight-loss')
    if row['carbs'] < 10: tags.append('keto-friendly')
    if row['fiber'] > 5: tags.append('high-fiber')
    if row['sugar'] < 5 and row['carbs'] < 30: tags.append('diabetes-friendly')
    if row['fat'] < 5: tags.append('low-fat')
    
    if row['diet_type'] == 'vegan': tags.append('vegan')
    elif row['diet_type'] == 'veg': tags.append('veg')
    
    # ensure proper json array format using single quotes inside string representing array
    if not tags:
        return "[]"
    return str(tags).replace("'", '"')

print("Enriching dataset...")
df['region']    = df['name'].apply(infer_region)
df['category']  = df['name'].apply(infer_category)
df['diet_type'] = df['name'].apply(infer_diet)
df['meal_type'] = df['category'].apply(infer_meals)

df['glycemic_index'] = df.apply(get_gi, axis=1)
df['health_tags']    = df.apply(get_tags, axis=1)

# Ensure only required columns exist
cols = ['name', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'category', 'diet_type', 'region', 'meal_type', 'health_tags', 'glycemic_index']

df_final = df[cols].copy()

# Drop rows with NaN in essential columns
df_final = df_final.dropna(subset=['calories', 'protein', 'carbs', 'fat'])

# Drop duplicates
df_final = df_final.drop_duplicates(subset=['name'])

# Save
df_final.to_csv(OUTPUT_CSV, index=False)

print(f"✅ Successfully processed {len(df_final)} Indian foods!")
print(f"Saved to {OUTPUT_CSV}")
