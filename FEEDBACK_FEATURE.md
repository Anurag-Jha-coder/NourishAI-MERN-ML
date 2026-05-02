# NourishAI — Feedback & Incremental Retraining Feature

## Overview

This feature lets users submit detailed feedback on their generated diet plans.
The feedback is saved to MongoDB and, once 50 feedback documents accumulate,
automatically triggers the Python ML service to retrain its models using the
real user data — making future recommendations more accurate over time.

---

## Architecture

```
React FeedbackWidget
        │  POST /api/feedback
        ▼
Node.js feedbackController
        │  saves Feedback doc to MongoDB
        │  if total docs >= 50 → addToQueue()
        ▼
Bull Queue (Redis :6379)  ←  retrainQueue.js
        │  checks 24h cooldown via Settings collection
        │  POST /retrain  { min_samples: 50 }
        ▼
Flask ML Service  ←  retrain.py
        │  loads base CSV + MongoDB feedback
        │  retrains RandomForest + XGBoost with sample_weight
        │  saves new .pkl files (backs up old ones)
        │  updates model_metrics.json
        │  hot-reloads models in memory
        ▼
Next prediction uses the updated models
```

---

## Files

### Server (Node.js)

#### `server/src/models/Feedback.js`
Mongoose schema for feedback documents.

Fields:
- `user` — ObjectId ref to User
- `dietPlan` — ObjectId ref to DietPlan
- `rating` — Number 1–5 (required)
- `foods_eaten` — array of food name strings
- `foods_skipped` — array of food name strings
- `goal_progress.weight_change_kg` — optional Number
- `goal_progress.energy_level` — Number 1–5
- `goal_progress.hunger_level` — Number 1–5
- `profile_snapshot` — denormalised copy of age, gender, weight, height, activity, goal, health_condition, region, dietType
- `actual_diet_category` — optional String override
- `created_at` — Date, default now

#### `server/src/models/Settings.js`
Singleton collection (one document, key = `'global'`).
Stores `last_retrain_at` timestamp to enforce the 24-hour retraining cooldown.

#### `server/src/controllers/feedbackController.js`
Handles `POST /api/feedback`.

Steps:
1. Validates `dietPlanId` and `rating` (1–5)
2. Validates optional `energy_level` / `hunger_level` range
3. Fetches the DietPlan from MongoDB to build the `profile_snapshot`
4. Checks `feedback_submitted` flag — returns 409 if already submitted
5. Saves the Feedback document
6. Sets `feedback_submitted = true` on the DietPlan
7. Counts total Feedback documents
8. If count >= 50, calls `addToQueue()` to trigger retraining

#### `server/src/utils/retrainQueue.js`
Bull queue named `retrain-queue` connected to Redis on `localhost:6379`.

Queue processor logic:
1. Counts total Feedback docs in MongoDB
2. If count < 50 → skips (not enough data)
3. Fetches Settings singleton — checks `last_retrain_at`
4. If last retrain was < 24 hours ago → skips (cooldown active)
5. POSTs to `http://localhost:5001/retrain` with `{ min_samples: 50 }`
6. On success → updates `last_retrain_at` in Settings

Error handling:
- If Redis is not running, the queue initialisation silently fails — feedback still saves, retraining is just disabled
- Failed retrain jobs are retried 3 times with exponential backoff (30s → 60s → 120s)
- Failed jobs never crash the server

Exported function: `addToQueue(meta)` — safe to call even when Redis is down.

#### `server/src/routes/feedback.js`
```
POST /api/feedback   →  submitFeedback  (JWT protected)
```

#### `server/src/routes/diet.js` (updated)
```
PATCH /api/diet/:id/mark-feedback  →  markFeedbackSubmitted  (JWT protected)
```
Flips `feedback_submitted = true` on the DietPlan after the widget submits.

#### `server/src/models/DietPlan.js` (updated)
Added field:
```js
feedback_submitted: { type: Boolean, default: false }
```
The `FeedbackWidget` checks this to disable itself after one submission per plan.

---

### Python ML Service

#### `ml/retrain.py`
Full retraining module. Called by the Flask `/retrain` route.

Steps:
1. Loads base dataset (`real_diet_dataset.csv` or `diet_dataset.csv`)
2. Connects to MongoDB via `pymongo` and fetches all Feedback documents
3. Transforms each feedback doc into a 13-feature training row:
   - Features: `age, gender, weight_kg, height_cm, bmi, activity_level, goal_encoded, condition_encoded, region_encoded, bmi_sq, age_activity, weight_height, age_group`
   - Target regression: `protein_pct, carbs_pct, fat_pct`
   - Target classification: `diet_category`
4. Assigns `sample_weight = 2.0` to feedback rows, `1.0` to base rows
5. Combines both datasets and does an 80/20 train/test split
6. Retrains `RandomForestRegressor` (macros) with sample weights
7. Retrains `XGBClassifier` (diet category) with sample weights
8. Backs up old `.pkl` files with a timestamp suffix (e.g. `macro_regressor.pkl.bak.20240428_183000`)
9. Saves new `.pkl` files to `ml/models/`
10. Updates `model_metrics.json` with new R² and accuracy scores

Returns a dict: `{ success, message, metrics, counts, timestamp }`

#### `ml/app.py` (updated)
Added route:
```
POST /retrain   →  retrain()
```
- Calls `run_retrain()` from `retrain.py`
- On success, hot-reloads `macro_regressor`, `classifier`, and `model_metrics` into memory
- Returns the retrain result dict as JSON

