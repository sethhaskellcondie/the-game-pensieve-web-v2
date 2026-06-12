import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import Header from "@/components/Header";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { DEFAULT_UI_SETTINGS } from "@/lib/uiSettings.types";

const baseProps = {
  icon: <span data-testid="icon" />,
  title: "THE GAME",
  titleAccent: "PENSIEVE",
  tagline: "Explore ALL your games.",
};

describe("Header", () => {
  it("renders the title and accent together in the level-1 heading", () => {
    render(<Header {...baseProps} />);

    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading).toHaveTextContent("THE GAME PENSIEVE");
  });

  it("renders the tagline", () => {
    render(<Header {...baseProps} />);

    expect(screen.getByText("Explore ALL your games.")).toBeInTheDocument();
  });

  it("renders the provided icon node", () => {
    render(<Header {...baseProps} />);

    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders children passed to it", () => {
    render(
      <Header {...baseProps}>
        <div data-testid="child" />
      </Header>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders the title alone when no accent is provided", () => {
    render(
      <Header
        icon={baseProps.icon}
        title={baseProps.title}
        tagline={baseProps.tagline}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "THE GAME",
    );
  });

  it("shows the beginner hint when beginner mode is on and a hint is provided", () => {
    render(
      <UiSettingsProvider
        initial={{ ...DEFAULT_UI_SETTINGS, beginnerMode: true }}
      >
        <Header {...baseProps} beginnerHint="Try the filters first." />
      </UiSettingsProvider>,
    );

    const button = screen.getByRole("button", { name: "Beginner hint" });
    fireEvent.click(button);
    expect(screen.getByText("Try the filters first.")).toBeInTheDocument();
  });

  it("omits the beginner hint while beginner mode is off", () => {
    render(<Header {...baseProps} beginnerHint="Try the filters first." />);

    expect(
      screen.queryByRole("button", { name: "Beginner hint" }),
    ).not.toBeInTheDocument();
  });

  it("omits the beginner hint when no hint text is provided", () => {
    render(
      <UiSettingsProvider
        initial={{ ...DEFAULT_UI_SETTINGS, beginnerMode: true }}
      >
        <Header {...baseProps} />
      </UiSettingsProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Beginner hint" }),
    ).not.toBeInTheDocument();
  });

  it("renders the animated background by default", () => {
    render(<Header {...baseProps} />);

    expect(screen.getByRole("banner")).toHaveAttribute("data-static", "false");
  });

  it("parks the background on a static frame when Hide Animations is on", () => {
    render(
      <UiSettingsProvider
        initial={{ ...DEFAULT_UI_SETTINGS, hideAnimations: true }}
      >
        <Header {...baseProps} />
      </UiSettingsProvider>,
    );

    expect(screen.getByRole("banner")).toHaveAttribute("data-static", "true");
  });
});
