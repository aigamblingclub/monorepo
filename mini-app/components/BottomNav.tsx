'use client';

import { toast } from 'sonner';
import { AgentsIcon, BetIcon, ChatIcon, MintIcon, MoreIcon } from './icons';

export type MenuItemLabel = 'Mint' | 'Bet' | 'Chat' | 'Agents' | 'More';

interface BottomNavProps {
  onMenuItemClick: (item: MenuItemLabel) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onMenuItemClick }) => {
  const menuItems: { label: MenuItemLabel; icon: React.ElementType }[] = [
    {
      label: 'Mint',
      icon: MintIcon,
    },
    {
      label: 'Bet',
      icon: BetIcon,
    },
    {
      label: 'Chat',
      icon: ChatIcon,
    },
    {
      label: 'Agents',
      icon: AgentsIcon,
    },
    {
      label: 'More',
      icon: MoreIcon,
    },
  ];

  return (
    <nav className="fixed z-50 bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 flex justify-around items-center h-16 z-60">
      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={() => onMenuItemClick(item.label)}
          className="flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <item.icon className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}; 