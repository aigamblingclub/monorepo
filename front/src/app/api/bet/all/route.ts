import { isDev } from '@/utils/env';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const userApiKey = (await headers()).get('x-api-key') || '';

    const serverMainUrl = isDev
      ? process.env.NEXT_PUBLIC_SERVER_MAIN_LOCAL
      : process.env.NEXT_PUBLIC_SERVER_MAIN;

    const response = await fetch(`${serverMainUrl}/api/bet/all`, {
      headers: {
        'x-api-key': userApiKey,
        'API-KEY': process.env.SERVER_MAIN_API_KEY || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch all bets' },
        { status: 500 }
      );
    }
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch all bets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch all bets' },
      { status: 500 }
    );
  }
}
