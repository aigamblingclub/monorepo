import { type PlayerState } from "poker-state-machine"
import { Chip } from "./Chip"
import { Card } from "./Card"

type PlayerInfoProps = {
  player: PlayerState
  position: "top" | "bottom" | "left" | "right"
  isCurrentPlayer?: boolean
  isDealer?: boolean
  isBigBlind?: boolean
  isSmallBlind?: boolean
}

export default function PlayerInfo({
  player,
  position,
  isCurrentPlayer,
}: PlayerInfoProps) {
  return (
      <div className="flex flex-col items-center gap-2">
        {player.hand && (
          <div className="flex gap-1 justify-center">
            {player.hand.map((card, i) => (
              <Card key={i} card={card} />
            ))}
          </div>
        )}

        <div className={`
          bg-gray-800
          text-white
          p-4
          rounded-lg
          w-[200px]
          ${isCurrentPlayer ? "ring-2 ring-yellow-400" : ""}
        `}>
          <div className="flex items-center">
            <div className="font-bold text-lg truncate mr-4 flex-1">
              {player.id}
            </div>
            <div className="text-gray-300 whitespace-nowrap">
              ${player.chips}
            </div>
          </div>
        </div>

        {player.status === "FOLDED" && (
          <div className="text-red-500 font-bold">FOLDED</div>
        )}
      </div>
    );
}
