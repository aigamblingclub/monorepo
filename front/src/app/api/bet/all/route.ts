import { headers } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET() {
  try {
    const userApiKey = (await headers()).get("x-api-key") || "";
    console.log("🔍 userApiKey:", userApiKey);
    const response = await fetch(`${API_URL}/api/bet/all`, {
      headers: {
        "x-api-key": userApiKey,
        "API-KEY": process.env.API_KEY || "",
      }
    });
    console.log("🔍 response:", response);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch all bets" },
        { status: 500 }
      );
    }
    const data = await response.json();
    console.log("🔍 data fetching all bets:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching all bets:", error);
    return NextResponse.json(
      { error: "Failed to fetch all bets" },
      { status: 500 }
    );
  }
}
