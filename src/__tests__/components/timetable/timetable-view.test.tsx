import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
  entries: Record<string, { text: string; color: string }> = {}
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

    it("renders exactly 14 hour-row headers (06:00–19:00)", async () => {
      await renderAndLoad();
      const rowHeaders = screen.getAllByRole("rowheader");
      expect(rowHeaders).toHaveLength(14);
    });

    it("labels the first hour slot 06:00 to 07:00", async () => {
      await renderAndLoad();
      const rowHeaders = screen.getAllByRole("rowheader");
      expect(rowHeaders[0]).toHaveAccessibleName("06:00 to 07:00");
    });

    it("labels the last hour slot 19:00 to 20:00", async () => {
      await renderAndLoad();
      const rowHeaders = screen.getAllByRole("rowheader");
      expect(rowHeaders[rowHeaders.length - 1]).toHaveAccessibleName(
        "19:00 to 20:00"
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
      await renderAndLoad({ "monday-09": { text: "Team meeting", color: "" } });
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
        name: /Monday, 06:00 to 07:00/,
      });
      await user.click(cell);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Add task…")).toBeInTheDocument();
    });

    it("shows colour swatches while editing", async () => {
      const user = userEvent.setup();
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 07:00/ })
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
        screen.getByRole("cell", { name: /Monday, 06:00 to 07:00/ })
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
        screen.getByRole("cell", { name: /Monday, 06:00 to 07:00/ })
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
        screen.getByRole("cell", { name: /Monday, 06:00 to 07:00/ })
      );
      // Leave textarea empty, press Enter
      await user.keyboard("{Enter}");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      // No text content should have been added
      expect(
        screen.queryByRole("cell", {
          name: /Monday, 06:00 to 07:00: /,
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
        screen.getByRole("cell", { name: /Monday, 06:00 to 07:00/ })
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

    it("selecting a colour is included in the POST body", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({ entries: {} }),
      });
      await renderAndLoad();
      await user.click(
        screen.getByRole("cell", { name: /Monday, 06:00 to 07:00/ })
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
      await renderAndLoad({ "monday-09": { text: "Yoga", color: "" } });
      await waitFor(() => expect(screen.getByText("Yoga")).toBeInTheDocument());
    });

    it("shows a delete button on a cell that has an entry", async () => {
      await renderAndLoad({ "monday-09": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));
      expect(
        screen.getByRole("button", { name: "Delete entry" })
      ).toBeInTheDocument();
    });

    it("clicking a cell with an existing entry pre-fills the textarea", async () => {
      const user = userEvent.setup();
      await renderAndLoad({ "monday-09": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));
      await user.click(
        screen.getByRole("cell", { name: /Monday, 09:00 to 10:00/ })
      );
      expect(screen.getByRole("textbox")).toHaveValue("Yoga");
    });
  });

  // ── Delete flow ───────────────────────────────────────────────────────────

  describe("delete flow", () => {
    it("clicking the delete button opens a confirmation dialog", async () => {
      const user = userEvent.setup();
      await renderAndLoad({ "monday-09": { text: "Yoga", color: "" } });
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
      await renderAndLoad({ "monday-09": { text: "Yoga", color: "" } });
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
      await renderAndLoad({ "monday-09": { text: "Yoga", color: "" } });
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
      await renderAndLoad({ "monday-09": { text: "Yoga", color: "" } });
      await waitFor(() => screen.getByText("Yoga"));

      await user.click(screen.getByRole("button", { name: "Delete entry" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByText("Yoga")).toBeInTheDocument();
    });

    it("cancelling the dialog sends no DELETE request", async () => {
      const user = userEvent.setup();
      await renderAndLoad({ "monday-09": { text: "Yoga", color: "" } });
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
        "monday-09": { text: "Dark task", color: "blue" },
      });
      await waitFor(() =>
        expect(screen.getByText("Dark task")).toBeInTheDocument()
      );
    });
  });
});
