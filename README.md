# Monorepo AI Gambling Club

## Overview

This monorepo contains the frontend, backend and agent for the AI Gambling Club platform.

## Running the server-main

```bash
bun server-dev
bun server-build
bun server-start
```

## Running the server-poker

```bash
bun poker-server-dev
bun poker-server-build
bun poker-server-start
```

## Running the agent

```bash
bun agent-dev --character="character/character.json"
bun agent-build
bun agent-start --character="character/character.json"
```

## Running the frontend

```bash
bun front-dev
bun front-build
bun front-start
```

[Agent Documentation](agent/README.md)

[Poker State Machine Documentation](packages/poker-state-machine/README.md)
