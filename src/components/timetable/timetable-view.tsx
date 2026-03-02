"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
}

// --- Constants ---

const HOUR_SLOTS = Array.from({ length: 14 }, (_, i) => i + 6); // 6…19

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

function fmtHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

/** "monday-09", "friday-14", etc. */
function cellKey(day: Date, hour: number): string {
  const name = day
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toLowerCase();
  return `${name}-${String(hour).padStart(2, "0")}`;
}

// --- Cell ---

interface CellProps {
  savedText: string;
  savedColor: ColorId;
  isToday: boolean;
  isEditing: boolean;
  isDark: boolean;
  cellAriaLabel: string;
  draft: string;
  draftColor: ColorId;
  onActivate: () => void;
  onDraftChange: (v: string) => void;
  onColorChange: (c: ColorId) => void;
  onCommit: () => void;
  onCancel: () => void;
  onDeleteRequest: () => void;
}

function TimetableCell({
  savedText,
  savedColor,
  isToday,
  isEditing,
  isDark,
  cellAriaLabel,
  draft,
  draftColor,
  onActivate,
  onDraftChange,
  onColorChange,
  onCommit,
  onCancel,
  onDeleteRequest,
}: CellProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      autoResize(inputRef.current);
    }
  }, [isEditing]);

  // The active colour (draft while editing, saved otherwise)
  const activeBg = getCellBg(isEditing ? draftColor : savedColor, isDark);

  return (
    <td
      onClick={!isEditing ? onActivate : undefined}
      aria-label={cellAriaLabel}
      style={activeBg ? { backgroundColor: activeBg } : undefined}
      className={cn(
        "relative group border-b border-r last:border-r-0 h-14 p-1 align-top transition-colors",
        !isEditing && "cursor-pointer",
        // Default hover / today tint only when no colour is set
        !activeBg && !isEditing && !isToday && "hover:bg-accent/60",
        !activeBg && !isEditing && isToday && "bg-primary/5 hover:bg-primary/10",
        !activeBg && isToday && isEditing && "bg-primary/5",
        isEditing && "ring-2 ring-inset ring-ring",
      )}
    >
      {isEditing ? (
        <>
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            onChange={(e) => {
              onDraftChange(e.target.value);
              autoResize(e.target);
            }}
            onBlur={onCancel}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onCommit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            placeholder="Add task…"
            className="w-full bg-transparent outline-none text-sm leading-tight placeholder:text-muted-foreground/50 resize-none overflow-hidden"
          />

          {/* Colour swatches */}
          <div className="flex items-center gap-1 mt-1.5">
            {/* No-colour option */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onColorChange(""); }}
              aria-label="No colour"
              className={cn(
                "h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center",
                draftColor === ""
                  ? "border-foreground"
                  : "border-muted-foreground/40",
              )}
            >
              <X className="h-2.5 w-2.5 text-muted-foreground" />
            </button>

            {COLORS.map(({ id, swatch }) => (
              <button
                key={id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); onColorChange(id); }}
                aria-label={id}
                style={{ backgroundColor: swatch }}
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-transform",
                  draftColor === id
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-110",
                )}
              />
            ))}
          </div>
        </>
      ) : savedText ? (
        <>
          <p
            className={cn(
              "text-xs font-medium leading-snug break-words pr-6",
              // Only show the default pill style when there's no background colour
              !savedColor && "px-1.5 py-1 rounded-md bg-primary/15 text-primary",
            )}
          >
            {savedText}
          </p>

          <button
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Delete entry"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </>
      ) : null}
    </td>
  );
}

// --- Main view ---

export default function TimetableView() {
  const today = new Date();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [pickerOpen, setPickerOpen] = useState(false);

  const [tasks, setTasks] = useState<Record<string, Entry>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftColor, setDraftColor] = useState<ColorId>("");
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

  function startEdit(key: string) {
    setEditingKey(key);
    setDraft(tasks[key]?.text ?? "");
    setDraftColor(tasks[key]?.color ?? "");
  }

  function commit() {
    if (!editingKey) return;
    const trimmed = draft.trim();
    const key = editingKey;
    const weekStr = toDateStr(weekStart);

    // Optimistic update
    setTasks((prev) => {
      if (!trimmed) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { text: trimmed, color: draftColor } };
    });
    setEditingKey(null);
    setDraft("");
    setDraftColor("");

    // Persist
    if (trimmed) {
      fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: weekStr,
          cellKey: key,
          task: trimmed,
          color: draftColor,
        }),
      }).catch(console.error);
    } else if (tasks[key]) {
      fetch("/api/timetable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekStr, cellKey: key }),
      }).catch(console.error);
    }
  }

  function cancel() {
    setEditingKey(null);
    setDraft("");
    setDraftColor("");
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

          {/* Hour rows */}
          <tbody>
            {HOUR_SLOTS.map((hour) => (
              <tr key={hour}>
                <th
                  scope="row"
                  aria-label={`${fmtHour(hour)} to ${fmtHour(hour + 1)}`}
                  className="sticky left-0 z-10 bg-background border-b border-r px-2 pt-1 text-[11px] font-mono text-muted-foreground text-right align-top select-none font-normal"
                >
                  <span aria-hidden="true">{fmtHour(hour)}</span>
                </th>
                {days.map((day, i) => {
                  const key = cellKey(day, hour);
                  const taskText = tasks[key]?.text;
                  const dayName = DAY_NAMES[day.getDay()];
                  const cellAriaLabel = taskText
                    ? `${dayName}, ${fmtHour(hour)} to ${fmtHour(hour + 1)}: ${taskText}`
                    : `${dayName}, ${fmtHour(hour)} to ${fmtHour(hour + 1)}, empty`;
                  return (
                    <TimetableCell
                      key={i}
                      savedText={taskText ?? ""}
                      savedColor={tasks[key]?.color ?? ""}
                      isToday={isSameDay(day, today)}
                      isEditing={editingKey === key}
                      isDark={isDark}
                      cellAriaLabel={cellAriaLabel}
                      draft={draft}
                      draftColor={draftColor}
                      onActivate={() => startEdit(key)}
                      onDraftChange={setDraft}
                      onColorChange={setDraftColor}
                      onCommit={commit}
                      onCancel={cancel}
                      onDeleteRequest={() => setDeletingKey(key)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
