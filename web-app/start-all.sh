#!/bin/bash

echo "========================================"
echo "Document Writer - Web Application Setup"
echo "========================================"
echo ""
echo "Starting all services..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start MCP server in background
echo "Starting MCP Server..."
node mcp-server.js &
MCP_PID=$!

# Wait a moment for MCP server to start
sleep 2

# Start Python web server in background
echo "Starting Web Server..."
python -m http.server 8000 &
WEB_PID=$!

# Wait a moment
sleep 2

echo ""
echo "========================================"
echo "All services started!"
echo "========================================"
echo ""
echo "1. MCP Server running on port 3000 (PID: $MCP_PID)"
echo "2. Web Server running on port 8000 (PID: $WEB_PID)"
echo "3. Make sure LM Studio is running on port 1234"
echo ""
echo "Opening browser..."

# Try to open browser based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:8000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:8000 2>/dev/null || echo "Please open http://localhost:8000 in your browser"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    start http://localhost:8000
fi

echo ""
echo "Press Ctrl+C to stop all services..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $MCP_PID 2>/dev/null
    kill $WEB_PID 2>/dev/null
    echo "All services stopped."
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup INT

# Wait indefinitely
while true; do
    sleep 1
done