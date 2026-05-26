@echo off
REM Start the Order Tracker server on Windows

cd /d "%~dp0"

REM Find Python
where python >nul 2>&1
if %errorlevel% equ 0 (
    set PY=python
) else (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        set PY=py
    ) else (
        echo ERROR: Python 3 not found. Install from python.org
        pause
        exit /b 1
    )
)

echo Using:
%PY% --version

REM Install dependencies if needed
%PY% -c "import flask, openpyxl" 2>nul
if %errorlevel% neq 0 (
    echo Installing dependencies...
    %PY% -m pip install --user -r requirements.txt
)

echo.
echo ==========================================
echo Order Tracker starting on http://localhost:5000
echo Press Ctrl+C to stop
echo ==========================================
%PY% app.py
pause
