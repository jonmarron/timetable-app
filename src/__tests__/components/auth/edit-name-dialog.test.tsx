import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditNameDialog } from "@/components/auth/edit-name-dialog";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/app/login/actions", () => ({
  updateUserName: jest.fn().mockResolvedValue(null),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("EditNameDialog", () => {
  describe("trigger button", () => {
    it("renders the display label as a button", () => {
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      expect(screen.getByRole("button", { name: "Edit your name" })).toBeInTheDocument();
    });

    it("shows the display label text", () => {
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      expect(screen.getByText("Jon")).toBeInTheDocument();
    });

    it("falls back to email as display label", () => {
      render(<EditNameDialog currentName={null} displayLabel="jon@example.com" />);
      expect(screen.getByText("jon@example.com")).toBeInTheDocument();
    });
  });

  describe("dialog", () => {
    it("does not show the dialog initially", () => {
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens the dialog when the trigger is clicked", async () => {
      const user = userEvent.setup();
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      await user.click(screen.getByRole("button", { name: "Edit your name" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows the dialog title", async () => {
      const user = userEvent.setup();
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      await user.click(screen.getByRole("button", { name: "Edit your name" }));
      expect(screen.getByText("Change your name")).toBeInTheDocument();
    });

    it("pre-fills the name input with the current name", async () => {
      const user = userEvent.setup();
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      await user.click(screen.getByRole("button", { name: "Edit your name" }));
      expect(screen.getByLabelText("Name")).toHaveValue("Jon");
    });

    it("pre-fills with empty string when currentName is null", async () => {
      const user = userEvent.setup();
      render(<EditNameDialog currentName={null} displayLabel="jon@example.com" />);
      await user.click(screen.getByRole("button", { name: "Edit your name" }));
      expect(screen.getByLabelText("Name")).toHaveValue("");
    });

    it("renders Save and Cancel buttons", async () => {
      const user = userEvent.setup();
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      await user.click(screen.getByRole("button", { name: "Edit your name" }));
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("closes the dialog when Cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      await user.click(screen.getByRole("button", { name: "Edit your name" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("allows typing a new name", async () => {
      const user = userEvent.setup();
      render(<EditNameDialog currentName="Jon" displayLabel="Jon" />);
      await user.click(screen.getByRole("button", { name: "Edit your name" }));
      const input = screen.getByLabelText("Name");
      await user.clear(input);
      await user.type(input, "Jane");
      expect(input).toHaveValue("Jane");
    });
  });
});
