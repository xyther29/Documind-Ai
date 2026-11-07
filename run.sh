#!/usr/bin/env bash
# ==============================================================================
# DocuMind AI — One-Command Launch Script
# ==============================================================================
# Usage:
#   ./run.sh          # Production mode (FastAPI serving built React bundle)
#   ./run.sh --dev    # Development mode (FastAPI + Vite dev server concurrently)
#   ./run.sh --help   # Display help instructions
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEV_MODE=false
for arg in "$@"; do
  case "$arg" in
    --dev)
      DEV_MODE=true
      ;;
    --help|-h)
      echo "DocuMind AI Launcher"
      echo "Usage:"
      echo "  ./run.sh          Run production server (FastAPI serving React SPA)"
      echo "  ./run.sh --dev    Run dev environment (FastAPI + Vite with hot reload)"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg"
      echo "Use ./run.sh --help for available options."
      exit 1
      ;;
  esac
done

echo "============================================================"
echo "  DocuMind AI — Document Q&A Learning Workspace"
echo "============================================================"

# ------------------------------------------------------------------------------
# 1. Environment & Runtime Validation
# ------------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed or not in PATH."
  echo "Please install Node.js v20+ to proceed."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH."
  exit 1
fi

PYTHON_BIN=""
if [ -x ".venv/bin/python" ]; then
  PYTHON_BIN=".venv/bin/python"
elif command -v python3.12 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3.12)"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
else
  echo "Error: Python 3.12+ was not found on your system."
  exit 1
fi

# Verify Python version >= 3.12
PYTHON_OK=$("$PYTHON_BIN" -c 'import sys; print(int(sys.version_info >= (3, 12)))' 2>/dev/null || echo 0)
if [ "$PYTHON_OK" != "1" ]; then
  echo "Error: Python 3.12 or higher is required. Found: $("$PYTHON_BIN" --version 2>&1)"
  exit 1
fi

# ------------------------------------------------------------------------------
# 2. Virtual Environment & Dependencies
# ------------------------------------------------------------------------------
if [ ! -d ".venv" ]; then
  echo "--> Creating Python virtual environment in .venv..."
  "$PYTHON_BIN" -m venv .venv
fi
PYTHON_BIN=".venv/bin/python"

# Verify requirements are installed
if ! "$PYTHON_BIN" -c 'import fastapi, pypdf, sklearn, httpx, dotenv' >/dev/null 2>&1; then
  echo "--> Installing backend dependencies from requirements.txt..."
  "$PYTHON_BIN" -m pip install -q -r requirements.txt
fi

# Verify frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
  echo "--> Installing frontend dependencies in frontend/node_modules..."
  npm install --prefix frontend --silent
fi

# ------------------------------------------------------------------------------
# 3. Host and Port Resolution
# ------------------------------------------------------------------------------
HOST="127.0.0.1"
PORT=8000

if [ -f ".env" ]; then
  # Safely parse HOST and PORT without running bash eval on secrets
  ENV_HOST=$(grep -E '^[[:space:]]*HOST=' .env | cut -d '=' -f2- | tr -d ' "\r\n' || true)
  ENV_PORT=$(grep -E '^[[:space:]]*PORT=' .env | cut -d '=' -f2- | tr -d ' "\r\n' || true)
  if [ -n "$ENV_HOST" ]; then HOST="$ENV_HOST"; fi
  if [ -n "$ENV_PORT" ]; then PORT="$ENV_PORT"; fi
fi

# Check if target port is already in use
PORT_BUSY=$("$PYTHON_BIN" -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.bind(('$HOST', int('$PORT')))
    s.close()
    print('0')
except Exception:
    print('1')
")

if [ "$PORT_BUSY" = "1" ]; then
  echo "Error: Port $PORT on $HOST is already in use by another process."
  echo "Please terminate the process listening on port $PORT or configure another PORT in .env."
  exit 1
fi

# ------------------------------------------------------------------------------
# 4. Production Build Verification
# ------------------------------------------------------------------------------
BUILD_NEEDED=false
if [ ! -f "frontend/dist/index.html" ]; then
  BUILD_NEEDED=true
fi

# Check if any frontend src file is newer than dist/index.html
if [ "$BUILD_NEEDED" = false ]; then
  if [ -n "$(find frontend/src -type f -newer frontend/dist/index.html 2>/dev/null | head -n 1)" ]; then
    BUILD_NEEDED=true
  fi
fi

if [ "$BUILD_NEEDED" = true ] && [ "$DEV_MODE" = false ]; then
  echo "--> Compiling React production bundle (frontend/dist)..."
  npm run build --prefix frontend --silent
fi

# Ensure canonical demo PDF is generated
if [ ! -f "demo/sample_rag_primer.pdf" ]; then
  echo "--> Generating canonical sample demo PDF (demo/sample_rag_primer.pdf)..."
  "$PYTHON_BIN" demo/generate_sample_pdf.py
fi

# ------------------------------------------------------------------------------
# 5. Application Launch & Signal Handling
# ------------------------------------------------------------------------------
CHILD_PIDS=()

cleanup() {
  echo ""
  echo "--> Shutting down DocuMind AI..."
  for pid in "${CHILD_PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -TERM "$pid" >/dev/null 2>&1 || true
    fi
  done
  wait >/dev/null 2>&1 || true
  echo "DocuMind AI terminated cleanly."
}

trap cleanup SIGINT SIGTERM EXIT

if [ "$DEV_MODE" = true ]; then
  echo "============================================================"
  echo "  Starting DocuMind AI in DEVELOPMENT mode"
  echo "  - Backend API:  http://$HOST:$PORT (with auto-reload)"
  echo "  - Vite Dev:     http://localhost:5173 (with hot module reload)"
  echo "============================================================"

  # Start FastAPI with reload in background
  .venv/bin/uvicorn app.main:app --host "$HOST" --port "$PORT" --reload &
  CHILD_PIDS+=($!)

  # Start Vite dev server in background
  npm run dev --prefix frontend &
  CHILD_PIDS+=($!)

  # Wait for both processes
  wait
else
  echo "============================================================"
  echo "  DocuMind AI running in PRODUCTION mode"
  echo "  Application URL: http://$HOST:$PORT"
  echo "  Press Ctrl+C to terminate."
  echo "============================================================"

  # Start Uvicorn serving SPA and API
  .venv/bin/uvicorn app.main:app --host "$HOST" --port "$PORT" &
  CHILD_PIDS+=($!)

  wait
fi
