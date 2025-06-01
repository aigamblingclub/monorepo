import { NextResponse } from "next/server";
import { NEXT_PUBLIC_SERVER_MAIN } from "@/utils/env";

export async function GET() {
  try {
    const response = await fetch(`${NEXT_PUBLIC_SERVER_MAIN}/api/game/current-state`, {
      headers: {
        "API-KEY": process.env.SERVER_MAIN_API_KEY || "",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch poker state" },
        { status: 500 }
      );
    }
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching poker state:", error);
    return NextResponse.json(
      { error: "Failed to fetch poker state" },
      { status: 500 }
    );
  }
}
