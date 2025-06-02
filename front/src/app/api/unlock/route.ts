import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { NEXT_PUBLIC_SERVER_MAIN } from "@/utils/env";

export async function POST(request: Request) {
  try {
    const userApiKey = (await headers()).get("x-api-key") || "";
    const body = await request.json();
    const { nearNamedAddress } = body;

    if (!nearNamedAddress) {
      return NextResponse.json(
        { error: "Missing nearNamedAddress" },
        { status: 400 }
      );
    }

    // Call backend to get signed message for unlock
    // Backend will determine the amount based on user's virtual balance
    const response = await fetch(`${NEXT_PUBLIC_SERVER_MAIN}/api/contract/sign-message`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "x-api-key": userApiKey,
        "API-KEY": process.env.SERVER_MAIN_API_KEY || "",
      },
      body: JSON.stringify({
        nearNamedAddress,
        // No unlockUsdcBalance sent - backend will determine based on virtual balance
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || "Failed to process unlock" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Return the message and signature for contract submission
    return NextResponse.json({
      success: true,
      message: data.gameResult, // The gameResult object that was signed
      signature: data.signature, // The signature to verify
    });
  } catch (error) {
    console.error("Error processing unlock:", error);
    return NextResponse.json(
      { error: "Failed to process unlock" },
      { status: 500 }
    );
  }
} 