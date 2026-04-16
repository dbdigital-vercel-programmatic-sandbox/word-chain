import "server-only"

import { and, desc, eq, lte, sql } from "drizzle-orm"

import {
  compareDateStrings,
  createFallbackSchedule,
  getTodayDateString,
  type Puzzle,
  type PuzzleSchedule,
} from "@/lib/chainword-cms"
import { db } from "@/lib/db"
import { puzzleSchedules, type PuzzleScheduleRecord } from "@/lib/db/schema"

let schemaReadyPromise: Promise<void> | null = null

function normalizePuzzles(input: unknown): Puzzle[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input.map((item) => {
    const puzzle = item as Partial<Puzzle>
    return {
      question: (puzzle.question ?? "").trim(),
      answer: (puzzle.answer ?? "").toUpperCase().trim(),
    }
  })
}

function mapRecordToSchedule(record: PuzzleScheduleRecord): PuzzleSchedule {
  return {
    id: record.id,
    date: record.scheduleDate,
    startWord: record.startWord.toUpperCase(),
    puzzles: normalizePuzzles(record.puzzles),
    published: Boolean(record.published),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function normalizeScheduleInput(schedule: PuzzleSchedule): PuzzleSchedule {
  return {
    ...schedule,
    date: schedule.date,
    startWord: schedule.startWord.toUpperCase().trim(),
    puzzles: schedule.puzzles.map((puzzle) => ({
      question: puzzle.question.trim(),
      answer: puzzle.answer.toUpperCase().trim(),
    })),
  }
}

export async function ensurePuzzleSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = db
      .execute(
        sql`
      CREATE TABLE IF NOT EXISTS puzzle_schedules (
        id TEXT PRIMARY KEY,
        schedule_date DATE NOT NULL UNIQUE,
        start_word TEXT NOT NULL,
        puzzles JSONB NOT NULL,
        published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      )
      .then(() => undefined)
  }

  await schemaReadyPromise
}

export async function listPuzzleSchedules(options?: {
  includeDrafts?: boolean
}) {
  await ensurePuzzleSchema()

  const includeDrafts = options?.includeDrafts ?? true
  const query = db.select().from(puzzleSchedules)
  const rows = includeDrafts
    ? await query.orderBy(desc(puzzleSchedules.scheduleDate))
    : await query
        .where(eq(puzzleSchedules.published, true))
        .orderBy(desc(puzzleSchedules.scheduleDate))

  if (rows.length === 0) {
    return [createFallbackSchedule()]
  }

  return rows.map(mapRecordToSchedule)
}

export async function getActivePuzzleSchedule(date = getTodayDateString()) {
  await ensurePuzzleSchema()

  const rows = await db
    .select()
    .from(puzzleSchedules)
    .where(
      and(
        eq(puzzleSchedules.published, true),
        lte(puzzleSchedules.scheduleDate, date)
      )
    )
    .orderBy(desc(puzzleSchedules.scheduleDate))
    .limit(1)

  if (!rows[0]) {
    return createFallbackSchedule(date)
  }

  return mapRecordToSchedule(rows[0])
}

export async function savePuzzleScheduleRecord(schedule: PuzzleSchedule) {
  await ensurePuzzleSchema()
  const normalized = normalizeScheduleInput(schedule)

  const byId = await db
    .select()
    .from(puzzleSchedules)
    .where(eq(puzzleSchedules.id, normalized.id))
    .limit(1)

  if (byId[0]) {
    const updated = await db
      .update(puzzleSchedules)
      .set({
        scheduleDate: normalized.date,
        startWord: normalized.startWord,
        puzzles: normalized.puzzles,
        published: normalized.published,
        updatedAt: sql`NOW()`,
      })
      .where(eq(puzzleSchedules.id, normalized.id))
      .returning()

    return mapRecordToSchedule(updated[0])
  }

  const byDate = await db
    .select()
    .from(puzzleSchedules)
    .where(eq(puzzleSchedules.scheduleDate, normalized.date))
    .limit(1)

  if (byDate[0]) {
    const updated = await db
      .update(puzzleSchedules)
      .set({
        startWord: normalized.startWord,
        puzzles: normalized.puzzles,
        published: normalized.published,
        updatedAt: sql`NOW()`,
      })
      .where(eq(puzzleSchedules.scheduleDate, normalized.date))
      .returning()

    return mapRecordToSchedule(updated[0])
  }

  const inserted = await db
    .insert(puzzleSchedules)
    .values({
      id: normalized.id,
      scheduleDate: normalized.date,
      startWord: normalized.startWord,
      puzzles: normalized.puzzles,
      published: normalized.published,
    })
    .returning()

  return mapRecordToSchedule(inserted[0])
}

export async function listSortedPuzzleSchedules(options?: {
  includeDrafts?: boolean
}) {
  const schedules = await listPuzzleSchedules(options)
  return schedules.sort((left, right) =>
    compareDateStrings(right.date, left.date)
  )
}
