@echo off
echo ========================================
echo Document Writer - Web Application Setup
echo ========================================
echo.
echo This application requires:
echo 1. MCP Server running on port 3000 (for web search)
echo 2. LM Studio running on port 1234 (for AI generation)
echo 3. A web server for the frontend
echo.
echo Starting MCP Server...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
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

node mcp-server.js