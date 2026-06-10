import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import ToyDetailsPage from "@/app/toys/[id]/page";

describe("ToyDetailsPage", () => {
  it("renders the Toys header and a back link to the list", () => {
    render(<ToyDetailsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "TOYS" }),
    ).toBeInTheDocument();

    const back = screen.getByRole("link", { name: /Back to Toys/i });
    expect(back).toHaveAttribute("href", "/toys");
  });
});
