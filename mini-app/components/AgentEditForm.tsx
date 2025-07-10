'use client';

import { PlayerState as Player } from '@/types/poker';
import { useState } from 'react';
import SimpleBar from 'simplebar-react';

// For the MVP, we'll use mock data based on the provided showman.json
// In a real app, this data would be fetched from an API for the selected agent.
const mockAgentData = {
  name: 'The Showman',
  system:
    "You are a flamboyant, high-stakes poker showman specializing in Texas Hold'em. Your goal is to dominate the table with bold plays, daring bluffs, and psychological warfare, winning big while entertaining everyone. Use your knowledge of poker psychology and memory of past games to outwit opponents and craft unforgettable moments. Communicate with charisma, drama, and provocative flair, making every hand a spectacle.",
  bio: [
    'Infamous poker icon known for jaw-dropping bluffs and theatrical table presence',
    "Thrives in high-stakes Texas Hold'em with an ultra-aggressive, unpredictable style",
    'Master of reading tells and manipulating opponents’ emotions',
    'Loved by fans for turning poker into a dramatic performance',
  ],
  lore: [
    'Rose from smoky backroom games to dazzling televised tournaments',
    'Once won a million-dollar pot with a 10-high bluff, cementing legend status',
    'Critics call them reckless, but fans adore their fearless swagger',
    'Lives for the thrill of all-in moments and the roar of the crowd',
  ],
  adjectives: [
    'flamboyant',
    'daring',
    'unpredictable',
    'charismatic',
    'provocative',
    'fearless',
    'theatrical',
    'bold',
    'entertaining',
    'magnetic',
  ],
};

interface AgentEditFormProps {
  agent: Player;
  onBack: () => void;
}

export const AgentEditForm: React.FC<AgentEditFormProps> = ({
  agent,
  onBack,
}) => {
  // We use the agent's name to pre-fill but the rest is mock data for the MVP.
  const [formData, setFormData] = useState({
    name: agent.playerName,
    system: mockAgentData.system,
    bio: mockAgentData.bio.join('\n'),
    lore: mockAgentData.lore.join('\n'),
    adjectives: mockAgentData.adjectives.join(', '),
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    // For the MVP, we just log the data to the console.
    const finalData = {
      ...formData,
      bio: formData.bio.split('\n').filter((line) => line.trim() !== ''),
      lore: formData.lore.split('\n').filter((line) => line.trim() !== ''),
      adjectives: formData.adjectives
        .split(',')
        .map((adj) => adj.trim())
        .filter((adj) => adj !== ''),
    };
    console.log('Saving agent data:', finalData);
    // alert('Agent data saved to console! Check the browser dev tools.');
    onBack();
  };

  return (
    <div className="p-4 h-full flex flex-col text-white">
      <div className="flex items-center mb-4 flex-shrink-0">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-700">
          &larr;
        </button>
        <h3 className="text-lg font-semibold">Edit: {agent.playerName}</h3>
      </div>

      <SimpleBar className="flex-grow form-scrollbar overflow-y-auto">
        <div className="pr-4 space-y-4 pb-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Agent Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 placeholder-gray-500"
            />
          </div>
          <div>
            <label
              htmlFor="system"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Personality / System Prompt
            </label>
            <textarea
              name="system"
              id="system"
              rows={6}
              value={formData.system}
              onChange={handleInputChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 placeholder-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              This is the core personality. It has the biggest impact on the
              agent's decisions.
            </p>
          </div>
          <div>
            <label
              htmlFor="bio"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Biography
            </label>
            <textarea
              name="bio"
              id="bio"
              rows={4}
              value={formData.bio}
              onChange={handleInputChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 placeholder-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              One bio point per line. This gives the agent a backstory.
            </p>
          </div>
          <div>
            <label
              htmlFor="lore"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Lore / History
            </label>
            <textarea
              name="lore"
              id="lore"
              rows={4}
              value={formData.lore}
              onChange={handleInputChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 placeholder-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              One lore point per line. Fun facts and history for the agent.
            </p>
          </div>
          <div>
            <label
              htmlFor="adjectives"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Adjectives / Style
            </label>
            <input
              type="text"
              name="adjectives"
              id="adjectives"
              value={formData.adjectives}
              onChange={handleInputChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 placeholder-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Comma-separated tags to describe the agent's play style.
            </p>
          </div>
        </div>
      </SimpleBar>

      <div className="mt-4 flex-shrink-0">
        <button
          onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}; 