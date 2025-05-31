import { PrismaClient } from '@/prisma';
import { PokerState } from '@/types/schemas';

const prisma = new PrismaClient();

export let currentStatePoker: PokerState | null = null;

export const updatePokerState = async (interval: number) => {
  if (!currentStatePoker) {
    const raw = await prisma.rawState.findFirst({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
      select: {
        data: true,
      },
    });
    currentStatePoker = raw ? JSON.parse(raw.data as string) : null;
  }
  setInterval(async () => {
    if (!process.env.POKER_API_URL) {
      console.log('POKER_API_URL is not set');
      return;
    }

    const currentState = await getCurrentStatePoker();
    // Only update the state if the data is different

    if (currentState && JSON.stringify(currentState) !== JSON.stringify(currentStatePoker)) {
      console.log('Current state from poker server', currentState);
      currentStatePoker = currentState;
      await saveCurrentStateToDatabase(currentState);
    }
  }, interval || 2000);
};

const getCurrentStatePoker = async () => {
  try {
    const response = await fetch(`${process.env.POKER_API_URL}/api/`, {
      method: 'POST', // rpc is only supported for POST requests
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        _tag: 'Request',
        id: `${Date.now()}`,
        tag: 'currentState',
        payload: {},
        traceId: 'traceId',
        spanId: 'spanId',
        sampled: true,
        headers: {},
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch current state from poker server');
      return;
    }

    const data = await response.json();

    // Handle array response format
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];

      if (firstItem._tag === 'Exit' && firstItem.exit?._tag === 'Success') {
        // Return just the game state value
        return firstItem.exit.value;
      }
    }

    console.error('ERROR: ', data);
    return null;
  } catch (error) {
    console.error('Error fetching current state from poker server', error);
    return null;
  }
};

// save the current state to the database
export const saveCurrentStateToDatabase = async (state: PokerState) => {
  await prisma.$transaction(async tx => {
    await tx.rawState.create({
      data: { data: JSON.stringify(state), status: 'active', updatedAt: new Date() },
    });

    // save to table
    await tx.table.upsert({
      where: { tableId: state.tableId },
      update: {
        tableId: state.tableId,
        tableStatus: state.tableStatus,
        config: state.config,
        winners: state.winner ? [state.winner] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        tableId: state.tableId,
        tableStatus: state.tableStatus,
        volume: 0, // TODO: sum of all bets, query?
        totalBets: 0, // TODO: sum of all bets, query?
        config: state.config,
      },
    });

    // save to players
    for (const player of state.players) {
      await tx.player.upsert({
        where: { playerId: player.id },
        update: {
          playerName: player.playerName,
          updatedAt: new Date(),
        },
        create: {
          playerId: player.id,
          playerName: player.playerName,
          updatedAt: new Date(),
        },
      });
      await tx.player_Table.upsert({
        where: {
          playerId_tableId: {
            playerId: player.id,
            tableId: state.tableId,
          },
        },
        update: {
          status: 'active',
          volume: player.bet.volume, // ? TODO: sum of all bets in all rounds
          currentBalance: player.chips,
        },
        create: {
          playerId: player.id,
          tableId: state.tableId,
          status: 'active',
          volume: 0,
          initialBalance: player.chips,
          currentBalance: player.chips,
        },
      });
    }
    // TODO add info to all other tables, rounds, phases, moves, playerHands;
  });
};
