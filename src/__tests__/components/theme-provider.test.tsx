import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";

// Avoid wiring up the real next-themes provider (localStorage, matchMedia, etc.)
jest.mock("next-themes", () => ({
  ThemeProvider: ({
    children,
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <div data-testid="next-themes-provider">{children}</div>,
}));

describe("ThemeProvider", () => {
  it("renders its children", () => {
    render(
      <ThemeProvider attribute="class">
        <p>hello world</p>
      </ThemeProvider>
    );
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("wraps children in the NextThemes provider", () => {
    render(
      <ThemeProvider attribute="class">
        <span />
      </ThemeProvider>
    );
    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
  });

  it("does not throw when given extra next-themes props", () => {
    expect(() =>
      render(
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <span />
        </ThemeProvider>
      )
    ).not.toThrow();
  });
});
