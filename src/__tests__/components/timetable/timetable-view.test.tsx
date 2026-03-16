import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimetableView from "@/components/timetable/timetable-view";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUseTheme = jest.fn();

jest.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/** Wait until the initial fetch resolves and loading state clears. */
async function renderAndLoad(
  entries: Record<string, { text: string; color: string; endHour?: number; repeatAllDays?: boolean }> = {}
) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    json: async () => ({ entries }),
  });
  render(<TimetableView />);
  // Wait for the GET request to have been made, then flush state
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  // Give React a tick to process the setState from the resolved promise
  await waitFor(() =>
    expect(
      (global.fetch as jest.Mock).mock.calls[0][0]
    ).toMatch(/\/api\/timetable\?weekStart=/)
  );
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  mockUseTheme.mockReturnValue({ resolvedTheme: "light" });
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => ({ entries: {} }),
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("TimetableView", () => {
  // ── Grid structure ───────────────────────────────────────────────────────

  describe("grid structure", () => {
    it("renders a table with a screen-reader caption", async () => {
      await renderAndLoad();
      expect(screen.getByRole("table")).toBeInTheDocument();
      // Caption is visually hidden but accessible
      expect(
        screen.getByText(/Timetable for the week of/)
      ).toBeInTheDocument();
    });

    it("renders exactly 6 column headers (time + 5 weekdays)", async () => {
      await renderAndLoad();
      const colHeaders = screen.getAllByRole("columnheader");
      expect(colHeaders).toHaveLength(6);
    });

    it("renders exactly 28 half-hour row headers (06:00–19:30)", async () => {
      await renderAndLoad();
      const rowHeaders = screen.getAllByRole("rowheader");
      expect(rowHeaders).toHaveLength(28);
    });

    it("labels the first slot 06:00 to 06:30", async () => {
      await renderAndLoad();
      const rowHeaders = screen.getAllByRole("rowheader");
      expect(rowHeaders[0]).toHaveAccessibleName("06:00 to 06:30");
    });

    it("labels the second slot 06:30 to 07:00", async () => {
      await renderAndLoad();
      const rowHeaders = screen.getAllByRole("rowheader");
      expect(rowHeaders[1]).toHaveAccessibleName("06:30 to 07:00");
    });

    it("labels the last slot 19:30 to 20:00", async () => {
      await renderAndLoad();
      const rowHeaders = screen.getAllByRole("rowheader");
      expect(rowHeaders[rowHeaders.length - 1]).toHaveAccessibleName(
        "19:30 to 20:00"
      );
    });

    it("marks the first column header as the time axis", async () => {
      await renderAndLoad();
      expect(
        screen.getByRole("columnheader", { name: "Time" })
      ).toBeInTheDocument();
    });

    it("labels day columns with full day names", async () => {
      await renderAndLoad();
      // The week always starts on Monday
      expect(
        screen.getAllByRole("columnheader", { name: /Monday/ }).length
      ).toBeGreaterThanOrEqual(1);
    });

    it(":30 rows have data-halfhour attribute (solid o'clock border)", async () => {
      await renderAndLoad();
      // 14 half-hour (:30) rows × 5 day cells = 70 cells with data-halfhour
      const halfHourCells = document.querySelectorAll('[data-halfhour="true"]');
      expect(halfHourCells.length).toBe(70);
    });

    it(":00 rows do not have data-halfhour attribute (dashed half-hour separator)", async () => {
      await renderAndLoad();
      const cells = screen.getAllByRole("cell");
      const halfHourCells = cells.filter(
        (c) => c.getAttribute("data-halfhour") === "true"
      );
      const fullHourCells = cells.filter(
        (c) => c.getAttribute("data-halfhour") !== "true"
      );
      // 14 :30 rows + 14 :00 rows, each with 5 day cells
      expect(halfHourCells.length).toBe(70);
      expect(fullHourCells.length).toBe(70);
    });
  });

  // ── API loading ──────────────────────────────────────────────────────────

  describe("API loading", () => {
    it("fetches the current week on mount", async () => {
      await renderAndLoad();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/timetable\?weekStart=\d{4}-\d{2}-\d{2}/)
      );
    });

    it("renders a saved entry returned from the API", async () => {
      await renderAndLoad({ "monday-0900": { text: "Team meeting", color: "" } });
      await waitFor(() =>
        expect(screen.getByText("Team meeting")).toBeInTheDocument()
      );
    });

    it("fetches again when the week changes", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      // Add a second mock for the next fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({ entries: {} }),
      });
      await user.click(screen.getByRole("button", { name: "Next week" }));
      await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledTimes(2)
      );
    });
  });

  // ── Week navigation ──────────────────────────────────────────────────────

  describe("week navigation", () => {
    it("renders the week navigator landmark", async () => {
      await renderAndLoad();
      expect(
        screen.getByRole("navigation", { name: "Week navigation" })
      ).toBeInTheDocument();
    });

    it("renders Previous week and Next week buttons", async () => {
      await renderAndLoad();
      expect(
        screen.getByRole("button", { name: "Previous week" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Next week" })
      ).toBeInTheDocument();
    });

    it("hides the Today button when already on the current week", async () => {
      await renderAndLoad();
      expect(
        screen.queryByRole("button", { name: "Go to current week" })
      ).not.toBeInTheDocument();
    });

    it("shows the Today button after navigating away", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      await user.click(screen.getByRole("button", { name: "Next week" }));
      expect(
        screen.getByRole("button", { name: "Go to current week" })
      ).toBeInTheDocument();
    });

    it("clicking Today returns to the current week", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      const originalLabel = screen
        .getByRole("button", { name: /Open date picker/ })
        .getAttribute("aria-label");

      await user.click(screen.getByRole("button", { name: "Next week" }));
      await user.click(
        screen.getByRole("button", { name: "Go to current week" })
      );

      expect(
        screen.getByRole("button", { name: /Open date picker/ })
      ).toHaveAttribute("aria-label", originalLabel);
    });

    it("changes the week label when navigating to the previous week", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      const before = screen
        .getByRole("button", { name: /Open date picker/ })
        .getAttribute("aria-label");

      await user.click(screen.getByRole("button", { name: "Previous week" }));

      const after = screen
        .getByRole("button", { name: /Open date picker/ })
        .getAttribute("aria-label");
      expect(after).not.toBe(before);
    });
  });

  // ── Cell editing ─────────────────────────────────────────────────────────

  describe("cell editing", () => {
    it("clicking an empty cell shows a textarea", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      const cell = screen.getByRole("cell", {
        name: /Monday, 06:00 to 06:30/,
      });
      await user.click(cell);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Add task…")).toBeInTheDocument();
    });

    it("shows time selects and repeat checkbox while editing", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      expect(screen.getByRole("combobox", { name: "Start time" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "End time" })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /Repeat every weekday/ })).toBeInTheDocument();
    });

    it("start time defaults to the clicked cell hour", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 09:00 to 09:30, empty/ })
      );
      const startTrigger = screen.getByRole("combobox", { name: "Start time" });
      expect(startTrigger).toHaveTextContent("09:00");
    });

    it("start time defaults to the clicked cell half-hour", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 09:30 to 10:00, empty/ })
      );
      const startTrigger = screen.getByRole("combobox", { name: "Start time" });
      expect(startTrigger).toHaveTextContent("09:30");
    });

    it("end time defaults to start time + 30 minutes", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 09:00 to 09:30, empty/ })
      );
      const endTrigger = screen.getByRole("combobox", { name: "End time" });
      expect(endTrigger).toHaveTextContent("09:30");
    });

    it("end time defaults to start time + 30 minutes from a :30 slot", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 09:30 to 10:00, empty/ })
      );
      const endTrigger = screen.getByRole("combobox", { name: "End time" });
      expect(endTrigger).toHaveTextContent("10:00");
    });

    it("shows colour swatches while editing", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      expect(
        screen.getByRole("button", { name: "No colour" })
      ).toBeInTheDocument();
      for (const colour of ["green", "blue", "yellow", "orange", "red"]) {
        expect(
          screen.getByRole("button", { name: colour })
        ).toBeInTheDocument();
      }
    });

    it("pressing Enter commits the draft text", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      await user.type(screen.getByRole("textbox"), "Stand-up");
      await user.keyboard("{Enter}");

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.getByText("Stand-up")).toBeInTheDocument();
    });

    it("pressing Escape discards the draft", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      await user.type(screen.getByRole("textbox"), "Discarded");
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByText("Discarded")).not.toBeInTheDocument();
    });

    it("committing an empty draft on a new cell does not add an entry", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      // Leave textarea empty, press Enter
      await user.keyboard("{Enter}");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      // No text content should have been added
      expect(
        screen.queryByRole("cell", {
          name: /Monday, 06:00 to 06:30: /,
        })
      ).not.toBeInTheDocument();
    });

    it("POST is called with the task text after committing", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      await user.type(screen.getByRole("textbox"), "Deep work");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        const calls = (global.fetch as jest.Mock).mock.calls;
        const postCall = calls.find(
          ([, opts]: [string, RequestInit]) => opts?.method === "POST"
        );
        expect(postCall).toBeDefined();
        expect(postCall[1].body).toContain('"task":"Deep work"');
      });
    });

    it("POST cellKey uses HHMM format", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      await user.type(screen.getByRole("textbox"), "Early task");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        const calls = (global.fetch as jest.Mock).mock.calls;
        const postCall = calls.find(
          ([, opts]: [string, RequestInit]) => opts?.method === "POST"
        );
        expect(postCall).toBeDefined();
        expect(postCall[1].body).toContain("monday-0600");
      });
    });

    it("POST body includes endHour and repeatAllDays", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      await user.type(screen.getByRole("textbox"), "Morning block");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        const calls = (global.fetch as jest.Mock).mock.calls;
        const postCall = calls.find(
          ([, opts]: [string, RequestInit]) => opts?.method === "POST"
        );
        expect(postCall).toBeDefined();
        expect(postCall[1].body).toContain('"endHour"');
        expect(postCall[1].body).toContain('"repeatAllDays"');
      });
    });

    it("selecting a colour is included in the POST body", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 06:30/ })
      );
      await user.type(screen.getByRole("textbox"), "Coloured task");

      // Use fireEvent to click the colour swatch — avoids blur because the
      // real browser's mousedown preventDefault is not wired in jsdom.
      fireEvent.mouseDown(screen.getByRole("button", { name: "blue" }), {
        preventDefault: () => undefined,
      });
      fireEvent.click(screen.getByRole("button", { name: "blue" }));

      await user.keyboard("{Enter}");

      await waitFor(() => {
        const calls = (global.fetch as jest.Mock).mock.calls;
        const postCall = calls.find(
          ([, opts]: [string, RequestInit]) => opts?.method === "POST"
        );
        expect(postCall).toBeDefined();
        expect(postCall[1].body).toContain('"color":"blue"');
      });
    });
  });

  // ── Entry display ────────────────────────────────────────────────────────

  describe("entry display", () => {
    it("shows the saved task text in the cell", async () => {
      await renderAndLoad({ "monday-0900": { text: "Yoga", color: "" } });
      await waitFor(() => expect(screen.getByText("Yoga")).toBeInTheDocument());
    });

    it("shows a delete button on a cell that has an entry", async () => {
      await renderAndLoad({ "monday-0900": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));
      expect(
        screen.getByRole("button", { name: "Delete entry" })
      ).toBeInTheDocument();
    });

    it("clicking a cell with an existing entry pre-fills the textarea", async () => {
      const user = userEvent.setup();
      await renderAndLoad({ "monday-0900": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));
      await user.click(
        screen.getByRole("cell", { name: /Monday, 09:00 to 09:30/ })
      );
      expect(screen.getByRole("textbox")).toHaveValue("Yoga");
    });
  });

  // ── Multi-slot spanning ──────────────────────────────────────────────────

  describe("multi-slot task spanning", () => {
    it("shows task text only in the first slot", async () => {
      await renderAndLoad({
        "monday-0900": { text: "Deep work", color: "blue", endHour: 11 },
      });
      await waitFor(() => expect(screen.getByText("Deep work")).toBeInTheDocument());
      // Text appears exactly once
      expect(screen.getAllByText("Deep work")).toHaveLength(1);
    });

    it("labels the first slot with the task text", async () => {
      await renderAndLoad({
        "monday-0900": { text: "Deep work", color: "blue", endHour: 11 },
      });
      await waitFor(() => screen.getByText("Deep work"));
      expect(
        screen.getByRole("cell", { name: /Monday, 09:00 to 09:30: Deep work/ })
      ).toBeInTheDocument();
    });

    it("labels subsequent slots as continuations", async () => {
      await renderAndLoad({
        "monday-0900": { text: "Deep work", color: "blue", endHour: 11 },
      });
      await waitFor(() => screen.getByText("Deep work"));
      // Multiple continuation cells (09:30, 10:00, 10:30)
      expect(
        screen.getByRole("cell", { name: /Monday, 09:30 to 10:00, continuation of Deep work/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("cell", { name: /Monday, 10:00 to 10:30, continuation of Deep work/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("cell", { name: /Monday, 10:30 to 11:00, continuation of Deep work/ })
      ).toBeInTheDocument();
    });

    it("does not show a delete button on continuation cells", async () => {
      await renderAndLoad({
        "monday-0900": { text: "Deep work", color: "blue", endHour: 11 },
      });
      await waitFor(() => screen.getByText("Deep work"));
      // Only one delete button (on the start cell), not on continuations
      expect(screen.getAllByRole("button", { name: "Delete entry" })).toHaveLength(1);
    });

    it("clicking a continuation cell opens the edit dialog for the canonical task", async () => {
      const user = userEvent.setup();
      await renderAndLoad({
        "monday-0900": { text: "Deep work", color: "blue", endHour: 11 },
      });
      await waitFor(() => screen.getByText("Deep work"));
      const continuationCell = screen.getByRole("cell", {
        name: /Monday, 09:30 to 10:00, continuation of Deep work/,
      });
      await user.click(continuationCell);
      expect(screen.getByRole("textbox")).toHaveValue("Deep work");
    });

    it("start and end time selects are pre-filled when editing a multi-slot task", async () => {
      const user = userEvent.setup();
      await renderAndLoad({
        "monday-0900": { text: "Deep work", color: "", endHour: 11 },
      });
      await waitFor(() => screen.getByText("Deep work"));
      await user.click(
        screen.getByRole("cell", { name: /Monday, 09:00 to 09:30: Deep work/ })
      );
      expect(
        screen.getByRole("combobox", { name: "Start time" })
      ).toHaveTextContent("09:00");
      expect(
        screen.getByRole("combobox", { name: "End time" })
      ).toHaveTextContent("11:00");
    });

    it("tasks with half-hour start time span correctly", async () => {
      await renderAndLoad({
        "monday-0930": { text: "Half-hour start", color: "", endHour: 10.5 },
      });
      await waitFor(() => screen.getByText("Half-hour start"));
      // Spans 09:30–10:30 (2 half-hour slots)
      expect(
        screen.getByRole("cell", { name: /Monday, 09:30 to 10:00: Half-hour start/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("cell", { name: /Monday, 10:00 to 10:30, continuation of Half-hour start/ })
      ).toBeInTheDocument();
    });
  });

  // ── Repeat every weekday ─────────────────────────────────────────────────

  describe("repeat every weekday", () => {
    it("shows a repeating task in all 5 weekday columns", async () => {
      await renderAndLoad({
        "monday-0900": { text: "Daily standup", color: "", repeatAllDays: true },
      });
      await waitFor(() =>
        expect(screen.getAllByText("Daily standup")).toHaveLength(5)
      );
    });

    it("each weekday shows the task text in the correct half-hour row", async () => {
      await renderAndLoad({
        "monday-0900": { text: "Standup", color: "", repeatAllDays: true },
      });
      await waitFor(() => screen.getAllByText("Standup"));
      // Monday, Tuesday, Wednesday, Thursday, Friday — all at 09:00-09:30
      for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
        expect(
          screen.getByRole("cell", { name: new RegExp(`${day}, 09:00 to 09:30: Standup`) })
        ).toBeInTheDocument();
      }
    });

    it("clicking any repeated cell opens the edit dialog with repeatAllDays checked", async () => {
      const user = userEvent.setup();
      await renderAndLoad({
        "monday-0900": { text: "Standup", color: "", repeatAllDays: true },
      });
      await waitFor(() => screen.getAllByText("Standup"));
      await user.click(
        screen.getByRole("cell", { name: /Wednesday, 09:00 to 09:30: Standup/ })
      );
      const checkbox = screen.getByRole("checkbox", { name: /Repeat every weekday/ });
      expect(checkbox).toBeChecked();
      expect(screen.getByRole("textbox")).toHaveValue("Standup");
    });

    it("delete on a repeated task deletes the canonical entry", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad({
        "monday-0900": { text: "Standup", color: "", repeatAllDays: true },
      });
      await waitFor(() => screen.getAllByText("Standup"));

      // Click delete on Monday (first visible delete button)
      const deleteButtons = screen.getAllByRole("button", { name: "Delete entry" });
      await user.click(deleteButtons[0]);
      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(screen.queryByText("Standup")).not.toBeInTheDocument()
      );

      // The DELETE request should reference the canonical key
      const calls = (global.fetch as jest.Mock).mock.calls;
      const deleteCall = calls.find(
        ([, opts]: [string, RequestInit]) => opts?.method === "DELETE"
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall[1].body).toContain("monday-0900");
    });

    it("multi-slot repeated task shows continuations on each weekday", async () => {
      await renderAndLoad({
        "monday-0900": {
          text: "Focus block",
          color: "green",
          endHour: 11,
          repeatAllDays: true,
        },
      });
      await waitFor(() =>
        expect(screen.getAllByText("Focus block")).toHaveLength(5)
      );
      // There should be continuation cells for 09:30 on each day
      for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
        expect(
          screen.getByRole("cell", {
            name: new RegExp(`${day}, 09:30 to 10:00, continuation of Focus block`),
          })
        ).toBeInTheDocument();
      }
    });

    it("non-repeating task at the same slot takes precedence over a repeating one", async () => {
      await renderAndLoad({
        // Repeating task owned by Monday
        "monday-0900": { text: "Standup", color: "", repeatAllDays: true },
        // Specific task on Wednesday at the same slot
        "wednesday-0900": { text: "1:1 meeting", color: "blue" },
      });
      await waitFor(() => screen.getByText("1:1 meeting"));
      // Wednesday should show the specific task, not the repeated one
      expect(
        screen.getByRole("cell", { name: /Wednesday, 09:00 to 09:30: 1:1 meeting/ })
      ).toBeInTheDocument();
      // Standup should appear only on the 4 remaining days
      expect(screen.getAllByText("Standup")).toHaveLength(4);
    });
  });

  // ── Delete flow ───────────────────────────────────────────────────────────

  describe("delete flow", () => {
    it("clicking the delete button opens a confirmation dialog", async () => {
      const user = userEvent.setup();
      await renderAndLoad({ "monday-0900": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));

      await user.click(screen.getByRole("button", { name: "Delete entry" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
    });

    it("confirming deletion removes the entry from the grid", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad({ "monday-0900": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));

      await user.click(screen.getByRole("button", { name: "Delete entry" }));
      await user.click(
        screen.getByRole("button", { name: "Delete" })
      );

      await waitFor(() =>
        expect(screen.queryByText("Yoga")).not.toBeInTheDocument()
      );
    });

    it("confirming deletion sends a DELETE request to the API", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad({ "monday-0900": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));

      await user.click(screen.getByRole("button", { name: "Delete entry" }));
      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        const calls = (global.fetch as jest.Mock).mock.calls;
        const deleteCall = calls.find(
          ([, opts]: [string, RequestInit]) => opts?.method === "DELETE"
        );
        expect(deleteCall).toBeDefined();
        expect(deleteCall[1].body).toContain('"cellKey"');
      });
    });

    it("cancelling the dialog keeps the entry", async () => {
      const user = userEvent.setup();
      await renderAndLoad({ "monday-0900": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));

      await user.click(screen.getByRole("button", { name: "Delete entry" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByText("Yoga")).toBeInTheDocument();
    });

    it("cancelling the dialog sends no DELETE request", async () => {
      const user = userEvent.setup();
      await renderAndLoad({ "monday-0900": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));

      const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
      await user.click(screen.getByRole("button", { name: "Delete entry" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    });
  });

  // ── Dark mode ─────────────────────────────────────────────────────────────

  describe("dark mode", () => {
    it("renders without errors in dark mode", async () => {
      mockUseTheme.mockReturnValue({ resolvedTheme: "dark" });
      await renderAndLoad({
        "monday-0900": { text: "Dark task", color: "blue" },
      });
      await waitFor(() =>
        expect(screen.getByText("Dark task")).toBeInTheDocument()
      );
    });
  });

  // ── Current time indicator ────────────────────────────────────────────────

  describe("current time indicator", () => {
    // 2026-03-02 is a Monday — within the grid range
    const MONDAY_10_30 = new Date("2026-03-02T10:30:00");
    const MONDAY_10_00 = new Date("2026-03-02T10:00:00");
    const MONDAY_05_59 = new Date("2026-03-02T05:59:00");
    const MONDAY_20_00 = new Date("2026-03-02T20:00:00");

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("renders the indicator when viewing the current week", async () => {
      jest.setSystemTime(MONDAY_10_30);
      await renderAndLoad();
      expect(
        screen.getByTestId("current-time-indicator")
      ).toBeInTheDocument();
    });

    it("positions the indicator at 0% at the start of the 10:30 slot", async () => {
      // At 10:30 exactly, we're at the start of the 10:30–11:00 slot
      jest.setSystemTime(MONDAY_10_30);
      await renderAndLoad();
      expect(screen.getByTestId("current-time-indicator")).toHaveStyle(
        "top: 0%"
      );
    });

    it("positions the indicator at 0% at the exact start of an hour slot", async () => {
      jest.setSystemTime(MONDAY_10_00);
      await renderAndLoad();
      expect(screen.getByTestId("current-time-indicator")).toHaveStyle(
        "top: 0%"
      );
    });

    it("positions the indicator at 50% at 15 minutes into a 30-min slot", async () => {
      // 10:15 → 15 min into the 10:00 slot → 15/30 = 50%
      jest.setSystemTime(new Date("2026-03-02T10:15:00"));
      await renderAndLoad();
      expect(screen.getByTestId("current-time-indicator")).toHaveStyle(
        "top: 50%"
      );
    });

    it("does not render before the grid range (before 06:00)", async () => {
      jest.setSystemTime(MONDAY_05_59);
      await renderAndLoad();
      expect(
        screen.queryByTestId("current-time-indicator")
      ).not.toBeInTheDocument();
    });

    it("does not render after the grid range (20:00 or later)", async () => {
      jest.setSystemTime(MONDAY_20_00);
      await renderAndLoad();
      expect(
        screen.queryByTestId("current-time-indicator")
      ).not.toBeInTheDocument();
    });

    it("does not render when viewing a different week", async () => {
      jest.setSystemTime(MONDAY_10_30);
      const user = userEvent.setup({
        advanceTimers: jest.advanceTimersByTime,
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      await user.click(screen.getByRole("button", { name: "Next week" }));
      expect(
        screen.queryByTestId("current-time-indicator")
      ).not.toBeInTheDocument();
    });

    it("updates position after one minute elapses", async () => {
      // Start at 10:14 so that advancing 60s lands at 10:15 → 50% in the 10:00 slot
      jest.setSystemTime(new Date("2026-03-02T10:14:00"));
      await renderAndLoad();
      expect(screen.getByTestId("current-time-indicator")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      await waitFor(() =>
        expect(screen.getByTestId("current-time-indicator")).toHaveStyle(
          "top: 50%"
        )
      );
    });
  });
});
