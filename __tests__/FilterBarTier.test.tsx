import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import FilterBar from "@/components/filters/FilterBar";
import { SessionProvider } from "@/components/auth/SessionProvider";
import type { Role } from "@/lib/sessionConfig";
import type { FilterFieldDef } from "@/components/filters/types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const fields: FilterFieldDef[] = [
  {
    field: "name",
    label: "Name",
    kind: "text",
    source: "standard",
    operators: ["equals", "contains"],
  },
];

function renderFor(role: Role) {
  render(
    <SessionProvider initial={{ role, email: null }}>
      <FilterBar
        entityKey="toy"
        fields={fields}
        filters={[]}
        onChange={jest.fn()}
        searchValue=""
        onSearchChange={jest.fn()}
        searchAriaLabel="Search toys"
      />
    </SessionProvider>,
  );
}

describe("FilterBar role gating", () => {
  it("lets guests filter the showcase", () => {
    renderFor("guest");
    expect(screen.getByRole("button", { name: "Add filter" })).toBeEnabled();
    expect(screen.getByRole("searchbox", { name: "Search toys" })).toBeEnabled();
  });

  it("lets paid users filter their own data", () => {
    renderFor("paid");
    expect(screen.getByRole("button", { name: "Add filter" })).toBeEnabled();
  });

  it("lets trial users filter their own data", () => {
    renderFor("trial");
    expect(screen.getByRole("button", { name: "Add filter" })).toBeEnabled();
  });

  it("disables filtering and quick-search for lapsed users", () => {
    renderFor("lapsed");
    expect(screen.getByRole("button", { name: "Add filter" })).toBeDisabled();
    expect(
      screen.getByRole("searchbox", { name: "Search toys" }),
    ).toBeDisabled();
  });
});
