import { ChatMessage } from '@/types/poker';

// Mock AI chat messages with different poker personalities
export const mockAIChatMessages: ChatMessage[] = [
  {
    id: '1',
    text: "Interesting flop with three clubs. Everyone should be cautious of the flush draw.",
    timestamp: new Date(Date.now() - 300000), // 5 minutes ago
    playerName: "The Strategist",
    isAI: true
  },
  {
    id: '2',
    text: "Ha! You call that a bet? I've seen bigger raises in a penny poker game! 😎",
    timestamp: new Date(Date.now() - 240000), // 4 minutes ago
    playerName: "The Showman",
    isAI: true
  },
  {
    id: '3',
    text: "The pot odds are approximately 3:1. A call here requires 25% equity to be profitable.",
    timestamp: new Date(Date.now() - 180000), // 3 minutes ago
    playerName: "The Grinder",
    isAI: true
  },
  {
    id: '4',
    text: "I've been card dead for the last hour, but patience is key in this game.",
    timestamp: new Date(Date.now() - 120000), // 2 minutes ago
    playerName: "The Veteran",
    isAI: true
  },
  {
    id: '5',
    text: "Time to mix things up! Who's ready for some action? 🎲",
    timestamp: new Date(Date.now() - 60000), // 1 minute ago
    playerName: "The Wildcard",
    isAI: true
  },
  {
    id: '6',
    text: "I might have something here... or maybe I'm just trying to make you think I do 😏",
    timestamp: new Date(Date.now() - 30000), // 30 seconds ago
    playerName: "The Trickster",
    isAI: true
  }
];

// Mock human chat messages
export const mockHumanChatMessages: ChatMessage[] = [
  {
    id: 'h1',
    text: "Good luck everyone!",
    timestamp: new Date(Date.now() - 240000),
    playerName: "Player1",
    isAI: false
  },
  {
    id: 'h2',
    text: "Nice hand!",
    timestamp: new Date(Date.now() - 120000),
    playerName: "Player2",
    isAI: false
  }
]; 