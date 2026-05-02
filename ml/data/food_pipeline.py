"""
NourishAI Food Data Pipeline
Source: USDA FoodData Central - SR Legacy (7,793 real foods, free)
URL: https://fdc.nal.usda.gov/download-datasets.html
"""

import os, sys, zipfile, io, json, re
import requests
import pandas as pd
import numpy as np

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
ZIP_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"

# ─── Key USDA nutrient IDs ───────────────────────────────────────
NUTRIENT_IDS = {
    1008: "calories",   # Energy (kcal)
    1003: "protein",    # Protein
    1004: "fat",        # Total fat
    1005: "carbs",      # Carbohydrates by diff
    1079: "fiber",      # Fiber
    2000: "sugar",      # Total sugars
}

# ─── Enrichment keyword dictionaries ─────────────────────────────
CATEGORY_KEYWORDS = {
    "grain":     ["rice","wheat","oat","bread","roti","chapati","naan","pasta","noodle","cereal","flour",
                  "barley","millet","corn","maize","quinoa","tortilla","bagel","muffin","pancake","waffle",
                  "cracker","pretzel","popcorn","granola","semolina","couscous","idli","dosa","upma"],
    "protein":   ["chicken","beef","pork","lamb","fish","tuna","salmon","shrimp","prawn","egg","dal","lentil",
                  "bean","tofu","paneer","tempeh","seitan","turkey","mutton","crab","lobster","sardine",
                  "anchovy","cod","tilapia","catfish","soy","legume","chickpea","kidney","black bean"],
    "vegetable": ["spinach","broccoli","carrot","tomato","pepper","onion","garlic","cucumber","lettuce",
                  "cabbage","cauliflower","pea","bean","zucchini","eggplant","mushroom","celery","kale",
                  "arugula","beet","radish","turnip","leek","asparagus","artichoke","okra","bhindi",
                  "palak","methi","gobi","aloo","saag","lauki","tinda","parwal","karela"],
    "fruit":     ["apple","banana","orange","mango","grape","berry","strawberry","blueberry","raspberry",
                  "watermelon","pineapple","kiwi","peach","plum","cherry","lemon","lime","grapefruit",
                  "papaya","guava","pomegranate","fig","date","coconut","melon","apricot","pear","avocado"],
    "dairy":     ["milk","cheese","yogurt","curd","butter","cream","ghee","paneer","whey","lactose",
                  "kefir","lassi","buttermilk","ice cream","custard"],
    "snack":     ["chip","cookie","cake","chocolate","candy","biscuit","crisp","wafer","brownie","donut",
                  "pie","pudding","jello","gummy","lollipop","toffee","fudge","bar","granola bar","trail mix"],
    "beverage":  ["juice","tea","coffee","soda","water","drink","smoothie","shake","lemonade","cola",
                  "beer","wine","alcohol","chai","lassi","buttermilk","coconut water"],
    "spice":     ["salt","pepper","cumin","turmeric","coriander","chili","ginger","cinnamon","cardamom",
                  "clove","mustard","fennel","fenugreek","oregano","basil","thyme","rosemary","paprika"],
    "oil":       ["oil","margarine","lard","shortening","ghee butter"],
    "nut":       ["almond","walnut","cashew","pistachio","peanut","pecan","hazelnut","macadamia",
                  "pine nut","chestnut","sunflower seed","pumpkin seed","flaxseed","chia"],
}

NON_VEG_KEYWORDS = ["chicken","beef","pork","lamb","fish","tuna","salmon","shrimp","prawn","turkey",
                     "mutton","crab","lobster","sardine","anchovy","cod","tilapia","catfish",
                     "duck","goose","venison","bison","veal","ham","bacon","sausage","salami",
                     "pepperoni","oyster","mussel","clam","squid","octopus"]

VEGAN_EXCLUDE    = ["milk","cheese","yogurt","curd","butter","cream","ghee","paneer","whey","egg",
                    "honey","casein","gelatin","lactose","kefir","custard","ice cream"]

INDIAN_KEYWORDS  = ["roti","chapati","naan","dal","dosa","idli","sambar","biryani","paneer","khichdi",
                    "rajma","chole","puri","paratha","upma","poha","halwa","kheer","lassi","chai",
                    "saag","palak","bhindi","gobi","aloo","methi","chaat","pakora","samosa",
                    "raita","korma","tikka","masala","curry","tadka","jeera","turmeric","ghee"]
NORTH_INDIA_KW   = ["roti","chapati","naan","paratha","dal","rajma","chole","puri","paneer","biryani",
                     "saag","lassi","kheer","halwa","kulfi","jalebi"]
