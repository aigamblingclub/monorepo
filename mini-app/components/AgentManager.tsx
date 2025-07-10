'use client';

import { PlayerState as Player } from '@/types/poker';
import { useState } from 'react';
import { AgentEditForm } from './AgentEditForm';

// For the MVP, we'll hardcode which agents are owned by the user.
// In a real app, this would come from an auth context or API call.
const USER_OWNED_AGENTS = ['The Showman']; // We use player name for the MVP

interface AgentManagerProps {
  players: Player[];
}

export const AgentManager: React.FC<AgentManagerProps> = ({ players }) => {
  const [editingAgent, setEditingAgent] = useState<Player | null>(null);

  if (editingAgent) {
    return (
      <AgentEditForm
        agent={editingAgent}
        onBack={() => setEditingAgent(null)}
      />
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Game Agents</h3>
      <ul className="space-y-3">
        {players.map((player) => {
          const isUserOwned = USER_OWNED_AGENTS.includes(player.playerName);
          return (
            <li
              key={player.id}
              className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
            >
              <span className="font-medium text-white">{player.playerName}</span>
              {isUserOwned ? (
                <button
                  onClick={() => setEditingAgent(player)}
                  className="px-3 py-1 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              ) : (
                <span className="px-3 py-1 text-sm text-gray-500 rounded-md bg-gray-700">
                  NPC
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}; 