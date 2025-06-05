import React, { useEffect, useState } from 'react';
import { PlayerState, PokerState } from '../types/poker';
import { formatUsdcDisplay } from '@/utils/usdcBalance';

interface MoveHistoryEntry {
  lastMove: PokerState['lastMove'];
  phase: PokerState['phase'];
  roundNumber: number;
}

interface MoveHistoryPanelProps {
  gameState: PokerState;
}

export const MoveHistoryPanel: React.FC<MoveHistoryPanelProps> = ({
  gameState,
}) => {
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);

  useEffect(() => {
    // Add new move to history if it exists and is different from the last one
    if (
      gameState &&
      gameState?.lastMove &&
      gameState.lastMove.move && // Ensure the move object exists
      gameState.lastMove.playerId && // Ensure playerId exists
      (!moveHistory.length ||
        JSON.stringify(gameState.lastMove) !==
          JSON.stringify(moveHistory?.[moveHistory.length - 1]?.lastMove))
    ) {
      setMoveHistory(prev => [...prev, {
        lastMove: gameState?.lastMove,
        phase: gameState.phase,
        roundNumber: gameState.round.roundNumber
      }]);
    }
  }, [gameState, moveHistory]);

  const getMoveDescription = (entry: MoveHistoryEntry) => {
    const { lastMove: move, phase, roundNumber } = entry;
    if (!move) return 'There are no moves yet';
    
    const { playerId, move: playerMove } = move;
    const playerName =
      gameState.players.find((p: PlayerState) => p.id === playerId)
        ?.playerName ?? playerId;

    const getActionText = () => {
      switch (playerMove.type) {
        case 'fold':
          return 'folded';
        case 'call':
          return 'called';
        case 'all_in':
          return 'went all in';
        case 'raise':
          return (
            <>
              raised to <span className='text-green-400'>${formatUsdcDisplay(playerMove.amount)}</span>
            </>
          );
        default:
          return 'Chuck used Roundhouse Kick';
      }
    };

    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-300 uppercase tracking-wide">{phase.street}</span>
          <span className="text-xs text-gray-300">Round {roundNumber}</span>
        </div>
        <div className="text-sm">
          <span className="text-green-400 font-semibold">{playerName}</span>
          <span className="text-white ml-2">{getActionText()}</span>
        </div>
      </div>
    );
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
              (entry: MoveHistoryEntry, index: number) => (
                <li
                  key={index}
                  className='text-white font-mono text-sm p-2 bg-black border border-white'
                >
                  {getMoveDescription(entry)}
                  {/* {entry.lastMove?.move.decisionContext?.explanation && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      {entry.lastMove.move.decisionContext.explanation}
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
