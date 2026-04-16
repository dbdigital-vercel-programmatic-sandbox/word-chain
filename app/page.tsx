"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react"

import {
  compareDateStrings,
  createFallbackSchedule,
  getActivePuzzleForDate,
  getResultStorageKey,
  getScheduleStatus,
  getTodayDateString,
  loadPuzzleSchedules,
  type Puzzle,
  type PuzzleSchedule,
} from "@/lib/chainword-cms"

type Screen = "home" | "game" | "end"

type SavedResult = {
  date: string
  score: number
  seconds: number
  mistakes: number
  longestStreak: number
}

type ButtonVariant =
  | "primary-large"
  | "secondary-large"
  | "disabled-large"
  | "primary-medium"
  | "secondary-medium"

const TYPO = {
  headline1: "text-[24px] leading-[36px] font-semibold",
  headline2: "text-[20px] leading-[30px] font-semibold",
  headline3: "text-[18px] leading-[26px] font-semibold",
  headline4: "text-[16px] leading-[24px] font-semibold",
  headline5: "text-[14px] leading-[22px] font-semibold",
  display2: "text-[28px] leading-[40px] font-bold",
  body1: "text-[18px] leading-[28px] font-normal",
  label: "text-[12px] leading-[18px] font-semibold",
} as const

const GAME_THEME_BACKGROUND = "#A1E7CB"
const GAME_FONT_FAMILY = '"Noto Sans", sans-serif'
const GAME_LOGO_URL =
  "https://images.bhaskarassets.com/web2images/521/2026/03/word-chain_1774968271.png"

const LETTER_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]

const icons = {
  home: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Home_Outline.svg",
  retry:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Retry_Outline.svg",
  pause:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Pause_Outline.svg",
  heart:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Heart.svg",
  hint: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Hint.svg",
  preview:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Preview.svg",
  number:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Number.svg",
  fire: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Fire.svg",
  tick: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/TIck.svg",
  cross:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Cross.svg",
  emptyCell:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Empty%20Cell.svg",
  ray: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Ray.svg",
  timer:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Timer_illustration.svg",
  trophy:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Trophy.svg",
} as const

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function formatPuzzleDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function getDiffIndex(left: string, right: string) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index]?.toUpperCase() !== right[index]?.toUpperCase()) return index
  }
  return -1
}

function computeScore(
  totalQuestions: number,
  seconds: number,
  mistakes: number,
  bonusPoints: number
) {
  const base = totalQuestions * 1000
  const total = base - seconds * 2 - mistakes * 200 + bonusPoints
  return Math.max(0, Math.min(10000, total))
}

function Icon({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="h-full w-full object-contain" />
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  )
}

