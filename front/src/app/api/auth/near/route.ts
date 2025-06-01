import { NextResponse } from "next/server";
import { NEXT_PUBLIC_SERVER_MAIN } from "@/utils/env";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json(
      { error: "Account ID is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${NEXT_PUBLIC_SERVER_MAIN}/api/auth/near/challenge?accountId=${accountId}`,
      {
        headers: {
          "API-KEY": process.env.SERVER_MAIN_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get challenge" },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error getting challenge:", error);
    return NextResponse.json(
      { error: "Failed to get challenge" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signature, accountId, publicKey } = body;

    if (!signature || !accountId || !publicKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${NEXT_PUBLIC_SERVER_MAIN}/api/auth/near/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "API-KEY": process.env.SERVER_MAIN_API_KEY || "",
          // origin: window.location.origin,
        },
        body: JSON.stringify({
          signature,
          accountId,
          publicKey,
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to verify signature" },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error verifying signature:", error);
    return NextResponse.json(
      { error: "Failed to verify signature" },
      { status: 500 }
    );
  }
} 