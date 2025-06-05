import React, { useEffect, useState } from 'react';
import { PlayerState, PokerState } from '../types/poker';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { formatChips } from '@/utils/poker';

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

  /// @dev Use this to mock moves
  // const addRandomMove = () => {
  //   const moveTypes = ['fold', 'call', 'all_in', 'raise'] as const;
  //   const streets = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'] as const;
  //   const playerNames = ['The Showman', 'Chuck Norris', 'Poker Face', 'Ace Hunter', 'Bluff Master'];
    
  //   const randomMoveType = moveTypes[Math.floor(Math.random() * moveTypes.length)];
  //   const randomStreet = streets[Math.floor(Math.random() * streets.length)];
  //   const randomPlayerName = playerNames[Math.floor(Math.random() * playerNames.length)];
  //   const randomAmount = Math.floor(Math.random() * 1000) + 100;

  //   setMoveHistory(prev => {
  //     const nextRound = prev.length + 1;
      
  //     const mockMove: MoveHistoryEntry = {
  //       lastMove: {
  //         type: 'move',
  //         playerId: `player_${Math.random()}`,
  //         move: randomMoveType === 'raise' 
  //           ? { type: 'raise', amount: randomAmount, decisionContext: null }
  //           : { type: randomMoveType, decisionContext: null }
  //       },
  //       phase: {
  //         street: randomStreet,
  //         actionCount: 0,
  //         volume: 0
  //       },
  //       roundNumber: nextRound
  //     };

  //     return [...prev, mockMove];
  //   });
  // };

  useEffect(() => {
    // Add new move to history if it exists and is different from the last one
    if (
      gameState &&
      gameState?.lastMove &&
      gameState.lastMove.move && // Ensure the move object exists
      gameState.lastMove.playerId // Ensure playerId exists
    ) {
      setMoveHistory(prev => {
        // Check if this move is different from the last one in the current history
        if (prev.length === 0 || 
            JSON.stringify(gameState.lastMove) !== JSON.stringify(prev[prev.length - 1]?.lastMove)) {
          return [...prev, {
            lastMove: gameState?.lastMove,
            phase: gameState.phase,
            roundNumber: gameState.round.roundNumber
          }];
        }
        return prev; // No change if it's the same move
      });
    }
  }, [gameState]);

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
              raised to <span className='text-green-400'>{formatChips(playerMove.amount)}</span>
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
        <div className="text-xs break-words whitespace-normal">
          <span className="text-green-400 font-semibold">{playerName}</span>
          <span className="text-white ml-2">{getActionText()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className='bg-black border-2 border-white p-4 flex-shrink-0 h-[50vh] max-h-[500px] flex flex-col'>
      <div className="flex justify-between items-center mb-4">
        <h3 className='text-white font-mono font-bold text-lg'>
          Move History
        </h3>
        {/* <button
          onClick={addRandomMove}
          className="text-xs bg-green-600 hover:bg-green-700 text-white font-mono px-2 py-1 border border-white"
        > */}
          {/* Add Random Move */}
        {/* </button> */}
      </div>
      <SimpleBar
        autoHide={false}
        className='ai-thoughts-scrollbar'
        style={{ height: 'calc(100% - 60px)' }}
      >
        <div className='pr-4'>
          <div className='space-y-2'>
            {moveHistory?.length === 0 ? (
              <p className='text-white font-mono text-sm'>No moves yet</p>
            ) : (
              <ul className='space-y-2'>
                {moveHistory.slice().reverse().map(
                  (entry: MoveHistoryEntry, index: number) => (
                    <li
                      key={moveHistory.length - 1 - index}
                      className='text-white font-mono text-sm p-2 bg-black border border-white'
                    >
                      {getMoveDescription(entry)}
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </div>
      </SimpleBar>
    </div>
  );
};
