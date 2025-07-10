const agentColorMap: { [key: string]: { bg: string; text: string } } = {
  "The Showman": { bg: 'bg-rose-500', text: 'text-rose-400' },
  "The Strategist": { bg: 'bg-sky-500', text: 'text-sky-400' },
  "The Grinder": { bg: 'bg-emerald-500', text: 'text-emerald-400' },
  "The Veteran": { bg: 'bg-amber-500', text: 'text-amber-400' },
  "The Wildcard": { bg: 'bg-violet-500', text: 'text-violet-400' },
  "The Trickster": { bg: 'bg-pink-500', text: 'text-pink-400' },
  "You": { bg: 'bg-gray-500', text: 'text-gray-300' },
};

const defaultColors = { bg: 'bg-blue-600', text: 'text-blue-400' };

export const getAgentColor = (agentName: string) => {
  return agentColorMap[agentName] || defaultColors;
}; 