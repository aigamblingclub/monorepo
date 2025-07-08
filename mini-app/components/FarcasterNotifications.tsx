'use client';

import React, { useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterNotificationsProps {
  gameState?: any;
  isAuthenticated?: boolean;
}

export default function FarcasterNotifications({ 
  gameState, 
  isAuthenticated 
}: FarcasterNotificationsProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enableNotifications = async () => {
    if (!isAuthenticated) {
      setError('Please authenticate with Farcaster first');
      return;
    }

    setIsEnabling(true);
    setError(null);

    try {
      // Request notification permission
      // Note: This would be implemented with the actual notification API
      // For now, we'll simulate the enablement
      
      console.log('🔔 Requesting notification permissions...');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setNotificationsEnabled(true);
      console.log('✅ Notifications enabled');
      
      // Send a test notification
      await sendTestNotification();
      
    } catch (error: any) {
      console.error('Failed to enable notifications:', error);
      setError(error.message || 'Failed to enable notifications');
    } finally {
      setIsEnabling(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      // This would use Farcaster's notification API
      console.log('📤 Sending test notification...');
      
      // Example notification payload
      const notification = {
        title: '🎉 Welcome to AI Poker Club!',
        body: 'You\'ll now receive updates about game actions and results.',
        icon: '/poker-icon.png',
      };
      
      console.log('Test notification:', notification);
      
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  const sendGameNotification = async (message: string) => {
    if (!notificationsEnabled) return;
    
    try {
      // This would send notifications about game events
      const notification = {
        title: '🃏 AI Poker Club',
        body: message,
        icon: '/poker-icon.png',
      };
      
      console.log('Game notification:', notification);
      
    } catch (error) {
      console.error('Failed to send game notification:', error);
    }
  };

  const disableNotifications = () => {
    setNotificationsEnabled(false);
    console.log('🔕 Notifications disabled');
  };

  // Auto-send notifications for game events
  React.useEffect(() => {
    if (!notificationsEnabled || !gameState) return;
    
    // Example: notify when it's a new round
    if (gameState.phase?.street === 'PREFLOP' && gameState.phase?.actionCount === 0) {
      sendGameNotification('🎲 New poker round started!');
    }
    
    // Example: notify when there's a winner
    if (gameState.winner) {
      sendGameNotification(`🏆 ${gameState.winner} won the round!`);
    }
    
  }, [gameState, notificationsEnabled]);

  if (!isAuthenticated) {
    return (
      <div className="bg-gray-900/30 border border-gray-400 rounded-lg p-4 mb-4 opacity-50">
        <div className="text-center">
          <h3 className="text-gray-300 font-semibold mb-2">🔔 Notifications</h3>
          <p className="text-gray-400 text-sm">
            Connect with Farcaster to enable notifications
          </p>
        </div>
      </div>
    );
  }

  if (notificationsEnabled) {
    return (
      <div className="bg-blue-900/30 border border-blue-400 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">🔔</span>
            </div>
            <div>
              <p className="text-blue-100 font-medium">Notifications Active</p>
              <p className="text-blue-300 text-sm">You'll receive game updates</p>
            </div>
          </div>
          <button
            onClick={disableNotifications}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Disable
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-900/30 border border-yellow-400 rounded-lg p-4 mb-4">
      <div className="text-center">
        <h3 className="text-yellow-100 font-semibold mb-2">🔔 Game Notifications</h3>
        <p className="text-yellow-300 text-sm mb-4">
          Get notified about important game events and results
        </p>
        
        {error && (
          <div className="bg-red-900/50 border border-red-400 rounded p-2 mb-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}
        
        <button
          onClick={enableNotifications}
          disabled={isEnabling}
          className="w-full bg-yellow-600 text-white py-2 px-4 rounded font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isEnabling ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Enabling...
            </span>
          ) : (
            '🔔 Enable Notifications'
          )}
        </button>
        
        <p className="text-yellow-400 text-xs mt-2">
          Get updates about new rounds, wins, and game events
        </p>
      </div>
    </div>
  );
} 