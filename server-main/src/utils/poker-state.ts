import { PrismaClient } from '@/prisma';

const prisma = new PrismaClient();

export let currentStatePoker = null;

export const updatePokerState = async (interval: number) => {
  setInterval(async () => {
    if (!process.env.POKER_API_URL) {
      console.log('POKER_API_URL is not set');
      return;
    }

    const currentState = await getCurrentStatePoker();
    // Only update the state if the data is different
    if (currentState && JSON.stringify(currentState) !== JSON.stringify(currentStatePoker)) {
      console.log('Current state from poker server', currentState);
      currentStatePoker = currentState;
      await prisma.rawState.create({
        data: { data: JSON.stringify(currentState), status: 'active', updatedAt: new Date() },
      });
    }
  }, interval || 2000);
}

const getCurrentStatePoker = async () => {
  try {
    const response = await fetch(`${process.env.POKER_API_URL}/api/`, {
      method: 'POST', // rpc is only supported for POST requests
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        _tag: 'Request',
        id: `${Date.now()}`,
        tag: 'currentState',
        payload: {},
        traceId: 'traceId',
        spanId: 'spanId',
        sampled: true,
        headers: {},
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch current state from poker server');
      return;
    }

    const data = await response.json();
    
    // Handle array response format
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];

      if (firstItem._tag === 'Exit' && firstItem.exit?._tag === 'Success') {
        // Return just the game state value
        return firstItem.exit.value;
      }
    }

    console.error('ERROR: ', data);
    return null;
  } catch (error) {
    console.error('Error fetching current state from poker server', error);
    return null;
  }
};