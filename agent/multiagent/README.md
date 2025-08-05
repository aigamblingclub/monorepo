# Multi-Agent Runner for Eliza

This script allows you to run multiple Eliza agents with different characters simultaneously, managing port conflicts and providing centralized control.

## Features

- **Automatic Port Management**: Automatically finds available ports for each agent
- **Background Execution**: Run agents in detached mode for production use
- **Centralized Logging**: All agent logs are stored in a central location
- **Process Management**: Start, stop, and check status of all agents
- **Configuration Support**: Use JSON config files for complex setups

## Installation

The script is located at `multiagent/multi-agent.sh`. Make sure it's executable:

```bash
chmod +x multiagent/multi-agent.sh
```

## Usage

### Basic Usage

Run multiple agents by specifying character files:

```bash
./multiagent/multi-agent.sh -a characters/grinder.json,characters/showman.json,characters/strategist.json
```

### Running in Background

Use the `-d` flag to run agents in detached mode:

```bash
./multiagent/multi-agent.sh -a characters/grinder.json,characters/wildcard.json -d
```

### Custom Base Port

Specify a different starting port (default is 3000):

```bash
./multiagent/multi-agent.sh -a characters/grinder.json,characters/showman.json -p 4000 -d
```

### Managing Agents

Check status of all running agents:

```bash
./multiagent/multi-agent.sh status
```

Stop all running agents:

```bash
./multiagent/multi-agent.sh stop
```

View logs for a specific agent:

```bash
./multiagent/multi-agent.sh logs grinder
```

### Using Configuration Files

For complex setups, use a JSON configuration file:

```bash
./multiagent/multi-agent.sh -c agents-config.json
```

Example configuration file:

```json
{
  "agents": [
    {
      "character": "characters/grinder.json",
      "port": 3001,
      "env": {
        "LOG_LEVEL": "info",
        "CACHE_STORE": "filesystem"
      }
    },
    {
      "character": "characters/showman.json",
      "port": 3002,
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  ],
  "defaults": {
    "env": {
      "CACHE_STORE": "database"
    },
    "basePort": 3000,
    "logDir": "./logs/agents"
  }
}
```

## Options

- `-c, --config FILE`: Path to agents configuration file (JSON)
- `-a, --agents AGENTS`: Comma-separated list of character files
- `-p, --base-port PORT`: Base port for agents (default: 3000)
- `-d, --detached`: Run agents in background
- `-l, --log-dir DIR`: Directory for log files (default: ./logs)
- `-v, --verbose`: Enable verbose output
- `-h, --help`: Display help message

## Directory Structure

The script creates the following directories:

- `./logs/`: Contains log files for each agent
- `./data/agents/`: Stores agent metadata and PID files

## Port Allocation

Each agent is assigned a sequential port starting from the base port:
- Agent 1: base_port (e.g., 3000)
- Agent 2: base_port + 1 (e.g., 3001)
- Agent 3: base_port + 2 (e.g., 3002)

If a port is already in use, the script automatically finds the next available port.

## Environment Variables

Each agent inherits the base `.env` file and can have additional agent-specific environment variables:

- `SERVER_PORT`: The assigned port for the agent
- `AGENT_ID`: Unique identifier for the agent instance
- `CHARACTER_FILE`: Path to the character configuration file

## Troubleshooting

### Agents not starting

1. Check if the required ports are available
2. Verify character files exist and are valid JSON
3. Check logs in the `./logs/` directory
4. Ensure all dependencies are installed (`pnpm install`)

### Port conflicts

The script automatically handles port conflicts by finding the next available port. If you still have issues:

1. Use a different base port with `-p`
2. Check for other services using the ports
3. Stop all agents and restart

### Viewing logs

Logs are stored in `./logs/` with filenames like `grinder_1234567890_12345.log`. Use the logs command with a pattern:

```bash
# View logs for grinder agent
./multiagent/multi-agent.sh logs grinder

# View logs with full agent ID
./multiagent/multi-agent.sh logs grinder_1234567890_12345
```

## Examples

### Development Setup

Run three agents in foreground for debugging:

```bash
./multiagent/multi-agent.sh -a characters/grinder.json,characters/showman.json,characters/strategist.json -v
```

### Production Setup

Run all poker agents in background with custom ports:

```bash
./multiagent/multi-agent.sh \
  -a characters/grinder.json,characters/showman.json,characters/strategist.json,characters/trickster.json,characters/veteran.json,characters/wildcard.json \
  -p 5000 \
  -l /var/log/eliza \
  -d
```

### Testing Setup

Use the test script to verify everything works:

```bash
./multiagent/test-multi-agent.sh
```

## Best Practices

1. **Use detached mode** for production deployments
2. **Monitor logs** regularly for errors
3. **Set appropriate base ports** to avoid conflicts with other services
4. **Use configuration files** for complex multi-agent setups
5. **Implement health checks** for production environments
6. **Set up log rotation** for long-running agents

## Security Considerations

- Each agent runs with the same system permissions
- Agents share the same `.env` base configuration
- Consider using separate database instances for each agent
- Monitor resource usage when running many agents
- Use firewall rules to restrict access to agent ports

## Performance Notes

- Each agent runs as a separate Node.js process
- Resource usage scales linearly with the number of agents
- Consider system limits when running many agents:
  - Available memory
  - CPU cores
  - File descriptor limits
  - Network connections

## Integration with Docker

While this script runs agents directly, you can also use it within Docker containers. See `docker.sh` for containerized deployments.