SOUTH_INDIA_KW   = ["dosa","idli","sambar","rasam","upma","vada","uttapam","appam","coconut chutney",
                     "tamarind","curd rice","avial","pongal","payasam"]

BREAKFAST_KW     = ["oat","cereal","egg","pancake","waffle","toast","bread","muffin","granola","yogurt",
                    "idli","dosa","upma","poha","paratha","smoothie","fruit","milk","cornflake","porridge"]
LUNCH_DINNER_KW  = ["rice","dal","roti","chicken","fish","beef","pork","pasta","noodle","curry","biryani",
                    "salad","soup","sandwich","burger","wrap","stew","lentil","bean","rajma","chole"]
SNACK_KW         = ["chip","cookie","cake","bar","nut","seed","fruit","cracker","pretzel","popcorn",
                    "biscuit","samosa","pakora","chaat","candy","chocolate","trail mix","dried"]
BEVERAGE_KW      = ["juice","tea","coffee","soda","water","drink","smoothie","shake","lemonade","milk",
                    "chai","lassi","buttermilk","coconut water"]


def classify_category(name):
    n = name.lower()
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(kw in n for kw in kws):
            return cat
    return "other"


def classify_diet_type(name):
    n = name.lower()
    if any(kw in n for kw in NON_VEG_KEYWORDS):
        return "non-veg"
    if any(kw in n for kw in VEGAN_EXCLUDE):
        return "veg"
    return "vegan"


def classify_region(name):
    n = name.lower()
    if any(kw in n for kw in SOUTH_INDIA_KW):
        return "south_india"
    if any(kw in n for kw in NORTH_INDIA_KW):
        return "north_india"
    if any(kw in n for kw in INDIAN_KEYWORDS):
        return "india"
    return "global"


def classify_meal_type(name, category):
    n = name.lower()
    meals = []
    if category == "beverage" or any(kw in n for kw in BEVERAGE_KW):
        meals.append("beverage")
        return meals
    if any(kw in n for kw in BREAKFAST_KW):
        meals.append("breakfast")
    if any(kw in n for kw in LUNCH_DINNER_KW):
        meals += ["lunch", "dinner"]
    if any(kw in n for kw in SNACK_KW):
        meals.append("snack")
    if not meals:
        meals = ["lunch", "dinner"]
    return list(dict.fromkeys(meals))  # deduplicate


def build_health_tags(row):
    tags = []
    cal, pro, carbs, fat, fiber, sugar = (
        row["calories"], row["protein"], row["carbs"],
        row["fat"], row.get("fiber", 0) or 0, row.get("sugar", 0) or 0
    )
    if cal < 100:          tags.append("very-low-calorie")
    if cal < 200:          tags.append("weight-loss")
    if pro > 15:           tags.append("high-protein")
    if pro > 8:            tags.append("good-protein")
    if carbs < 10:         tags.append("low-carb")
    if carbs < 5:          tags.append("keto-friendly")
    if fat < 5:            tags.append("low-fat")
    if fat < 3:            tags.append("heart-healthy")
    if fiber > 5:          tags.append("high-fiber")
    if sugar < 5:          tags.append("diabetes-friendly")
    if carbs < 15 and sugar < 5: tags.append("diabetes-friendly")
    return tags


def glycemic_index(carbs, sugar, fiber):
    fiber = fiber or 0
    sugar = sugar or 0
    net_carbs = max(0, carbs - fiber)
    if net_carbs < 15 or (sugar < 5 and carbs < 20):
        return "low"
    elif net_carbs < 45:
        return "medium"
    return "high"


# ─── STEP 1: Download USDA SR Legacy ──────────────────────────────
def download_usda():
    raw_dir = os.path.join(OUT_DIR, "usda_raw")
    food_csv     = os.path.join(raw_dir, "food.csv")
    nutrient_csv = os.path.join(raw_dir, "nutrient.csv")
    fn_csv       = os.path.join(raw_dir, "food_nutrient.csv")

    if os.path.exists(food_csv):
        print("✓ USDA files already downloaded.")
        return raw_dir

    os.makedirs(raw_dir, exist_ok=True)
    print(f"⬇  Downloading USDA SR Legacy from FoodData Central (~8 MB)...")
    resp = requests.get(ZIP_URL, timeout=120, stream=True)
    resp.raise_for_status()

    total = int(resp.headers.get("content-length", 0))
    downloaded = 0
    buf = io.BytesIO()
    for chunk in resp.iter_content(chunk_size=65536):
        buf.write(chunk)
        downloaded += len(chunk)
        if total:
            pct = downloaded / total * 100
            sys.stdout.write(f"\r   {downloaded/1024/1024:.1f} MB / {total/1024/1024:.1f} MB  ({pct:.0f}%)")
            sys.stdout.flush()
    print()

    print("📦 Extracting ZIP...")
    buf.seek(0)
    with zipfile.ZipFile(buf) as zf:
        for name in zf.namelist():
            basename = os.path.basename(name)
            if basename in ("food.csv", "nutrient.csv", "food_nutrient.csv", "food_category.csv"):
                data = zf.read(name)
                with open(os.path.join(raw_dir, basename), "wb") as f:
                    f.write(data)
                print(f"   extracted → {basename}")
    return raw_dir


