import { type Card as CardType } from "poker-state-machine";

const SUIT_SYMBOLS = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const VALUE_SYMBOLS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

interface CardProps {
  card: CardType;
}

export function Card({ card }: CardProps) {
  const value = VALUE_SYMBOLS[card.rank] ?? card.rank.toString();
  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div className="w-14 h-20 bg-white rounded-lg border border-gray-300 flex items-center justify-center">
      <div className={`text-lg ${isRed ? "text-red-600" : "text-black"}`}>
        <div>{value}</div>
        <div>{SUIT_SYMBOLS[card.suit]}</div>
      </div>
    </div>
  );
}
