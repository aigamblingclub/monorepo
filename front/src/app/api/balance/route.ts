import { isDev } from "@/utils/env";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const userApiKey = (await headers()).get("x-api-key") || "";

    const serverMainUrl = isDev ? process.env.NEXT_PUBLIC_SERVER_MAIN_LOCAL : process.env.NEXT_PUBLIC_SERVER_MAIN;

    const response = await fetch(`${serverMainUrl}/api/user/balance`, {
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
    console.log('[entrou] data', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
