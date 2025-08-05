#!/bin/bash

# Multi-Agent Runner Script for Eliza
# This script allows running multiple Eliza agents with different characters
# without port conflicts or other issues

set -e

# Default values
BASE_PORT=3000
LOG_DIR="./logs"
DATA_DIR="./data/agents"
AGENTS_CONFIG=""
DETACHED=false
ACTION="run"
VERBOSE=false

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS] [ACTION]"
    echo ""
    echo "ACTIONS:"
    echo "  run      Start all agents (default)"
    echo "  stop     Stop all running agents"
    echo "  status   Show status of all agents"
    echo "  logs     Show logs for a specific agent"
    echo ""
    echo "OPTIONS:"
    echo "  -c, --config FILE      Path to agents configuration file (JSON)"
    echo "  -a, --agents AGENTS    Comma-separated list of character files"
    echo "  -p, --base-port PORT   Base port for agents (default: 3000)"
    echo "  -d, --detached         Run agents in background"
    echo "  -l, --log-dir DIR      Directory for log files (default: ./logs)"
    echo "  -v, --verbose          Enable verbose output"
    echo "  -h, --help             Display this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  # Run multiple agents with character files"
    echo "  $0 -a grinder.json,showman.json,strategist.json"
    echo ""
    echo "  # Run agents in detached mode with custom base port"
    echo "  $0 -a grinder.json,wildcard.json -p 4000 -d"
    echo ""
    echo "  # Use a configuration file"
    echo "  $0 -c agents-config.json"
    echo ""
    echo "  # Stop all running agents"
    echo "  $0 stop"
    echo ""
    echo "  # Check agent status"
    echo "  $0 status"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            AGENTS_CONFIG="$2"
            shift 2
            ;;
        -a|--agents)
            AGENT_LIST="$2"
            shift 2
            ;;
        -p|--base-port)
            BASE_PORT="$2"
            shift 2
            ;;
        -d|--detached)
            DETACHED=true
            shift
            ;;
        -l|--log-dir)
            LOG_DIR="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        run|stop|status|logs)
            ACTION="$1"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Create necessary directories
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"

# Function to log messages
log() {
    local level=$1
    local message=$2
    local color=$NC
    
    case $level in
        ERROR) color=$RED ;;
        SUCCESS) color=$GREEN ;;
        WARNING) color=$YELLOW ;;
        INFO) color=$BLUE ;;
    esac
    
    echo -e "${color}[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message${NC}"
}

# Function to check if port is available
is_port_available() {
    local port=$1
    ! nc -z localhost $port 2>/dev/null
}

# Function to find next available port
find_available_port() {
    local start_port=$1
    local port=$start_port
    
    while ! is_port_available $port; do
        port=$((port + 1))
    done
    
    echo $port
}

# Function to generate unique agent ID
generate_agent_id() {
    local character_name=$1
    echo "${character_name}_$(date +%s)_$$"
}

