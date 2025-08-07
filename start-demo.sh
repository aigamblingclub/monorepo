#!/bin/bash

echo "🎰 Starting Poker Agent Demo..."

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down demo..."
    if [ ! -z "$POKER_PID" ]; then
        kill $POKER_PID 2>/dev/null
    fi
    if [ ! -z "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null
    fi
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM

# Start poker server
echo "🃏 Starting poker server..."
bun run packages/server-poker/src/multi-room-index.ts &
POKER_PID=$!

# Wait for poker server to start
sleep 3

# Start web frontend
echo "🌐 Starting web frontend..."
cd packages/web && bun run dev &
WEB_PID=$!
cd ..

# Wait for web server to start
sleep 3

echo ""
echo "✅ Demo is ready!"
echo ""
echo "📊 Servers:"
echo "   Poker Server: http://localhost:3001"
echo "   Web Frontend: http://localhost:3002"
echo ""
echo "🎮 How to use:"
echo "   1. Open http://localhost:3002 in your browser"
echo "   2. Type 'start game' in the chat"
echo "   3. Watch AI agents play poker!"
echo ""
echo "💡 Tips:"
echo "   - Type 'room: [name]' to switch rooms"
echo "   - Multiple rooms can run simultaneously"
echo "   - Agents automatically join and play poker"
echo ""
echo "Press Ctrl+C to stop the demo"

# Keep script running until interrupted
while true; do
    sleep 1
done