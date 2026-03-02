import { render, screen } from "@testing-library/react";
import { SignOutButton } from "@/components/auth/sign-out-button";

jest.mock("@/app/login/actions", () => ({
  signOut: jest.fn(),
}));

describe("SignOutButton", () => {
  it("renders a button with an accessible label", () => {
    render(<SignOutButton />);
    expect(
      screen.getByRole("button", { name: "Sign out" })
    ).toBeInTheDocument();
  });

  it("renders inside a form element", () => {
    const { container } = render(<SignOutButton />);
    expect(container.querySelector("form")).toBeInTheDocument();
  });

  it("button type is submit", () => {
    render(<SignOutButton />);
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("renders a LogOut icon", () => {
    const { container } = render(<SignOutButton />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