# Function to save agent info
save_agent_info() {
    local agent_id=$1
    local character=$2
    local port=$3
    local pid=$4
    
    cat > "$DATA_DIR/$agent_id.json" <<EOF
{
    "id": "$agent_id",
    "character": "$character",
    "port": $port,
    "pid": $pid,
    "started": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

# Function to start a single agent
start_agent() {
    local character_file=$1
    local port=$2
    local character_name=$(basename "$character_file" .json)
    local agent_id=$(generate_agent_id "$character_name")
    local log_file="$LOG_DIR/${agent_id}.log"
    
    # Find available port
    port=$(find_available_port $port)
    
    log "INFO" "Starting agent '$character_name' on port $port..."
    
    # Create agent-specific .env if needed
    local agent_env="$DATA_DIR/${agent_id}.env"
    if [[ -f ".env" ]]; then
        cp .env "$agent_env"
    else
        touch "$agent_env"
    fi
    
    # Add agent-specific environment variables
    cat >> "$agent_env" <<EOF

# Agent-specific configuration
SERVER_PORT=$port
AGENT_ID=$agent_id
CHARACTER_FILE=$character_file
POKER_ROOM_ID=${POKER_ROOM_ID:-default}
EOF
    
    # Start the agent
    if [[ "$DETACHED" == true ]]; then
        # Run in background
        (
            cd "$(dirname "$0")/.."
            # Export environment variables, filtering out comments and empty lines
            set -a
            source "$agent_env"
            set +a
            pnpm start --character="$character_file" > "$log_file" 2>&1
        ) &
        local pid=$!
        
        # Wait a bit to ensure process started
        sleep 2
        
        if kill -0 $pid 2>/dev/null; then
            save_agent_info "$agent_id" "$character_file" "$port" "$pid"
            log "SUCCESS" "Agent '$character_name' started successfully (PID: $pid, Port: $port)"
            echo "$pid" > "$DATA_DIR/${agent_id}.pid"
        else
            log "ERROR" "Failed to start agent '$character_name'"
            return 1
        fi
    else
        # Run in foreground (for debugging)
        cd "$(dirname "$0")/.."
        # Export environment variables, filtering out comments and empty lines
        set -a
        source "$agent_env"
        set +a
        SERVER_PORT=$port pnpm start --character="$character_file"
    fi
}

# Function to stop all agents
stop_agents() {
    log "INFO" "Stopping all agents..."
    
    for pid_file in "$DATA_DIR"/*.pid; do
        if [[ -f "$pid_file" ]]; then
            local pid=$(cat "$pid_file")
            local agent_id=$(basename "$pid_file" .pid)
            
            if kill -0 $pid 2>/dev/null; then
                kill $pid
                log "SUCCESS" "Stopped agent (PID: $pid)"
            else
                log "WARNING" "Agent with PID $pid is not running"
            fi
            
            # Clean up files
            rm -f "$pid_file"
            rm -f "$DATA_DIR/${agent_id}.json"
            rm -f "$DATA_DIR/${agent_id}.env"
        fi
    done
}

# Function to show agent status
show_status() {
    log "INFO" "Agent Status:"
    echo ""
    
    local running_count=0
    
    for info_file in "$DATA_DIR"/*.json; do
        if [[ -f "$info_file" ]]; then
            local agent_info=$(cat "$info_file")
            local pid=$(echo "$agent_info" | jq -r '.pid')
            local character=$(echo "$agent_info" | jq -r '.character')
            local port=$(echo "$agent_info" | jq -r '.port')
            local started=$(echo "$agent_info" | jq -r '.started')
            
            if kill -0 $pid 2>/dev/null; then
                echo -e "${GREEN}● Running${NC} - Character: $(basename "$character" .json), Port: $port, PID: $pid"
                echo "  Started: $started"
                running_count=$((running_count + 1))
            else
                echo -e "${RED}● Stopped${NC} - Character: $(basename "$character" .json)"
                # Clean up stale files
                rm -f "$info_file"
                rm -f "$DATA_DIR/$(basename "$info_file" .json).pid"
            fi
            echo ""
        fi
    done
    
    if [[ $running_count -eq 0 ]]; then
        log "INFO" "No agents are currently running"
    else
        log "INFO" "Total running agents: $running_count"
    fi
}

# Function to show logs for a specific agent
show_logs() {
    local agent_pattern=$1
    
    if [[ -z "$agent_pattern" ]]; then
        log "ERROR" "Please specify an agent name or pattern"
        echo "Available logs:"
        ls -la "$LOG_DIR"/*.log 2>/dev/null | awk '{print $9}' | xargs -n1 basename
        return 1
    fi
    
    local log_files=("$LOG_DIR"/*"$agent_pattern"*.log)
    
    if [[ ! -f "${log_files[0]}" ]]; then
        log "ERROR" "No log files found matching pattern: $agent_pattern"
        return 1
    fi
    
    # If multiple files match, let user choose
    if [[ ${#log_files[@]} -gt 1 ]]; then
        echo "Multiple log files found:"
        select log_file in "${log_files[@]}"; do
            if [[ -n "$log_file" ]]; then
                tail -f "$log_file"
                break
            fi
        done
    else
        tail -f "${log_files[0]}"
    fi
}

# Function to load agents from config file
load_agents_from_config() {
    local config_file=$1
    
    if [[ ! -f "$config_file" ]]; then
        log "ERROR" "Configuration file not found: $config_file"
        return 1
    fi
    
    # Example config format:
    # {
    #   "agents": [
    #     {
    #       "character": "grinder.json",
    #       "port": 3001,
    #       "env": {
    #         "CUSTOM_VAR": "value"
    #       }
    #     }
    #   ]
    # }
    
    log "WARNING" "Config file loading not yet implemented"
    return 1
}

# Main execution
case $ACTION in
    run)
        if [[ -n "$AGENTS_CONFIG" ]]; then
            # Load from config file
            load_agents_from_config "$AGENTS_CONFIG"
        elif [[ -n "$AGENT_LIST" ]]; then
            # Start agents from comma-separated list
            IFS=',' read -ra AGENTS <<< "$AGENT_LIST"
            
            log "INFO" "Starting ${#AGENTS[@]} agents..."
            
            current_port=$BASE_PORT
            for agent in "${AGENTS[@]}"; do
                start_agent "$agent" "$current_port"
                current_port=$((current_port + 1))
                
                # Add delay between agent starts to avoid conflicts
                sleep 2
            done
            
            if [[ "$DETACHED" == true ]]; then
                log "SUCCESS" "All agents started in detached mode"
                log "INFO" "Use '$0 status' to check agent status"
                log "INFO" "Use '$0 logs <agent-name>' to view logs"
                log "INFO" "Use '$0 stop' to stop all agents"
            fi
        else
            log "ERROR" "No agents specified. Use -a or -c option."
            usage
        fi
        ;;
        
    stop)
        stop_agents
        ;;
        
    status)
        show_status
        ;;
        
    logs)
        show_logs "$2"
        ;;
        
    *)
        log "ERROR" "Unknown action: $ACTION"
        usage
        ;;
esac