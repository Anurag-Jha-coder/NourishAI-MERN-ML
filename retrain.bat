@echo off
echo ============================================
echo   NourishAI - Retrain ML Models
echo ============================================
echo.
echo This will regenerate the dataset and retrain
echo RandomForest models. Takes ~60 seconds.
echo.
pause

cd /d %~dp0ml

echo [1/2] Generating dataset (10,000 rows)...
python generate_dataset.py
IF %ERRORLEVEL% NEQ 0 ( echo ERROR in dataset generation. & pause & exit /b 1 )

echo.
echo [2/2] Training ML models...
python train_models.py
IF %ERRORLEVEL% NEQ 0 ( echo ERROR in model training. & pause & exit /b 1 )

echo.
echo ============================================
echo Models retrained and saved to ml\models\
echo ============================================
pause
