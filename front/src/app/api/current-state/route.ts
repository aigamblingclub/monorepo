import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/game/current-state`, {
      headers: {
        'API-KEY': process.env.API_KEY || '',
      },
    });

    
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch poker state" }, { status: 500 });  
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching poker state:", error);
    return NextResponse.json({ error: "Failed to fetch poker state" }, { status: 500 });
  }
} 