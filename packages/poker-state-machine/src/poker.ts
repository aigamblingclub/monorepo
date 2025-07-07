import { Iterable, pipe } from "effect";
import { SUITS, type Card, type CardValue, type HoleCards, type PlayerState } from "./schemas";

export type Deck = Card[];

export const ORDERED_HAND_TYPES = [
    "high_card",
    "pair",
    "two_pair",
    "three_kind",
    "straight",
    "flush",
    "full_house",
    "four_kind",
    "straight_flush",
] as const;
export type HandType = (typeof ORDERED_HAND_TYPES)[number]

export type BestHandCards = [Card, Card, Card, Card, Card]
// TODO: make community tuples enforceable on schema level
export type RiverCommunity = [Card, Card, Card, Card, Card]

export type Hand = {
    type: HandType,
    cards: [Card, Card, Card, Card, Card]
}

function fisherYatesShuffle<T>(array: T[]): T[] {
  const clone = [...array];
  for (let i = clone.length-1; i > 0; --i) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

export function getShuffledDeck(): Deck {
  // Create a completely fresh deck every time
  const deck: Deck = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }).map((_, index) => ({
      suit,
      rank: (index + 1) as CardValue,
    })),
  );

  // Apply multiple shuffles to ensure true randomness
  let shuffled = fisherYatesShuffle(deck);
  shuffled = fisherYatesShuffle(shuffled);
  shuffled = fisherYatesShuffle(shuffled);
  
  // Debug: Log the first few cards to verify randomness
  console.log(`🎲 Fresh shuffled deck first 6 cards:`, shuffled.slice(0, 6));
  console.log(`🎲 Shuffle timestamp: ${Date.now()}`);
  
  return shuffled;
}

