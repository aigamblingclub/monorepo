import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { NEXT_PUBLIC_SERVER_MAIN } from "@/utils/env";

export async function GET() {
  try {
    const userApiKey = (await headers()).get("x-api-key") || "";

    const response = await fetch(`${NEXT_PUBLIC_SERVER_MAIN}/api/user/balance`, {
      headers: {
        "x-api-key": userApiKey, 
        "API-KEY": process.env.SERVER_MAIN_API_KEY || "",
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
