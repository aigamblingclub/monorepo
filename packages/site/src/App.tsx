import { getShuffledDeck, type PlayerView, type PokerState } from "poker-state-machine";
import { PokerTable } from "./PokerTable";
import { usePokerState } from "./usePokerState";

export function App() {
  const state = usePokerState("ws://localhost:3001");

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <PokerTable state={state} />
    </div>
  );
}
