import { NextRequest, NextResponse } from 'next/server';

// Helper function to build URLs correctly
function buildUrl(baseUrl: string, path: string) {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

// Helper function to get real game state
async function getCurrentGameState() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://poker-ai-flax.vercel.app';
    const response = await fetch(buildUrl(baseUrl, '/api/current-state'));
    
    if (!response.ok) {
      console.log('Failed to fetch game state, using fallback');
      return null;
    }
    
    const data = await response.json();
    return data.error ? null : data;
  } catch (error) {
    console.error('Error fetching game state:', error);
    return null;
  }
}

// Helper function to generate dynamic frame content based on game state
function generateFrameContent(gameState: any, action?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://poker-ai-flax.vercel.app';
  
  let title = 'AI Poker Club';
  let description = 'Join the AI Poker Club and play against AI opponents!';
  let button1Text = '🎮 Join Game';
  let button2Text = '📊 View Stats';
  let imageAction = action || 'default';
  
  if (gameState) {
    // Customize based on real game state
    const { tableStatus, phase, players, round } = gameState;
    const activePlayers = players?.filter((p: any) => p.status === 'PLAYING')?.length || 0;
    
    if (tableStatus === 'WAITING') {
      title = `AI Poker Club - Waiting (${activePlayers}/6)`;
      description = `${activePlayers} players ready. Waiting for more players to start.`;
      button1Text = '🎮 Join Game';
      button2Text = '👥 View Players';
      imageAction = 'waiting';
    } else if (tableStatus === 'PLAYING') {
      title = `AI Poker Club - Round ${round?.roundNumber || 1}`;
      description = `${activePlayers} players in ${phase || 'unknown'} phase. Current pot: ${round?.volume || 0} chips.`;
      button1Text = '👀 Watch Live';
      button2Text = '📊 Game Stats';
      imageAction = 'playing';
    } else if (tableStatus === 'FINISHED') {
      const winner = gameState.winner;
      title = `AI Poker Club - Game Finished`;
      description = winner ? `Winner: ${winner}! New game starting soon.` : 'Game finished! New game starting soon.';
      button1Text = '🎮 Join Next';
      button2Text = '🏆 Results';
      imageAction = 'finished';
    }
  }
  
  return {
    title,
    description,
    button1Text,
    button2Text,
    imageAction
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();
    const buttonIndex = body.get('untrustedData.buttonIndex');
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://poker-ai-flax.vercel.app';
    
    // Get current game state
    const gameState = await getCurrentGameState();
    
    // Handle different button actions
    if (buttonIndex === '1') {
      // Button 1 action (Join Game / Watch Live / Join Next)
      const content = generateFrameContent(gameState, 'join');
      
      return new NextResponse(
        `<!DOCTYPE html>
<html>
  <head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${buildUrl(baseUrl, `/api/og?action=${content.imageAction}`)}" />
    <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
    <meta property="fc:frame:button:1" content="👀 Watch Game" />
    <meta property="fc:frame:button:2" content="📊 View Stats" />
    <meta property="fc:frame:post_url" content="${buildUrl(baseUrl, '/api/frame')}" />
    <meta property="og:title" content="${content.title}" />
    <meta property="og:description" content="${content.description}" />
    <meta property="og:image" content="${buildUrl(baseUrl, `/api/og?action=${content.imageAction}`)}" />
    <title>${content.title}</title>
  </head>
  <body>
    <p>You're now watching the AI Poker Club! 🎉</p>
  </body>
</html>`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }
    
    if (buttonIndex === '2') {
      // Button 2 action (View Stats / Game Stats / Results)
      const content = generateFrameContent(gameState, 'stats');
      
      return new NextResponse(
        `<!DOCTYPE html>
<html>
  <head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${buildUrl(baseUrl, `/api/og?action=stats&data=${encodeURIComponent(JSON.stringify(gameState))}`)}" />
    <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
    <meta property="fc:frame:button:1" content="🎮 Join Game" />
    <meta property="fc:frame:button:2" content="🔄 Refresh" />
    <meta property="fc:frame:post_url" content="${buildUrl(baseUrl, '/api/frame')}" />
    <meta property="og:title" content="${content.title}" />
    <meta property="og:description" content="${content.description}" />
    <meta property="og:image" content="${buildUrl(baseUrl, `/api/og?action=stats&data=${encodeURIComponent(JSON.stringify(gameState))}`)}" />
    <title>${content.title}</title>
  </head>
  <body>
    <p>AI Poker Club Statistics</p>
  </body>
</html>`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }
    
    // Default response with current game state
    const content = generateFrameContent(gameState);
    
    return new NextResponse(
      `<!DOCTYPE html>
<html>
  <head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${buildUrl(baseUrl, `/api/og?action=${content.imageAction}&data=${encodeURIComponent(JSON.stringify(gameState))}`)}" />
    <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
    <meta property="fc:frame:button:1" content="${content.button1Text}" />
    <meta property="fc:frame:button:2" content="${content.button2Text}" />
    <meta property="fc:frame:post_url" content="${buildUrl(baseUrl, '/api/frame')}" />
    <meta property="og:title" content="${content.title}" />
    <meta property="og:description" content="${content.description}" />
    <meta property="og:image" content="${buildUrl(baseUrl, `/api/og?action=${content.imageAction}&data=${encodeURIComponent(JSON.stringify(gameState))}`)}" />
    <title>${content.title}</title>
  </head>
  <body>
    <p>Welcome to AI Poker Club!</p>
  </body>
</html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
    
  } catch (error) {
    console.error('Frame API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://poker-ai-flax.vercel.app';
  
  // Get current game state for initial load
  const gameState = await getCurrentGameState();
  const content = generateFrameContent(gameState);
  
  return new NextResponse(
    `<!DOCTYPE html>
<html>
  <head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${buildUrl(baseUrl, `/api/og?action=${content.imageAction}&data=${encodeURIComponent(JSON.stringify(gameState))}`)}" />
    <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
    <meta property="fc:frame:button:1" content="${content.button1Text}" />
    <meta property="fc:frame:button:2" content="${content.button2Text}" />
    <meta property="fc:frame:post_url" content="${buildUrl(baseUrl, '/api/frame')}" />
    <meta property="og:title" content="${content.title}" />
    <meta property="og:description" content="${content.description}" />
    <meta property="og:image" content="${buildUrl(baseUrl, `/api/og?action=${content.imageAction}&data=${encodeURIComponent(JSON.stringify(gameState))}`)}" />
    <title>${content.title}</title>
  </head>
  <body>
    <p>Welcome to AI Poker Club!</p>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    }
  );
} // Force redeploy Sat Jul  5 09:28:42 -03 2025
