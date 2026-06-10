import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { formatCustomFieldValue } from "@/components/toys/format";

function renderValue(...args: Parameters<typeof formatCustomFieldValue>) {
  return render(<>{formatCustomFieldValue(...args)}</>);
}

describe("formatCustomFieldValue", () => {
  it("renders a 'Yes' marker for a true boolean", () => {
    renderValue("boolean", "true");
    expect(screen.getByRole("img", { name: "Yes" })).toBeInTheDocument();
    expect(screen.queryByText("true")).not.toBeInTheDocument();
  });

  it("renders a 'No' marker for a false boolean", () => {
    renderValue("boolean", "false");
    expect(screen.getByRole("img", { name: "No" })).toBeInTheDocument();
  });

  it("passes text values through unchanged", () => {
    renderValue("text", "Limited Edition");
    expect(screen.getByText("Limited Edition")).toBeInTheDocument();
  });

  it("passes number values through unchanged", () => {
    renderValue("number", "1977");
    expect(screen.getByText("1977")).toBeInTheDocument();
  });

  it("renders a placeholder dash for a missing value", () => {
    const { container } = renderValue("text", undefined);
    expect(container).toHaveTextContent("—");
  });

  it("renders a placeholder dash for an empty value", () => {
    const { container } = renderValue("number", "");
    expect(container).toHaveTextContent("—");
  });

  it("renders deferred types (dropdown) as their raw string for now", () => {
    renderValue("dropdown", "Fantasy");
    expect(screen.getByText("Fantasy")).toBeInTheDocument();
  });
});
