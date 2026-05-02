@echo off
echo ============================================
echo   NourishAI - Starting All Services
echo ============================================
echo.
echo Starting 3 services in separate windows...
echo.

:: Start ML Flask service in new window
echo [1/3] Starting ML service on http://localhost:5001
start "NourishAI - ML Service" cmd /k "cd /d %~dp0ml && python app.py"

:: Wait 3 seconds for ML to boot
timeout /t 3 /nobreak >nul

:: Start Node.js server in new window
echo [2/3] Starting Node API on http://localhost:5000
start "NourishAI - Node API" cmd /k "cd /d %~dp0server && npm run dev"

:: Wait 2 seconds
timeout /t 2 /nobreak >nul

:: Start React client in new window
echo [3/3] Starting React app on http://localhost:3000
start "NourishAI - React App" cmd /k "cd /d %~dp0client && npm start"

echo.
echo ============================================
echo All services starting in separate windows!
echo.
echo   React App  : http://localhost:3000
echo   Node API   : http://localhost:5000
echo   ML Service : http://localhost:5001
echo   ML Health  : http://localhost:5001/health
echo   ML Metrics : http://localhost:5001/metrics
echo ============================================
echo.
echo Make sure MongoDB is running (mongod).
echo Close the 3 service windows to stop the app.
echo.
pause
