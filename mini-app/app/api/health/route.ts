import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'AI Poker Club Mini App',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      farcasterFrame: true,
      mobileOptimized: true,
      realTimeUpdates: true,
      sixPlayerSupport: true
    }
  });
} 