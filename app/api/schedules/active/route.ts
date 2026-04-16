import { NextResponse } from "next/server"

import { getTodayDateString } from "@/lib/chainword-cms"
import { getActivePuzzleSchedule } from "@/lib/puzzle-repository"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") ?? getTodayDateString()
    const schedule = await getActivePuzzleSchedule(date)
    return NextResponse.json({ schedule })
  } catch {
    return NextResponse.json(
      { error: "Failed to load active schedule" },
      { status: 500 }
    )
  }
}
