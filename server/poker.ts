export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

const SUITS = ["spades", "diamonds", "clubs", "hearts"] as const;
export type Suit = (typeof SUITS)[number];

export type Card = {
  suit: Suit;
  value: CardValue;
};

export type Deck = Card[];

// TODO: rename to hand? and let the types be the type field?
export type HandType =
  | { type: "high_card"; value: CardValue }
  | { type: "pair"; value: CardValue }
  | { type: "two_pair"; values: [CardValue, CardValue] }
  | { type: "three_kind"; value: CardValue }
  // for straight, the value is of the highest card
  | { type: "straight"; value: CardValue }
  // for flush, the value if of the highest card
  | { type: "flush"; value: CardValue }
  // for full house, the values are ordered by amount of cards
  | { type: "full_house"; values: [CardValue, CardValue] }
  | { type: "four_kind"; value: CardValue }
  // for straight flush, the value if of the highest card
  | { type: "straight_flush"; value: CardValue };
// NOTE: royal straight flush is encoded inside of straight flush

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

export function determineHandType(hand: Card[]): HandType {
  const sorted = hand.sort();

  const subsequentDiffs = sorted.map((card, index) =>
    index < sorted.length - 1 ? sorted[index + 1].value - card.value : 1,
  );

  const cardsByValue = hand.reduce(
    (count, card) => ({
      ...count,
      [card.value]: (count[card.value] ?? 0) + 1,
    }),
    {} as { [v: number]: number },
  );

  const cardsBySuit = hand.reduce(
    (count, card) => ({ ...count, [card.suit]: (count[card.suit] ?? 0) + 1 }),
    {} as { [v: string]: number },
  );

  const isStraight = subsequentDiffs.every((v) => v === 1);
  const isFlush = Object.values(cardsBySuit).some((c) => c >= 4);
  const isFourKind = Object.values(cardsByValue).some((c) => c === 4);
  const isThreeKind = Object.values(cardsByValue).some((c) => c === 3);
  // TODO: const isTwoPair
  const isPair = Object.values(cardsByValue).some((c) => c === 2);

  if (isStraight && isFlush) {
    return { type: "straight_flush", value: sorted[sorted.length - 1].value };
  } else if (isFourKind) {
    return {
      type: "four_kind",
      value: sorted.find((c) => cardsByValue[c.value] === 4)!.value,
    };
  } else if (isThreeKind && isPair) {
    return {
      type: "full_house",
      values: [
        sorted.find((c) => cardsByValue[c.value] === 3)!.value,
        sorted.find((c) => cardsByValue[c.value] === 2)!.value,
      ],
    };
  } else if (isFlush) {
    return {
      type: "flush",
      value: sorted.findLast((c) => cardsBySuit[c.suit] >= 4)!.value,
    };
  } else if (isStraight) {
    return { type: "straight", value: sorted[sorted.length - 1].value };
  } else if (isThreeKind) {
    return {
      type: "three_kind",
      value: sorted.find((c) => cardsByValue[c.value] === 3)!.value,
    };
    // TODO: two pair
  } else if (isPair) {
    return {
      type: "pair",
      value: sorted.find((c) => cardsByValue[c.value] === 2)!.value,
    };
  }

  return { type: "high_card", value: sorted[sorted.length - 1].value };
}

export function determineWinningHand(hands: HandType[]): HandType {
  const ORDERED_HAND_TYPES: HandType["type"][] = [
    "high_card",
    "pair",
    "two_pair",
    "three_kind",
    "straight",
    "flush",
    "full_house",
    "four_kind",
    "straight_flush",
  ];

  let highestHand: HandType = hands[0];
  for (const hand of hands.slice(1)) {
    const handIndex = ORDERED_HAND_TYPES.findIndex((t) => t === hand.type);
    const highestHandIndex = ORDERED_HAND_TYPES.findIndex(
      (t) => t === highestHand.type,
    );
    if (handIndex === highestHandIndex) {
      if (
        "value" in hand &&
        "value" in highestHand &&
        hand.value >= highestHand.value
      ) {
        highestHand = hand;
      }

      if (
        "values" in hand &&
        "values" in highestHand &&
        // lexicographic comparison
        hand.values.reduce(
          (acc, cur, index) =>
            // @ts-expect-error I have no clue why inference is broken here
            acc === 0 ? hand.values[index] - highestHand.values[index] : acc,
          0,
        ) > 0
      ) {
        highestHand = hand;
      }
    } else if (handIndex > highestHandIndex) {
      highestHand = hand;
    }
  }

  return highestHand;
}
