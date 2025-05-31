import { headers } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function POST(request: Request) {
  try {
    const userApiKey = (await headers()).get("x-api-key") || "";
    const body = await request.json();
    const { amount } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Convert amount to USDC decimals (6 decimals)
    const unlockUsdcBalance = Number(amount) * 1_000_000;

    const response = await fetch(`${API_URL}/api/contract/sign-message`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "x-api-key": userApiKey,
        "API-KEY": process.env.API_KEY || "",
      },
      body: JSON.stringify({
        unlockUsdcBalance,
        nearImplicitAddress: body.nearImplicitAddress,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || "Failed to process withdrawal" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return NextResponse.json(
      { error: "Failed to process withdrawal" },
      { status: 500 }
    );
  }
} 