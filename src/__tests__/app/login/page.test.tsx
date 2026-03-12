import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: jest.fn() }),
}));

// Mock the server actions — they are imported by the page
jest.mock("@/app/login/actions", () => ({
  signIn: jest.fn().mockResolvedValue(null),
  signUp: jest.fn().mockResolvedValue(null),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("LoginPage", () => {
  describe("initial render (sign-in mode)", () => {
    it("shows the app title", () => {
      render(<LoginPage />);
      expect(
        screen.getByRole("heading", { name: "Weekly Planner" })
      ).toBeInTheDocument();
    });

    it("shows the sign-in subtitle", () => {
      render(<LoginPage />);
      expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    });

    it("renders email and password inputs", () => {
      render(<LoginPage />);
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    it("renders a Sign in submit button", () => {
      render(<LoginPage />);
      expect(
        screen.getByRole("button", { name: "Sign in" })
      ).toBeInTheDocument();
    });

    it("renders the Sign up toggle link", () => {
      render(<LoginPage />);
      expect(
        screen.getByRole("button", { name: "Sign up" })
      ).toBeInTheDocument();
    });

    it("renders the theme toggle button", () => {
      render(<LoginPage />);
      expect(
        screen.getByRole("button", { name: "Toggle theme" })
      ).toBeInTheDocument();
    });

    it("does not show an error message initially", () => {
      render(<LoginPage />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("mode toggle", () => {
    it("switches to sign-up mode when the Sign up link is clicked", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      expect(screen.getByText("Create a new account")).toBeInTheDocument();
    });

    it("shows a Sign up submit button after switching to sign-up mode", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      // The submit button text changes; find it by its accessible name
      const submitButton = screen.getByRole("button", { name: "Sign up" });
      expect(submitButton).toHaveAttribute("type", "submit");
    });

    it("shows the Sign in toggle link in sign-up mode", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    });

    it("toggles back to sign-in mode from sign-up mode", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    });
  });

  describe("form fields", () => {
    it("email input has type email", () => {
      render(<LoginPage />);
      expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    });

    it("password input has type password", () => {
      render(<LoginPage />);
      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "type",
        "password"
      );
    });

    it("password input uses current-password autocomplete in sign-in mode", () => {
      render(<LoginPage />);
      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "autocomplete",
        "current-password"
      );
    });

    it("password input uses new-password autocomplete in sign-up mode", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "autocomplete",
        "new-password"
      );
    });

    it("user can type into the email field", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.type(screen.getByLabelText("Email"), "hello@example.com");
      expect(screen.getByLabelText("Email")).toHaveValue("hello@example.com");
    });

    it("user can type into the password field", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.type(screen.getByLabelText("Password"), "secret123");
      expect(screen.getByLabelText("Password")).toHaveValue("secret123");
    });

    it("does not show the name field in sign-in mode", () => {
      render(<LoginPage />);
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    });

    it("shows the name field in sign-up mode", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });

    it("name field has type text in sign-up mode", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      expect(screen.getByLabelText("Name")).toHaveAttribute("type", "text");
    });

    it("user can type into the name field in sign-up mode", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await user.type(screen.getByLabelText("Name"), "Jon");
      expect(screen.getByLabelText("Name")).toHaveValue("Jon");
    });

    it("hides the name field when switching back to sign-in mode", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    });
  });
});
