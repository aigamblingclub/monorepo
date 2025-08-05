#!/bin/bash

# Test script for multi-agent runner
# This demonstrates various usage scenarios

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MULTI_AGENT_SCRIPT="$SCRIPT_DIR/multi-agent.sh"

echo "=== Multi-Agent Test Script ==="
echo ""

# Function to run a test scenario
run_test() {
    local test_name=$1
    local test_cmd=$2
    
    echo "Test: $test_name"
    echo "Command: $test_cmd"
    echo "---"
    
    # Execute in a subshell to capture output
    (cd "$SCRIPT_DIR/.." && eval "$test_cmd")
    
    echo ""
    echo "---"
    echo ""
}

# Test 1: Show help
run_test "Show help" "$MULTI_AGENT_SCRIPT -h"

# Test 2: Run multiple agents in detached mode
echo "Starting multiple agents in detached mode..."
run_test "Start agents detached" \
    "$MULTI_AGENT_SCRIPT -a characters/grinder.json,characters/showman.json,characters/strategist.json -p 3100 -d run"

# Wait for agents to start
sleep 5

# Test 3: Check status
run_test "Check agent status" "$MULTI_AGENT_SCRIPT status"

# Test 4: Show example of checking logs
echo "To view logs for a specific agent, use:"
echo "  $MULTI_AGENT_SCRIPT logs <agent-name>"
echo ""

# Test 5: Stop all agents
read -p "Press Enter to stop all agents..."
run_test "Stop all agents" "$MULTI_AGENT_SCRIPT stop"

# Final status check
run_test "Final status check" "$MULTI_AGENT_SCRIPT status"

echo "=== Test Complete ==="