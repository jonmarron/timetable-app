import { signIn, signUp, signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

// Pull the mocked redirect so we can assert on it
const { redirect } = jest.requireMock("next/navigation") as {
  redirect: jest.Mock;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function mockSupabase(
  authOverrides: Record<string, jest.Mock> = {}
): jest.Mock {
  const client = {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      ...authOverrides,
    },
  };
  (createClient as jest.Mock).mockResolvedValue(client);
  return createClient as jest.Mock;
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── signIn ─────────────────────────────────────────────────────────────────

describe("signIn", () => {
  it("returns an error when email is missing", async () => {
    mockSupabase();
    const result = await signIn(null, makeFormData({ password: "pass123" }));
    expect(result).toBe("Email and password are required.");
  });

  it("returns an error when password is missing", async () => {
    mockSupabase();
    const result = await signIn(
      null,
      makeFormData({ email: "a@b.com", password: "" })
    );
    expect(result).toBe("Email and password are required.");
  });

  it("returns the Supabase error message on failed sign-in", async () => {
    mockSupabase({
      signInWithPassword: jest
        .fn()
        .mockResolvedValue({ error: { message: "Invalid login credentials" } }),
    });
    const result = await signIn(
      null,
      makeFormData({ email: "a@b.com", password: "wrongpass" })
    );
    expect(result).toBe("Invalid login credentials");
  });

  it("calls signInWithPassword with trimmed email and password", async () => {
    const spy = jest.fn().mockResolvedValue({ error: null });
    mockSupabase({ signInWithPassword: spy });

    await signIn(
      null,
      makeFormData({ email: "  a@b.com  ", password: "pass123" })
    );

    expect(spy).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pass123",
    });
  });

  it("redirects to / on successful sign-in", async () => {
    mockSupabase();
    await signIn(
      null,
      makeFormData({ email: "a@b.com", password: "pass123" })
    );
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("redirects to / and returns no error string on valid credentials", async () => {
    mockSupabase();
    const result = await signIn(
      null,
      makeFormData({ email: "a@b.com", password: "pass123" })
    );
    // In production redirect() throws (never returns). In tests it's mocked,
    // so the function falls off the end and result is undefined — not an error string.
    expect(typeof result === "string").toBe(false);
    expect(redirect).toHaveBeenCalledWith("/");
  });
});

// ── signUp ─────────────────────────────────────────────────────────────────

describe("signUp", () => {
  it("returns an error when email is missing", async () => {
    mockSupabase();
    const result = await signUp(null, makeFormData({ password: "pass123" }));
    expect(result).toBe("Email and password are required.");
  });

  it("returns an error when password is missing", async () => {
    mockSupabase();
    const result = await signUp(
      null,
      makeFormData({ email: "a@b.com", password: "" })
    );
    expect(result).toBe("Email and password are required.");
  });

  it("returns an error when password is shorter than 6 characters", async () => {
    mockSupabase();
    const result = await signUp(
      null,
      makeFormData({ email: "a@b.com", password: "abc" })
    );
    expect(result).toBe("Password must be at least 6 characters.");
  });

  it("accepts a password of exactly 6 characters", async () => {
    const spy = jest.fn().mockResolvedValue({ error: null });
    mockSupabase({ signUp: spy });

    const result = await signUp(
      null,
      makeFormData({ email: "a@b.com", password: "abc123" })
    );

    expect(spy).toHaveBeenCalled();
    // redirect() is mocked (doesn't throw), so no error string is returned
    expect(typeof result === "string").toBe(false);
  });

  it("returns the Supabase error message on failed sign-up", async () => {
    mockSupabase({
      signUp: jest
        .fn()
        .mockResolvedValue({ error: { message: "User already registered" } }),
    });
    const result = await signUp(
      null,
      makeFormData({ email: "a@b.com", password: "pass123" })
    );
    expect(result).toBe("User already registered");
  });

  it("redirects to / on successful sign-up", async () => {
    mockSupabase();
    await signUp(
      null,
      makeFormData({ email: "new@user.com", password: "pass123" })
    );
    expect(redirect).toHaveBeenCalledWith("/");
  });
});

// ── signOut ────────────────────────────────────────────────────────────────

describe("signOut", () => {
  it("calls supabase.auth.signOut()", async () => {
    const spy = jest.fn().mockResolvedValue({ error: null });
    mockSupabase({ signOut: spy });

    await signOut();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("redirects to /login after sign-out", async () => {
    mockSupabase();
    await signOut();
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