# ─── STEP 2: Load & merge ─────────────────────────────────────────
def load_and_merge(raw_dir):
    print("\n📂 Loading USDA tables...")
    food     = pd.read_csv(os.path.join(raw_dir, "food.csv"),         low_memory=False)
    nutrient = pd.read_csv(os.path.join(raw_dir, "nutrient.csv"),     low_memory=False)
    fn       = pd.read_csv(os.path.join(raw_dir, "food_nutrient.csv"),low_memory=False)

    print(f"   food rows:          {len(food):,}")
    print(f"   nutrient rows:      {len(nutrient):,}")
    print(f"   food_nutrient rows: {len(fn):,}")

    # Map nutrient id → column name
    nutrient_map = nutrient[nutrient["id"].isin(NUTRIENT_IDS)][["id","name"]].copy()
    nutrient_map["col"] = nutrient_map["id"].map(NUTRIENT_IDS)

    # Pivot food_nutrient → wide format
    fn2 = fn[fn["nutrient_id"].isin(NUTRIENT_IDS)][["fdc_id","nutrient_id","amount"]].copy()
    fn2["col"] = fn2["nutrient_id"].map(NUTRIENT_IDS)
    pivot = fn2.pivot_table(index="fdc_id", columns="col", values="amount", aggfunc="first").reset_index()

    # Merge with food names
    merged = food[["fdc_id","description"]].merge(pivot, on="fdc_id", how="inner")
    merged.rename(columns={"description": "name"}, inplace=True)
    print(f"   merged rows: {len(merged):,}")
    return merged


# ─── STEP 3: Clean ────────────────────────────────────────────────
def clean(df):
    print("\n🧹 Cleaning...")
    df = df.copy()
    df["name"] = df["name"].str.lower().str.strip()

    # Keep only rows with calories, protein, carbs, fat
    for col in ["calories", "protein", "carbs", "fat"]:
        df = df[df[col].notna()]

    df["calories"] = df["calories"].round(1)
    df["protein"]  = df["protein"].round(2)
    df["carbs"]    = df["carbs"].round(2)
    df["fat"]      = df["fat"].round(2)
    df["fiber"]    = df.get("fiber", pd.Series(0, index=df.index)).fillna(0).round(2)
    df["sugar"]    = df.get("sugar", pd.Series(0, index=df.index)).fillna(0).round(2)

    # Remove implausible rows
    df = df[(df["calories"] > 0) & (df["calories"] <= 900)]
    df = df[(df["protein"] >= 0) & (df["fat"] >= 0) & (df["carbs"] >= 0)]

    # Remove duplicates by name (keep first)
    df = df.drop_duplicates(subset=["name"], keep="first")

    print(f"   rows after clean: {len(df):,}")
    return df.reset_index(drop=True)


# ─── STEP 4: Enrich ───────────────────────────────────────────────
def enrich(df):
    print("\n✨ Enriching with AI-inferred columns...")
    df = df.copy()

    df["category"]      = df["name"].apply(classify_category)
    df["diet_type"]     = df["name"].apply(classify_diet_type)
    df["region"]        = df["name"].apply(classify_region)
    df["meal_type"]     = df.apply(lambda r: classify_meal_type(r["name"], r["category"]), axis=1)
    df["health_tags"]   = df.apply(build_health_tags, axis=1)
    df["glycemic_index"]= df.apply(lambda r: glycemic_index(r["carbs"], r["sugar"], r["fiber"]), axis=1)

    print(f"   category  distribution:\n{df['category'].value_counts().to_string()}")
    print(f"\n   diet_type distribution:\n{df['diet_type'].value_counts().to_string()}")
    print(f"\n   glycemic  distribution:\n{df['glycemic_index'].value_counts().to_string()}")
    return df


