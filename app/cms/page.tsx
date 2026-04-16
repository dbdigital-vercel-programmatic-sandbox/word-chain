"use client"

import { useEffect, useMemo, useState } from "react"

import {
  createEmptySchedule,
  findScheduleByDate,
  getScheduleStatus,
  getTodayDateString,
  loadPuzzleSchedules,
  savePuzzleSchedule,
  type Puzzle,
  type PuzzleSchedule,
  upsertSchedule,
  validateSchedule,
} from "@/lib/chainword-cms"

function countChangedLetters(previous: string, next: string) {
  const maxLength = Math.max(previous.length, next.length)
  let changes = 0

  for (let i = 0; i < maxLength; i += 1) {
    if (previous[i] !== next[i]) {
      changes += 1
    }
  }

  return changes
}

function toEditable(schedule: PuzzleSchedule): PuzzleSchedule {
  return {
    ...schedule,
    puzzles:
      schedule.puzzles.length > 0
        ? schedule.puzzles.map((puzzle) => ({ ...puzzle }))
        : [{ question: "", answer: "" }],
  }
}

export default function CmsPage() {
  const [hydrated, setHydrated] = useState(false)
  const [schedules, setSchedules] = useState<PuzzleSchedule[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PuzzleSchedule>(createEmptySchedule())
  const [errors, setErrors] = useState<string[]>([])
  const [flash, setFlash] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const today = useMemo(() => getTodayDateString(), [])

  useEffect(() => {
    let isMounted = true

    async function hydrateSchedules() {
      const stored = await loadPuzzleSchedules()
      if (!isMounted) return

      setSchedules(stored)
      if (stored[0]) {
        setActiveId(stored[0].id)
        setDraft(toEditable(stored[0]))
      }
      setHydrated(true)
    }

    void hydrateSchedules()

    return () => {
      isMounted = false
    }
  }, [])

  function selectSchedule(schedule: PuzzleSchedule) {
    setActiveId(schedule.id)
    setDraft(toEditable(schedule))
    setErrors([])
  }

  function createNew() {
    const empty = createEmptySchedule()
    setActiveId(empty.id)
    setDraft(empty)
    setErrors([])
  }

  const sameDateSchedule = useMemo(
    () => findScheduleByDate(schedules, draft.date, draft.id),
    [draft.date, draft.id, schedules]
  )

  function updateDraftDate(nextDate: string) {
    setDraft((prev) => ({ ...prev, date: nextDate }))
    setErrors([])
  }

  function loadSameDateSchedule() {
    if (!sameDateSchedule) return
    selectSchedule(sameDateSchedule)
    setFlash(`Loaded ${sameDateSchedule.date} schedule`)
    window.setTimeout(() => setFlash(null), 1200)
  }

  function updateStep(index: number, next: Partial<Puzzle>) {
    setDraft((prev) => ({
      ...prev,
      puzzles: prev.puzzles.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...next } : step
      ),
    }))
  }

  function addStep() {
    setDraft((prev) => ({
      ...prev,
      puzzles: [...prev.puzzles, { question: "", answer: "" }],
    }))
  }

  function removeStep(index: number) {
    setDraft((prev) => ({
      ...prev,
      puzzles: prev.puzzles.filter((_, stepIndex) => stepIndex !== index),
    }))
  }

  async function saveSchedule(published: boolean) {
    const nextDraft = { ...draft, published }
    const nextErrors = validateSchedule(nextDraft)
    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    try {
      setIsSaving(true)
      await savePuzzleSchedule(nextDraft)
      const refreshed = await loadPuzzleSchedules()
      const persistedSchedule =
        refreshed.find((schedule) => schedule.id === nextDraft.id) ??
        refreshed.find((schedule) => schedule.date === nextDraft.date) ??
        upsertSchedule([], nextDraft)[0]

      setSchedules(refreshed)
      setActiveId(persistedSchedule.id)
      setDraft(toEditable(persistedSchedule))
      setErrors([])
      setFlash(published ? "Published" : "Saved as draft")
      window.setTimeout(() => setFlash(null), 1200)
    } catch {
      setFlash("Failed to save. Check your DB connection.")
      window.setTimeout(() => setFlash(null), 1800)
    } finally {
      setIsSaving(false)
    }
  }

  if (!hydrated) {
    return <main className="min-h-dvh" />
  }

  return (
    <main className="min-h-dvh bg-[#f6f4ee] text-[#1f1d17]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#7b745f] uppercase">
              Puzzle CMS
            </p>
            <h1 className="text-3xl font-bold">ChainWord Scheduler</h1>
            <p className="mt-1 text-sm text-[#5f5949]">
              Create daily puzzle chains, save drafts, and publish by date.
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-[#d8d2c3] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Schedules</h2>
              <button
                type="button"
                onClick={createNew}
                className="rounded-lg bg-[#1f1d17] px-3 py-1.5 text-xs font-semibold text-white"
              >
                New
              </button>
            </div>
            <div className="space-y-2">
              {schedules.map((schedule) => {
                const status = getScheduleStatus(schedule, today)
                return (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => selectSchedule(schedule)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      schedule.id === activeId
                        ? "border-[#1f1d17] bg-[#f6f4ee]"
                        : "border-[#e8e2d3] bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold">{schedule.date}</p>
                    <p className="text-xs text-[#6a6454]">
                      {status} · {schedule.puzzles.length} steps
                    </p>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-[#d8d2c3] bg-white p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold tracking-wide text-[#716a58] uppercase">
                  Puzzle Date
                </span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) => updateDraftDate(event.target.value)}
                  className="w-full rounded-lg border border-[#d9d2c2] px-3 py-2"
                />
                {sameDateSchedule ? (
                  <button
                    type="button"
                    onClick={loadSameDateSchedule}
                    className="mt-1 text-xs font-semibold text-[#2f5e8e]"
                  >
                    Load existing {getScheduleStatus(sameDateSchedule, today)}
                    schedule for this date
                  </button>
                ) : null}
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold tracking-wide text-[#716a58] uppercase">
                  Start Word
                </span>
                <input
                  value={draft.startWord}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      startWord: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="TOLD"
                  className="w-full rounded-lg border border-[#d9d2c2] px-3 py-2 uppercase"
                />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {draft.puzzles.map((step, index) => (
                <div
                  key={`${draft.id}-step-${index}`}
                  className="rounded-xl border border-[#e8e2d3] p-3"
                >
                  {(() => {
                    const startWord = draft.startWord.trim().toUpperCase()
                    const answer = step.answer.trim().toUpperCase()
                    const previousWord =
                      index === 0
                        ? startWord
                        : (draft.puzzles[index - 1]?.answer ?? "")
                            .trim()
                            .toUpperCase()

                    const warnings: string[] = []

                    if (startWord && answer.length > startWord.length) {
                      warnings.push(
                        `Answer has ${answer.length} letters, which exceeds the start word limit of ${startWord.length}.`
                      )
                    }

                    if (previousWord && answer) {
                      const changedLetters = countChangedLetters(
                        previousWord,
                        answer
                      )
                      if (changedLetters > 2) {
                        warnings.push(
                          `More than 2 letters changed from the previous word (${changedLetters} changed).`
                        )
                      }
                    }

                    if (warnings.length === 0) {
                      return null
                    }

                    return (
                      <div className="mb-2 rounded-lg border border-[#f4c66f] bg-[#fff8e8] px-3 py-2 text-xs text-[#8a5a07]">
                        {warnings.map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-[0.15em] text-[#7e7664] uppercase">
                      Step {index + 1}
                    </p>
                    {draft.puzzles.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="text-xs font-semibold text-[#8e2f2f]"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                    <input
                      value={step.question}
                      onChange={(event) =>
                        updateStep(index, { question: event.target.value })
                      }
                      placeholder="Question or clue"
                      className="w-full rounded-lg border border-[#d9d2c2] px-3 py-2"
                    />
                    <input
                      value={step.answer}
                      onChange={(event) =>
                        updateStep(index, {
                          answer: event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="ANSWER"
                      className="w-full rounded-lg border border-[#d9d2c2] px-3 py-2 uppercase"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStep}
              className="mt-3 rounded-lg border border-dashed border-[#b9b09a] px-3 py-2 text-sm font-semibold"
            >
              Add step
            </button>

            {errors.length > 0 ? (
              <div className="mt-4 rounded-lg border border-[#f0b4b4] bg-[#fff4f4] p-3 text-sm text-[#8a2d2d]">
                {errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveSchedule(false)}
                disabled={isSaving}
                className="rounded-lg border border-[#1f1d17] px-4 py-2 text-sm font-semibold"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => void saveSchedule(true)}
                disabled={isSaving}
                className="rounded-lg bg-[#1f1d17] px-4 py-2 text-sm font-semibold text-white"
              >
                Publish
              </button>
              {flash ? (
                <p className="self-center text-sm font-semibold text-[#2e6a44]">
                  {flash}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
