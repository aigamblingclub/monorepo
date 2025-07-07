import { NextResponse } from 'next/server';

// Environment check
const isDev = process.env.NODE_ENV === 'development';

export async function GET() {
  try {
    const serverMainUrl = isDev
      ? process.env.NEXT_PUBLIC_SERVER_MAIN_LOCAL
      : process.env.NEXT_PUBLIC_SERVER_MAIN;

    if (!serverMainUrl) {
      // If no server URL configured, return mock data for development
      return NextResponse.json({
        error: 'Server URL not configured',
      });
    }

    const response = await fetch(`${serverMainUrl}/api/game/current-state`, {
      headers: {
        'API-KEY': process.env.SERVER_MAIN_API_KEY || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch poker state' },
        { status: 500 }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Poker state fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch poker state' },
      { status: 500 }
    );
  }
} 