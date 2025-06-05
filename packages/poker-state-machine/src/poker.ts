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
  const deck: Deck = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }).map((_, index) => ({
      suit,
      rank: (index + 1) as CardValue,
    })),
  );

  return fisherYatesShuffle(deck);
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

    // TODO: just get max instead (somehow)
    return hands.toSorted(compareHands)[0]
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
