# NourishAI — Premium ML-Powered Diet & Grocery Planner
### MERN Stack + Python ML Microservice + Redis Async Queue

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend :3000                   │
│   Home (Wizard) → DietResult (Charts) → History → Shopping   │
│   MLStatus badge    Framer Motion + Glassmorphism UI         │
└──────────────────────┬──────────────────────────────────────┘
                       │ axios
┌──────────────────────▼──────────────────────────────────────┐
│                  Node.js / Express API :5000                 │
│  /api/auth   /api/diet   /api/history   /api/shopping        │
│  /api/feedback (Redis Queue for Incremental Retraining)      │
└────────┬────────────────────┬────────────────────┬──────────┘
         │ mongoose            │ http (mlService)   │ Bull Queue
┌────────▼──────────┐ ┌───────▼────────────────┐ ┌─▼────────┐
│   MongoDB         │ │ Python Flask ML :5001  │ │  Redis   │
│  Users, Foods     │ │ POST /predict          │ │  :6379   │
│  DietPlans, Lists │ │ POST /retrain          │ │          │
│  Feedback (Data)  │ │ XGBClassifier / RF     │ └──────────┘
└───────────────────┘ └────────────────────────┘ 
```

---

## 🌟 Key Features

### 1. ML Diet Prediction Engine
*   **Predictive Models**: Uses an **XGBoost Classifier** to predict the optimal diet focus (Weight Loss, Muscle Gain, Maintenance) and a **RandomForest Regressor** to predict the exact macronutrient split based on 13 user features.
*   **Auto-Retraining Pipeline**: Features a complete feedback loop. Users rate generated plans and submit data via the Feedback Widget. Once 50 feedback entries are collected, a **Redis (Bull) background queue** silently triggers an asynchronous incremental retrain of the ML models via the Flask API.

### 2. Automated Grocery Shopping List
*   **Ingredient Extraction**: Instantly parses 3 variants of diet plans into a consolidated list of required groceries.
*   **Smart Conversions**: Uses heuristics to convert raw macro calculations into purchase units (e.g. Grams -> Litres of milk, Pieces of roti).
*   **PDF Export**: Uses `pdfkit` to export an organized, checkbox-ready PDF shopping list for printing or offline use.

### 3. Premium UI/UX Experience
*   **Framer Motion Wizard**: The diet generation form uses a highly engaging, animated 3-step wizard to reduce cognitive load.
*   **Dark Glassmorphism**: The interface relies on frosted glass styling (`backdrop-filter`) over an animated mesh gradient background.
*   **Gamification**: Integrates `canvas-confetti` to celebrate when a user successfully generates a plan.
*   **Data Visualization**: Uses Recharts with custom SVG `<linearGradient>` definitions to beautifully display calorie distributions and macro radar charts.

---

## Quick Start

### Prerequisites
- Node.js v18+
- Python 3.10+
- MongoDB running locally
- **Redis Server** running locally (required for background retraining)

### 1 — Install dependencies
```bash
# Python ML dependencies
cd ml && pip install -r requirements.txt && cd ..
 
# Node dependencies (root + server + client)
npm run install:all
```

### 2 — Train Initial ML models (Only needed once)
```bash
npm run train
# Generates dataset → trains RF + XGBoost models → saves .pkl files to ml/models/
```

### 3 — Seed the Food database (Only needed once)
```bash
cd server && node src/seedDatabase.js && cd ..
# Populates MongoDB with regional food data required for meal planning
```

### 4 — Start Database Infrastructure
```bash
# Start MongoDB
mongod --dbpath C:\data\db

# Start Redis (Windows/WSL or standard)
redis-server
```

### 5 — Start everything
```bash
npm run dev
# Starts: ML service (:5001) + Node API (:5000) + React (:3000)
```

| Service | URL |
|---------|-----|
| React app | http://localhost:3000 |
| Node API | http://localhost:5000 |
| ML service | http://localhost:5001 |
| Redis Server | localhost:6379 |

---

## API Reference (Core Routes)

### POST `/api/diet/generate`
Generates 3 plan variants based on user inputs. Queries the ML service for macros/categories and filters the MongoDB `Food` collection by region and allergy to build meal options.

### POST `/api/feedback/submit`
Submits user feedback (1-5 stars) on generated plans. If total feedback documents reach a threshold, a Bull queue job is added to trigger an ML retrain.

### POST `/api/shopping/generate`
Parses the selected `dietPlanId` to reverse-calculate ingredient weight, aggregates duplicates, predicts local INR pricing, and returns a grouped grocery list.

### GET `/api/shopping/:listId/export`
Dynamically renders a `pdfkit` document formatted by category with checkboxes and streams the raw PDF binary down to the browser.

### POST `/retrain` (Flask ML service — internal)
Triggers incremental retraining of the models using a merged dataset of the original synthetic data and the newly submitted MongoDB Feedback logs (via weighted sampling). Auto-creates timestamped backups of old models.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| ML offline badge | Ensure Flask is running: `cd ml && python app.py` |
| Retrain queue failing | Ensure Redis is running (`redis-cli ping` should return `PONG`) |
| No foods in meal plan | Run `node src/seedDatabase.js` from the `server/` folder |
| PDF Export fails | Ensure the `ShoppingList` exists and `pdfkit` is correctly installed. |
| UI Transitions broken | Ensure `framer-motion` is installed in `client/` |
| `pip` not found | Use `python -m pip install -r requirements.txt` |