function DlsButton({
  variant,
  children,
  className,
  icon,
  iconPosition = "leading",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: ButtonVariant
  icon?: string
  iconPosition?: "leading" | "trailing"
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:active:translate-y-0"
  const styles: Record<ButtonVariant, string> = {
    "primary-large": `w-full min-h-[56px] rounded-[12px] bg-black px-4 py-[14px] text-white ${TYPO.headline2}`,
    "secondary-large": `w-full min-h-[56px] rounded-[12px] border-2 border-black bg-transparent px-4 py-[14px] text-black ${TYPO.headline2}`,
    "disabled-large": `w-full min-h-[56px] rounded-[12px] bg-[rgba(0,0,0,0.25)] px-4 py-[14px] text-black/45 ${TYPO.headline2}`,
    "primary-medium": `rounded-[12px] bg-black px-3 py-[14px] text-white ${TYPO.headline5}`,
    "secondary-medium": `rounded-[12px] border-2 border-black bg-transparent px-3 py-[14px] text-black ${TYPO.headline5}`,
  }

  return (
    <button
      {...props}
      className={cn(base, styles[variant], className)}
      disabled={variant === "disabled-large" || props.disabled}
    >
      {icon && iconPosition === "leading" ? (
        <span className="h-5 w-5 shrink-0">
          <Icon src={icon} alt="" />
        </span>
      ) : null}
      <span>{children}</span>
      {icon && iconPosition === "trailing" ? (
        <span className="h-5 w-5 shrink-0">
          <Icon src={icon} alt="" />
        </span>
      ) : null}
    </button>
  )
}

function IconShellButton({
  icon,
  onClick,
  label,
}: {
  icon: string
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-black text-white transition-transform active:translate-y-0.5"
    >
      <span className="h-5 w-5">
        <Icon src={icon} alt={label} />
      </span>
    </button>
  )
}

function GameScreenHeader({
  dateLabel,
  timerText,
  onHome,
  onPause,
}: {
  dateLabel: string
  timerText: string
  onHome: () => void
  onPause: () => void
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-transparent px-3 pt-3">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex w-10 shrink-0 items-center justify-start">
            <IconShellButton icon={icons.home} onClick={onHome} label="Home" />
          </div>
          <div className="flex-1 text-center">
            <p className={`${TYPO.headline3} text-black`}>{dateLabel}</p>
          </div>
          <div className="flex w-10 shrink-0 items-center justify-end" />
        </div>
        <div className="flex items-center justify-center gap-3 text-center">
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause"
            className={`inline-flex items-center gap-2 rounded-[999px] bg-black px-4 py-2 text-white ${TYPO.headline4}`}
          >
            <span className="h-4 w-4">
              <PauseGlyph />
            </span>
            {timerText}
          </button>
        </div>
      </div>
    </header>
  )
}

function PauseModal({ onResume }: { onResume: () => void }) {
  return (
    <div className="modal-backdrop-enter fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
      <div className="modal-panel-enter w-full max-w-[20rem] rounded-[20px] border-2 border-black bg-white px-6 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <Icon src={icons.timer} alt="Paused" />
        </div>
        <h3 className={`mt-4 text-black ${TYPO.headline1}`}>Paused</h3>
        <p className={`mt-2 text-black/70 ${TYPO.body1}`}>
          The chain is waiting for you.
        </p>
        <div className="mt-6">
          <DlsButton
            variant="primary-medium"
            onClick={onResume}
            className="w-full"
          >
            Resume
          </DlsButton>
        </div>
      </div>
    </div>
  )
}

function ResultSummary({ result }: { result: SavedResult }) {
  return (
    <section className="rounded-[24px] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className={TYPO.headline3 + " text-black"}>Total score</p>
        <p className={TYPO.display2 + " text-black"}>
          {result.score.toLocaleString("en-US")}
        </p>
      </div>

      <div className="mt-4 rounded-[18px] bg-[#FFF7D1] px-3 py-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            {
              label: "Time",
              value: formatClock(result.seconds),
            },
            {
              label: "Mistakes",
              value: String(result.mistakes),
            },
            {
              label: "Best streak",
              value: String(result.longestStreak),
            },
          ].map((item) => (
            <div key={item.label} className="px-1 py-1.5">
              <p className={TYPO.label + " text-black/55"}>{item.label}</p>
              <p className={TYPO.headline4 + " mt-1 text-black"}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StreakCard({ puzzleDate }: { puzzleDate: string }) {
  const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const anchorIndex = new Date(`${puzzleDate}T00:00:00`).getDay()
  const days = Array.from({ length: 7 }, (_, index) => {
    const label = weekdayLabels[(anchorIndex + index) % 7]
    return {
      label,
      state: index === 0 ? "today" : "upcoming",
    } as const
  })

  return (
    <section className="rounded-[24px] bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className={TYPO.headline3}>Streak</h3>
        <span className="h-6 w-6">
          <Icon src={icons.fire} alt="Streak" />
        </span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center">
              {day.state === "today" ? (
                <span className="glow-pulse absolute inset-0 rounded-full bg-[#FF7A00]/20" />
              ) : null}
              {day.state === "today" ? (
                <span className="absolute h-8 w-8 opacity-90">
                  <Icon src={icons.ray} alt="Glow" />
                </span>
              ) : null}
              <span className="h-5 w-5">
                <Icon
                  src={day.state === "upcoming" ? icons.emptyCell : icons.tick}
                  alt={day.state}
                />
              </span>
            </div>
            <p
              className={cn(
                TYPO.label,
                day.state === "today" ? "text-[#FF7A00]" : "text-black/55"
              )}
            >
              {day.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function SummaryHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center">
        <Icon src={icons.trophy} alt="Trophy" />
      </div>
      <p className={`mt-4 text-black/55 ${TYPO.headline1}`}>{title}</p>
      <h2 className="mt-2 text-[28px] leading-[1.1] font-bold text-black">
        Nice run.
      </h2>
      <p className={`mt-2 text-black/70 ${TYPO.body1}`}>{subtitle}</p>
    </div>
  )
}

function HomeScreen({
  dateLabel,
  completedResult,
  onLogoTap,
  onStart,
  onResetGame,
}: {
  dateLabel: string
  completedResult: SavedResult | null
  onLogoTap: () => void
  onStart: () => void
  onResetGame: () => void
}) {
  return (
    <div className="screen-enter mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:px-6">
      <div className="w-full max-w-[420px]">
        <img
          src={GAME_LOGO_URL}
          alt="Word Chain game logo"
          onClick={onLogoTap}
          className="hero-logo-enter mx-auto h-auto w-full max-w-[150px] object-contain"
        />
        <h1 className="motion-step motion-step-1 mt-4 text-[32px] leading-[1.05] font-bold text-black sm:text-[40px]">
          ChainWord
        </h1>
        <p
          className={`motion-step motion-step-2 mt-3 text-black/70 ${TYPO.body1}`}
        >
          Change exactly one letter to unlock the next clue. Ten links, one
          chain.
        </p>
        <p
          className={
            TYPO.label + " motion-step motion-step-3 mt-3 text-black/55"
          }
        >
          {dateLabel}
        </p>
      </div>

      <div className="motion-step motion-step-4 mt-6 w-full max-w-[420px]">
        {completedResult ? (
          <DlsButton variant="disabled-large">Puzzle Finished</DlsButton>
        ) : (
          <DlsButton variant="primary-large" onClick={onStart}>
            Start
          </DlsButton>
        )}
      </div>

      {completedResult ? (
        <div className="mt-4 w-full max-w-[420px]">
          <button
            type="button"
            onClick={onResetGame}
            className="text-sm font-semibold text-black/60 underline underline-offset-4 transition-colors hover:text-black"
          >
            Debug: reset game
          </button>
        </div>
      ) : null}
    </div>
  )
}

function TesterScheduleModal({
  schedules,
  today,
  onPlay,
  onClose,
}: {
  schedules: PuzzleSchedule[]
  today: string
  onPlay: (schedule: PuzzleSchedule) => void
  onClose: () => void
}) {
  const publishedSchedules = schedules
    .filter((schedule) => schedule.published)
    .sort((left, right) => compareDateStrings(right.date, left.date))

  return (
    <div className="modal-backdrop-enter fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
      <div className="modal-panel-enter w-full max-w-[26rem] rounded-[20px] border-2 border-black bg-white text-left shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
        <div className="border-b-2 border-black px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={TYPO.headline2 + " text-black"}>Tester mode</h3>
              <p className={TYPO.headline5 + " mt-1 text-black/70"}>
                Open any published puzzle date for level testing.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tester mode"
              className="rounded-[10px] border-2 border-black px-3 py-1.5 text-sm font-semibold text-black transition-transform active:translate-y-0.5"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[26rem] space-y-3 overflow-y-auto px-5 py-4">
          {publishedSchedules.length === 0 ? (
            <p className={TYPO.headline5 + " text-black/70"}>
              No published schedules found.
            </p>
          ) : (
            publishedSchedules.map((schedule) => {
              const status = getScheduleStatus(schedule, today)

              return (
                <div
                  key={schedule.id}
                  className="rounded-[16px] border-2 border-black bg-[#FFF7D1] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={TYPO.headline4 + " text-black"}>
                        {formatPuzzleDate(schedule.date)}
                      </p>
                      <p className={TYPO.label + " mt-1 text-black/55"}>
                        {status} · {schedule.puzzles.length} steps · starts with{" "}
                        {schedule.startWord}
                      </p>
                    </div>
                    <DlsButton
                      variant="primary-medium"
                      onClick={() => onPlay(schedule)}
                    >
                      Play
                    </DlsButton>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function GameSupportRow({
  onHint,
  onReveal,
}: {
  onHint: () => void
  onReveal: () => void
}) {
  const actions = [
    { label: "Hint", icon: icons.hint, onClick: onHint },
    { label: "Reveal", icon: icons.preview, onClick: onReveal },
  ]

  return (
    <div className="flex items-start justify-center gap-4">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className="support-action-enter flex flex-col items-center gap-2"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black p-3 transition-transform active:scale-95">
            <span className="h-7 w-7">
              <Icon src={action.icon} alt={action.label} />
            </span>
          </span>
          <span className={TYPO.headline5 + " text-black/80"}>
            {action.label}
          </span>
        </button>
      ))}
    </div>
  )
}

function QuestionBox({
  questionIndex,
  totalQuestions,
  question,
}: {
  questionIndex: number
  totalQuestions: number
  question: string
}) {
  return (
    <section className="question-enter mx-auto w-full max-w-[296px] rounded-[3px] bg-[#051413] px-[5px] py-2 text-center shadow-[0_10px_24px_rgba(5,20,19,0.18)]">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-[#A1E7CB] uppercase">
        Question {questionIndex + 1}/{totalQuestions}
      </p>
      <h2 className="mt-1 text-[16px] leading-[1.2] font-semibold text-white">
        {question}
      </h2>
    </section>
  )
}

function WordTiles({
  currentWord,
  questionIndex,
  completedFlash,
  selectedIndex,
  hintIndex,
  hintFlashIndex,
  wrongIndex,
  correctIndex,
  shakeIndex,
  onSelectTile,
}: {
  currentWord: string
  questionIndex: number
  completedFlash: boolean
  selectedIndex: number | null
  hintIndex: number | null
  hintFlashIndex: number | null
  wrongIndex: number | null
  correctIndex: number | null
  shakeIndex: number | null
  onSelectTile: (index: number) => void
}) {
  const tileCount = currentWord.length
  const tileGap = Math.max(8, 22 - tileCount * 2)
  const tileMaxWidth = Math.min(420, 240 + tileCount * 21)

  return (
    <div
      className="mx-auto mt-2 grid w-full justify-center"
      style={{
        maxWidth: `${tileMaxWidth}px`,
        gridTemplateColumns: `repeat(${tileCount}, minmax(0, 1fr))`,
        gap: `${tileGap}px`,
      }}
    >
      {currentWord.split("").map((letter, index) => {
        const isSelected = selectedIndex === index
        const isHinted = hintIndex === index
        const isHintFlash = hintFlashIndex === index
        const isWrong = wrongIndex === index
        const isCorrect = correctIndex === index
        const isShaking = shakeIndex === index

        return (
          <button
            key={`${questionIndex}-${index}`}
            type="button"
            onClick={() => onSelectTile(index)}
            className={cn(
              "tile-enter relative flex aspect-square w-full items-center justify-center rounded-[4px] text-[24px] font-semibold uppercase transition-all duration-200 focus-visible:outline-none active:translate-y-0.5 sm:text-[26px]",
              completedFlash || isCorrect
                ? "bg-[#3E9E3E] text-white shadow-[inset_0_-4px_0_0_rgba(0,0,0,0.25)]"
                : isWrong
                  ? "bg-[#F44336] text-white shadow-[inset_0_-4px_0_0_rgba(0,0,0,0.25)]"
                  : isHintFlash
                    ? "bg-[#FFB005] text-white shadow-[inset_0_-4px_0_0_rgba(0,0,0,1)]"
                    : isSelected
                      ? "bg-black text-white shadow-[inset_0_4px_0_0_rgba(19,141,112,1)]"
                      : isHinted
                        ? "bg-[#FFB005] text-white shadow-[inset_0_-4px_0_0_rgba(0,0,0,1)]"
                        : "bg-white text-black shadow-[inset_0_-4px_0_0_rgba(19,141,112,1)]",
              isShaking && "tile-shake",
              isHintFlash && "tile-hint-flash"
            )}
            style={{
              animationDelay: `${index * 24}ms`,
              fontSize:
                tileCount >= 6 ? "20px" : tileCount === 5 ? "22px" : "24px",
            }}
          >
            {isHinted ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-80">
                <span className="glow-pulse absolute h-10 w-10">
                  <Icon src={icons.ray} alt="Hint glow" />
                </span>
              </span>
            ) : null}
            <span className="relative z-10">{letter}</span>
          </button>
        )
      })}
    </div>
  )
}

function Keyboard({ onLetter }: { onLetter: (letter: string) => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 m-0 w-full p-0">
      <div className="w-full space-y-2.5 bg-[var(--Base-Colors-Tertiary,rgba(0,0,0,0.25))] px-2.5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {LETTER_ROWS.map((row, rowIndex) => (
          <div
            key={row.join("")}
            className={cn(
              "grid gap-2",
              rowIndex === 0 && "grid-cols-10",
              rowIndex === 1 && "grid-cols-9 px-4",
              rowIndex === 2 && "grid-cols-7 px-8"
            )}
          >
            {row.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => onLetter(letter)}
                className={`h-11 rounded-[12px] bg-white text-black shadow-[0px_1.7777777910232544px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-0.5 ${TYPO.headline5}`}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function GameScreen({
  dateLabel,
  elapsed,
  questionIndex,
  totalQuestions,
  question,
  currentWord,
  selectedIndex,
  hintIndex,
  hintFlashIndex,
  wrongIndex,
  correctIndex,
  shakeIndex,
  completedFlash,
  noticeMessage,
  noticeNonce,
  onSelectTile,
  onLetter,
  onHint,
  onReveal,
  onHome,
  onPause,
}: {
  dateLabel: string
  elapsed: number
  questionIndex: number
  totalQuestions: number
  question: string
  currentWord: string
  selectedIndex: number | null
  hintIndex: number | null
  hintFlashIndex: number | null
  wrongIndex: number | null
  correctIndex: number | null
  shakeIndex: number | null
  completedFlash: boolean
  noticeMessage: string | null
  noticeNonce: number
  onSelectTile: (index: number) => void
  onLetter: (letter: string) => void
  onHint: () => void
  onReveal: () => void
  onHome: () => void
  onPause: () => void
}) {
  return (
    <>
      <GameScreenHeader
        dateLabel={dateLabel}
        timerText={formatClock(elapsed)}
        onHome={onHome}
        onPause={onPause}
      />

      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col px-4 pt-[104px] pb-[14rem] sm:px-6">
        <div
          key={questionIndex}
          className="question-group-enter flex flex-1 flex-col items-center justify-start gap-4 pt-3"
        >
          <QuestionBox
            questionIndex={questionIndex}
            totalQuestions={totalQuestions}
            question={question}
          />

          <WordTiles
            currentWord={currentWord}
            questionIndex={questionIndex}
            completedFlash={completedFlash}
            selectedIndex={selectedIndex}
            hintIndex={hintIndex}
            hintFlashIndex={hintFlashIndex}
            wrongIndex={wrongIndex}
            correctIndex={correctIndex}
            shakeIndex={shakeIndex}
            onSelectTile={onSelectTile}
          />
        </div>

        <div className="fixed inset-x-0 bottom-[calc(11.5rem+env(safe-area-inset-bottom))] z-20 px-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-[520px] justify-center">
            <GameSupportRow onHint={onHint} onReveal={onReveal} />
          </div>
        </div>

        <Keyboard onLetter={onLetter} />

        {noticeMessage ? (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-4">
            <div
              key={noticeNonce}
              className="game-toast rounded-[18px] border-2 border-black bg-black px-4 py-3 text-center text-white shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
            >
              <p className={TYPO.headline4}>{noticeMessage}</p>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

function EndScreen({
  result,
  puzzleDate,
  onHome,
}: {
  result: SavedResult
  puzzleDate: string
  onHome: () => void
}) {
  return (
    <div className="screen-enter mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center px-4 py-6 text-center sm:px-6">
      <div className="w-full max-w-[420px] space-y-5">
        <div className="motion-step motion-step-1">
          <SummaryHero
            title="Chain complete"
            subtitle="You finished today's word ladder and locked in a score."
          />
        </div>

        <div className="motion-step motion-step-2">
          <ResultSummary result={result} />
        </div>

        <div className="motion-step motion-step-3">
          <StreakCard puzzleDate={puzzleDate} />
        </div>

        <div className="motion-step motion-step-4 text-center">
          <p className={TYPO.label + " text-black/55"}>Next challenge</p>
          <p className={`mt-2 text-black ${TYPO.headline4}`}>
            {formatLongDate(
              new Date(new Date(`${puzzleDate}T00:00:00`).getTime() + 86400000)
                .toISOString()
                .slice(0, 10)
            )}
          </p>
        </div>

        <div className="motion-step motion-step-5 space-y-3">
          <DlsButton variant="primary-large" onClick={onHome} icon={icons.home}>
            Back to Home
          </DlsButton>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home")
  const [hydrated, setHydrated] = useState(false)
  const [activeSchedule, setActiveSchedule] = useState<PuzzleSchedule>(() =>
    createFallbackSchedule()
  )
  const [availableSchedules, setAvailableSchedules] = useState<
    PuzzleSchedule[]
  >([])
  const [completedResult, setCompletedResult] = useState<SavedResult | null>(
    null
  )
  const [isTesterOpen, setIsTesterOpen] = useState(false)

  const puzzleDate = activeSchedule.date
  const startWord = activeSchedule.startWord.toUpperCase()
  const puzzles = activeSchedule.puzzles
  const storageKey = getResultStorageKey(puzzleDate)
  const safeStartWord = startWord || "WORD"
  const safePuzzles: Puzzle[] =
    puzzles.length > 0
      ? puzzles
      : [{ question: "No live puzzle found.", answer: safeStartWord }]

  const [questionIndex, setQuestionIndex] = useState(0)
  const [letters, setLetters] = useState(safeStartWord.split(""))
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [bonusPoints, setBonusPoints] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [correctIndex, setCorrectIndex] = useState<number | null>(null)
  const [shakeIndex, setShakeIndex] = useState<number | null>(null)
  const [hintIndex, setHintIndex] = useState<number | null>(null)
  const [hintFlashIndex, setHintFlashIndex] = useState<number | null>(null)
  const [wrongIndex, setWrongIndex] = useState<number | null>(null)
  const [completedFlash, setCompletedFlash] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)
  const [noticeNonce, setNoticeNonce] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const timerStartRef = useRef<number | null>(null)
  const feedbackTimerRef = useRef<number | null>(null)
  const revealTimerRef = useRef<number | null>(null)
  const noticeTimerRef = useRef<number | null>(null)
  const hintTimerRef = useRef<number | null>(null)
  const logoTapCountRef = useRef(0)
  const logoTapTimerRef = useRef<number | null>(null)

  const dateLabel = useMemo(() => formatPuzzleDate(puzzleDate), [puzzleDate])

  const currentPuzzle =
    safePuzzles[questionIndex] ?? safePuzzles[safePuzzles.length - 1]
  const currentWord = letters.join("")
  const answerIndex = getDiffIndex(currentWord, currentPuzzle.answer)

  function clearPendingTimers() {
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }
    if (hintTimerRef.current) {
      window.clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
  }

  function showNotice(message: string) {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }

    setNoticeMessage(message)
    setNoticeNonce((value) => value + 1)
    noticeTimerRef.current = window.setTimeout(() => {
      setNoticeMessage(null)
      noticeTimerRef.current = null
    }, 1200)
  }

  function persistResult(result: SavedResult) {
    window.localStorage.setItem(storageKey, JSON.stringify(result))
  }

  function loadStoredResult(date: string) {
    const nextStorageKey = getResultStorageKey(date)

    try {
      const raw = window.localStorage.getItem(nextStorageKey)
      if (!raw) return null

      const parsed = JSON.parse(raw) as SavedResult
      return parsed?.date === date ? parsed : null
    } catch {
      window.localStorage.removeItem(nextStorageKey)
      return null
    }
  }

  function finishGame(
    nextMistakes = mistakes,
    nextLongestStreak = longestStreak,
    nextElapsed = elapsed,
    nextBonusPoints = bonusPoints
  ) {
    const score = computeScore(
      safePuzzles.length,
      nextElapsed,
      nextMistakes,
      nextBonusPoints
    )
    const result: SavedResult = {
      date: puzzleDate,
      score,
      seconds: nextElapsed,
      mistakes: nextMistakes,
      longestStreak: nextLongestStreak,
    }

    setCompletedResult(result)
    setScreen("end")
    persistResult(result)
  }

  function advanceQuestion(
    nextWord: string,
    nextMistakes = mistakes,
    nextLongestStreak = longestStreak,
    nextElapsed = elapsed,
    nextBonusPoints = bonusPoints
  ) {
    clearPendingTimers()

    if (questionIndex >= safePuzzles.length - 1) {
      finishGame(nextMistakes, nextLongestStreak, nextElapsed, nextBonusPoints)
      return
    }

    setQuestionIndex((value) => value + 1)
    setLetters(nextWord.split(""))
    setSelectedIndex(null)
    setCorrectIndex(null)
    setShakeIndex(null)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(null)
    setCompletedFlash(false)
    setNoticeMessage(null)
  }

  function handleLetter(letter: string) {
    if (screen !== "game" || completedFlash || isPaused) return

    if (selectedIndex === null) {
      showNotice("Tap a tile first.")
      return
    }

    const activeIndex = selectedIndex
    const previousLetter = letters[activeIndex]
    const nextLetters = [...letters]
    nextLetters[activeIndex] = letter

    const nextWord = nextLetters.join("")
    const expected = currentPuzzle.answer.toUpperCase()

    if (nextWord.toUpperCase() === expected) {
      clearPendingTimers()
      const nextStreak = streak + 1
      const nextLongestStreak = Math.max(longestStreak, nextStreak)
      const nextBonusPoints = bonusPoints + (streak > 0 ? 100 : 0)
      const resolvedElapsed = timerStartRef.current
        ? Math.floor((Date.now() - timerStartRef.current) / 1000)
        : elapsed
      setLetters(nextLetters)
      setCorrectIndex(activeIndex)
      setHintIndex(null)
      setHintFlashIndex(null)
      setCompletedFlash(true)
      setSelectedIndex(activeIndex)
      setStreak(nextStreak)
      setLongestStreak(nextLongestStreak)
      setBonusPoints(nextBonusPoints)

      feedbackTimerRef.current = window.setTimeout(() => {
        setCompletedFlash(false)
        advanceQuestion(
          nextWord.toUpperCase(),
          mistakes,
          nextLongestStreak,
          resolvedElapsed,
          nextBonusPoints
        )
      }, 480)
      return
    }

    clearPendingTimers()
    setMistakes((value) => value + 1)
    setStreak(0)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(activeIndex)
    setShakeIndex(activeIndex)
    setCompletedFlash(false)
    setSelectedIndex(activeIndex)

    feedbackTimerRef.current = window.setTimeout(() => {
      setLetters((value: string[]) => {
        const reverted = [...value]
        reverted[activeIndex] = previousLetter
        return reverted
      })
      setShakeIndex(null)
      setWrongIndex(null)
    }, 420)
  }

  function handleHint() {
    if (screen !== "game" || completedFlash || isPaused) return
    const nextHintIndex = answerIndex >= 0 ? answerIndex : 0
    setHintIndex(nextHintIndex)
    setWrongIndex(null)

    if (selectedIndex === nextHintIndex) {
      if (hintTimerRef.current) {
        window.clearTimeout(hintTimerRef.current)
      }

      setHintFlashIndex(nextHintIndex)
      setSelectedIndex(null)
      hintTimerRef.current = window.setTimeout(() => {
        setHintFlashIndex(null)
        hintTimerRef.current = null
      }, 420)
    }
  }

  function handleReveal() {
    if (screen !== "game" || completedFlash || isPaused) return

    clearPendingTimers()
    const nextMistakes = mistakes + 3
    const resolvedElapsed = timerStartRef.current
      ? Math.floor((Date.now() - timerStartRef.current) / 1000)
      : elapsed
    setMistakes((value) => value + 3)
    setStreak(0)
    setHintIndex(null)
    setHintFlashIndex(null)
    setSelectedIndex(answerIndex >= 0 ? answerIndex : 0)
    setWrongIndex(null)
    setLetters(currentPuzzle.answer.split(""))
    setCompletedFlash(true)

    revealTimerRef.current = window.setTimeout(() => {
      setCompletedFlash(false)
      advanceQuestion(
        currentPuzzle.answer,
        nextMistakes,
        longestStreak,
        resolvedElapsed,
        bonusPoints
      )
    }, 520)
  }

  function startGame(options?: {
    ignoreCompleted?: boolean
    schedule?: PuzzleSchedule
  }) {
    const nextSchedule = options?.schedule ?? activeSchedule
    const nextCompletedResult = options?.schedule
      ? loadStoredResult(nextSchedule.date)
      : completedResult
    const nextStartWord = nextSchedule.startWord.toUpperCase() || "WORD"

    if (nextCompletedResult && !options?.ignoreCompleted) return

    clearPendingTimers()
    if (options?.schedule) {
      setActiveSchedule(nextSchedule)
      setCompletedResult(nextCompletedResult)
    }
    setScreen("game")
    setIsPaused(false)
    setQuestionIndex(0)
    setLetters(nextStartWord.split(""))
    setSelectedIndex(null)
    setMistakes(0)
    setStreak(0)
    setLongestStreak(0)
    setBonusPoints(0)
    setElapsed(0)
    setCorrectIndex(null)
    setShakeIndex(null)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(null)
    setCompletedFlash(false)
    setNoticeMessage(null)
    timerStartRef.current = Date.now()
  }

  function applySchedule(schedule: PuzzleSchedule) {
    const nextStartWord = schedule.startWord.toUpperCase() || "WORD"

    clearPendingTimers()
    setActiveSchedule(schedule)
    setCompletedResult(loadStoredResult(schedule.date))
    setScreen("home")
    setIsPaused(false)
    setQuestionIndex(0)
    setLetters(nextStartWord.split(""))
    setSelectedIndex(null)
    setMistakes(0)
    setStreak(0)
    setLongestStreak(0)
    setBonusPoints(0)
    setElapsed(0)
    setCorrectIndex(null)
    setShakeIndex(null)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(null)
    setCompletedFlash(false)
    setNoticeMessage(null)
    timerStartRef.current = null
  }

  function handleLogoTap() {
    if (logoTapTimerRef.current) {
      window.clearTimeout(logoTapTimerRef.current)
    }

    logoTapCountRef.current += 1
    logoTapTimerRef.current = window.setTimeout(() => {
      logoTapCountRef.current = 0
      logoTapTimerRef.current = null
    }, 1200)

    if (logoTapCountRef.current < 5) {
      return
    }

    logoTapCountRef.current = 0
    if (logoTapTimerRef.current) {
      window.clearTimeout(logoTapTimerRef.current)
      logoTapTimerRef.current = null
    }
    setIsTesterOpen(true)
  }

  function handleSelectTile(index: number) {
    if (hintIndex === index) {
      setHintIndex(null)
    }
    setSelectedIndex(index)
  }

  function resetGame() {
    clearPendingTimers()
    window.localStorage.removeItem(storageKey)
    setCompletedResult(null)
    setScreen("home")
    setIsPaused(false)
    setQuestionIndex(0)
    setLetters(safeStartWord.split(""))
    setSelectedIndex(null)
    setMistakes(0)
    setStreak(0)
    setLongestStreak(0)
    setBonusPoints(0)
    setElapsed(0)
    setCorrectIndex(null)
    setShakeIndex(null)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(null)
    setCompletedFlash(false)
    setNoticeMessage(null)
    timerStartRef.current = null
  }

  useEffect(() => {
    let isMounted = true

    async function hydrateSchedule() {
      const [nextSchedule, schedules] = await Promise.all([
        getActivePuzzleForDate(),
        loadPuzzleSchedules(),
      ])
      if (!isMounted) return

      setAvailableSchedules(schedules)
      applySchedule(nextSchedule)

      try {
        setCompletedResult(loadStoredResult(nextSchedule.date))
      } finally {
        setHydrated(true)
      }
    }

    void hydrateSchedule()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (screen !== "game" || isPaused) return

    const tick = () => {
      if (!timerStartRef.current) return
      setElapsed(Math.floor((Date.now() - timerStartRef.current) / 1000))
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [screen, isPaused])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== "game" || isPaused) return
      const key = event.key.toUpperCase()
      if (/^[A-Z]$/.test(key)) {
        event.preventDefault()
        handleLetter(key)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleLetter, isPaused, screen])

  useEffect(() => {
    return () => {
      clearPendingTimers()
      if (logoTapTimerRef.current) {
        window.clearTimeout(logoTapTimerRef.current)
      }
    }
  }, [])

  if (!hydrated) {
    return (
      <main
        className="min-h-dvh"
        style={{
          backgroundColor: GAME_THEME_BACKGROUND,
          fontFamily: GAME_FONT_FAMILY,
        }}
      />
    )
  }

  return (
    <main
      className="relative min-h-dvh overflow-hidden"
      style={{
        backgroundColor: GAME_THEME_BACKGROUND,
        fontFamily: GAME_FONT_FAMILY,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_36%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_bottom,rgba(0,0,0,0.08),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.26),transparent)]" />

      <div className="relative flex min-h-dvh flex-col">
        {screen === "home" ? (
          <HomeScreen
            dateLabel={dateLabel}
            completedResult={completedResult}
            onLogoTap={handleLogoTap}
            onStart={startGame}
            onResetGame={resetGame}
          />
        ) : null}

        {screen === "game" ? (
          <GameScreen
            dateLabel={dateLabel}
            elapsed={elapsed}
            questionIndex={questionIndex}
            totalQuestions={safePuzzles.length}
            question={currentPuzzle.question}
            currentWord={currentWord}
            selectedIndex={selectedIndex}
            hintIndex={hintIndex}
            hintFlashIndex={hintFlashIndex}
            wrongIndex={wrongIndex}
            correctIndex={correctIndex}
            shakeIndex={shakeIndex}
            completedFlash={completedFlash}
            noticeMessage={noticeMessage}
            noticeNonce={noticeNonce}
            onSelectTile={handleSelectTile}
            onLetter={handleLetter}
            onHint={handleHint}
            onReveal={handleReveal}
            onHome={() => {
              clearPendingTimers()
              setNoticeMessage(null)
              setIsPaused(false)
              setScreen("home")
            }}
            onPause={() => setIsPaused(true)}
          />
        ) : null}

        {screen === "game" && isPaused ? (
          <PauseModal onResume={() => setIsPaused(false)} />
        ) : null}

        {isTesterOpen ? (
          <TesterScheduleModal
            schedules={availableSchedules}
            today={getTodayDateString()}
            onPlay={(schedule) => {
              setIsTesterOpen(false)
              startGame({ ignoreCompleted: true, schedule })
            }}
            onClose={() => setIsTesterOpen(false)}
          />
        ) : null}

        {screen === "end" && completedResult ? (
          <EndScreen
            result={completedResult}
            puzzleDate={puzzleDate}
            onHome={() => {
              setIsPaused(false)
              setScreen("home")
            }}
          />
        ) : null}
      </div>
    </main>
  )
}
