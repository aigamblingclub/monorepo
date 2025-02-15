import { bigBlind, currentPlayer, dealer, roundRotation, smallBlind, type PokerState } from "poker-state-machine";
import { Card } from "./Card";
import PlayerInfo from "./PlayerInfo";
import { PlayerChips } from "./PlayerChips";

const PLAYER_POSITIONS = [
  { top: "5%", left: "50%" },   // North
  { top: "25%", left: "90%" },  // Northeast
  { top: "75%", left: "90%" },  // Southeast
  { top: "95%", left: "50%" },  // South
  { top: "75%", left: "10%" },  // Southwest
  { top: "25%", left: "10%" },  // Northwest
];

interface PokerTableProps {
  state: PokerState;
}

export function PokerTable({ state }: PokerTableProps) {
  const currentPlayerId = currentPlayer(state)?.id
  const dealerId = dealer(state)?.id;
  const bigBlindId = bigBlind(state)?.id;
  const smallBlindId = smallBlind(state)?.id;

  const allPlayers = Object.values(state.players)

  return (
    <div className="w-full aspect-[2/1] relative mb-4">
      <div className="absolute w-[75%] h-[75%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-800 rounded-[50%] border-8 border-yellow-600">
        {allPlayers.map((p, index) => (
          <PlayerChips
            key={`player-chips-${p.id}`}
            bet={p.bet}
            isDealer={p.id === dealerId}
            isBigBlind={p.id === bigBlindId}
            isSmallBlind={p.id === smallBlindId}
            position={index}
          />
        ))}

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="mb-4">
            <div className="text-white">Pot: ${state.pot}</div>
            <div className="text-white">Current Bet: ${state.bet}</div>
          </div>

          <div className="flex gap-2 mb-4">
            {state.community.map((card, i) => (
              <Card key={i} card={card} />
            ))}
          </div>
        </div>
      </div>

      {allPlayers.map((p, index) => (
        <div
          key={`player-info-${p.id}`}
          className="absolute z-10"
          style={{
            ...PLAYER_POSITIONS[index],
            transform: "translate(-50%, -50%)",
          }}
        >
          <PlayerInfo
            player={p}
            isCurrentPlayer={p.id === currentPlayerId}
            position={"top"}
          />
        </div>
      ))}
    </div>
  );
}
