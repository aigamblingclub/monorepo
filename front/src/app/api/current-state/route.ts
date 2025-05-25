import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/`, {
      method: "POST", // rpc is only supported for POST requests
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _tag: "Request",
        id: `${Date.now()}`,
        tag: "currentState",
        payload: {},
        traceId: "traceId",
        spanId: "spanId",
        sampled: true,
        headers: {},
      }),
    });

    
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch poker state" }, { status: 500 });  
    }
    
    const data = await response.json();
    console.log('response', data);

    // Handle array response format
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];
      
      if (firstItem._tag === "Exit" && firstItem.exit?._tag === "Success") {
        // Return just the game state value
        return NextResponse.json(firstItem.exit.value);
      }
    }

    // Fallback to returning the raw response if structure doesn't match expected format
    return NextResponse.json({ error: "Failed to fetch poker state" }, { status: 500 });
  } catch (error) {
    console.error("Error fetching poker state:", error);
    return NextResponse.json({ error: "Failed to fetch poker state" }, { status: 500 });
  }
} 