import { PrismaClient } from '@/prisma';
import { PokerState } from '@/types/schemas';
import { isDev, isProd, SERVER_POKER } from './env';

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
    if (!SERVER_POKER) {
      console.log(' is not set');
      return;
    }

    let currentState: any;
    if(isDev) {
      currentState = fakeData[0];
    } else if (isProd) {
      currentState = await getCurrentStatePoker();
    }
    // Only update the state if the data is different

    if (currentState && JSON.stringify(currentState) !== JSON.stringify(currentStatePoker)) {
      if(isDev) {
        console.log('[SUCCESS][TABLE][STATE] Saved new state', currentState);
      }
      currentStatePoker = currentState;
      await saveCurrentStateToDatabase(currentState);
    }
  }, interval || 2000);
};

const getCurrentStatePoker = async () => {
  try {
    const response = await fetch(`${SERVER_POKER}/api/`, {
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

const fakeData: PokerState[] = [
  {
    "tableId": "1",
    "tableStatus": "WAITING",
    "players": [
      {
        "id": "472a3913-2ead-05b5-9ee2-1693304f5862",
        "playerName": "The Showman",
        "status": "PLAYING",
        "playedThisPhase": false,
        "position": "SB",
        "hand": [],
        "chips": 1000,
        "bet": {
          "amount": 0,
          "volume": 0
        }
      },
      {
        "id": "058cf225-7d2c-075f-8bf6-b7cad54aa4b7",
        "playerName": "The Strategist",
        "status": "PLAYING",
        "playedThisPhase": false,
        "position": "BB",
        "hand": [],
        "chips": 800,
        "bet": {
          "amount": 0,
          "volume": 0
        }
      }
    ],
    "lastMove": null,
    "currentPlayerIndex": -1,
    "deck": [],
    "community": [],
    "phase": {
      "street": "PRE_FLOP",
      "actionCount": 0,
      "volume": 0
    },
    "round": {
      "roundNumber": 1,
      "volume": 0,
      "currentBet": 0,
      "foldedPlayers": [],
      "allInPlayers": []
    },
    "dealerId": "",
    "winner": null,
    "config": {
      "maxRounds": null,
      "startingChips": 1000,
      "smallBlind": 10,
      "bigBlind": 20
    }
  },
]
