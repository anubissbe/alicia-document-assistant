# PowerShell script for starting Document Writer with all services

param(
    [switch]$debug,
    [switch]$d
)

$debugMode = $debug -or $d

Clear-Host
Write-Host "========================================"
Write-Host "Alicia - Your Personal Document Assistant"
if ($debugMode) {
    Write-Host "[DEBUG MODE ENABLED]" -ForegroundColor Red
}
Write-Host "========================================"
Write-Host ""
Write-Host "Starting all services..."
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Set environment variable for debug mode
if ($debugMode) {
    $env:NODE_ENV = "debug"
    Write-Host "[DEBUG] Debug logging enabled - check console windows for detailed logs" -ForegroundColor Yellow
    Write-Host ""
}

# Start MCP server in a new window
Write-Host "Starting MCP Server in new window..."
if ($debugMode) {
    Start-Process cmd -ArgumentList "/k", "set NODE_ENV=debug && node mcp-server.js --debug" -WindowStyle Normal
} else {
    Start-Process cmd -ArgumentList "/k", "node mcp-server.js" -WindowStyle Normal
}

# Wait a moment for MCP server to start
Start-Sleep -Seconds 2

# Start Python web server in a new window
Write-Host "Starting Web Server in new window..."
Start-Process cmd -ArgumentList "/k", "python -m http.server 8000" -WindowStyle Normal

# Wait a moment
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================"
Write-Host "All services started!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "1. MCP Server running on port 3000"
Write-Host "2. Web Server running on port 8000"
Write-Host "3. Make sure LM Studio is running on port 1234"
Write-Host "4. Image Generation API on 192.168.1.25:8000"
Write-Host ""
Write-Host "Alicia is ready to help you create amazing documents!" -ForegroundColor Green

if ($debugMode) {
    Write-Host ""
    Write-Host "[DEBUG] Open browser console (F12) to see client-side logs" -ForegroundColor Yellow
    Write-Host "[DEBUG] Check MCP Server window for server-side logs" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Opening browser..."

# Open browser with or without debug parameter
if ($debugMode) {
    Start-Process "http://localhost:8000?debug=true"
} else {
    Start-Process "http://localhost:8000"
}

Write-Host ""
Write-Host "Press any key to stop all services..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Kill the services
Write-Host ""
Write-Host "Stopping services..."
Get-Process | Where-Object { $_.MainWindowTitle -like "*MCP Server*" } | Stop-Process -Force
Get-Process | Where-Object { $_.MainWindowTitle -like "*Web Server*" } | Stop-Process -Force

Write-Host ""
Write-Host "All services stopped." -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")