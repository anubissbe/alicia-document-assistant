#!/bin/bash

echo "========================================"
echo "Document Writer - Web Application Setup"
echo "========================================"
echo ""
echo "This application requires:"
echo "1. MCP Server running on port 3000 (for web search)"
echo "2. LM Studio running on port 1234 (for AI generation)"
echo "3. A web server for the frontend"
echo ""
echo "Starting MCP Server..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start MCP server
node mcp-server.js &
MCP_PID=$!

echo ""
echo "MCP Server started (PID: $MCP_PID)"
echo ""
echo "To complete the setup:"
echo "1. Open a new terminal and run: python -m http.server 8000"
echo "2. Start LM Studio with a model loaded on port 1234"
echo "3. Open your browser to: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop the MCP server"
echo ""

# Wait for user to stop
wait $MCP_PID