import { PrismaClient } from '@/prisma';
import { PokerState } from '@/types/schemas';
import { isDev, isProd, SERVER_POKER } from './env';

const prisma = new PrismaClient();

export let currentStatePoker: PokerState | null = null;

export const updatePokerState = async (interval: number) => {
  console.log("[STATE] Updating Poker State");
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
  console.log("[STATE] before node env, set interval");
  if (process.env.NODE_ENV !== 'test') {
    setInterval(async () => {
      console.log("[STATE] in interval");
      if (!SERVER_POKER) {
        console.log("[STATE] no server poker");
        return;
      }
      let currentState: any;
      if (isDev) {
        console.log("[STATE] in dev");
        currentState = fakeData[0];
      } else if (isProd) {
        console.log("[STATE] in prod");
        currentState = await getCurrentStatePoker();
      }
      // Only update the state if the data is different
      console.log("[STATE] currentState", currentState);
      if (currentState && JSON.stringify(currentState) !== JSON.stringify(currentStatePoker)) {
        console.log("[STATE] updating state");
        currentStatePoker = currentState;
        await saveCurrentStateToDatabase(currentState);
      }
    }, interval || 2000);
  }
};

const getCurrentStatePoker = async () => {
  console.log("[STATE] getting current state");
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
    console.log("[STATE] response", response);
    if (!response.ok) {
      console.log("[STATE] response not ok", response);
      return;
    }

    console.log("[STATE] response ok, jsonfying");
    const data = await response.json();
    console.log("[STATE] data", data);
    // Handle array response format
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];

      if (firstItem._tag === 'Exit' && firstItem.exit?._tag === 'Success') {
        // Return just the game state value
        return firstItem.exit.value;
      }
    }

    console.log("[STATE] finished getting current state and returning null");
    return null;
  } catch (error) {
    console.log("[STATE] error in getCurrentStatePoker", error);
    return null;
  }
};

// save the current state to the database
export const saveCurrentStateToDatabase = async (state: PokerState) => {
  console.log("[STATE] saving current state to database", state);
  await prisma.$transaction(async tx => {
    console.log("[STATE] creating raw state");
    await tx.rawState.create({
      data: { data: JSON.stringify(state), status: 'active', updatedAt: new Date() },
    });
    console.log("[STATE] created raw state");
    // save to table
    console.log("[STATE] saving to table");
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
    console.log("[STATE] saved to table");
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
    tableId: '1',
    tableStatus: 'WAITING',
    players: [
      {
        id: '472a3913-2ead-05b5-9ee2-1693304f5862',
        playerName: 'The Showman',
        status: 'PLAYING',
        playedThisPhase: false,
        position: 'SB',
        hand: [],
        chips: 1000,
        bet: {
          amount: 0,
          volume: 0,
        },
      },
      {
        id: '058cf225-7d2c-075f-8bf6-b7cad54aa4b7',
        playerName: 'The Strategist',
        status: 'PLAYING',
        playedThisPhase: false,
        position: 'BB',
        hand: [],
        chips: 800,
        bet: {
          amount: 0,
          volume: 0,
        },
      },
    ],
    lastMove: null,
    currentPlayerIndex: -1,
    deck: [],
    community: [],
    phase: {
      street: 'PRE_FLOP',
      actionCount: 0,
      volume: 0,
    },
    round: {
      roundNumber: 1,
      volume: 0,
      currentBet: 0,
      foldedPlayers: [],
      allInPlayers: [],
    },
    dealerId: '',
    winner: null,
    config: {
      maxRounds: null,
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
    },
  },
];