// Test scenarios for deterministic card dealing
export const TEST_SCENARIOS = {
  // Player 1 wins with pair of Aces, Player 2 loses with high card
  PLAYER1_WINS: {
    playerCards: [
      [{ rank: 1, suit: "hearts" }, { rank: 1, suit: "spades" }], // Player 1: Pair of Aces
      [{ rank: 7, suit: "clubs" }, { rank: 9, suit: "diamonds" }], // Player 2: 7-9 offsuit
    ],
    community: [
      { rank: 2, suit: "hearts" },
      { rank: 5, suit: "clubs" },
      { rank: 10, suit: "spades" },
      { rank: 3, suit: "diamonds" },
      { rank: 8, suit: "hearts" },
    ],
  },
  // Player 2 wins with pair of Kings, Player 1 loses with high card
  PLAYER2_WINS: {
    playerCards: [
      [{ rank: 4, suit: "hearts" }, { rank: 6, suit: "spades" }], // Player 1: 4-6 offsuit
      [{ rank: 13, suit: "clubs" }, { rank: 13, suit: "diamonds" }], // Player 2: Pair of Kings
    ],
    community: [
      { rank: 2, suit: "hearts" },   // 2, 4, 6, 9, 11, 12 - no straights possible
      { rank: 9, suit: "clubs" },    
      { rank: 11, suit: "spades" },  // Jack
      { rank: 12, suit: "diamonds" }, // Queen  
      { rank: 1, suit: "hearts" },   // Ace (but no straight: A,2,4,6,9)
    ],
  },
  // Multiple winners - both get same pair
  TIE_SCENARIO: {
    playerCards: [
      [{ rank: 8, suit: "hearts" }, { rank: 8, suit: "spades" }], // Player 1: Pair of 8s
      [{ rank: 8, suit: "clubs" }, { rank: 8, suit: "diamonds" }], // Player 2: Pair of 8s
    ],
    community: [
      { rank: 2, suit: "hearts" },
      { rank: 5, suit: "clubs" },
      { rank: 10, suit: "spades" },
      { rank: 3, suit: "diamonds" },
      { rank: 7, suit: "hearts" },
    ],
  },
  // Player 1 consistently wins - for testing game over scenarios
  PLAYER1_DOMINANT: {
    playerCards: [
      [{ rank: 13, suit: "hearts" }, { rank: 13, suit: "spades" }], // Player 1: Pair of Kings
      [{ rank: 2, suit: "clubs" }, { rank: 3, suit: "diamonds" }], // Player 2: 2-3 offsuit (very weak)
    ],
    community: [
      { rank: 4, suit: "hearts" },   // Community cannot help Player 2
      { rank: 7, suit: "clubs" },    // No straights, no pairs possible
      { rank: 10, suit: "spades" },  // Player 1 wins with pair of Kings
      { rank: 11, suit: "diamonds" }, 
      { rank: 9, suit: "hearts" },   // vs Player 2's high card
    ],
  },
  // All-in scenario - both players get decent hands but should auto-progress
  ALL_IN_SCENARIO: {
    playerCards: [
      [{ rank: 12, suit: "hearts" }, { rank: 12, suit: "spades" }], // Player 1: Pair of Queens
      [{ rank: 11, suit: "clubs" }, { rank: 11, suit: "diamonds" }], // Player 2: Pair of Jacks
    ],
    community: [
      { rank: 2, suit: "hearts" },
      { rank: 5, suit: "clubs" },
      { rank: 8, suit: "spades" },
      { rank: 9, suit: "diamonds" },
      { rank: 13, suit: "hearts" },
    ],
  },
  // Elimination scenario - Player 1 completely dominates for quick elimination
  ELIMINATION: {
    playerCards: [
      [{ rank: 1, suit: "hearts" }, { rank: 1, suit: "spades" }], // Player 1: Pocket Aces (AA) - strongest pocket hand
      [{ rank: 2, suit: "clubs" }, { rank: 3, suit: "diamonds" }], // Player 2: 2-3 offsuit - weakest possible hand
    ],
    community: [
      { rank: 4, suit: "hearts" },   // Community: 4, 7, 9, 10, 6 
      { rank: 7, suit: "clubs" },    // Player 1: AA + community = Pair of Aces (very strong)
      { rank: 9, suit: "spades" },   // Player 2: 23 + community = High card 9 (very weak)
      { rank: 10, suit: "diamonds" }, // No straights or flushes possible
      { rank: 6, suit: "hearts" },   // Player 1 wins with 100% certainty
    ],
  },
  // Super weak vs strong - Player 2 guaranteed to lose chips fast  
  PLAYER2_LOSES_FAST: {
    playerCards: [
      [{ rank: 1, suit: "hearts" }, { rank: 13, suit: "spades" }], // Player 1: Ace-King suited (premium hand)
      [{ rank: 2, suit: "clubs" }, { rank: 4, suit: "diamonds" }], // Player 2: 2-4 offsuit (trash hand)
    ],
    community: [
      { rank: 1, suit: "spades" },   // Flop gives Player 1 pair of Aces
      { rank: 5, suit: "clubs" },    // Player 2 gets nothing useful
      { rank: 8, suit: "hearts" },   // Turn and River don't help Player 2
      { rank: 10, suit: "diamonds" },
      { rank: 7, suit: "spades" },   // Player 1 dominates with pair of Aces
    ],
  },
  // Phase transition testing - known community cards for predictable phase tests
  PHASES: {
    playerCards: [
      [{ rank: 10, suit: "spades" }, { rank: 9, suit: "spades" }], // Player 1: 10-9 suited
      [{ rank: 8, suit: "clubs" }, { rank: 7, suit: "diamonds" }], // Player 2: 8-7 offsuit
      [{ rank: 6, suit: "hearts" }, { rank: 5, suit: "clubs" }], // Player 3: 6-5 offsuit
    ],
    community: [
      { rank: 2, suit: "hearts" },   // Flop cards for phase transition tests
      { rank: 3, suit: "hearts" },   
      { rank: 4, suit: "hearts" },   
      { rank: 5, suit: "hearts" },   // Turn card
      { rank: 6, suit: "hearts" },   // River card
    ],
  },
} as const;

// Track test state for consistent deck handling
let testDeckIndex = 0;
let currentTestDeck: Deck | null = null;

// REFACTORED: Aggressive reset to prevent test pollution
export function resetTestDeck(): void {
  testDeckIndex = 0;
  currentTestDeck = null;
  
  // CRITICAL: Aggressively clear ALL deterministic state
  console.log(`🧹 resetTestDeck: Aggressively clearing all deterministic state`);
  
  // Force clear environment variables
  process.env.POKER_DETERMINISTIC_CARDS = "false";
  delete process.env.POKER_TEST_SCENARIO;
  
  // Force garbage collection of any cached objects
  if (typeof global !== 'undefined' && global.gc) {
    global.gc();
  }
}

