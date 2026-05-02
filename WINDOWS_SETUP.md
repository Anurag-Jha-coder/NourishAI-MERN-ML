# NourishAI — Windows Setup Guide

## Prerequisites

### 1. Install Python 3.10+
- Download from: https://www.python.org/downloads/
- Run installer → **CHECK "Add Python to PATH"** ✅
- Verify: open Command Prompt → `python --version`

### 2. Install Node.js v18+
- Download LTS from: https://nodejs.org/
- Run installer (all defaults are fine)
- Verify: open Command Prompt → `node --version`

### 3. Install MongoDB Community Edition
- Download: https://www.mongodb.com/try/download/community
- Run installer → choose **"Complete"**
- MongoDB installs as a Windows Service (starts automatically on boot)
- Optional: also install **MongoDB Compass** (GUI) when prompted

---

## First-Time Setup

### Option A — Double-click (easiest)
1. Unzip `NourishAI-MERN-ML-WINDOWS.zip`
2. Open the `diet-app` folder
3. Double-click **`setup.bat`** — installs all Python and Node dependencies
4. Wait until you see "Setup complete!" in all windows

### Option B — PowerShell
1. Right-click **`setup.ps1`** → **"Run with PowerShell"**
   - If you get a security error, open PowerShell **as Administrator** and run:
     ```powershell
     Set-ExecutionPolicy RemoteSigned
     ```
   - Then try again

### Option C — Manual (Command Prompt, step by step)
```cmd
cd diet-app

:: Step 1 — Install Python ML packages
cd ml
python -m pip install -r requirements.txt
cd ..

:: Step 2 — Install Node packages (root, server, client)
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

---

## Seed the Food Database (Once)

After dependencies are installed, populate MongoDB with food data:

```cmd
cd diet-app\server
node src\seedDatabase.js
```

You should see output like:
```
✅ MongoDB connected
🌱 Seeding food database...
✅ Done — X foods inserted
```

> **This step is required.** Without it, meal plans will be empty even if the ML service is running correctly.

---

## Start the App (Every Time)

### Option A — Double-click (easiest)
Double-click **`start.bat`** — opens 3 Command Prompt windows automatically:
- Window 1: ML service (Flask, port 5001)
- Window 2: Node API (Express, port 5000)
- Window 3: React app (port 3000)

Then open **http://localhost:3000** in your browser.

### Option B — Manual (3 separate Command Prompt windows)

**Window 1 — ML Service (Flask):**
```cmd
cd diet-app\ml
python app.py
```
Wait for: `🤖 ML Service running on http://localhost:5001`

**Window 2 — Node API:**
```cmd
cd diet-app\server
npm run dev
```
Wait for: `✅ MongoDB connected` and `🚀 Server running on http://localhost:5000`

**Window 3 — React App:**
```cmd
cd diet-app\client
npm start
```
Wait for: browser opens automatically at **http://localhost:3000**

---

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| React app | http://localhost:3000 | Main UI |
| Node API | http://localhost:5000 | REST API |
| ML service | http://localhost:5001 | Flask predictions |
| API health | http://localhost:5000/api/health | Check Node is up |
| ML health | http://localhost:5001/health | Check Flask + model status |

---

## Retrain Models (Optional)

Pre-trained models are included and ready to use. To retrain from scratch:

```cmd
:: Option A — Double-click
retrain.bat

:: Option B — Manual
cd diet-app\ml
python generate_dataset.py
python train_models.py
```

This regenerates `ml/data/diet_dataset.csv` and saves new `.pkl` files to `ml/models/`.

---

## Troubleshooting

### `python` is not recognized
- Reinstall Python and make sure **"Add Python to PATH"** is checked
- Or use the full path:
  ```cmd
  C:\Users\YourName\AppData\Local\Programs\Python\Python312\python.exe app.py
  ```

### `pip` is not recognized
```cmd
python -m pip install -r requirements.txt
```

### `npm` or `node` is not recognized
- Reinstall Node.js from https://nodejs.org/ and restart Command Prompt

### MongoDB connection error (`❌ MongoDB connection failed`)
1. Open **Services**: press `Win+R`, type `services.msc`, find **MongoDB** → click **Start**
2. Or run manually:
   ```cmd
   mkdir C:\data\db
   mongod --dbpath C:\data\db
   ```

### Meal plans are empty (no foods shown)
Run the database seeder:
```cmd
cd diet-app\server
node src\seedDatabase.js
```

### ML badge shows "Offline" (red dot in app)
- Make sure Window 1 (ML service) is running and shows `ML Service running`
- Check http://localhost:5001/health in your browser
- Restart it: `cd diet-app\ml && python app.py`

### Port already in use
- Change `PORT=5000` in `server\.env`
- Change ML port: edit `ML_PORT=5001` in `server\.env` and the last line of `ml\app.py`

### `Module not found` (Node)
```cmd
cd diet-app
npm run install:all
```

### `ModuleNotFoundError` (Python)
```cmd
cd diet-app\ml
python -m pip install -r requirements.txt
```

### JWT / login errors
- Make sure `JWT_SECRET` is set in `server\.env`
- Default value: `nourish_ai_super_secret_key_change_in_production`
