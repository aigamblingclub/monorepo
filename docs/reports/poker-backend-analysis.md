# Poker Backend Analysis Report

## Overview

The poker backend consists of two main packages:
1. **poker-state-machine** - Core game logic using Effect-TS
2. **server-poker** - RPC server exposing the game logic

## Architecture

### Poker State Machine (`packages/poker-state-machine`)

The state machine package implements a functional poker game engine using Effect-TS:

- **State Management**: Immutable state transitions with full game history
- **Game Flow**: Supports complete poker rounds (pre-flop, flop, turn, river, showdown)
- **Player Actions**: Fold, call, check, raise, all-in with validation
- **Position System**: Proper handling of blinds, dealer button, and player positions
- **Testing**: Comprehensive test suite with 101 tests covering edge cases

Key files:
- `src/schemas.ts` - Type definitions using Effect Schema
- `src/room.ts` - PokerGameService interface and implementation
- `src/transitions.ts` - State transition logic
- `src/queries.ts` - Query functions for game state

### Server Poker (`packages/server-poker`)

RPC server built with @effect/rpc exposing poker room methods:

- **Transport**: Supports both HTTP REST and WebSocket connections
- **Endpoints**:
  - `/api` - REST API endpoint
  - `/rpc` - WebSocket endpoint
- **Port**: 3001

Available RPC methods:
- `currentState()` - Get current game state
- `processEvent(event)` - Process game events (join, leave, moves)
- `playerView(playerId)` - Get player-specific view
- `stateUpdates()` - Stream of state updates
- `startGame()` - Start a new game (has 2-minute delay)

## Integration Testing

Created `rpc-client-demo.ts` demonstrating:
- Connecting to the RPC server using Effect's layered architecture
- Adding players to the table
- Starting a game
- Making moves (call, raise)
- Retrieving player views with hidden information

### Key Learnings

1. **Effect-TS Architecture**: Heavy use of functional programming patterns with layers, services, and effects
2. **Type Safety**: Extensive use of Effect Schema for runtime validation
3. **Testing**: Well-tested core logic with deterministic and random test scenarios
4. **Configuration**: Environment variables control game behavior (MIN_PLAYERS, AUTO_RESTART_ENABLED, etc.)

## Running the Demo

The integrated demo (`integrated-demo.ts`) manages the server lifecycle automatically:

```bash
cd packages/server-poker
bun run integrated-demo.ts
```

This demo:
- Spawns the server with a 1-second game start delay (instead of default 2 minutes)
- Creates players and starts a game
- Shows player hands and makes moves
- Properly shuts down the server after completion

## Key Findings

1. **Game Start Delay**: The server has a configurable sleep time before starting games (default: 2 minutes, demo: 1 second via `START_SLEEP_TIME` env var)
2. **Minimum Players**: Default is 2 players (configurable via `MIN_PLAYERS`)
3. **Positions**: In heads-up games, positions are assigned as SB (Small Blind) and BB (Big Blind)
4. **Server Management**: The server runs a single poker room instance - for multiple rooms, you'd need multiple server instances
5. **RPC Communication**: Uses HTTP REST API on port 3001 with Effect's layered architecture

## Notes

- All 101 tests pass successfully
- The state machine properly handles betting rounds, pot calculations, and player positions
- Auto-restart is available after game completion (configurable)
- The demo shows proper integration testing with server lifecycle management