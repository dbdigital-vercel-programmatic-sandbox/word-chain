"use client"

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react"

import {
  compareDateStrings,
  createFallbackSchedule,
  getProgressStorageKey,
  getActivePuzzleForDate,
  getResultStorageKey,
  getScheduleStatus,
  getTodayDateString,
  loadPuzzleSchedules,
  type Puzzle,
  type PuzzleSchedule,
} from "@/lib/chainword-cms"

type Screen = "home" | "game" | "end"
type TutorialStep = "tile" | "keyboard"
type ScreenTransitionKind =
  | "home-to-game"
  | "home-to-guided-game"
  | "game-to-end"

type ScreenTransitionState = {
  kind: ScreenTransitionKind
  nonce: number
}

type SavedResult = {
  date: string
  score: number
  seconds: number
  mistakes: number
  longestStreak: number
  revealCount: number
}

type SavedProgress = {
  date: string
  questionIndex: number
  letters: string[]
  selectedIndex: number | null
  mistakes: number
  questionMistakes: number
  streak: number
  longestStreak: number
  bonusPoints: number
  revealCount: number
  elapsed: number
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
const FIRST_QUESTION_HAND_STORAGE_KEY = "chainword:first-question-hand-seen"
const FIRST_QUESTION_HAND_IMAGE_URL =
  "https://staging-images.bhaskarassets.com/web2images/521/2026/04/image-hand-swipe-gesture_1776413302.png"

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

const PRELOADED_GAME_ASSET_URLS = [
  GAME_LOGO_URL,
  FIRST_QUESTION_HAND_IMAGE_URL,
  ...Object.values(icons),
]

const GAME_COPY = {
  home: {
    title: "Wordचेन",
    tagline: "एक-एक अक्षर बदलें, नए शब्दों की चेन बनाए",
    start: "पजल शुरू करें",
    resume: "खेल जारी रखें",
    completed: "आज का मिशन पूरा",
  },
  game: {
    tapTileHint: "अक्षर बदलने के लिए टाइल पर टैप करें",
    changeLetterHint: "एक अक्षर बदलकर उत्तर बनाएं",
    hint: "हिंट",
    reveal: "उत्तर देखें",
  },
  pause: {
    title: "गेम पॉज है",
    subtitle: "चेन को अधूरा मत छोड़ें",
    resume: "खेल जारी रखें",
  },
  summary: {
    title: "बधाई!",
    subtitle: "आपने आज के सारे शब्द खोज लिए",
    score: "आपका स्कोर",
    time: "समय",
    mistakes: "गलतियां",
    streak: "आपकी स्ट्रीक",
    nextChallenge: "अगला चैलेंज",
    home: "होम पेज",
  },
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

function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number)
  const nextDate = new Date(year, month - 1, day)
  nextDate.setDate(nextDate.getDate() + days)

  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`
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

function TutorialHand({ placement }: { placement: "tile" | "key" }) {
  const isTile = placement === "tile"

  return (
    <span
      aria-hidden="true"
      className={cn(
        "tutorial-hand pointer-events-none absolute inset-0 z-20 flex",
        isTile ? "items-end justify-end" : "items-end justify-center"
      )}
    >
      <span
        className={cn(
          "tutorial-ripple-wrap absolute",
          isTile
            ? "right-0 bottom-0 translate-x-[16%] translate-y-[18%]"
            : "right-1 bottom-0 translate-x-[8%] translate-y-[24%]"
        )}
      >
        <span className="tutorial-ripple tutorial-ripple-delay-1" />
        <span className="tutorial-ripple tutorial-ripple-delay-2" />
      </span>
      <img
        src={FIRST_QUESTION_HAND_IMAGE_URL}
        alt=""
        className={cn(
          "tutorial-hand-image max-w-none select-none",
          isTile
            ? "h-[82px] w-[82px] translate-x-[40%] translate-y-[42%] sm:h-[90px] sm:w-[90px]"
            : "h-[56px] w-[56px] translate-x-[20%] translate-y-[38%] sm:h-[62px] sm:w-[62px]"
        )}
      />
    </span>
  )
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  )
}

function RevealGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      <path
        d="M1.5 12s3.75-6 10.5-6 10.5 6 10.5 6-3.75 6-10.5 6S1.5 12 1.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
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
  disabled = false,
}: {
  icon: string
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-black text-white transition-transform active:translate-y-0.5 disabled:opacity-45 disabled:active:translate-y-0"
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
  tutorialLocked,
  isExiting,
}: {
  dateLabel: string
  timerText: string
  onHome: () => void
  onPause: () => void
  tutorialLocked: boolean
  isExiting: boolean
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-40 px-3 pt-3",
          isExiting && "screen-exit-game-top"
        )}
      >
        <div className="mx-auto flex w-full max-w-[520px] justify-start">
          <div className="flex w-10 shrink-0 items-center justify-start">
            <IconShellButton icon={icons.home} onClick={onHome} label="Home" />
          </div>
        </div>
      </div>

      <header
        className={cn(
          "fixed inset-x-0 top-0 bg-transparent px-3 pt-3",
          tutorialLocked ? "z-0" : "z-30",
          isExiting && "screen-exit-game-top"
        )}
      >
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex w-10 shrink-0 items-center justify-start" />
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
              disabled={tutorialLocked}
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
    </>
  )
}

function PauseModal({ onResume }: { onResume: () => void }) {
  return (
    <div className="modal-backdrop-enter fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
      <div className="modal-panel-enter w-full max-w-[20rem] rounded-[20px] border-2 border-black bg-white px-6 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <Icon src={icons.timer} alt="Paused" />
        </div>
        <h3 className={`mt-4 text-black ${TYPO.headline1}`}>
          {GAME_COPY.pause.title}
        </h3>
        <p className={`mt-2 text-black/70 ${TYPO.body1}`}>
          {GAME_COPY.pause.subtitle}
        </p>
        <div className="mt-6">
          <DlsButton
            variant="primary-medium"
            onClick={onResume}
            className="w-full"
          >
            {GAME_COPY.pause.resume}
          </DlsButton>
        </div>
      </div>
    </div>
  )
}

function ResultSummary({
  result,
  totalQuestions,
}: {
  result: SavedResult
  totalQuestions: number
}) {
  const score = Math.max(0, totalQuestions - result.revealCount)

  return (
    <section className="rounded-[24px] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className={TYPO.headline3 + " text-black"}>
          {GAME_COPY.summary.score}
        </p>
        <p
          className={TYPO.display2 + " text-black"}
        >{`${score}/${totalQuestions}`}</p>
      </div>

      <div className="mt-4 rounded-[18px] bg-[#FFF7D1] px-3 py-3">
        <div className="grid grid-cols-2 gap-3 text-center">
          {[
            {
              label: GAME_COPY.summary.time,
              value: formatClock(result.seconds),
            },
            {
              label: GAME_COPY.summary.mistakes,
              value: String(result.mistakes),
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
        <h3 className={TYPO.headline3}>{GAME_COPY.summary.streak}</h3>
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
        {GAME_COPY.summary.title}
      </h2>
      <p className={`mt-2 text-black/70 ${TYPO.body1}`}>{subtitle}</p>
    </div>
  )
}

function HomeScreen({
  dateLabel,
  completedResult,
  hasSavedProgress,
  onLogoTap,
  onPrimaryAction,
  onResetGame,
  transitionKind,
}: {
  dateLabel: string
  completedResult: SavedResult | null
  hasSavedProgress: boolean
  onLogoTap: () => void
  onPrimaryAction: () => void
  onResetGame: () => void
  transitionKind: ScreenTransitionKind | null
}) {
  const isLeaving = transitionKind !== null

  return (
    <div
      className={cn(
        "screen-enter mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:px-6",
        isLeaving && "screen-exit-home"
      )}
      data-transition-kind={transitionKind ?? undefined}
    >
      <div className="w-full max-w-[420px]">
        <img
          src={GAME_LOGO_URL}
          alt="Word Chain game logo"
          onClick={onLogoTap}
          className={cn(
            "hero-logo-enter mx-auto h-auto w-full max-w-[150px] object-contain",
            isLeaving && "screen-exit-home-logo"
          )}
        />
        <h1
          className={cn(
            "motion-step motion-step-1 mt-4 text-[32px] leading-[1.05] font-bold text-black sm:text-[40px]",
            isLeaving && "screen-exit-home-copy screen-exit-home-copy-1"
          )}
        >
          {GAME_COPY.home.title}
        </h1>
        <p
          className={cn(
            `motion-step motion-step-2 mt-3 text-black/70 ${TYPO.body1}`,
            isLeaving && "screen-exit-home-copy screen-exit-home-copy-2"
          )}
        >
          {GAME_COPY.home.tagline}
        </p>
        <p
          className={cn(
            TYPO.label + " motion-step motion-step-3 mt-3 text-black/55",
            isLeaving && "screen-exit-home-copy screen-exit-home-copy-3"
          )}
        >
          {dateLabel}
        </p>
      </div>

      <div
        className={cn(
          "motion-step motion-step-4 mt-6 w-full max-w-[420px]",
          isLeaving && "screen-exit-home-cta"
        )}
      >
        {completedResult ? (
          <DlsButton variant="disabled-large">
            {GAME_COPY.home.completed}
          </DlsButton>
        ) : (
          <DlsButton variant="primary-large" onClick={onPrimaryAction}>
            {hasSavedProgress ? GAME_COPY.home.resume : GAME_COPY.home.start}
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
            Debug: restart game
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
  highlightHint,
  highlightReveal,
  disabled = false,
}: {
  onHint: () => void
  onReveal: () => void
  highlightHint: boolean
  highlightReveal: boolean
  disabled?: boolean
}) {
  const actions = [
    {
      label: GAME_COPY.game.hint,
      icon: icons.hint,
      onClick: onHint,
      className: "bg-black text-white",
      isHighlighted: highlightHint,
    },
    {
      label: GAME_COPY.game.reveal,
      icon: "",
      onClick: onReveal,
      className: "border-[4px] border-black bg-transparent text-black",
      useRevealGlyph: true,
      isHighlighted: highlightReveal,
    },
  ]

  return (
    <div className="flex w-full items-center justify-center gap-4">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={disabled}
          className={cn(
            "inline-flex h-11 flex-1 items-center justify-center gap-[10px] rounded-[12px] px-4 transition-transform active:translate-y-0.5",
            action.className,
            action.isHighlighted && !disabled && "support-action-highlight",
            disabled && "pointer-events-none opacity-45 active:translate-y-0"
          )}
        >
          <span className="h-4 w-4 shrink-0">
            {action.useRevealGlyph ? (
              <RevealGlyph />
            ) : (
              <Icon src={action.icon} alt="" />
            )}
          </span>
          <span className="text-[16px] leading-[24px] font-semibold whitespace-nowrap">
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
  const EXIT_MS = 220
  const GAP_MS = 40
  const ENTER_MS = 220
  const [currentCard, setCurrentCard] = useState({
    question,
    questionIndex,
  })
  const [incomingCard, setIncomingCard] = useState<null | {
    question: string
    questionIndex: number
  }>(null)
  const [phase, setPhase] = useState<"idle" | "exit" | "prep" | "enter">("idle")
  const [stageHeight, setStageHeight] = useState<number | null>(null)
  const currentCardRef = useRef<HTMLElement | null>(null)
  const incomingCardRef = useRef<HTMLElement | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const swapTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const heightFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const currentHeight = currentCardRef.current?.offsetHeight ?? 0
    const incomingHeight = incomingCardRef.current?.offsetHeight ?? 0
    const nextHeight =
      phase === "idle"
        ? currentHeight
        : Math.max(currentHeight, incomingHeight, currentHeight)

    if (heightFrameRef.current) {
      window.cancelAnimationFrame(heightFrameRef.current)
    }

    if (nextHeight > 0) {
      heightFrameRef.current = window.requestAnimationFrame(() => {
        setStageHeight(nextHeight)
        heightFrameRef.current = null
      })
    }

    return () => {
      if (heightFrameRef.current) {
        window.cancelAnimationFrame(heightFrameRef.current)
        heightFrameRef.current = null
      }
    }
  }, [currentCard, incomingCard, phase])

  useEffect(() => {
    if (
      currentCard.question === question &&
      currentCard.questionIndex === questionIndex
    ) {
      return
    }

    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current)
    }

    if (swapTimerRef.current) {
      window.clearTimeout(swapTimerRef.current)
    }

    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current)
    }

    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
    }

    exitTimerRef.current = window.setTimeout(() => {
      setPhase("exit")
      exitTimerRef.current = null
      swapTimerRef.current = window.setTimeout(() => {
        setIncomingCard({ question, questionIndex })
        setPhase("prep")
        swapTimerRef.current = null
        frameRef.current = window.requestAnimationFrame(() => {
          setPhase("enter")
          frameRef.current = null
          settleTimerRef.current = window.setTimeout(() => {
            setCurrentCard({ question, questionIndex })
            setIncomingCard(null)
            setPhase("idle")
            settleTimerRef.current = null
          }, ENTER_MS)
        })
      }, EXIT_MS + GAP_MS)
    }, 0)

    return () => {
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }

      if (swapTimerRef.current) {
        window.clearTimeout(swapTimerRef.current)
        swapTimerRef.current = null
      }

      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = null
      }

      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }

      if (heightFrameRef.current) {
        window.cancelAnimationFrame(heightFrameRef.current)
        heightFrameRef.current = null
      }
    }
  }, [ENTER_MS, EXIT_MS, GAP_MS, currentCard, question, questionIndex])

  const showCurrent = phase === "idle" || phase === "exit"
  const showIncoming = incomingCard && (phase === "prep" || phase === "enter")

  return (
    <div
      className="question-box-stage mx-auto w-full max-w-[360px] overflow-hidden"
      style={{ height: stageHeight ? `${stageHeight}px` : undefined }}
    >
      {showCurrent ? (
        <section
          ref={currentCardRef}
          className="question-box-motion rounded-[3px] bg-[#051413] px-3 py-2 text-center shadow-[0_10px_24px_rgba(5,20,19,0.18)]"
          data-phase={phase === "exit" ? "exit" : "idle"}
          style={{ transitionDuration: `${EXIT_MS}ms` }}
        >
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#A1E7CB] uppercase">
            Question {currentCard.questionIndex + 1}/{totalQuestions}
          </p>
          <h2 className="mt-1 text-[24px] leading-[36px] font-semibold text-white">
            {currentCard.question}
          </h2>
        </section>
      ) : null}

      {showIncoming ? (
        <section
          ref={incomingCardRef}
          className="question-box-motion question-box-motion-layer rounded-[3px] bg-[#051413] px-3 py-2 text-center shadow-[0_10px_24px_rgba(5,20,19,0.18)]"
          data-phase={phase}
          style={{
            transitionDuration: phase === "enter" ? `${ENTER_MS}ms` : "0ms",
          }}
        >
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#A1E7CB] uppercase">
            Question {incomingCard.questionIndex + 1}/{totalQuestions}
          </p>
          <h2 className="mt-1 text-[24px] leading-[36px] font-semibold text-white">
            {incomingCard.question}
          </h2>
        </section>
      ) : null}
    </div>
  )
}

function WordTiles({
  questionIndex,
  currentWord,
  completedFlash,
  selectedIndex,
  hintIndex,
  hintFlashIndex,
  wrongIndex,
  correctIndex,
  tutorialStep,
  tutorialTargetTileIndex,
  onSelectTile,
}: {
  questionIndex: number
  currentWord: string
  completedFlash: boolean
  selectedIndex: number | null
  hintIndex: number | null
  hintFlashIndex: number | null
  wrongIndex: number | null
  correctIndex: number | null
  tutorialStep: TutorialStep | null
  tutorialTargetTileIndex: number | null
  onSelectTile: (index: number) => void
}) {
  const tileCount = currentWord.length
  const tileGap = Math.max(8, 22 - tileCount * 2)
  const tileMaxWidth = Math.min(420, 240 + tileCount * 21)
  const [showTileEnter, setShowTileEnter] = useState(true)

  useEffect(() => {
    setShowTileEnter(true)
    const timer = window.setTimeout(() => {
      setShowTileEnter(false)
    }, 340)

    return () => {
      window.clearTimeout(timer)
    }
  }, [questionIndex])

  return (
    <div
      className="relative mx-auto mt-2 w-full overflow-visible"
      style={{
        maxWidth: `${tileMaxWidth}px`,
      }}
    >
      <div
        key={`tiles-${questionIndex}`}
        className="grid w-full justify-center"
        style={{
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
          const wrongDistance =
            wrongIndex === null ? null : Math.abs(wrongIndex - index)
          const correctDistance =
            correctIndex === null ? null : Math.abs(correctIndex - index)
          const isWrongNeighbor = wrongDistance === 1 || wrongDistance === 2
          const isSuccessReaction =
            completedFlash && correctDistance !== null && correctDistance > 0
          const tutorialTileLocked = tutorialStep === "tile"
          const isTutorialTarget = tutorialTargetTileIndex === index
          const showTutorialHand = tutorialTileLocked && isTutorialTarget
          const tileMotionStyle: CSSProperties & Record<string, string> = {
            animationDelay: `${index * 24}ms`,
            fontSize:
              tileCount >= 6 ? "20px" : tileCount === 5 ? "22px" : "24px",
          }

          if (wrongDistance !== null) {
            tileMotionStyle["--wrong-wobble-rotate"] = isWrong
              ? "8deg"
              : wrongDistance === 1
                ? index % 2 === 0
                  ? "5deg"
                  : "-5deg"
                : index % 2 === 0
                  ? "2.75deg"
                  : "-2.75deg"
            tileMotionStyle["--wrong-wobble-shift"] = isWrong
              ? "10px"
              : wrongDistance === 1
                ? "6px"
                : "3px"
            tileMotionStyle["--wrong-wobble-squash"] = isWrong
              ? "0.92"
              : wrongDistance === 1
                ? "0.96"
                : "0.985"
          }

          if (correctDistance !== null) {
            tileMotionStyle["--success-react-lift"] =
              correctDistance === 0
                ? "10px"
                : correctDistance === 1
                  ? "7px"
                  : correctDistance === 2
                    ? "5px"
                    : "3px"
            tileMotionStyle["--success-react-tilt"] =
              correctDistance === 0
                ? index % 2 === 0
                  ? "-5deg"
                  : "5deg"
                : correctDistance === 1
                  ? index % 2 === 0
                    ? "-4deg"
                    : "4deg"
                  : correctDistance === 2
                    ? index % 2 === 0
                      ? "-2.5deg"
                      : "2.5deg"
                    : index % 2 === 0
                      ? "-1.5deg"
                      : "1.5deg"
            tileMotionStyle["--success-react-delay"] =
              correctDistance === 0
                ? "0ms"
                : correctDistance === 1
                  ? "40ms"
                  : correctDistance === 2
                    ? "78ms"
                    : "108ms"
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectTile(index)}
              disabled={tutorialTileLocked && !isTutorialTarget}
              className={cn(
                "relative flex aspect-square w-full items-center justify-center rounded-[4px] text-[24px] font-semibold uppercase transition-[background-color,box-shadow,color,opacity] duration-200 focus-visible:outline-none active:translate-y-0.5 sm:text-[26px]",
                showTileEnter && "tile-enter",
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
                wrongIndex !== null && "tile-wrong-row",
                isWrong && "tile-wrong-hero",
                isWrongNeighbor && "tile-wrong-neighbor",
                isCorrect && "tile-correct-bounce",
                isSuccessReaction && "tile-success-react",
                isHintFlash && "tile-hint-flash",
                showTutorialHand && "z-20",
                tutorialTileLocked &&
                  !isTutorialTarget &&
                  "pointer-events-none opacity-30"
              )}
              style={tileMotionStyle}
            >
              {isWrong ? (
                <span className="tile-wrong-impact" aria-hidden="true" />
              ) : null}
              {isHinted ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-80">
                  <span className="glow-pulse absolute h-10 w-10">
                    <Icon src={icons.ray} alt="Hint glow" />
                  </span>
                </span>
              ) : null}
              {showTutorialHand ? <TutorialHand placement="tile" /> : null}
              <span className="relative z-10">{letter}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Keyboard({
  onLetter,
  visible,
  tutorialStep,
  tutorialTargetLetter,
  className,
}: {
  onLetter: (letter: string) => void
  visible: boolean
  tutorialStep: TutorialStep | null
  tutorialTargetLetter: string | null
  className?: string
}) {
  return (
    <div
      className={cn(
        "keyboard-shell fixed inset-x-0 bottom-0 z-20 m-0 w-full p-0",
        className
      )}
      data-visible={visible}
    >
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
            {row.map((letter) => {
              const tutorialKeyLocked = tutorialStep === "keyboard"
              const isTutorialTarget = tutorialTargetLetter === letter

              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => onLetter(letter)}
                  disabled={tutorialKeyLocked && !isTutorialTarget}
                  className={cn(
                    `relative h-11 rounded-[12px] bg-white text-black shadow-[0px_1.7777777910232544px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-0.5 ${TYPO.headline5}`,
                    tutorialKeyLocked &&
                      !isTutorialTarget &&
                      "pointer-events-none opacity-30"
                  )}
                >
                  {tutorialKeyLocked && isTutorialTarget ? (
                    <TutorialHand placement="key" />
                  ) : null}
                  {letter}
                </button>
              )
            })}
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
  completedFlash,
  showSuccessCelebration,
  successCelebrationNonce,
  noticeMessage,
  noticeNonce,
  tutorialStep,
  tutorialTargetTileIndex,
  tutorialTargetLetter,
  tutorialLocked,
  onSelectTile,
  onLetter,
  onHint,
  onReveal,
  highlightHint,
  highlightReveal,
  onHome,
  onPause,
  transitionKind,
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
  completedFlash: boolean
  showSuccessCelebration: boolean
  successCelebrationNonce: number
  noticeMessage: string | null
  noticeNonce: number
  tutorialStep: TutorialStep | null
  tutorialTargetTileIndex: number | null
  tutorialTargetLetter: string | null
  tutorialLocked: boolean
  onSelectTile: (index: number) => void
  onLetter: (letter: string) => void
  onHint: () => void
  onReveal: () => void
  highlightHint: boolean
  highlightReveal: boolean
  onHome: () => void
  onPause: () => void
  transitionKind: ScreenTransitionKind | null
}) {
  const isKeyboardVisible = selectedIndex !== null
  const isLeavingToEnd = transitionKind === "game-to-end"

  return (
    <>
      {showSuccessCelebration ? (
        <span
          key={successCelebrationNonce}
          aria-hidden="true"
          className="success-screen-celebration"
        >
          <span className="success-screen-ripple-field">
            <span className="success-screen-arc success-screen-arc-1" />
            <span className="success-screen-arc success-screen-arc-2" />
            <span className="success-screen-arc success-screen-arc-3" />
          </span>
        </span>
      ) : null}

      <GameScreenHeader
        dateLabel={dateLabel}
        timerText={formatClock(elapsed)}
        onHome={onHome}
        onPause={onPause}
        tutorialLocked={tutorialLocked}
        isExiting={isLeavingToEnd}
      />

      {tutorialLocked ? (
        <div className="tutorial-overlay-enter pointer-events-none fixed inset-0 z-10 bg-black/72" />
      ) : null}

      <div
        className={cn(
          "mx-auto flex w-full max-w-[520px] flex-1 flex-col px-4 pt-[104px] pb-[14rem] sm:px-6",
          isLeavingToEnd && "screen-exit-game"
        )}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-8">
          <div
            className={cn(
              "relative flex w-full flex-col items-center gap-8",
              !tutorialLocked && "z-20",
              isLeavingToEnd && "screen-exit-game-board"
            )}
          >
            <QuestionBox
              questionIndex={questionIndex}
              totalQuestions={totalQuestions}
              question={question}
            />

            <div
              className={cn(
                "w-full",
                isLeavingToEnd && "screen-exit-game-tiles"
              )}
            >
              <WordTiles
                questionIndex={questionIndex}
                currentWord={currentWord}
                completedFlash={completedFlash}
                selectedIndex={selectedIndex}
                hintIndex={hintIndex}
                hintFlashIndex={hintFlashIndex}
                wrongIndex={wrongIndex}
                correctIndex={correctIndex}
                tutorialStep={tutorialStep}
                tutorialTargetTileIndex={tutorialTargetTileIndex}
                onSelectTile={onSelectTile}
              />
            </div>
          </div>

          <p
            className={cn(
              "relative z-0 text-center text-[16px] leading-[24px] font-semibold text-black/40",
              isLeavingToEnd && "screen-exit-game-copy"
            )}
          >
            {isKeyboardVisible
              ? GAME_COPY.game.changeLetterHint
              : GAME_COPY.game.tapTileHint}
          </p>
        </div>

        <div
          className={cn(
            "fixed inset-x-0 px-4 sm:px-6",
            tutorialLocked ? "z-0" : "z-20",
            isKeyboardVisible
              ? "bottom-[calc(11.5rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
          )}
        >
          <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3">
            <div
              className={cn(
                "w-full",
                isLeavingToEnd && "screen-exit-game-support"
              )}
            >
              <GameSupportRow
                onHint={onHint}
                onReveal={onReveal}
                highlightHint={highlightHint}
                highlightReveal={highlightReveal}
                disabled={tutorialLocked}
              />
            </div>
          </div>
        </div>

        <Keyboard
          onLetter={onLetter}
          visible={isKeyboardVisible}
          tutorialStep={tutorialStep}
          tutorialTargetLetter={tutorialTargetLetter}
          className={cn(isLeavingToEnd && "screen-exit-game-keyboard")}
        />

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
  nextPuzzleDateLabel,
  totalQuestions,
  onHome,
}: {
  result: SavedResult
  puzzleDate: string
  nextPuzzleDateLabel: string
  totalQuestions: number
  onHome: () => void
}) {
  return (
    <div className="screen-enter mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center px-4 py-6 text-center sm:px-6">
      <div className="w-full max-w-[420px] space-y-5">
        <div className="motion-step motion-step-1">
          <SummaryHero
            title={GAME_COPY.summary.title}
            subtitle={GAME_COPY.summary.subtitle}
          />
        </div>

        <div className="motion-step motion-step-2">
          <ResultSummary result={result} totalQuestions={totalQuestions} />
        </div>

        <div className="motion-step motion-step-3">
          <StreakCard puzzleDate={puzzleDate} />
        </div>

        <div className="motion-step motion-step-4 text-center">
          <p className={TYPO.label + " text-black/55"}>
            {GAME_COPY.summary.nextChallenge}
          </p>
          <p className={`mt-2 text-black ${TYPO.headline4}`}>
            {nextPuzzleDateLabel}
          </p>
        </div>

        <div className="motion-step motion-step-5 space-y-3">
          <DlsButton variant="primary-large" onClick={onHome} icon={icons.home}>
            {GAME_COPY.summary.home}
          </DlsButton>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home")
  const [screenTransition, setScreenTransition] =
    useState<ScreenTransitionState | null>(null)
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
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null)
  const [isTesterOpen, setIsTesterOpen] = useState(false)
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(false)

  const puzzleDate = activeSchedule.date
  const systemDate = getTodayDateString()
  const startWord = activeSchedule.startWord.toUpperCase()
  const puzzles = activeSchedule.puzzles
  const storageKey = getResultStorageKey(puzzleDate)
  const progressStorageKey = getProgressStorageKey(puzzleDate)
  const safeStartWord = startWord || "WORD"
  const safePuzzles: Puzzle[] =
    puzzles.length > 0
      ? puzzles
      : [{ question: "No live puzzle found.", answer: safeStartWord }]

  const [questionIndex, setQuestionIndex] = useState(0)
  const [letters, setLetters] = useState(safeStartWord.split(""))
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [questionMistakes, setQuestionMistakes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [bonusPoints, setBonusPoints] = useState(0)
  const [revealCount, setRevealCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [correctIndex, setCorrectIndex] = useState<number | null>(null)
  const [shakeIndex, setShakeIndex] = useState<number | null>(null)
  const [hintIndex, setHintIndex] = useState<number | null>(null)
  const [hintFlashIndex, setHintFlashIndex] = useState<number | null>(null)
  const [wrongIndex, setWrongIndex] = useState<number | null>(null)
  const [completedFlash, setCompletedFlash] = useState(false)
  const [showSuccessCelebration, setShowSuccessCelebration] = useState(false)
  const [successCelebrationNonce, setSuccessCelebrationNonce] = useState(0)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)
  const [noticeNonce, setNoticeNonce] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [highlightHintButton, setHighlightHintButton] = useState(false)
  const [highlightRevealButton, setHighlightRevealButton] = useState(false)

  const timerStartRef = useRef<number | null>(null)
  const feedbackTimerRef = useRef<number | null>(null)
  const revealTimerRef = useRef<number | null>(null)
  const noticeTimerRef = useRef<number | null>(null)
  const hintTimerRef = useRef<number | null>(null)
  const idleHintTimerRef = useRef<number | null>(null)
  const idleRevealTimerRef = useRef<number | null>(null)
  const hintHighlightTimerRef = useRef<number | null>(null)
  const revealHighlightTimerRef = useRef<number | null>(null)
  const logoTapCountRef = useRef(0)
  const logoTapTimerRef = useRef<number | null>(null)
  const screenTransitionStageTimerRef = useRef<number | null>(null)
  const screenTransitionNonceRef = useRef(0)

  const dateLabel = useMemo(() => formatPuzzleDate(systemDate), [systemDate])
  const nextPuzzleDateLabel = useMemo(
    () => formatLongDate(addDaysToDateString(systemDate, 1)),
    [systemDate]
  )

  const currentPuzzle =
    safePuzzles[questionIndex] ?? safePuzzles[safePuzzles.length - 1]
  const currentWord = letters.join("")
  const answerIndex = getDiffIndex(currentWord, currentPuzzle.answer)
  const tutorialQuestionLimit = Math.min(2, safePuzzles.length)
  const tutorialLocked =
    screen === "game" &&
    !completedFlash &&
    !isPaused &&
    !hasCompletedTutorial &&
    questionIndex < tutorialQuestionLimit
  const tutorialStep: TutorialStep | null = tutorialLocked
    ? selectedIndex === null
      ? "tile"
      : "keyboard"
    : null
  const tutorialTargetTileIndex =
    tutorialLocked && answerIndex >= 0 ? answerIndex : null
  const tutorialTargetLetter =
    tutorialStep === "keyboard" && tutorialTargetTileIndex !== null
      ? (currentPuzzle.answer[tutorialTargetTileIndex]?.toUpperCase() ?? null)
      : null

  function clearScreenTransitionTimers() {
    if (screenTransitionStageTimerRef.current) {
      window.clearTimeout(screenTransitionStageTimerRef.current)
      screenTransitionStageTimerRef.current = null
    }
  }

  function runScreenTransition(
    nextScreen: Screen,
    kind: ScreenTransitionKind,
    beforeScreenSwitch?: () => void
  ) {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const leaveDuration = prefersReducedMotion
      ? 24
      : kind === "home-to-guided-game"
        ? 240
        : kind === "game-to-end"
          ? 220
          : 180

    clearScreenTransitionTimers()
    beforeScreenSwitch?.()

    const nonce = screenTransitionNonceRef.current + 1
    screenTransitionNonceRef.current = nonce

    setScreenTransition({ kind, nonce })

    screenTransitionStageTimerRef.current = window.setTimeout(() => {
      screenTransitionStageTimerRef.current = null
      setScreen(nextScreen)
      setScreenTransition((value) =>
        value && value.nonce === nonce ? null : value
      )
    }, leaveDuration)
  }

  function clearIdlePromptTimers() {
    if (idleHintTimerRef.current) {
      window.clearTimeout(idleHintTimerRef.current)
      idleHintTimerRef.current = null
    }
    if (idleRevealTimerRef.current) {
      window.clearTimeout(idleRevealTimerRef.current)
      idleRevealTimerRef.current = null
    }
    if (hintHighlightTimerRef.current) {
      window.clearTimeout(hintHighlightTimerRef.current)
      hintHighlightTimerRef.current = null
    }
    if (revealHighlightTimerRef.current) {
      window.clearTimeout(revealHighlightTimerRef.current)
      revealHighlightTimerRef.current = null
    }
  }

  function clearIdlePrompts() {
    clearIdlePromptTimers()
    setHighlightHintButton(false)
    setHighlightRevealButton(false)
  }

  function pulseHintPrompt() {
    if (hintHighlightTimerRef.current) {
      window.clearTimeout(hintHighlightTimerRef.current)
    }

    setHighlightHintButton(true)
    hintHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightHintButton(false)
      hintHighlightTimerRef.current = null
    }, 2000)
  }

  function pulseRevealPrompt() {
    if (revealHighlightTimerRef.current) {
      window.clearTimeout(revealHighlightTimerRef.current)
    }

    setHighlightRevealButton(true)
    revealHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightRevealButton(false)
      revealHighlightTimerRef.current = null
    }, 2000)
  }

  function scheduleIdlePrompts() {
    clearIdlePrompts()

    idleHintTimerRef.current = window.setTimeout(() => {
      pulseHintPrompt()
      idleHintTimerRef.current = null
    }, 4000)

    idleRevealTimerRef.current = window.setTimeout(() => {
      pulseRevealPrompt()
      idleRevealTimerRef.current = null
    }, 10000)
  }

  function registerQuestionActivity() {
    if (screen !== "game" || completedFlash || isPaused) {
      clearIdlePrompts()
      return
    }

    scheduleIdlePrompts()
  }

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
    clearIdlePromptTimers()
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

  function completeTutorial() {
    window.localStorage.setItem(FIRST_QUESTION_HAND_STORAGE_KEY, "1")
    setHasCompletedTutorial(true)
  }

  function clearStoredProgress(date = puzzleDate) {
    window.localStorage.removeItem(getProgressStorageKey(date))
  }

  function isValidSavedProgress(
    progress: SavedProgress,
    schedule: PuzzleSchedule
  ): boolean {
    if (progress.date !== schedule.date) return false
    if (!Array.isArray(progress.letters)) return false
    if (
      !Number.isInteger(progress.questionIndex) ||
      progress.questionIndex < 0 ||
      progress.questionIndex >= schedule.puzzles.length
    ) {
      return false
    }

    const expectedLength =
      schedule.puzzles[progress.questionIndex]?.answer.length ??
      schedule.startWord.length

    if (progress.letters.length !== expectedLength) return false
    if (
      progress.selectedIndex !== null &&
      (!Number.isInteger(progress.selectedIndex) ||
        progress.selectedIndex < 0 ||
        progress.selectedIndex >= progress.letters.length)
    ) {
      return false
    }

    return (
      Number.isFinite(progress.mistakes) &&
      Number.isFinite(progress.questionMistakes) &&
      Number.isFinite(progress.streak) &&
      Number.isFinite(progress.longestStreak) &&
      Number.isFinite(progress.bonusPoints) &&
      Number.isFinite(progress.elapsed)
    )
  }

  function persistProgress(progress: SavedProgress) {
    window.localStorage.setItem(progressStorageKey, JSON.stringify(progress))
    setSavedProgress(progress)
  }

  function loadStoredProgress(schedule: PuzzleSchedule) {
    const nextStorageKey = getProgressStorageKey(schedule.date)

    try {
      const raw = window.localStorage.getItem(nextStorageKey)
      if (!raw) return null

      const parsed = JSON.parse(raw) as SavedProgress
      const normalizedProgress: SavedProgress = {
        ...parsed,
        revealCount: Number.isFinite(parsed.revealCount)
          ? parsed.revealCount
          : 0,
      }

      if (!isValidSavedProgress(normalizedProgress, schedule)) {
        window.localStorage.removeItem(nextStorageKey)
        return null
      }

      return normalizedProgress
    } catch {
      window.localStorage.removeItem(nextStorageKey)
      return null
    }
  }

  function loadStoredResult(date: string) {
    const nextStorageKey = getResultStorageKey(date)

    try {
      const raw = window.localStorage.getItem(nextStorageKey)
      if (!raw) return null

      const parsed = JSON.parse(raw) as SavedResult
      return parsed?.date === date
        ? {
            ...parsed,
            revealCount: Number.isFinite(parsed.revealCount)
              ? parsed.revealCount
              : 0,
          }
        : null
    } catch {
      window.localStorage.removeItem(nextStorageKey)
      return null
    }
  }

  function finishGame(
    nextMistakes = mistakes,
    nextLongestStreak = longestStreak,
    nextElapsed = elapsed,
    nextBonusPoints = bonusPoints,
    nextRevealCount = revealCount
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
      revealCount: nextRevealCount,
    }

    runScreenTransition("end", "game-to-end", () => {
      setCompletedResult(result)
      setSavedProgress(null)
      persistResult(result)
      clearStoredProgress()
    })
  }

  function advanceQuestion(
    nextWord: string,
    nextMistakes = mistakes,
    nextLongestStreak = longestStreak,
    nextElapsed = elapsed,
    nextBonusPoints = bonusPoints,
    nextRevealCount = revealCount
  ) {
    clearPendingTimers()

    if (questionIndex >= safePuzzles.length - 1) {
      finishGame(
        nextMistakes,
        nextLongestStreak,
        nextElapsed,
        nextBonusPoints,
        nextRevealCount
      )
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
    setShowSuccessCelebration(false)
    setNoticeMessage(null)
    setQuestionMistakes(0)
    setHighlightHintButton(false)
    setHighlightRevealButton(false)
  }

  function handleLetter(letter: string) {
    if (screen !== "game" || completedFlash || isPaused) return
    if (tutorialStep === "tile") return
    if (tutorialStep === "keyboard" && letter !== tutorialTargetLetter) return
    registerQuestionActivity()

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
      setShowSuccessCelebration(true)
      setSuccessCelebrationNonce((value) => value + 1)
      setSelectedIndex(activeIndex)
      setStreak(nextStreak)
      setLongestStreak(nextLongestStreak)
      setBonusPoints(nextBonusPoints)
      if (
        !hasCompletedTutorial &&
        tutorialQuestionLimit > 0 &&
        questionIndex >= tutorialQuestionLimit - 1
      ) {
        completeTutorial()
      }

      feedbackTimerRef.current = window.setTimeout(() => {
        setCompletedFlash(false)
        setShowSuccessCelebration(false)
        advanceQuestion(
          nextWord.toUpperCase(),
          mistakes,
          nextLongestStreak,
          resolvedElapsed,
          nextBonusPoints
        )
      }, 620)
      return
    }

    clearPendingTimers()
    const nextQuestionMistakes = questionMistakes + 1
    setMistakes((value) => value + 1)
    setQuestionMistakes(nextQuestionMistakes)
    setStreak(0)
    setLetters(nextLetters)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(activeIndex)
    setShakeIndex(activeIndex)
    setCompletedFlash(false)
    setShowSuccessCelebration(false)
    setSelectedIndex(activeIndex)

    if (nextQuestionMistakes === 2) {
      pulseHintPrompt()
    }
    if (nextQuestionMistakes === 4) {
      pulseRevealPrompt()
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setLetters((value: string[]) => {
        const reverted = [...value]
        reverted[activeIndex] = previousLetter
        return reverted
      })
      setShakeIndex(null)
      setWrongIndex(null)
    }, 860)
  }

  function handleHint() {
    if (screen !== "game" || completedFlash || isPaused) return
    if (tutorialLocked) return
    registerQuestionActivity()
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
    if (tutorialLocked) return
    registerQuestionActivity()

    clearPendingTimers()
    const nextMistakes = mistakes + 3
    const nextRevealCount = revealCount + 1
    const resolvedElapsed = timerStartRef.current
      ? Math.floor((Date.now() - timerStartRef.current) / 1000)
      : elapsed
    setMistakes((value) => value + 3)
    setRevealCount(nextRevealCount)
    setStreak(0)
    setHintIndex(null)
    setHintFlashIndex(null)
    setSelectedIndex(answerIndex >= 0 ? answerIndex : 0)
    setWrongIndex(null)
    const revealedLetters = currentPuzzle.answer.split("")
    setLetters(revealedLetters)
    setCompletedFlash(true)
    setShowSuccessCelebration(false)
    setHighlightHintButton(false)
    setHighlightRevealButton(false)

    revealTimerRef.current = window.setTimeout(() => {
      setCompletedFlash(false)
      advanceQuestion(
        currentPuzzle.answer,
        nextMistakes,
        longestStreak,
        resolvedElapsed,
        bonusPoints,
        nextRevealCount
      )
    }, 520)
  }

  function applySavedProgress(
    progress: SavedProgress,
    schedule: PuzzleSchedule
  ) {
    clearPendingTimers()
    setActiveSchedule(schedule)
    setCompletedResult(loadStoredResult(schedule.date))
    setIsPaused(false)
    setQuestionIndex(progress.questionIndex)
    setLetters(progress.letters)
    setSelectedIndex(progress.selectedIndex)
    setMistakes(progress.mistakes)
    setQuestionMistakes(progress.questionMistakes)
    setStreak(progress.streak)
    setLongestStreak(progress.longestStreak)
    setBonusPoints(progress.bonusPoints)
    setRevealCount(progress.revealCount)
    setElapsed(progress.elapsed)
    setCorrectIndex(null)
    setShakeIndex(null)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(null)
    setCompletedFlash(false)
    setShowSuccessCelebration(false)
    setNoticeMessage(null)
    setHighlightHintButton(false)
    setHighlightRevealButton(false)
    setSavedProgress(progress)
    timerStartRef.current = Date.now() - progress.elapsed * 1000

    const isGuidedStart =
      !hasCompletedTutorial &&
      progress.questionIndex < Math.min(2, schedule.puzzles.length)

    runScreenTransition(
      "game",
      isGuidedStart ? "home-to-guided-game" : "home-to-game"
    )
  }

  function startGame(options?: {
    ignoreCompleted?: boolean
    schedule?: PuzzleSchedule
  }) {
    const nextSchedule = options?.schedule ?? activeSchedule
    const nextCompletedResult = options?.schedule
      ? loadStoredResult(nextSchedule.date)
      : completedResult
    const nextSavedProgress = loadStoredProgress(nextSchedule)
    const nextStartWord = nextSchedule.startWord.toUpperCase() || "WORD"

    if (nextCompletedResult && !options?.ignoreCompleted) return
    if (nextSavedProgress) {
      applySavedProgress(nextSavedProgress, nextSchedule)
      return
    }

    clearPendingTimers()
    clearStoredProgress(nextSchedule.date)
    if (options?.schedule) {
      setActiveSchedule(nextSchedule)
      setCompletedResult(nextCompletedResult)
    }

    const tutorialLimit = Math.min(2, nextSchedule.puzzles.length)
    const isGuidedStart = !hasCompletedTutorial && tutorialLimit > 0

    runScreenTransition(
      "game",
      isGuidedStart ? "home-to-guided-game" : "home-to-game",
      () => {
        setSavedProgress(null)
        setIsPaused(false)
        setQuestionIndex(0)
        setLetters(nextStartWord.split(""))
        setSelectedIndex(null)
        setMistakes(0)
        setQuestionMistakes(0)
        setStreak(0)
        setLongestStreak(0)
        setBonusPoints(0)
        setRevealCount(0)
        setElapsed(0)
        setCorrectIndex(null)
        setShakeIndex(null)
        setHintIndex(null)
        setHintFlashIndex(null)
        setWrongIndex(null)
        setCompletedFlash(false)
        setShowSuccessCelebration(false)
        setNoticeMessage(null)
        setHighlightHintButton(false)
        setHighlightRevealButton(false)
        timerStartRef.current = Date.now()
      }
    )
  }

  function applySchedule(schedule: PuzzleSchedule) {
    const nextStartWord = schedule.startWord.toUpperCase() || "WORD"
    const nextSavedProgress = loadStoredProgress(schedule)

    clearPendingTimers()
    setActiveSchedule(schedule)
    setCompletedResult(loadStoredResult(schedule.date))
    setSavedProgress(nextSavedProgress)
    setScreen("home")
    setIsPaused(false)
    setQuestionIndex(0)
    setLetters(nextStartWord.split(""))
    setSelectedIndex(null)
    setMistakes(0)
    setQuestionMistakes(0)
    setStreak(0)
    setLongestStreak(0)
    setBonusPoints(0)
    setRevealCount(0)
    setElapsed(0)
    setCorrectIndex(null)
    setShakeIndex(null)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(null)
    setCompletedFlash(false)
    setShowSuccessCelebration(false)
    setNoticeMessage(null)
    setHighlightHintButton(false)
    setHighlightRevealButton(false)
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
    if (tutorialStep === "keyboard") return
    if (tutorialStep === "tile" && index !== tutorialTargetTileIndex) return
    registerQuestionActivity()
    if (hintIndex === index) {
      setHintIndex(null)
    }
    setSelectedIndex(index)
  }

  function resetGame() {
    clearPendingTimers()
    window.localStorage.removeItem(storageKey)
    window.localStorage.removeItem(FIRST_QUESTION_HAND_STORAGE_KEY)
    clearStoredProgress()
    setCompletedResult(null)
    setSavedProgress(null)
    setHasCompletedTutorial(false)
    setScreen("home")
    setIsPaused(false)
    setQuestionIndex(0)
    setLetters(safeStartWord.split(""))
    setSelectedIndex(null)
    setMistakes(0)
    setQuestionMistakes(0)
    setStreak(0)
    setLongestStreak(0)
    setBonusPoints(0)
    setRevealCount(0)
    setElapsed(0)
    setCorrectIndex(null)
    setShakeIndex(null)
    setHintIndex(null)
    setHintFlashIndex(null)
    setWrongIndex(null)
    setCompletedFlash(false)
    setShowSuccessCelebration(false)
    setNoticeMessage(null)
    setHighlightHintButton(false)
    setHighlightRevealButton(false)
    timerStartRef.current = null
  }

  useEffect(() => {
    const imagePreloads = PRELOADED_GAME_ASSET_URLS.map((src) => {
      const image = new window.Image()
      image.src = src
      return image
    })

    return () => {
      imagePreloads.forEach((image) => {
        image.src = ""
      })
    }
  }, [])

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
        setSavedProgress(loadStoredProgress(nextSchedule))
        setHasCompletedTutorial(
          window.localStorage.getItem(FIRST_QUESTION_HAND_STORAGE_KEY) === "1"
        )
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
    if (screen !== "game" || completedResult) return

    persistProgress({
      date: puzzleDate,
      questionIndex,
      letters,
      selectedIndex,
      mistakes,
      questionMistakes,
      streak,
      longestStreak,
      bonusPoints,
      revealCount,
      elapsed,
    })
  }, [
    bonusPoints,
    completedResult,
    elapsed,
    letters,
    longestStreak,
    mistakes,
    progressStorageKey,
    puzzleDate,
    questionIndex,
    questionMistakes,
    revealCount,
    screen,
    selectedIndex,
    streak,
  ])

  useEffect(() => {
    if (screen !== "game" || isPaused || completedFlash) {
      clearIdlePrompts()
      return
    }

    scheduleIdlePrompts()

    return () => {
      clearIdlePrompts()
    }
  }, [questionIndex, screen, isPaused, completedFlash])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== "game" || isPaused) return
      if (tutorialLocked) return
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
      clearScreenTransitionTimers()
    }
  }, [])

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
            hasSavedProgress={savedProgress !== null}
            onLogoTap={handleLogoTap}
            onPrimaryAction={() => startGame()}
            onResetGame={resetGame}
            transitionKind={screenTransition?.kind ?? null}
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
            completedFlash={completedFlash}
            showSuccessCelebration={showSuccessCelebration}
            successCelebrationNonce={successCelebrationNonce}
            noticeMessage={noticeMessage}
            noticeNonce={noticeNonce}
            tutorialStep={tutorialStep}
            tutorialTargetTileIndex={tutorialTargetTileIndex}
            tutorialTargetLetter={tutorialTargetLetter}
            tutorialLocked={tutorialLocked}
            onSelectTile={handleSelectTile}
            onLetter={handleLetter}
            onHint={handleHint}
            onReveal={handleReveal}
            highlightHint={highlightHintButton}
            highlightReveal={highlightRevealButton}
            onHome={() => {
              persistProgress({
                date: puzzleDate,
                questionIndex,
                letters,
                selectedIndex,
                mistakes,
                questionMistakes,
                streak,
                longestStreak,
                bonusPoints,
                revealCount,
                elapsed,
              })
              clearPendingTimers()
              clearIdlePrompts()
              setNoticeMessage(null)
              setIsPaused(false)
              setScreen("home")
            }}
            onPause={() => {
              if (tutorialLocked) return
              setIsPaused(true)
            }}
            transitionKind={screenTransition?.kind ?? null}
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
            puzzleDate={systemDate}
            nextPuzzleDateLabel={nextPuzzleDateLabel}
            totalQuestions={safePuzzles.length}
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
