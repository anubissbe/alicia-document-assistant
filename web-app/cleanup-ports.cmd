@echo off
echo ========================================
echo Cleaning up ports for Document Writer
echo ========================================
echo.

REM Kill processes on port 3000 (MCP Server)
echo Checking port 3000...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel%==0 (
    echo Found process on port 3000, killing it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        echo Killing PID %%a
        taskkill /PID %%a /F
    )
) else (
    echo Port 3000 is free
)

REM Kill processes on port 8000 (Python server)
echo.
echo Checking port 8000...
netstat -ano | findstr :8000 >nul 2>&1
if %errorlevel%==0 (
    echo Found process on port 8000, killing it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
        echo Killing PID %%a
        taskkill /PID %%a /F
    )
) else (
    echo Port 8000 is free
)

REM Kill any leftover node processes
echo.
echo Cleaning up Node.js processes...
taskkill /FI "WindowTitle eq MCP Server*" /F >nul 2>&1
taskkill /FI "WindowTitle eq Web Server*" /F >nul 2>&1
taskkill /IM node.exe /F >nul 2>&1

echo.
echo ========================================
echo Cleanup complete! Ports should be free.
echo ========================================
pause