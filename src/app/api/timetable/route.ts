import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/timetable?weekStart=YYYY-MM-DD
// Returns { entries: Record<string, { text: string; color: string }> }
export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart");

  if (!weekStart) {
    return NextResponse.json(
      { error: "weekStart query param is required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("timetable_entries")
    .select("cell_key, task, color")
    .eq("week_start", weekStart);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries: Record<string, { text: string; color: string }> = {};
  for (const row of data) {
    entries[row.cell_key] = { text: row.task, color: row.color ?? "" };
  }

  return NextResponse.json({ entries });
}

// POST /api/timetable
// Body: { weekStart: string, cellKey: string, task: string, color: string }
// Upserts a single entry
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { weekStart, cellKey, task, color } = body as {
    weekStart?: string;
    cellKey?: string;
    task?: string;
    color?: string;
  };

  if (!weekStart || !cellKey || !task?.trim()) {
    return NextResponse.json(
      { error: "weekStart, cellKey, and task are required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.from("timetable_entries").upsert(
    {
      week_start: weekStart,
      cell_key: cellKey,
      task: task.trim(),
      color: color ?? "",
    },
    { onConflict: "week_start,cell_key" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/timetable
// Body: { weekStart: string, cellKey: string }
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { weekStart, cellKey } = body as {
    weekStart?: string;
    cellKey?: string;
  };

  if (!weekStart || !cellKey) {
    return NextResponse.json(
      { error: "weekStart and cellKey are required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("timetable_entries")
    .delete()
    .eq("week_start", weekStart)
    .eq("cell_key", cellKey);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
