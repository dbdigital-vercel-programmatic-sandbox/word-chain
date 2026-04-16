import { NextResponse } from "next/server"

import { type PuzzleSchedule, validateSchedule } from "@/lib/chainword-cms"
import { getSession } from "@/lib/internal/auth-session"
import {
  listSortedPuzzleSchedules,
  savePuzzleScheduleRecord,
} from "@/lib/puzzle-repository"

export const dynamic = "force-dynamic"

async function ensureSession() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  return null
}

export async function GET() {
  try {
    const session = await getSession()
    const schedules = await listSortedPuzzleSchedules({
      includeDrafts: Boolean(session),
    })
    return NextResponse.json({ schedules })
  } catch {
    return NextResponse.json(
      { error: "Failed to load schedules" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const unauthorized = await ensureSession()
  if (unauthorized) {
    return unauthorized
  }

  try {
    const data = (await request.json()) as { schedule?: PuzzleSchedule }
    const schedule = data.schedule

    if (!schedule) {
      return NextResponse.json(
        { error: "Missing schedule payload" },
        { status: 400 }
      )
    }

    const errors = validateSchedule(schedule)
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 })
    }

    const saved = await savePuzzleScheduleRecord(schedule)
    return NextResponse.json({ schedule: saved })
  } catch {
    return NextResponse.json(
      { error: "Failed to save schedule" },
      { status: 500 }
    )
  }
}
