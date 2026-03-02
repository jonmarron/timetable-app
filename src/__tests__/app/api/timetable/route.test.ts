/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/app/api/timetable/route";
import { createClient } from "@/lib/supabase/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/supabase/server");

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(
  method: string,
  url: string,
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

function mockClient(overrides: {
  user?: object | null;
  selectData?: object[];
  selectError?: object | null;
  upsertError?: object | null;
  deleteError?: object | null;
}) {
  const {
    user = { id: "user-1", email: "a@b.com" },
    selectData = [],
    selectError = null,
    upsertError = null,
    deleteError = null,
  } = overrides;

  const client = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ error: upsertError }),
      delete: jest.fn().mockReturnThis(),
      then: undefined,
      // The final .eq() in a chain must resolve
    }),
  };

  // Make chained .select().eq().eq() resolve properly
  const chainResult: Promise<{ data: object[]; error: object | null }> =
    Promise.resolve({ data: selectData, error: selectError });

  // Override the from().select()...eq() chain to resolve with selectData
  client.from.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: selectData, error: selectError }),
        // For single .eq() calls (GET route)
        then: (resolve: (v: typeof chainResult) => void) =>
          chainResult.then(resolve),
      }),
      then: (resolve: (v: typeof chainResult) => void) =>
        chainResult.then(resolve),
    }),
    upsert: jest.fn().mockResolvedValue({ error: upsertError }),
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: deleteError }),
      }),
    }),
  });

  (createClient as jest.Mock).mockResolvedValue(client);
  return client;
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ── GET ────────────────────────────────────────────────────────────────────

describe("GET /api/timetable", () => {
  it("returns 400 when weekStart is missing", async () => {
    mockClient({});
    const req = makeRequest("GET", "http://localhost/api/timetable");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/weekStart/);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockClient({ user: null });
    const req = makeRequest(
      "GET",
      "http://localhost/api/timetable?weekStart=2025-03-03"
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns entries keyed by cell_key for an authenticated user", async () => {
    mockClient({
      selectData: [
        { cell_key: "monday-09", task: "Stand-up", color: "blue" },
        { cell_key: "tuesday-10", task: "Review", color: "" },
      ],
    });
    const req = makeRequest(
      "GET",
      "http://localhost/api/timetable?weekStart=2025-03-03"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries["monday-09"]).toEqual({ text: "Stand-up", color: "blue" });
    expect(body.entries["tuesday-10"]).toEqual({ text: "Review", color: "" });
  });

  it("returns 500 when the database query fails", async () => {
    mockClient({ selectError: { message: "DB error" } });
    const req = makeRequest(
      "GET",
      "http://localhost/api/timetable?weekStart=2025-03-03"
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ── POST ───────────────────────────────────────────────────────────────────

describe("POST /api/timetable", () => {
  it("returns 401 when the user is not authenticated", async () => {
    mockClient({ user: null });
    const req = makeRequest("POST", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
      cellKey: "monday-09",
      task: "Stand-up",
      color: "",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    mockClient({});
    const req = makeRequest("POST", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when task is whitespace-only", async () => {
    mockClient({});
    const req = makeRequest("POST", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
      cellKey: "monday-09",
      task: "   ",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 ok for a valid upsert", async () => {
    mockClient({});
    const req = makeRequest("POST", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
      cellKey: "monday-09",
      task: "Stand-up",
      color: "blue",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 500 when the upsert fails", async () => {
    mockClient({ upsertError: { message: "constraint violation" } });
    const req = makeRequest("POST", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
      cellKey: "monday-09",
      task: "Stand-up",
      color: "",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ── DELETE ─────────────────────────────────────────────────────────────────

describe("DELETE /api/timetable", () => {
  it("returns 401 when the user is not authenticated", async () => {
    mockClient({ user: null });
    const req = makeRequest("DELETE", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
      cellKey: "monday-09",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when weekStart is missing", async () => {
    mockClient({});
    const req = makeRequest("DELETE", "http://localhost/api/timetable", {
      cellKey: "monday-09",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when cellKey is missing", async () => {
    mockClient({});
    const req = makeRequest("DELETE", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 ok for a valid delete", async () => {
    mockClient({});
    const req = makeRequest("DELETE", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
      cellKey: "monday-09",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 500 when the delete query fails", async () => {
    mockClient({ deleteError: { message: "DB error" } });
    const req = makeRequest("DELETE", "http://localhost/api/timetable", {
      weekStart: "2025-03-03",
      cellKey: "monday-09",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });
});
