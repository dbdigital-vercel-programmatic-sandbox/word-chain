export type Puzzle = {
  question: string
  answer: string
}

export type PuzzleSchedule = {
  id: string
  date: string
  startWord: string
  puzzles: Puzzle[]
  published: boolean
  createdAt: string
  updatedAt: string
}

export const CMS_STORAGE_KEY = "chainword:cms:schedules"

const DEFAULT_PUZZLES: Puzzle[] = [
  { question: "What do you do in origami?", answer: "FOLD" },
  { question: "What is a precious metal?", answer: "GOLD" },
  { question: "What is the opposite of warm?", answer: "COLD" },
  { question: "What word means brave?", answer: "BOLD" },
  { question: "What secures a wheel or panel?", answer: "BOLT" },
  { question: "What vehicle floats on water?", answer: "BOAT" },
  { question: "What farm animal climbs rocks?", answer: "GOAT" },
  { question: "What means to provoke?", answer: "GOAD" },
  { question: "What do cars drive on?", answer: "ROAD" },
  { question: "What do you do with a book?", answer: "READ" },
]

const DEFAULT_START_WORD = "TOLD"
const DEFAULT_DATE = "2026-03-30"

function getNowIso() {
  return new Date().toISOString()
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function compareDateStrings(a: string, b: string) {
  return a.localeCompare(b)
}

export function getScheduleStatus(schedule: PuzzleSchedule, today: string) {
  if (!schedule.published) return "Draft"
  if (compareDateStrings(schedule.date, today) > 0) return "Scheduled"
  return "Live"
}

export function getResultStorageKey(date: string) {
  return `chainword:${date}`
}

export function getProgressStorageKey(date: string) {
  return `chainword:progress:${date}`
}

export function createFallbackSchedule(date = DEFAULT_DATE): PuzzleSchedule {
  const now = getNowIso()
  return {
    id: "default-seed",
    date,
    startWord: DEFAULT_START_WORD,
    puzzles: DEFAULT_PUZZLES,
    published: true,
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeSchedule(schedule: PuzzleSchedule): PuzzleSchedule {
  return {
    ...schedule,
    startWord: (schedule.startWord ?? "").toUpperCase(),
    puzzles: (schedule.puzzles ?? []).map((puzzle) => ({
      question: puzzle.question ?? "",
      answer: (puzzle.answer ?? "").toUpperCase(),
    })),
  }
}

export async function loadPuzzleSchedules() {
  try {
    const response = await fetch("/api/schedules", {
      method: "GET",
      cache: "no-store",
    })

    if (!response.ok) {
      return [createFallbackSchedule()]
    }

    const data = (await response.json()) as { schedules?: PuzzleSchedule[] }
    const schedules = Array.isArray(data.schedules)
      ? data.schedules.map(normalizeSchedule)
      : []

    if (schedules.length === 0) {
      return [createFallbackSchedule()]
    }

    return schedules.sort((left, right) =>
      compareDateStrings(right.date, left.date)
    )
  } catch {
    return [createFallbackSchedule()]
  }
}

export async function savePuzzleSchedule(schedule: PuzzleSchedule) {
  const response = await fetch("/api/schedules", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ schedule }),
  })

  if (!response.ok) {
    throw new Error("Failed to save schedule")
  }

  const data = (await response.json()) as { schedule: PuzzleSchedule }
  return normalizeSchedule(data.schedule)
}

export function createEmptySchedule(
  date = getTodayDateString()
): PuzzleSchedule {
  const now = getNowIso()
  return {
    id: uid(),
    date,
    startWord: "",
    puzzles: [{ question: "", answer: "" }],
    published: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertSchedule(
  schedules: PuzzleSchedule[],
  schedule: PuzzleSchedule
) {
  const now = getNowIso()
  const nextSchedule: PuzzleSchedule = {
    ...schedule,
    startWord: schedule.startWord.toUpperCase().trim(),
    puzzles: schedule.puzzles.map((puzzle) => ({
      question: puzzle.question.trim(),
      answer: puzzle.answer.toUpperCase().trim(),
    })),
    updatedAt: now,
  }

  const index = schedules.findIndex((item) => item.id === nextSchedule.id)
  if (index === -1) {
    const dateMatchIndex = schedules.findIndex(
      (item) => item.date === nextSchedule.date
    )

    if (dateMatchIndex !== -1) {
      const cloned = [...schedules]
      const existing = cloned[dateMatchIndex]
      cloned[dateMatchIndex] = {
        ...existing,
        ...nextSchedule,
        id: existing.id,
        createdAt: existing.createdAt,
      }
      return cloned.sort((left, right) =>
        compareDateStrings(right.date, left.date)
      )
    }

    return [{ ...nextSchedule, createdAt: now }, ...schedules].sort(
      (left, right) => compareDateStrings(right.date, left.date)
    )
  }

  const cloned = [...schedules]
  cloned[index] = { ...cloned[index], ...nextSchedule }
  return cloned.sort((left, right) => compareDateStrings(right.date, left.date))
}

export function findScheduleByDate(
  schedules: PuzzleSchedule[],
  date: string,
  excludeId?: string
) {
  return schedules.find(
    (schedule) => schedule.date === date && schedule.id !== excludeId
  )
}

export async function getActivePuzzleForDate(date = getTodayDateString()) {
  try {
    const response = await fetch(
      `/api/schedules/active?date=${encodeURIComponent(date)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    )

    if (!response.ok) {
      return createFallbackSchedule(date)
    }

    const data = (await response.json()) as { schedule?: PuzzleSchedule }
    if (!data.schedule) {
      return createFallbackSchedule(date)
    }

    return normalizeSchedule(data.schedule)
  } catch {
    return createFallbackSchedule(date)
  }
}

export function validateSchedule(schedule: PuzzleSchedule) {
  const errors: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(schedule.date)) {
    errors.push("Date must be in YYYY-MM-DD format.")
  }
  if (!schedule.startWord.trim()) {
    errors.push("Start word is required.")
  }

  const cleanStart = schedule.startWord.trim().toUpperCase()
  const requiredLength = cleanStart.length
  let previous = cleanStart
  const cleanPuzzles = schedule.puzzles.filter(
    (puzzle) => puzzle.question.trim() || puzzle.answer.trim()
  )

  if (cleanPuzzles.length === 0) {
    errors.push("Add at least one puzzle step.")
    return errors
  }

  cleanPuzzles.forEach((puzzle, index) => {
    const question = puzzle.question.trim()
    const answer = puzzle.answer.trim().toUpperCase()

    if (!question) {
      errors.push(`Step ${index + 1}: question is required.`)
    }

    if (!answer) {
      errors.push(`Step ${index + 1}: answer is required.`)
      return
    }

    if (answer.length !== requiredLength) {
      errors.push(
        `Step ${index + 1}: answer length must match the start word (${requiredLength} letters).`
      )
      return
    }

    let diffCount = 0
    for (let i = 0; i < answer.length; i += 1) {
      if (answer[i] !== previous[i]) diffCount += 1
    }

    if (diffCount !== 1) {
      errors.push(
        `Step ${index + 1}: answer must change exactly one letter from ${previous}.`
      )
    }

    previous = answer
  })

  return errors
}
