@echo off

REM Check for debug flag
set DEBUG_MODE=0
set BROWSER_URL=http://localhost:8000
if "%1"=="--debug" set DEBUG_MODE=1
if "%1"=="-d" set DEBUG_MODE=1
if "%DEBUG_MODE%"=="1" set BROWSER_URL=http://localhost:8000?debug=true

echo ========================================
echo Document Writer - Web Application Setup
if "%DEBUG_MODE%"=="1" (
    echo [DEBUG MODE ENABLED]
)
echo ========================================
echo.
echo Starting all services...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Set environment variable for debug mode
if "%DEBUG_MODE%"=="1" (
    set NODE_ENV=debug
    echo [DEBUG] Debug logging enabled - check console windows for detailed logs
    echo.
)

REM Start MCP server in a new window
echo Starting MCP Server in new window...
if "%DEBUG_MODE%"=="1" (
    start "MCP Server - DEBUG MODE" cmd /k "set NODE_ENV=debug && node mcp-server.js --debug"
) else (
    start "MCP Server" cmd /k "node mcp-server.js"
)

REM Wait a moment for MCP server to start
ping -n 3 127.0.0.1 >nul

REM Start Python web server in a new window
echo Starting Web Server in new window...
start "Web Server" cmd /k "python -m http.server 8000"

REM Wait a moment
ping -n 3 127.0.0.1 >nul

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo 1. MCP Server running on port 3000
echo 2. Web Server running on port 8000
echo 3. Make sure LM Studio is running on port 1234
echo 4. Image Generation API on 192.168.1.25:8000
if "%DEBUG_MODE%"=="1" (
    echo.
    echo [DEBUG] Open browser console (F12) to see client-side logs
    echo [DEBUG] Check MCP Server window for server-side logs
)
echo.
echo Opening browser...
start "" "%BROWSER_URL%"
echo.
echo Press any key to stop all services...
pause >nul

REM Kill the services
echo.
echo Stopping services...
taskkill /FI "WindowTitle eq MCP Server*" /F >nul 2>&1
taskkill /FI "WindowTitle eq Web Server*" /F >nul 2>&1
echo.
echo All services stopped.
pause