@echo off
setlocal enabledelayedexpansion

REM Check for debug flag
set DEBUG_MODE=0
if "%1"=="--debug" set DEBUG_MODE=1
if "%1"=="-d" set DEBUG_MODE=1

echo ========================================
echo Document Writer - Web Application Setup
if !DEBUG_MODE!==1 (
    echo [DEBUG MODE ENABLED]
)
echo ========================================
echo.
echo This application requires:
echo 1. MCP Server running on port 3000 (for web search)
echo 2. LM Studio running on port 1234 (for AI generation)
echo 3. Image Generation API on 192.168.1.25:8000
echo 4. A web server for the frontend
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Set environment variable for debug mode
if !DEBUG_MODE!==1 (
    set NODE_ENV=debug
    echo [DEBUG] Debug logging enabled
)

REM Start MCP server
echo.
echo MCP Server is starting...
echo.
echo To complete the setup:
echo 1. Open a new terminal and run: python -m http.server 8000
echo 2. Start LM Studio with a model loaded on port 1234
echo 3. Open your browser to: http://localhost:8000
echo.
echo Press Ctrl+C to stop the MCP server
echo.

if !DEBUG_MODE!==1 (
    node mcp-server.js --debug
) else (
    node mcp-server.js
)