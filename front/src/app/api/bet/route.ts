import { isDev } from '@/utils/env';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const userApiKey = (await headers()).get('x-api-key') || '';

    const serverMainUrl = isDev
      ? process.env.NEXT_PUBLIC_SERVER_MAIN_LOCAL
      : process.env.NEXT_PUBLIC_SERVER_MAIN;

    const response = await fetch(`${serverMainUrl}/api/user/bet`, {
      headers: {
        'x-api-key': userApiKey,
        'API-KEY': process.env.SERVER_MAIN_API_KEY || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch bet' },
        { status: 500 }
      );
    }
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Bet fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bet' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { playerId, amount } = await request.json();
  if (!playerId || !amount) {
    return NextResponse.json(
      { error: 'Missing playerId or amount' },
      { status: 400 }
    );
  }
  try {
    const userApiKey = (await headers()).get('x-api-key') || '';

    const serverMainUrl = isDev
      ? process.env.NEXT_PUBLIC_SERVER_MAIN_LOCAL
      : process.env.NEXT_PUBLIC_SERVER_MAIN;

    const response = await fetch(`${serverMainUrl}/api/bet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': userApiKey,
        'API-KEY': process.env.SERVER_MAIN_API_KEY || '',
      },
      body: JSON.stringify({
        playerId,
        amount,
      }),
    });

    if (!response.ok) {
      console.error("[placeBet] Error:", response);
      const error = await response.json();
      console.error("[placeBet] Error:", error);
      return NextResponse.json(
        { error: 'Failed to place bet' },
        { status: 500 }
      );
    }
    const data = await response.json();
    console.log("[placeBet] Data:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Place bet error:', error);
    return NextResponse.json({ error: 'Failed to place bet' }, { status: 500 });
  }
}
