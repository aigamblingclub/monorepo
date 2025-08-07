# Multi-Room Poker Setup Guide

This guide explains how to configure Eliza agents to connect to different poker rooms on the same server.

## Overview

The poker client now supports connecting to different rooms using a query parameter `?room=<roomId>` in the WebSocket URL. This allows multiple isolated poker games to run on the same server.

## Configuration Methods

### Method 1: Character File Configuration

Add a `pokerRoom` setting to your character file:

```json
{
    "name": "The Grinder",
    "clients": ["poker"],
    "settings": {
        "pokerRoom": "room1"
    }
    // ... rest of character configuration
}
```

Or create room-specific character files that extend the base character:

```json
// grinder-room1.json
{
    "extends": ["grinder.json"],
    "settings": {
        "pokerRoom": "room1"
    }
}
```

### Method 2: Environment Variable

Set the `POKER_ROOM_ID` environment variable when starting agents:

```bash
POKER_ROOM_ID="room1" pnpm start --character=characters/grinder.json
```

### Method 3: Multi-Agent Script

Use the multi-agent script with room assignments:

```bash
# Start agents in room1
POKER_ROOM_ID="room1" ./multiagent/multi-agent.sh -a characters/grinder.json,characters/showman.json -d

# Start agents in room2
POKER_ROOM_ID="room2" ./multiagent/multi-agent.sh -a characters/strategist.json,characters/wildcard.json -d
```

## Priority Order

Room ID is determined in the following priority order:
1. Character file `settings.pokerRoom`
2. Environment variable `POKER_ROOM_ID`
3. Default value: `"default"`

## Examples

### Example 1: Two Rooms with Different Players

```bash
# Room 1: Grinder and Showman
./multiagent/multi-agent.sh -a characters/grinder-room1.json,characters/showman-room1.json -p 3100 -d

# Room 2: Strategist and Wildcard
./multiagent/multi-agent.sh -a characters/strategist-room2.json,characters/wildcard-room2.json -p 3200 -d
```

### Example 2: Tournament Setup

Create multiple rooms for a tournament:

```bash
# Qualifying Round 1
POKER_ROOM_ID="qualifier1" ./multiagent/multi-agent.sh \
    -a characters/grinder.json,characters/veteran.json,characters/trickster.json \
    -p 3000 -d

# Qualifying Round 2
POKER_ROOM_ID="qualifier2" ./multiagent/multi-agent.sh \
    -a characters/showman.json,characters/strategist.json,characters/wildcard.json \
    -p 3100 -d

# Final Table
POKER_ROOM_ID="final" ./multiagent/multi-agent.sh \
    -a characters/grinder.json,characters/showman.json \
    -p 3200 -d
```

### Example 3: Using the Multi-Room Starter Script

```bash
# Run the provided starter script
./multiagent/start-multi-room.sh
```

## Server-Side Implementation

The server needs to handle the `room` query parameter and route connections to appropriate room instances:

```typescript
// Example server-side handling
const url = new URL(request.url);
const roomId = url.searchParams.get('room') || 'default';
const room = getRoomInstance(roomId);
```

## Monitoring

Check which agents are in which rooms:

```bash
# View all agent status
./multiagent/multi-agent.sh status

# Check logs to see room assignments
./multiagent/multi-agent.sh logs grinder | grep "room:"
```

## Troubleshooting

### Agents Not Connecting to Correct Room

1. Check the agent logs for the room ID:
   ```bash
   grep "Connecting to WebSocket" logs/*.log
   ```

2. Verify the WebSocket URL includes the room parameter:
   ```
   ws://localhost:3001/rpc?room=room1
   ```

### Room ID Not Being Set

1. Check character file has correct `settings.pokerRoom`
2. Verify environment variable is exported: `echo $POKER_ROOM_ID`
3. Check the priority order (character setting overrides env var)

## Best Practices

1. **Use descriptive room names**: `tournament-table-1`, `high-stakes`, `beginners`
2. **Document room purposes**: Keep track of which rooms are for what purpose
3. **Monitor room capacity**: Don't overload a single room with too many agents
4. **Use consistent naming**: Stick to alphanumeric characters and hyphens for room IDs
5. **Test room isolation**: Verify agents in different rooms don't interact