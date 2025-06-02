import React, { useEffect, useState } from 'react';
import { PlayerState, PokerState } from '../types/poker';

interface MoveHistoryPanelProps {
  gameState: PokerState;
}

export const MoveHistoryPanel: React.FC<MoveHistoryPanelProps> = ({
  gameState,
}) => {
  const [moveHistory, setMoveHistory] = useState<PokerState['lastMove'][]>([]);

  useEffect(() => {
    // Add new move to history if it exists and is different from the last one
    if (
      gameState.lastMove &&
      (!moveHistory.length ||
        JSON.stringify(gameState.lastMove) !==
          JSON.stringify(moveHistory[moveHistory.length - 1]))
    ) {
      setMoveHistory(prev => [...prev, gameState.lastMove]);
    }
  }, [gameState.lastMove, moveHistory]);

  const getMoveDescription = (move: NonNullable<PokerState['lastMove']>) => {
    const { playerId, move: playerMove } = move;
    const playerName =
      gameState.players.find((p: PlayerState) => p.id === playerId)
        ?.playerName ?? playerId;

    switch (playerMove.type) {
      case 'fold':
        return `Round ${gameState.round.roundNumber} - Street ${gameState.phase.street} - ${playerName} - folded`;
      case 'call':
        return `Round ${gameState.round.roundNumber} - Street ${gameState.phase.street} - ${playerName} - called`;
      case 'all_in':
        return `Round ${gameState.round.roundNumber} - Street ${gameState.phase.street} - ${playerName} - went all in`;
      case 'raise':
        return (
          <>
            Round {gameState.round.roundNumber} - Street{' '}
            {gameState.phase.street} - {playerName} - raised to{' '}
            <span className='text-green-400'>${playerMove.amount}</span>
          </>
        );
      default:
        return 'Unknown move';
    }
  };

  return (
    <div className='bg-black border-2 border-white p-4 flex-shrink-0 h-[50vh] max-h-[500px] flex flex-col'>
      <h3 className='text-white font-mono font-bold text-lg mb-4'>
        Move History
      </h3>
      <div className='flex-1 overflow-y-auto'>
        {moveHistory?.length === 0 ? (
          <p className='text-white font-mono text-sm'>No moves yet</p>
        ) : (
          <ul className='space-y-2'>
            {moveHistory.map(
              (move: PokerState['lastMove'], index: number) =>
                move && (
                  <li
                    key={index}
                    className='text-white font-mono text-sm p-2 bg-black border border-white'
                  >
                    {getMoveDescription(move)}
                    {/* {move.move.decisionContext?.explanation && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">
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
