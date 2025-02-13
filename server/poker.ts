export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

const SUITS = ["spades", "diamonds", "clubs", "hearts"] as const;
export type Suit = (typeof SUITS)[number];

export type Card = {
  suit: Suit;
  value: CardValue;
};

export type Deck = Card[];

function fisherYatesShuffle<T>(array: T[]): T[] {
  const clone = [...array];
  for (let i = 0; i < clone.length; ++i) {
    const j = Math.floor(Math.random() * (clone.length - i));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

export function getShuffledDeck(): Deck {
  const deck: Deck = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }).map((_, index) => ({
      suit,
      value: (index + 1) as CardValue,
    })),
  );

  return fisherYatesShuffle(deck);
}
