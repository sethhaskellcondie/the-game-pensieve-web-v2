import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { CustomFieldOption } from "@/lib/api";
import CustomFieldValue from "@/components/toys/CustomFieldValue";

const opt = (
  id: number,
  name: string,
  order: number,
): CustomFieldOption => ({
  id,
  customFieldId: 1,
  name,
  isDefault: order === 0,
  order,
});

const stages = [
  opt(1, "Purchased", 0),
  opt(2, "Opened", 1),
  opt(3, "Painted", 2),
  opt(4, "Finished", 3),
];

describe("CustomFieldValue", () => {
  it("renders a Yes/No badge for booleans", () => {
    const { rerender } = render(<CustomFieldValue type="boolean" value="true" />);
    expect(screen.getByRole("img", { name: "Yes" })).toBeInTheDocument();
    rerender(<CustomFieldValue type="boolean" value="false" />);
    expect(screen.getByRole("img", { name: "No" })).toBeInTheDocument();
  });

  it("passes text through and styles numbers", () => {
    const { rerender } = render(
      <CustomFieldValue type="text" value="Limited Edition" />,
    );
    expect(screen.getByText("Limited Edition")).toBeInTheDocument();
    rerender(<CustomFieldValue type="number" value="1977" />);
    expect(screen.getByText("1977")).toBeInTheDocument();
  });

  it("renders a dropdown value as a pill", () => {
    render(
      <CustomFieldValue
        type="dropdown"
        value="Fantasy"
        options={[opt(1, "Fantasy", 0), opt(2, "Sci-Fi", 1)]}
      />,
    );
    expect(screen.getByText("Fantasy")).toBeInTheDocument();
  });

  it("renders the selected radio option as a chip", () => {
    render(
      <CustomFieldValue
        type="radio_button"
        value="Good"
        options={[opt(1, "Mint", 0), opt(2, "Good", 1)]}
      />,
    );
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it("renders a progress value as a pill with its position (e.g. Painted 3/4)", () => {
    render(
      <CustomFieldValue type="progress_bar" value="Painted" options={stages} />,
    );
    expect(screen.getByText("Painted")).toBeInTheDocument();
    // Painted is the 3rd of 4 stages.
    expect(screen.getByText("3/4")).toBeInTheDocument();
  });

  it("shows a dash for missing values", () => {
    const { container } = render(
      <CustomFieldValue type="text" value={undefined} />,
    );
    expect(container).toHaveTextContent("—");
  });

  it("treats an invalid value as empty (dash)", () => {
    const { container } = render(
      <CustomFieldValue type="number" value="not-a-number" />,
    );
    expect(container).toHaveTextContent("—");
  });
});
