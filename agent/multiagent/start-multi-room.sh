#!/bin/bash

# Multi-Room Poker Agent Starter Script
# This script demonstrates how to start agents in different poker rooms

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MULTI_AGENT_SCRIPT="$SCRIPT_DIR/multi-agent.sh"

echo "=== Starting Multi-Room Poker Agents ==="
echo ""

# Function to start agents in a specific room
start_room_agents() {
    local room_id=$1
    shift
    local agents=("$@")
    
    echo "Starting agents in room: $room_id"
    echo "Agents: ${agents[@]}"
    
    # Set room ID environment variable and start agents
    POKER_ROOM_ID="$room_id" "$MULTI_AGENT_SCRIPT" -a "$(IFS=,; echo "${agents[*]}")" -d
    
    echo ""
}

# Example 1: Using room-specific character files
echo "Method 1: Using room-specific character files"
echo "============================================"
"$MULTI_AGENT_SCRIPT" -a characters/grinder-room1.json,characters/showman-room1.json -p 3100 -d
sleep 2
"$MULTI_AGENT_SCRIPT" -a characters/strategist-room2.json,characters/wildcard-room2.json -p 3200 -d

echo ""
echo "Method 2: Using environment variables"
echo "===================================="

# Stop all agents first
"$MULTI_AGENT_SCRIPT" stop

# Start Room 1 agents
echo "Starting Room 1 agents..."
POKER_ROOM_ID="room1" "$MULTI_AGENT_SCRIPT" -a characters/grinder.json,characters/showman.json,characters/veteran.json -p 3300 -d

sleep 3

# Start Room 2 agents
echo "Starting Room 2 agents..."
POKER_ROOM_ID="room2" "$MULTI_AGENT_SCRIPT" -a characters/strategist.json,characters/wildcard.json,characters/trickster.json -p 3400 -d

echo ""
echo "=== All agents started ==="
echo ""
echo "Room 1 agents (grinder, showman, veteran) on ports starting from 3300"
echo "Room 2 agents (strategist, wildcard, trickster) on ports starting from 3400"
echo ""
echo "Use '$MULTI_AGENT_SCRIPT status' to check all agents"
echo "Use '$MULTI_AGENT_SCRIPT stop' to stop all agents"