// Get deterministic deck for testing
export function getTestDeck(scenario: keyof typeof TEST_SCENARIOS): Deck {
  const testScenario = TEST_SCENARIOS[scenario];
  const usedCards = new Set<string>();
  
  // Collect all used cards
  testScenario.playerCards.forEach(hand => {
    hand.forEach(card => {
      usedCards.add(`${card.rank}-${card.suit}`);
    });
  });
  testScenario.community.forEach(card => {
    usedCards.add(`${card.rank}-${card.suit}`);
  });
  
  // Create full deck and remove used cards
  const fullDeck: Deck = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }).map((_, index) => ({
      suit,
      rank: (index + 1) as CardValue,
    })),
  );
  
  const remainingCards = fullDeck.filter(card => 
    !usedCards.has(`${card.rank}-${card.suit}`)
  );
  
  // FIXED: Shuffle remaining cards to prevent repetitive patterns between rounds
  const shuffledRemaining = fisherYatesShuffle(remainingCards);
  
  // Build deck in dealing order: player cards first, then community cards at positions where they'll be drawn
  const testDeck: Deck = [];
  
  // Add player hole cards in correct dealing order
  // For 2 players: [P1_Card1, P1_Card2, P2_Card1, P2_Card2]
  for (let playerIndex = 0; playerIndex < testScenario.playerCards.length; playerIndex++) {
    testDeck.push(testScenario.playerCards[playerIndex][0]); // First card
    testDeck.push(testScenario.playerCards[playerIndex][1]); // Second card
  }
  
  // Add shuffled remaining cards to pad the deck (prevents repetitive dealing patterns)
  const paddingCards = shuffledRemaining.slice(0, 10);
  testDeck.push(...paddingCards);
  
  // Add community cards at the end (nextPhase draws from end)
  testDeck.push(...testScenario.community);
  
  console.log(`🎯 Created test deck for scenario "${scenario}":`, {
    totalCards: testDeck.length,
    holeCards: testDeck.slice(0, testScenario.playerCards.length * 2),
    communityCards: testDeck.slice(-5),
  });
  
  return testDeck;
}

// REFACTORED: Robust deck function with better validation
export function getDeck(): Deck {
  const deterministicMode = process.env.POKER_DETERMINISTIC_CARDS === 'true';
  const testScenario = process.env.POKER_TEST_SCENARIO as keyof typeof TEST_SCENARIOS;
  
  console.log(`🎯 getDeck() called with deterministic=${deterministicMode}, scenario=${testScenario}`);
  
  // STRICT VALIDATION: Only use deterministic decks when explicitly and correctly configured
  if (deterministicMode && testScenario && TEST_SCENARIOS[testScenario]) {
    console.log(`🎯 Using deterministic test scenario: ${testScenario}`);
    
    // Create fresh test deck each time to avoid pollution between rounds
    // This prevents infinite loops while still providing deterministic cards
    const testDeck = getTestDeck(testScenario);
    
    // VALIDATION: Ensure test deck is valid
    if (!testDeck || testDeck.length < 10) {
      console.log(`❌ Invalid test deck, falling back to random deck`);
      return getShuffledDeck();
    }
    
    console.log(`✅ Created fresh test deck for "${testScenario}" (${testDeck.length} cards)`);
    return testDeck;
  }
  
  // DEFAULT: Create fresh shuffled deck
  const shuffledDeck = getShuffledDeck();
  
  // VALIDATION: Ensure shuffled deck is valid
  if (!shuffledDeck || shuffledDeck.length !== 52) {
    console.log(`❌ Invalid shuffled deck (length: ${shuffledDeck?.length}), creating emergency deck`);
    // Emergency deck creation
    return SUITS.flatMap((suit) =>
      Array.from({ length: 13 }).map((_, index) => ({
        suit,
        rank: (index + 1) as CardValue,
      })),
    );
  }
  
  console.log(`🔀 Using fresh random deck (${shuffledDeck.length} cards)`);
  return shuffledDeck;
}

// is there a neater way to implement this?
function combinations<T>(array: T[], k: number): T[][] {
  const result: T[][] = [];

  function combine(current: T[], start: number): void {
    if (current.length === k) {
      result.push([...current]);
      return;
    }

    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      combine(current, i + 1);
      current.pop();
    }
  }

  combine([], 0);
  return result;
}

