#!/usr/bin/env bash
# Start the Order Tracker server
# Works on Linux and macOS. Use run.bat on Windows.

set -e
cd "$(dirname "$0")"

# Find Python
if command -v python3 >/dev/null 2>&1; then
    PY=python3
elif command -v python >/dev/null 2>&1; then
    PY=python
else
    echo "ERROR: Python 3 not found. Install from python.org"
    exit 1
fi

echo "Using $($PY --version)"

# Install dependencies if needed
if ! $PY -c "import flask, openpyxl" 2>/dev/null; then
    echo "Installing dependencies..."
    $PY -m pip install --user -r requirements.txt
fi

# Start the server
echo ""
echo "=========================================="
echo "Order Tracker starting on http://localhost:5000"
echo "Press Ctrl+C to stop"
echo "=========================================="
exec $PY app.py
