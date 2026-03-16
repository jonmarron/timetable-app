"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// --- Date helpers ---

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function shiftDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Format a Date as YYYY-MM-DD for API calls */
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// --- Color palette ---

const COLORS = [
  { id: "green",  swatch: "#4ade80", cellBg: "#dcfce7", cellBgDark: "#14532d" },
  { id: "blue",   swatch: "#60a5fa", cellBg: "#dbeafe", cellBgDark: "#1e3a5f" },
  { id: "yellow", swatch: "#facc15", cellBg: "#fef9c3", cellBgDark: "#713f12" },
  { id: "orange", swatch: "#fb923c", cellBg: "#ffedd5", cellBgDark: "#7c2d12" },
  { id: "red",    swatch: "#f87171", cellBg: "#fee2e2", cellBgDark: "#7f1d1d" },
] as const;

type ColorId = typeof COLORS[number]["id"] | "";

function getCellBg(colorId: ColorId, isDark: boolean): string | undefined {
  const c = COLORS.find((c) => c.id === colorId);
  if (!c) return undefined;
  return isDark ? c.cellBgDark : c.cellBg;
}

// --- Entry type ---

interface Entry {
  text: string;
  color: ColorId;
  /** End hour (exclusive). Defaults to startHour + 1 if omitted. */
  endHour?: number;
  /** When true the task repeats across all weekdays of the week. */
  repeatAllDays?: boolean;
}

// --- Coverage map ---

interface CoverageInfo {
  /** The cellKey of the canonical (first) entry that owns this cell. */
  canonicalKey: string;
  /** True only for the first slot of a task on each day it appears. */
  isStart: boolean;
}

/**
 * Parse "monday-0900" → { dayName: "monday", hour: 9, minute: 0 }
 * Also supports legacy format "monday-09" → { dayName: "monday", hour: 9, minute: 0 }
 */
function parseCellKey(key: string): { dayName: string; hour: number; minute: number } {
  const dashIdx = key.lastIndexOf("-");
  const timeStr = key.slice(dashIdx + 1);
  if (timeStr.length <= 2) {
    // Legacy format: "09"
    return { dayName: key.slice(0, dashIdx), hour: parseInt(timeStr, 10), minute: 0 };
  }
  return {
    dayName: key.slice(0, dashIdx),
    hour: parseInt(timeStr.slice(0, 2), 10),
    minute: parseInt(timeStr.slice(2), 10),
  };
}

/**
 * Build a map from every cell key that has visual content to the canonical
 * entry that owns it. Non-repeating tasks take priority over repeating ones.
 */
function buildCoverage(
  tasks: Record<string, Entry>,
  days: Date[]
): Record<string, CoverageInfo> {
  const coverage: Record<string, CoverageInfo> = {};
  const entries = Object.entries(tasks);

  // Pass 1: non-repeating tasks (exact-match cells, highest priority)
  for (const [key, entry] of entries) {
    if (entry.repeatAllDays) continue;
    const { dayName, hour, minute } = parseCellKey(key);
    const startTime = hour + minute / 60;
    const endTime = entry.endHour ?? startTime + 0.5;
    for (let t = startTime; t < endTime; t += 0.5) {
      const h = Math.floor(t);
      const m = Math.round((t % 1) * 60);
      const k = `${dayName}-${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
      coverage[k] = { canonicalKey: key, isStart: t === startTime };
    }
  }

  // Pass 2: repeating tasks fill any cells not already claimed
  for (const [key, entry] of entries) {
    if (!entry.repeatAllDays) continue;
    const { hour, minute } = parseCellKey(key);
    const startTime = hour + minute / 60;
    const endTime = entry.endHour ?? startTime + 0.5;
    for (const day of days) {
      const dn = day
        .toLocaleDateString("en-GB", { weekday: "long" })
        .toLowerCase();
      for (let t = startTime; t < endTime; t += 0.5) {
        const h = Math.floor(t);
        const m = Math.round((t % 1) * 60);
        const k = `${dn}-${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
        if (!coverage[k]) {
          coverage[k] = { canonicalKey: key, isStart: t === startTime };
        }
      }
    }
  }

  return coverage;
}

// --- Constants ---

/** 28 half-hour slots: 06:00, 06:30, 07:00, … 19:00, 19:30 */
const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const totalMinutes = 360 + i * 30; // start at 06:00 = 360 min
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
});