export function compareHands(a: Hand, b: Hand): -1 | 0 | 1 {
    const indexA = ORDERED_HAND_TYPES.findIndex(ht => ht == a.type)
    const indexB = ORDERED_HAND_TYPES.findIndex(ht => ht == b.type)

    // First compare hand types
    // Lower index means worse hand (ORDERED_HAND_TYPES is ordered from worst to best)
    if (indexA < indexB) return -1  // a is worse than b (has lower index)
    if (indexA > indexB) return 1   // a is better than b (has higher index)

    // If same hand type, compare by highest cards
    const sortedA = a.cards.toSorted((c1, c2) => {
        // Convert ranks for comparison (Ace = 14)
        const rankA = c1.rank === 1 ? 14 : c1.rank
        const rankB = c2.rank === 1 ? 14 : c2.rank
        return rankB - rankA
    })
    const sortedB = b.cards.toSorted((c1, c2) => {
        const rankA = c1.rank === 1 ? 14 : c1.rank
        const rankB = c2.rank === 1 ? 14 : c2.rank
        return rankB - rankA
    })

    // Compare each card in order
    for (let i = 0; i < sortedA.length; i++) {
        // Convert ranks for comparison (Ace = 14)
        const rankA = sortedA[i].rank === 1 ? 14 : sortedA[i].rank
        const rankB = sortedB[i].rank === 1 ? 14 : sortedB[i].rank
        
        if (rankA < rankB) return -1  // a is worse than b
        if (rankA > rankB) return 1   // a is better than b
    }

    // If all cards are equal, it's a tie
    return 0
}

export function determineHandType(cards: BestHandCards): HandType {
  // Sort cards by rank, treating Ace (rank 1) as 14 for high straights
  const sorted = [...cards].sort((a, b) => {
    const rankA = a.rank === 1 ? 14 : a.rank;
    const rankB = b.rank === 1 ? 14 : b.rank;
    return rankA - rankB;
  });

  // Check for straight by looking at consecutive rank differences
  // First try normal straight check
  const subsequentDiffs = sorted.map((card, index) => {
    if (index >= sorted.length - 1) return 1;
    const currentRank = card.rank === 1 ? 14 : card.rank;
    const nextRank = sorted[index + 1].rank === 1 ? 14 : sorted[index + 1].rank;
    return nextRank - currentRank;
  });

  // Count cards by rank and suit
  const cardsByValue = cards.reduce(
    (count, card) => ({
      ...count,
      [card.rank]: (count[card.rank] ?? 0) + 1,
    }),
    {} as { [v: number]: number }
  );

  const cardsBySuit = cards.reduce(
    (count, card) => ({
      ...count,
      [card.suit]: (count[card.suit] ?? 0) + 1
    }),
    {} as { [v: string]: number }
  );

  // Check for straight and flush
  const isStraight = subsequentDiffs.every(v => v === 1);
  const isFlush = Object.values(cardsBySuit).some(c => c === 5);
  const isFourKind = Object.values(cardsByValue).some(c => c === 4);
  const isThreeKind = Object.values(cardsByValue).some(c => c === 3);
  const pairs = Object.values(cardsByValue).filter(c => c === 2).length;
  const isTwoPair = pairs === 2;
  const isPair = pairs > 0;

  // Check combinations in order from highest to lowest
  if (isStraight && isFlush) return "straight_flush";
  if (isFourKind) return "four_kind";
  if (isThreeKind && isPair) return "full_house";
  if (isFlush) return "flush";
  if (isStraight) return "straight";
  if (isThreeKind) return "three_kind";
  if (isTwoPair) return "two_pair";
  if (isPair) return "pair";
  return "high_card";
}

export function getBestHand(community: RiverCommunity, hole: HoleCards): Hand {
    const combs = combinations([...community, ...hole], 5) as BestHandCards[]
    const hands = combs.map(cards => ({
        type: determineHandType(cards),
        cards,
    }))

    // Sort hands so that the best hand (highest ranking) comes first and
    // return that hand.  `compareHands` returns `-1` when the first hand is
    // WORSE than the second one, therefore sorting with it ascending places
    // the WORST hand first.  We want the BEST hand, so we either sort in the
    // opposite direction or simply pick the **last** element from the sorted
    // array.  Picking the last element keeps the implementation simple and
    // avoids allocating another array.
    return hands.toSorted(compareHands)[hands.length - 1]
}

// gets player ids and hole cards, together with community (assuming river as it is showdown) and
// returns the list of player ids which won this pot (singleton in case of no ties)
export function determineWinningPlayers(
    players: PlayerState[],
    community: RiverCommunity
): string[] {
    // get each players best hand and sort in descending order
    const playerHands = players
      .map(({ id, hand }) => ({ id, hand: getBestHand(community, hand as [Card, Card]) }))
      .toSorted((a, b) => compareHands(b.hand, a.hand));

    return pipe(
        playerHands,
        Iterable.groupWith((a, b) => compareHands(a.hand, b.hand) === 0),
        Iterable.take(1),
        Iterable.flatten,
        Iterable.map(p => p.id),
        Iterable.reduce<string[], string>([], (acc, id) => [...acc ,id])
    )
}
