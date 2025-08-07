import { PokerState } from '../types/poker';

export const mockPokerState: PokerState = {
  players: [
    {
      id: '1',
      playerName: 'Alice',
      status: 'PLAYING',
      playedThisPhase: false,
      position: 'BTN',
      hand: [
        { rank: 1, suit: 'spades' },
        { rank: 13, suit: 'spades' }
      ],
      chips: 10000,
      bet: { amount: 100, volume: 100 }
    },
    {
      id: '2',
      playerName: 'Bob',
      status: 'PLAYING',
      playedThisPhase: true,
      position: 'SB',
      hand: [
        { rank: 10, suit: 'hearts' },
        { rank: 10, suit: 'diamonds' }
      ],
      chips: 8500,
      bet: { amount: 50, volume: 50 }
    },
    {
      id: '3',
      playerName: 'Charlie',
      status: 'PLAYING',
      playedThisPhase: false,
      position: 'BB',
      hand: [
        { rank: 7, suit: 'clubs' },
        { rank: 8, suit: 'clubs' }
      ],
      chips: 12000,
      bet: { amount: 100, volume: 100 }
    },
    {
      id: '4',
      playerName: 'Diana',
      status: 'FOLDED',
      playedThisPhase: true,
      position: 'EP',
      hand: [],
      chips: 9200,
      bet: { amount: 0, volume: 0 }
    },
    {
      id: '5',
      playerName: 'Eve',
      status: 'ALL_IN',
      playedThisPhase: true,
      position: 'MP',
      hand: [
        { rank: 11, suit: 'hearts' },
        { rank: 11, suit: 'clubs' }
      ],
      chips: 0,
      bet: { amount: 5000, volume: 5000 }
    },
    {
      id: '6',
      playerName: 'Frank',
      status: 'PLAYING',
      playedThisPhase: false,
      position: 'CO',
      hand: [
        { rank: 1, suit: 'hearts' },
        { rank: 12, suit: 'hearts' }
      ],
      chips: 15000,
      bet: { amount: 100, volume: 100 }
    }
  ],
  community: [
    { rank: 1, suit: 'diamonds' },
    { rank: 13, suit: 'hearts' },
    { rank: 12, suit: 'spades' },
    { rank: 10, suit: 'clubs' },
    { rank: 9, suit: 'diamonds' }
  ],
  currentPlayerIndex: 0,
  round: {
    roundNumber: 3,
    currentBet: 100,
    volume: 5350
  },
  phase: {
    street: 'TURN'
  },
  tableStatus: 'PLAYING',
  lastMove: {
    playerId: '5',
    move: {
      type: 'ALL_IN'
    }
  },
  winner: null,
  dealerId: '1'
};