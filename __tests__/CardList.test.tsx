import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import CardList, { type CardData } from "@/components/card-list/CardList";

// The DataTable's mobile twin: cards render the configured slots, the whole
// card navigates via its stretched title link, and — by decision — cards are
// read-only: no delete button, no inline editors, ever.

type Row = { id: number; title: string };

const rows: Row[] = [
  { id: 1, title: "Kirby's Adventures" },
  { id: 2, title: "Chrono Trigger" },
];

const cards: Record<number, CardData> = {
  1: {
    title: "Kirby's Adventures",
    subtitle: "NES · 2 boxes",
    glyph: { label: "Favorite", on: true },
    bars: [{ key: "cf-3", name: "Playthrough", stage: "Played", pos: 2, count: 4 }],
    pills: [
      { key: "physical", kind: "boolean", label: "Physical", on: false },
      { key: "cf-4", kind: "value", tone: "gold", name: "Genre", label: "Action" },
      { key: "cf-6", kind: "value", tone: "purple", name: "Year", label: "1993" },
    ],
  },
  2: { title: "Chrono Trigger" },
};

function renderList(props: Partial<Parameters<typeof CardList<Row>>[0]> = {}) {
  return render(
    <CardList
      rows={rows}
      getRowKey={(r) => r.id}
      loading={false}
      emptyMessage="No games."
      loadingMessage="Loading…"
      getHref={(r) => `/video-games/${r.id}`}
      card={(r) => cards[r.id]}
      showNames={false}
      {...props}
    />,
  );
}

describe("CardList", () => {
  it("renders one card per row whose title links to the row's detail page", () => {
    renderList();
    expect(
      screen.getByRole("link", { name: "Kirby's Adventures" }),
    ).toHaveAttribute("href", "/video-games/1");
    expect(
      screen.getByRole("link", { name: "Chrono Trigger" }),
    ).toHaveAttribute("href", "/video-games/2");
  });

  it("shows the subtitle, corner badge, progress bar, and pills when configured", () => {
    renderList();
    expect(screen.getByText("NES · 2 boxes")).toBeInTheDocument();
    // The corner badge is the full labelled pill, not a bare check.
    const badge = screen.getByRole("img", { name: "Favorite: Yes" });
    expect(badge).toHaveTextContent("Favorite");
    expect(
      screen.getByRole("img", { name: "Playthrough: Played (2 of 4)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Physical: No" })).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("1993")).toBeInTheDocument();
  });

  it("renders a minimal card when only the title is set", () => {
    renderList();
    const card = screen
      .getByRole("link", { name: "Chrono Trigger" })
      .closest("li")!;
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
    expect(within(card).queryByText(/\d\/\d/)).not.toBeInTheDocument();
  });

  it("renders no buttons — it is a read/navigate-only list", () => {
    // The field-names toggle now lives in the FilterBar; the card list and the
    // cards themselves carry no actions.
    renderList();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    for (const card of screen.getAllByRole("listitem")) {
      expect(within(card).queryAllByRole("button")).toHaveLength(0);
    }
  });

  it("shows bare values when showNames is off", () => {
    renderList({ showNames: false });
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("1993")).toBeInTheDocument();
    expect(screen.getByText("Played")).toBeInTheDocument();
  });

  it("prefixes pills and bars with their field name when showNames is on", () => {
    renderList({ showNames: true });
    expect(screen.getByText("Genre: Action")).toBeInTheDocument();
    expect(screen.getByText("Year: 1993")).toBeInTheDocument();
    expect(screen.getByText("Playthrough: Played")).toBeInTheDocument();
  });

  it("shows the loading message when loading with no rows", () => {
    renderList({ rows: [], loading: true });
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows the empty message when not loading with no rows", () => {
    renderList({ rows: [], loading: false });
    expect(screen.getByText("No games.")).toBeInTheDocument();
  });
});