---

### React Client

#### `client/src/components/FeedbackWidget.js`
React component that receives a `dietPlan` prop.

Props:
```js
dietPlan = {
  _id: String,               // plan ID for API calls
  feedback_submitted: Boolean, // disables widget if true
  meals: Array               // used to extract food names
}
```

UI sections:
1. **5-star rating** — required before submit
2. **Food checklist** — every food item from the plan shown with "Ate it ✓" / "Skipped ✗" toggle buttons
3. **Optional section** (collapsed by default):
   - Energy level slider (1–5)
   - Hunger level slider (1–5)
   - Weight change input (number, supports negative)
4. **Submit button** — disabled until rating is selected

On submit:
1. `POST /api/feedback` — sends rating, foods_eaten, foods_skipped, goal_progress
2. `PATCH /api/diet/:id/mark-feedback` — flips feedback_submitted on the plan
3. Shows success toast: `"Feedback saved — helps improve your future plans! 🚀"`
4. Widget switches to a "thank you" state and cannot be submitted again

States:
- **Disabled** if `feedback_submitted = true` (already submitted)
- **Locked** if user is not logged in (shows login prompt)

#### `client/src/components/FeedbackWidget.css`
Styles for the widget with animated entry, star hover effects, food item colour coding (green for eaten, red for skipped), slider ticks, and responsive layout.

---

## API Reference

### POST `/api/feedback`
**Auth:** Bearer token required

**Body:**
```json
{
  "dietPlanId": "64f3a...",
  "rating": 4,
  "foods_eaten": ["Dal", "Rice", "Roti"],
  "foods_skipped": ["Paneer"],
  "goal_progress": {
    "energy_level": 4,
    "hunger_level": 2,
    "weight_change_kg": -0.5
  },
  "actual_diet_category": "weight_loss"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback saved. Thank you!",
  "data": { "feedbackId": "64f3b..." }
}
```

**Error codes:**
- `400` — missing dietPlanId or invalid rating/levels
- `404` — plan not found or belongs to another user
- `409` — feedback already submitted for this plan

---

### PATCH `/api/diet/:id/mark-feedback`
**Auth:** Bearer token required

**Response:**
```json
{ "success": true, "feedback_submitted": true }
```

---

### POST `/retrain` (Flask, port 5001)
Called by the Bull queue — not called directly from the browser.

**Body:**
```json
{ "min_samples": 50 }
```

**Response (success):**
```json
{
  "success": true,
  "message": "Retrain complete.",
  "metrics": {
    "regression_r2": 0.9612,
    "classifier_accuracy": 0.9234
  },
  "counts": {
    "base": 10000,
    "feedback": 53,
    "total": 10053
  },
  "timestamp": "20240428_183000"
}
```

---

## Redis Setup

Redis is required for the Bull queue. It runs on **port 6379** (default).

### Windows (already installed)
Redis runs as a Windows Service and starts automatically on boot.

Verify it is running:
```powershell
Get-Service -Name Redis
```
Expected: `Status = Running`

Test connection:
```powershell
& "C:\Program Files\Redis\redis-cli.exe" ping
```
Expected: `PONG`

### Environment variables (optional overrides)
Add to `server/.env` if your Redis is on a different host/port:
```
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## How Retraining is Triggered

```
User submits feedback
        ↓
feedbackController counts total Feedback docs
        ↓
total >= 50?  YES → addToQueue()
        ↓
Bull queue processor runs (async, non-blocking)
        ↓
last retrain < 24 hours ago?  YES → skip
        ↓
POST /retrain to Flask
        ↓
retrain.py runs (may take 1–3 minutes)
        ↓
new models saved + hot-reloaded
        ↓
next /predict uses improved models
```

The retraining is **completely non-blocking** — the API responds to the user immediately, and retraining happens in the background.

---

## Sample Weights Explained

| Row type | `sample_weight` | Why |
|----------|----------------|-----|
| Base synthetic/real dataset | `1.0` | Standard weight |
| User feedback rows | `2.0` | Real-world signal, twice as important |

Feedback rows with low energy (< 3) get +5% carbs.
Feedback rows with high hunger (> 3) get +5% protein.
These adjustments are applied before training so the model learns from real user experience.

---

## Model Backup Strategy

Before saving new `.pkl` files, `retrain.py` copies the current ones with a timestamp:
```
macro_regressor.pkl  →  macro_regressor.pkl.bak.20240428_183000
diet_classifier.pkl  →  diet_classifier.pkl.bak.20240428_183000
```

To roll back to a previous model:
```powershell
copy ml\models\macro_regressor.pkl.bak.20240428_183000 ml\models\macro_regressor.pkl
copy ml\models\diet_classifier.pkl.bak.20240428_183000 ml\models\diet_classifier.pkl
```
Then restart the Flask server to reload them.

---

## Running the Full Stack

```powershell
# Terminal 1 — ML Service
cd ml
python app.py

# Terminal 2 — Node.js Server
cd server
npm run dev

# Terminal 3 — React Client
cd client
npm start
```

Redis runs automatically as a Windows Service — no manual start needed.

---

## Dependency Summary

### Node.js (added to server)
```
bull       — Redis-backed job queue
axios      — HTTP client (used by retrainQueue to call Flask)
```

Install: `npm install bull axios` (already done)

### Python (added to ml)
```
pymongo>=4.6.0  — MongoDB driver for retrain.py
```

Install: `python -m pip install pymongo`
