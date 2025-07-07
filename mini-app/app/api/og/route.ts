import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'default';
  const dataParam = searchParams.get('data');
  
  // Parse game state data if provided
  let gameState = null;
  if (dataParam) {
    try {
      gameState = JSON.parse(decodeURIComponent(dataParam));
    } catch (error) {
      console.error('Error parsing game state data:', error);
    }
  }
  
  // Generate SVG image based on action and game state
  const generateSVG = (action: string, gameState: any) => {
    let message = 'AI Poker Club - Watch AI agents battle!';
    let statusColor = '#ffd700';
    let tableColor = '#2d5a3d';
    let showPlayers = false;
    let playerData = [];
    let potAmount = 0;
    let roundNumber = 1;
    
    if (gameState) {
      const { tableStatus, phase, players, round, winner } = gameState;
      const activePlayers = players?.filter((p: any) => p.status === 'PLAYING') || [];
      potAmount = round?.volume || 0;
      roundNumber = round?.roundNumber || 1;
      
      // Extract player data for display
      playerData = activePlayers.slice(0, 6).map((player: any, index: number) => ({
        name: player.playerName || `Player ${index + 1}`,
        chips: player.chips || 0,
        status: player.status || 'WAITING',
        isActive: player.id === gameState.currentPlayerIndex
      }));
      
      if (action === 'waiting') {
        message = `Waiting for players: ${activePlayers.length}/6`;
        statusColor = '#ffa500';
        showPlayers = true;
      } else if (action === 'playing') {
        message = `Round ${roundNumber} • ${phase} • Pot: ${potAmount}`;
        statusColor = '#00ff00';
        tableColor = '#1a4f2a';
        showPlayers = true;
      } else if (action === 'finished') {
        message = winner ? `🏆 Winner: ${winner}!` : 'Game Finished!';
        statusColor = '#ff6b35';
        showPlayers = true;
      } else if (action === 'stats') {
        message = `Round ${roundNumber} Stats • ${activePlayers.length} Players`;
        statusColor = '#6366f1';
        showPlayers = true;
      } else {
        // Default with game state
        if (tableStatus === 'WAITING') {
          message = `AI Poker Club • ${activePlayers.length}/6 Players`;
          statusColor = '#ffa500';
        } else if (tableStatus === 'PLAYING') {
          message = `🎮 Live Game • Round ${roundNumber}`;
          statusColor = '#00ff00';
          tableColor = '#1a4f2a';
        } else {
          message = 'AI Poker Club • Join the Action!';
        }
        showPlayers = activePlayers.length > 0;
      }
    } else {
      // Fallback messages for when no game state is available
      if (action === 'join') {
        message = 'Welcome to AI Poker Club! 🎉';
        statusColor = '#00ff00';
      } else if (action === 'stats') {
        message = 'AI Poker Stats - Loading...';
        statusColor = '#6366f1';
      }
    }
    
    return `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0f5132;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1a5f3f;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="tableBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${tableColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f3d20;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        
        <!-- Poker table ellipse -->
        <ellipse cx="600" cy="315" rx="400" ry="200" fill="url(#tableBg)" stroke="${statusColor}" stroke-width="8"/>
        
        <!-- Title -->
        <text x="600" y="120" font-family="Arial, sans-serif" font-size="42" font-weight="bold" text-anchor="middle" fill="${statusColor}">
          AI POKER CLUB
        </text>
        
        <!-- Main Message -->
        <text x="600" y="180" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="white">
          ${message}
        </text>
        
        ${showPlayers && playerData.length > 0 ? `
          <!-- Player Info -->
          ${playerData.map((player: any, index: number) => {
            const angle = (index * 60) - 150; // Distribute around table
            const radius = 320;
            const x = 600 + radius * Math.cos(angle * Math.PI / 180);
            const y = 315 + radius * Math.sin(angle * Math.PI / 180) * 0.6;
            const isActive = player.isActive;
            
            return `
              <g>
                <!-- Player circle -->
                <circle cx="${x}" cy="${y}" r="25" fill="${isActive ? statusColor : '#4a5568'}" stroke="white" stroke-width="2"/>
                <!-- Player name -->
                <text x="${x}" y="${y - 35}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="white">
                  ${player.name.length > 8 ? player.name.substring(0, 8) + '...' : player.name}
                </text>
                <!-- Player chips -->
                <text x="${x}" y="${y + 50}" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="${statusColor}">
                  ${player.chips} chips
                </text>
              </g>
            `;
          }).join('')}
        ` : `
          <!-- Default cards decoration when no players -->
          <rect x="450" y="280" width="40" height="60" rx="6" fill="white" stroke="#333" stroke-width="2"/>
          <rect x="500" y="280" width="40" height="60" rx="6" fill="white" stroke="#333" stroke-width="2"/>
          <rect x="660" y="280" width="40" height="60" rx="6" fill="white" stroke="#333" stroke-width="2"/>
          <rect x="710" y="280" width="40" height="60" rx="6" fill="white" stroke="#333" stroke-width="2"/>
        `}
        
        <!-- Pot display (if game is active) -->
        ${potAmount > 0 ? `
          <rect x="550" y="300" width="100" height="30" rx="15" fill="rgba(0,0,0,0.7)" stroke="${statusColor}" stroke-width="2"/>
          <text x="600" y="320" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="${statusColor}">
            POT: ${potAmount}
          </text>
        ` : ''}
        
        <!-- Chips decoration -->
        <circle cx="520" cy="240" r="12" fill="#dc2626"/>
        <circle cx="540" cy="240" r="12" fill="#2563eb"/>
        <circle cx="560" cy="240" r="12" fill="#16a34a"/>
        <circle cx="640" cy="240" r="12" fill="#16a34a"/>
        <circle cx="660" cy="240" r="12" fill="#2563eb"/>
        <circle cx="680" cy="240" r="12" fill="#dc2626"/>
        
        <!-- Status indicator -->
        <rect x="50" y="50" width="200" height="40" rx="20" fill="rgba(0,0,0,0.8)" stroke="${statusColor}" stroke-width="2"/>
        <text x="150" y="75" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="${statusColor}">
          ${action.toUpperCase()}
        </text>
        
        <!-- Live indicator for active games -->
        ${gameState?.tableStatus === 'PLAYING' ? `
          <circle cx="1150" cy="80" r="8" fill="#ff0000">
            <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/>
          </circle>
          <text x="1120" y="85" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="end" fill="white">
            LIVE
          </text>
        ` : ''}
      </svg>
    `;
  };
  
  const svg = generateSVG(action, gameState);
  
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=60', // Reduced cache time for dynamic content
    },
  });
} 