# ─── STEP 5: Export ───────────────────────────────────────────────
def export(df):
    print("\n💾 Exporting files...")

    # CSV with lists as JSON strings for compatibility
    export_df = df.copy()
    export_df["meal_type"]   = export_df["meal_type"].apply(json.dumps)
    export_df["health_tags"] = export_df["health_tags"].apply(json.dumps)

    final_cols = ["name","calories","protein","carbs","fat","fiber","sugar",
                  "category","diet_type","region","meal_type","health_tags","glycemic_index"]
    export_df = export_df[final_cols]

    csv_path = os.path.join(OUT_DIR, "enriched_foods.csv")
    export_df.to_csv(csv_path, index=False)
    print(f"   ✓ enriched_foods.csv  → {len(export_df):,} rows  ({os.path.getsize(csv_path)//1024} KB)")

    # ── Sample 10 preview ──────────────────────────────────────
    sample = df.sample(10, random_state=42)[final_cols].copy()
    sample["meal_type"]   = sample["meal_type"].apply(json.dumps)
    sample["health_tags"] = sample["health_tags"].apply(json.dumps)
    sample_path = os.path.join(OUT_DIR, "sample_10.csv")
    sample.to_csv(sample_path, index=False)
    print(f"   ✓ sample_10.csv")

    # ── MongoDB JSON (5 samples) ───────────────────────────────
    mongo_samples = []
    for _, row in df.sample(5, random_state=7).iterrows():
        mongo_samples.append({
            "name":          row["name"],
            "calories":      float(row["calories"]),
            "protein":       float(row["protein"]),
            "carbs":         float(row["carbs"]),
            "fat":           float(row["fat"]),
            "fiber":         float(row["fiber"]),
            "sugar":         float(row["sugar"]),
            "category":      row["category"],
            "diet_type":     row["diet_type"],
            "region":        row["region"],
            "meal_type":     row["meal_type"],
            "health_tags":   row["health_tags"],
            "glycemic_index":row["glycemic_index"],
        })
    mongo_path = os.path.join(OUT_DIR, "mongodb_samples.json")
    with open(mongo_path, "w") as f:
        json.dump(mongo_samples, f, indent=2)
    print(f"   ✓ mongodb_samples.json")

    # ── Stats report ──────────────────────────────────────────
    stats = {
        "total_foods": int(len(df)),
        "columns": list(final_cols),
        "category_distribution": df["category"].value_counts().to_dict(),
        "diet_type_distribution": df["diet_type"].value_counts().to_dict(),
        "glycemic_distribution": df["glycemic_index"].value_counts().to_dict(),
        "region_distribution": df["region"].value_counts().to_dict(),
        "nutrition_stats": {
            "avg_calories": round(float(df["calories"].mean()), 1),
            "avg_protein":  round(float(df["protein"].mean()), 1),
            "avg_carbs":    round(float(df["carbs"].mean()), 1),
            "avg_fat":      round(float(df["fat"].mean()), 1),
        }
    }
    stats_path = os.path.join(OUT_DIR, "pipeline_stats.json")
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"   ✓ pipeline_stats.json")

    return export_df


# ─── STEP 6: Preview ──────────────────────────────────────────────
def preview(df):
    print("\n" + "="*70)
    print("  FINAL COLUMN STRUCTURE")
    print("="*70)
    cols = ["name","calories","protein","carbs","fat","fiber","sugar",
            "category","diet_type","region","meal_type","health_tags","glycemic_index"]
    for c in cols:
        dtype = str(df[c].dtype)
        print(f"  {c:<18} {dtype}")

    print("\n" + "="*70)
    print("  SAMPLE 10 ROWS PREVIEW")
    print("="*70)
    sample = df.sample(10, random_state=42)
    for _, r in sample.iterrows():
        print(f"\n  {r['name'][:45]}")
        print(f"    cal={r['calories']}  P={r['protein']}g  C={r['carbs']}g  F={r['fat']}g")
        print(f"    cat={r['category']}  diet={r['diet_type']}  region={r['region']}")
        print(f"    meals={r['meal_type']}  gi={r['glycemic_index']}")
        print(f"    tags={r['health_tags']}")

    print("\n" + "="*70)
    print("  MONGODB SAMPLE")
    print("="*70)
    mongo_path = os.path.join(OUT_DIR, "mongodb_samples.json")
    with open(mongo_path) as f:
        samples = json.load(f)
    print(json.dumps(samples[0], indent=2))
    print("="*70)


# ─── MAIN ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("="*70)
    print("  NourishAI Food Data Pipeline  |  USDA FoodData Central SR Legacy")
    print("="*70 + "\n")

    raw_dir = download_usda()
    merged  = load_and_merge(raw_dir)
    cleaned = clean(merged)
    enriched = enrich(cleaned)
    exported = export(enriched)
    preview(enriched)

    print("\n✅ Pipeline complete! Files saved to:", OUT_DIR)
