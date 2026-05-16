@echo off
title Catch Item Game Server

echo.
echo  ================================================
echo   CATCH ITEM GAME - Starting Server...
echo  ================================================
echo.

:: Check if .venv exists
if not exist ".venv\Scripts\activate.bat" (
    echo  [ERROR] Virtual environment not found!
    echo  Please run the following command first:
    echo.
    echo    python -m venv .venv
    echo    .venv\Scripts\activate
    echo    pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

:: Activate virtual environment
echo  [1/3] Activating virtual environment...
call .venv\Scripts\activate.bat

:: Check if dependencies are installed
echo  [2/3] Checking dependencies...
python -c "import fastapi, uvicorn, jinja2, itsdangerous, openpyxl" 2>nul
if errorlevel 1 (
    echo  [INFO] Installing dependencies...
    pip install -r requirements.txt
    echo.
)

:: Start the server
echo  [3/3] Starting server...
echo.
echo  ================================================
echo   Server running at: http://127.0.0.1:8000
echo   Admin panel at:    http://127.0.0.1:8000/admin
echo.
echo   Press CTRL+C to stop the server
echo  ================================================
echo.

python main.py

:: If server stops
echo.
echo  [INFO] Server stopped.
pause
