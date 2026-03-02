import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/theme-toggle";

const mockSetTheme = jest.fn();
const mockUseTheme = jest.fn();

jest.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockUseTheme.mockReturnValue({ resolvedTheme: "light", setTheme: mockSetTheme });
  });

  it("renders a button with an accessible label", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });

  it("renders Sun and Moon SVG icons", () => {
    const { container } = render(<ThemeToggle />);
    // lucide-react renders SVGs; there should be exactly two
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("switches from light to dark when clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("switches from dark to light when clicked", async () => {
    mockUseTheme.mockReturnValue({ resolvedTheme: "dark", setTheme: mockSetTheme });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls setTheme exactly once per click", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledTimes(2);
  });
});
