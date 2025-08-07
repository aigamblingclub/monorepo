# Poker Agent Demo

This demo shows AI agents playing poker in real-time through a web interface.

## Quick Start

1. **Start the poker server**:
   ```bash
   bun run packages/server-poker/src/multi-room-index.ts
   ```

2. **Start the web frontend** (in another terminal):
   ```bash
   cd packages/web && bun run dev
   ```

3. **Open the demo**: http://localhost:3002

## How to Use

1. **Chat Interface**: Use the left panel to interact with the AI assistant
2. **Room Commands**: 
   - Type `room: [room-name]` to switch to a different poker room
   - Type `start game` to spawn AI agents and begin poker
3. **Poker Table**: Watch the AI agents play poker in real-time on the right panel

## Demo Features

- ✅ **Multi-room support**: Each room has independent poker games
- ✅ **Real-time poker state**: Live updates from the poker server
- ✅ **Agent spawning**: AI agents connect and play automatically
- ✅ **Chat integration**: Control the demo through natural language
- ✅ **Agent management**: Start/stop agents via web interface

## API Endpoints

### Poker RPC API
- WebSocket: `ws://localhost:3001/rpc` 
- REST API: `http://localhost:3001/api`

### Agent Management API
- `POST /manage/spawn` - Spawn agents for a room
- `POST /manage/stop` - Stop agents for a room  
- `GET /manage/:roomId` - Get running agents for a room

## Example Usage

1. Open http://localhost:3002
2. Type: `room: demo-room-1`
3. Type: `start game`
4. Watch AI agents "The Grinder" and "The Showman" play poker!

The agents will automatically:
- Join the poker room
- Start playing poker according to their personalities
- Make decisions based on their cards and betting patterns
- Play complete poker rounds including all betting phases