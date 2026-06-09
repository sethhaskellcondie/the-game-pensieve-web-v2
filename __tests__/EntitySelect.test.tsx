import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import EntitySelect from "@/components/custom-fields/EntitySelect";

describe("EntitySelect", () => {
  it("shows the current entity label and is collapsed by default", () => {
    render(<EntitySelect value="boardGame" onChange={jest.fn()} />);
    const trigger = screen.getByRole("button", { name: /board game/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a listbox of all six entities and marks the selected one", () => {
    render(<EntitySelect value="boardGame" onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /board game/i }));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(6);
    const selected = screen.getByRole("option", { name: "Board Game" });
    expect(selected).toHaveAttribute("aria-selected", "true");
  });

  it("fires onChange with the picked entity key and closes", () => {
    const onChange = jest.fn();
    render(<EntitySelect value="boardGame" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /board game/i }));
    fireEvent.click(screen.getByRole("option", { name: /video game box/i }));

    expect(onChange).toHaveBeenCalledWith("videoGameBox");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
