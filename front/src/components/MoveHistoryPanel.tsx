import React, { useEffect, useState } from 'react';
import { PlayerState, PokerState } from '../types/poker';

interface MoveHistoryPanelProps {
  gameState: PokerState;
}

export const MoveHistoryPanel: React.FC<MoveHistoryPanelProps> = ({ gameState }) => {
    const [moveHistory, setMoveHistory] = useState<PokerState["lastMove"][]>(
      []
    );

  useEffect(() => {
    // Add new move to history if it exists and is different from the last one
    if (
      gameState.lastMove &&
      (!moveHistory.length ||
        JSON.stringify(gameState.lastMove) !==
          JSON.stringify(moveHistory[moveHistory.length - 1]))
    ) {
      setMoveHistory((prev) => [...prev, gameState.lastMove]);
    }
  }, [gameState.lastMove, moveHistory]);

  const getMoveDescription = (move: NonNullable<PokerState["lastMove"]>) => {
    const { playerId, move: playerMove } = move;
    console.log("🔍 Move:", move);
    const playerName =
      gameState.players.find((p: PlayerState) => p.id === playerId)
        ?.playerName ?? playerId;

    switch (playerMove.type) {
      case "fold":
        return `Round ${gameState.round.roundNumber} - Street ${gameState.round.phase} - ${playerName} - folded`;
      case "call":
        return `Round ${gameState.round.roundNumber} - Street ${gameState.round.phase} - ${playerName} - called`;
      case "all_in":
        return `Round ${gameState.round.roundNumber} - Street ${gameState.round.phase} - ${playerName} - went all in`;
      case "raise":
        return `Round ${gameState.round.roundNumber} - Street ${gameState.round.phase} - ${playerName} - raised to ${playerMove.amount}`;
      default:
        return "Unknown move";
    }
  };

  return (
    <div className="bg-surface-primary rounded-border-radius-element p-4 border border-theme-primary rounded-border-radius-element">
      <h3 className="text-theme-primary text-shadow-cyan mb-4">Move History</h3>
      <div className="max-h-96 overflow-y-auto">
        {moveHistory?.length === 0 ? (
          <p className="text-theme-secondary text-shadow-cyan text-sm">
            No moves yet
          </p>
        ) : (
          <ul className="space-y-2">
            {moveHistory.map(
              (move, index) =>
                move && (
                  <li
                    key={index}
                    className="text-theme-primary text-shadow-cyan text-sm p-2 bg-surface-secondary rounded-border-radius-element"
                  >
                    {getMoveDescription(move)}
                    {/* {move.move.decisionContext?.explanation && (
                      <p className="text-xs text-theme-secondary mt-1">
                        {move.move.decisionContext.explanation}
                      </p>
                    )} */}
                  </li>
                )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}; 