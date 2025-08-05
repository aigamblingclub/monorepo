#!/bin/bash

# Test script to verify room functionality

echo "=== Testing Room Functionality ==="
echo ""

# Stop any existing agents
./multiagent/multi-agent.sh stop

echo "Starting test agents in different rooms..."
echo ""

# Start 2 agents in room1
echo "Starting agents in room1..."
POKER_ROOM_ID="room1" ./multiagent/multi-agent.sh -a characters/grinder.json,characters/showman.json -p 4000 -d

sleep 3

# Start 2 agents in room2
echo "Starting agents in room2..."
POKER_ROOM_ID="room2" ./multiagent/multi-agent.sh -a characters/strategist.json,characters/wildcard.json -p 4100 -d

sleep 3

# Check status
echo ""
echo "Checking agent status..."
./multiagent/multi-agent.sh status

# Check logs to verify room assignments
echo ""
echo "Verifying room assignments..."
echo ""
echo "Room 1 agents:"
grep -h "Connecting to WebSocket.*room=room1" logs/*.log | tail -2
echo ""
echo "Room 2 agents:"
grep -h "Connecting to WebSocket.*room=room2" logs/*.log | tail -2

echo ""
echo "Test complete. Agents are running in separate rooms."
echo "Use './multiagent/multi-agent.sh stop' to stop all agents."