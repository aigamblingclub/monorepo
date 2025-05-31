import { headers } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET() {
  try {
    const userApiKey = (await headers()).get("x-api-key") || "";

    const response = await fetch(`${API_URL}/api/user/balance`, {
      headers: {
        "x-api-key": userApiKey, 
        "API-KEY": process.env.API_KEY || "",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch balance" },
        { status: 500 }
      );
    }
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
