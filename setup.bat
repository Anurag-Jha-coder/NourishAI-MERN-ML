@echo off
echo ============================================
echo   NourishAI - Windows Setup Script
echo ============================================
echo.

:: Check Python
echo [1/4] Checking Python...
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found!
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)
python --version
echo Python OK.
echo.

:: Check Node
echo [2/4] Checking Node.js...
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo Node.js OK.
echo.

:: Install Python dependencies
echo [3/4] Installing Python ML dependencies...
cd ml
python -m pip install -r requirements.txt
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install Python dependencies.
    pause
    exit /b 1
)
cd ..
echo Python deps OK.
echo.

:: Install Node dependencies
echo [4/4] Installing Node.js dependencies...
call npm install
cd server && call npm install && cd ..
cd client && call npm install && cd ..
echo Node deps OK.
echo.

echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo Next steps:
echo   1. Start MongoDB  (run: mongod)
echo   2. Run the app    (run: start.bat)
echo.
pause