/** All 30-min increments valid as an end time (up to and including 20:00) */
const END_TIME_SLOTS = [...TIME_SLOTS, { hour: 20, minute: 0 }];

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Monday, 3 March" — locale-independent, avoids SSR/client hydration mismatches. */
function fullDayStr(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function fmtTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "monday-0900", "friday-1430", etc. */
function cellKey(day: Date, hour: number, minute: number): string {
  const name = day
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toLowerCase();
  return `${name}-${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}`;
}

// --- Cell ---

interface CellProps {
  savedText: string;
  savedColor: ColorId;
  isToday: boolean;
  isDark: boolean;
  cellAriaLabel: string;
  /** Percentage (0–100) from the top of this cell where the current-time line should appear. Omit when not the current hour. */
  nowPct?: number;
  /** True when this cell is a non-first slot of a multi-slot or repeated task. */
  isContinuation?: boolean;
  /** True for the :30 half-hour separator row — renders a dashed bottom border. */
  isHalfHour?: boolean;
  onActivate: () => void;
  onDeleteRequest: () => void;
}

function TimetableCell({
  savedText,
  savedColor,
  isToday,
  isDark,
  cellAriaLabel,
  nowPct,
  isContinuation,
  isHalfHour,
  onActivate,
  onDeleteRequest,
}: CellProps) {
  const activeBg = getCellBg(savedColor, isDark);

  return (
    <td
      onClick={onActivate}
      aria-label={cellAriaLabel}
      data-halfhour={isHalfHour ? "true" : undefined}
      style={activeBg ? { backgroundColor: activeBg } : undefined}
      className={cn(
        "relative group border-r last:border-r-0 h-7 p-1 align-top transition-colors cursor-pointer",
        isHalfHour
          ? "border-b"
          : "border-b [border-bottom-style:dashed] border-border/60",
        !activeBg && !isToday && !isContinuation && "hover:bg-accent/60",
        !activeBg && !isToday && isContinuation && "bg-primary/5",
        !activeBg && isToday && "bg-primary/5 hover:bg-primary/10",
      )}
    >
      {nowPct !== undefined && (
        <div
          aria-hidden="true"
          data-testid="current-time-indicator"
          className="absolute inset-x-0 z-10 pointer-events-none"
          style={{ top: `${nowPct}%` }}
        >
          <div className="relative h-px bg-red-500">
            <div className="absolute -left-0.5 -top-[3px] h-2 w-2 rounded-full bg-red-500" />
          </div>
        </div>
      )}

      {savedText && (
        <>
          <p
            className={cn(
              "text-xs font-medium leading-snug break-words pr-6",
              !savedColor && "px-1.5 py-1 rounded-md bg-primary/15 text-primary",
            )}
          >
            {savedText}
          </p>

          <button
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            aria-label="Delete entry"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </>
      )}
    </td>
  );
}

// --- Main view ---

export default function TimetableView() {
  const today = new Date();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [tasks, setTasks] = useState<Record<string, Entry>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftColor, setDraftColor] = useState<ColorId>("");
  const [draftStartHour, setDraftStartHour] = useState(6); // float: 9.5 = 09:30
  const [draftEndHour, setDraftEndHour] = useState(6.5); // float: 9.5 = 09:30
  const [draftRepeatAllDays, setDraftRepeatAllDays] = useState(false);
  const [loadedWeek, setLoadedWeek] = useState("");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const isLoading = loadedWeek !== toDateStr(weekStart);

  // Load entries for the displayed week
  useEffect(() => {
    const weekStr = toDateStr(weekStart);
    fetch(`/api/timetable?weekStart=${weekStr}`)
      .then((r) => r.json())
      .then(({ entries }) => {
        setTasks(entries ?? {});
        setLoadedWeek(weekStr);
      })
      .catch(console.error);
  }, [weekStart]);

  const days = Array.from({ length: 5 }, (_, i) => shiftDays(weekStart, i));
  const weekEnd = shiftDays(weekStart, 6);
  const isCurrentWeek = isSameDay(weekStart, getWeekStart(today));

  const weekLabel = [
    weekStart.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
    "–",
    weekEnd.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  ].join(" ");

  // Build coverage map: maps every visually-occupied cellKey to the canonical entry
  const coverage = useMemo(
    () => buildCoverage(tasks, days),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, weekStart]
  );

  function startEdit(key: string) {
    const { hour, minute } = parseCellKey(key);
    const startTime = hour + minute / 60;
    setEditingKey(key);
    setDraft(tasks[key]?.text ?? "");
    setDraftColor(tasks[key]?.color ?? "");
    setDraftStartHour(startTime);
    setDraftEndHour(tasks[key]?.endHour ?? startTime + 0.5);
    setDraftRepeatAllDays(tasks[key]?.repeatAllDays ?? false);
  }

  function commit() {
    if (!editingKey) return;
    const trimmed = draft.trim();
    const oldKey = editingKey;
    const { dayName } = parseCellKey(oldKey);
    const newHour = Math.floor(draftStartHour);
    const newMinute = Math.round((draftStartHour % 1) * 60);
    const newKey = `${dayName}-${String(newHour).padStart(2, "0")}${String(newMinute).padStart(2, "0")}`;
    const weekStr = toDateStr(weekStart);

    // Optimistic update
    setTasks((prev) => {
      const next = { ...prev };
      delete next[oldKey];
      if (trimmed) {
        next[newKey] = {
          text: trimmed,
          color: draftColor,
          endHour: draftEndHour,
          repeatAllDays: draftRepeatAllDays,
        };
      }
      return next;
    });
    setEditingKey(null);
    setDraft("");
    setDraftColor("");
    setDraftRepeatAllDays(false);

    if (trimmed) {
      // If the start hour changed, remove the old canonical entry first
      if (oldKey !== newKey && tasks[oldKey]) {
        fetch("/api/timetable", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart: weekStr, cellKey: oldKey }),
        }).catch(console.error);
      }
      fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: weekStr,
          cellKey: newKey,
          task: trimmed,
          color: draftColor,
          endHour: draftEndHour,
          repeatAllDays: draftRepeatAllDays,
        }),
      }).catch(console.error);
    } else if (tasks[oldKey]) {
      fetch("/api/timetable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekStr, cellKey: oldKey }),
      }).catch(console.error);
    }
  }

  function cancel() {
    setEditingKey(null);
    setDraft("");
    setDraftColor("");
    setDraftRepeatAllDays(false);
  }

  function confirmDelete() {
    if (!deletingKey) return;
    const key = deletingKey;
    const weekStr = toDateStr(weekStart);

    setTasks((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDeletingKey(null);

    fetch("/api/timetable", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: weekStr, cellKey: key }),
    }).catch(console.error);
  }

  // End-time options: all slots strictly after the selected start time, up to 20:00
  const endTimeOptions = END_TIME_SLOTS.filter(
    ({ hour, minute }) => hour + minute / 60 > draftStartHour
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Week navigator ── */}
      <nav aria-label="Week navigation" className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekStart((d) => shiftDays(d, -7))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 min-w-[260px] justify-center font-medium"
              aria-label={`Open date picker, week of ${weekLabel}`}
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span aria-hidden="true">{weekLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={weekStart}
              onSelect={(date) => {
                if (date) {
                  setWeekStart(getWeekStart(date));
                  setPickerOpen(false);
                }
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekStart((d) => shiftDays(d, 7))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>

        {!isCurrentWeek && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(getWeekStart(today))}
            aria-label="Go to current week"
          >
            Today
          </Button>
        )}
      </nav>

      {/* ── Timetable grid ── */}
      <div
        className={cn(
          "rounded-xl border overflow-auto transition-opacity",
          isLoading && "opacity-50 pointer-events-none",
        )}
      >
        <table className="border-collapse w-full table-fixed">
          <caption className="sr-only">
            {`Timetable for the week of ${weekLabel}`}
          </caption>
          <colgroup>
            <col style={{ width: "4rem" }} />
            {days.map((_, i) => (
              <col key={i} style={{ width: "140px" }} />
            ))}
          </colgroup>

          {/* Day headers */}
          <thead className="sticky top-0 z-20 bg-background">
            <tr>
              <th
                scope="col"
                aria-label="Time"
                className="sticky left-0 z-30 bg-background border-b border-r"
              />
              {days.map((day, i) => {
                const isToday = isSameDay(day, today);
                const fullDayLabel = fullDayStr(day);
                return (
                  <th
                    key={i}
                    scope="col"
                    aria-label={isToday ? `${fullDayLabel}, today` : fullDayLabel}
                    className={cn(
                      "border-b border-r last:border-r-0 p-2 text-center font-normal select-none",
                      isToday && "bg-primary/5",
                    )}
                  >
                    <p
                      aria-hidden="true"
                      className={cn(
                        "text-[11px] uppercase tracking-wider text-muted-foreground",
                        isToday && "text-primary font-semibold",
                      )}
                    >
                      {day.toLocaleDateString("en-GB", { weekday: "short" })}
                    </p>
                    <div
                      aria-hidden="true"
                      className={cn(
                        "mt-1 mx-auto h-9 w-9 flex items-center justify-center rounded-full text-[18px] font-semibold",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {day.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Half-hour rows */}
          <tbody>
            {TIME_SLOTS.map(({ hour, minute }) => {
              const isHalfHour = minute === 30;
              const nextTotalMin = hour * 60 + minute + 30;
              const nextHour = Math.floor(nextTotalMin / 60);
              const nextMinute = nextTotalMin % 60;
              return (
                <tr key={`${hour}-${minute}`}>
                  <th
                    scope="row"
                    aria-label={`${fmtTime(hour, minute)} to ${fmtTime(nextHour, nextMinute)}`}
                    className={cn(
                      "sticky left-0 z-10 bg-background border-r px-2 align-top select-none font-normal",
                      isHalfHour
                        ? "border-b pt-0 text-[9px] font-mono text-muted-foreground/50 text-right"
                        : "border-b [border-bottom-style:dashed] border-border/60 pt-1 text-[11px] font-mono text-muted-foreground text-right",
                    )}
                  >
                    {/* Only show label on the :00 rows */}
                    {!isHalfHour && (
                      <span aria-hidden="true">{fmtTime(hour, minute)}</span>
                    )}
                  </th>
                  {days.map((day, i) => {
                    const key = cellKey(day, hour, minute);
                    const coverageInfo = coverage[key];
                    const canonicalKey = coverageInfo?.canonicalKey ?? key;
                    const canonicalEntry = coverageInfo
                      ? tasks[coverageInfo.canonicalKey]
                      : undefined;
                    const isContinuation = !!coverageInfo && !coverageInfo.isStart;
                    const displayText = coverageInfo?.isStart
                      ? (canonicalEntry?.text ?? "")
                      : "";
                    const displayColor = canonicalEntry?.color ?? "";

                    const dayName = DAY_NAMES[day.getDay()];
                    const slotStart = fmtTime(hour, minute);
                    const slotEnd = fmtTime(nextHour, nextMinute);
                    const cellAriaLabel = isContinuation
                      ? `${dayName}, ${slotStart} to ${slotEnd}, continuation of ${canonicalEntry?.text ?? "task"}`
                      : displayText
                      ? `${dayName}, ${slotStart} to ${slotEnd}: ${displayText}`
                      : `${dayName}, ${slotStart} to ${slotEnd}, empty`;

                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    const slotMinutes = hour * 60 + minute;
                    const isCurrentSlot =
                      isSameDay(day, now) &&
                      nowMinutes >= slotMinutes &&
                      nowMinutes < slotMinutes + 30;
                    const nowPct = isCurrentSlot
                      ? ((nowMinutes - slotMinutes) / 30) * 100
                      : undefined;

                    return (
                      <TimetableCell
                        key={i}
                        savedText={displayText}
                        savedColor={displayColor}
                        isToday={isSameDay(day, today)}
                        isDark={isDark}
                        cellAriaLabel={cellAriaLabel}
                        nowPct={nowPct}
                        isContinuation={isContinuation}
                        isHalfHour={isHalfHour}
                        onActivate={() => startEdit(canonicalKey)}
                        onDeleteRequest={() => setDeletingKey(canonicalKey)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit task dialog ── */}
      <Dialog
        open={!!editingKey}
        onOpenChange={(open) => { if (!open) cancel(); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingKey && tasks[editingKey] ? "Edit task" : "Add task"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enter a task title, set the time range and repeat option, then save or cancel.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commit(); }
                }}
                placeholder="Add task…"
              />
            </div>

            {/* Time range */}
            <div className="flex flex-col gap-1.5">
              <Label>Time</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={String(draftStartHour)}
                  onValueChange={(v) => {
                    const newStart = Number(v);
                    setDraftStartHour(newStart);
                    setDraftEndHour((prev) => Math.max(prev, newStart + 0.5));
                  }}
                >
                  <SelectTrigger className="flex-1" aria-label="Start time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(({ hour, minute }) => (
                      <SelectItem
                        key={`${hour}-${minute}`}
                        value={String(hour + minute / 60)}
                      >
                        {fmtTime(hour, minute)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-muted-foreground text-sm">to</span>

                <Select
                  value={String(draftEndHour)}
                  onValueChange={(v) => setDraftEndHour(Number(v))}
                >
                  <SelectTrigger className="flex-1" aria-label="End time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {endTimeOptions.map(({ hour, minute }) => (
                      <SelectItem
                        key={`${hour}-${minute}`}
                        value={String(hour + minute / 60)}
                      >
                        {fmtTime(hour, minute)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Repeat every weekday */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="repeat-all-days"
                checked={draftRepeatAllDays}
                onChange={(e) => setDraftRepeatAllDays(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <Label htmlFor="repeat-all-days" className="cursor-pointer font-normal">
                Repeat every weekday
              </Label>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Colour</Label>
              <div className="flex items-center gap-2">
                {/* No-colour option */}
                <button
                  onClick={() => setDraftColor("")}
                  aria-label="No colour"
                  className={cn(
                    "h-6 w-6 rounded-full border-2 bg-background flex items-center justify-center cursor-pointer transition-transform",
                    draftColor === "" ? "border-foreground scale-110" : "border-muted-foreground/40 hover:scale-110",
                  )}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>

                {COLORS.map(({ id, swatch }) => (
                  <button
                    key={id}
                    onClick={() => setDraftColor(id)}
                    aria-label={id}
                    style={{ backgroundColor: swatch }}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform cursor-pointer",
                      draftColor === id
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-110",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={commit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog
        open={!!deletingKey}
        onOpenChange={(open) => { if (!open) setDeletingKey(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingKey(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
