import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagFilterBar } from "./TagFilterBar";

const TAGS = [
  { tag: "praise", count: 4 },
  { tag: "praise team", count: 2 },
  { tag: "communion", count: 3 },
  { tag: "christmas", count: 1 },
];

function setup(initialSelected: string[] = []) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  const utils = render(
    <TagFilterBar
      tags={TAGS}
      selected={initialSelected}
      onToggle={onToggle}
      onClear={onClear}
    />,
  );
  return { ...utils, onToggle, onClear };
}

describe("TagFilterBar — accessibility", () => {
  it("wraps chips in a labelled toolbar", () => {
    setup();
    const toolbar = screen.getByRole("toolbar", { name: /tags/i });
    expect(toolbar).toBeInTheDocument();
    expect(within(toolbar).getAllByRole("button")).toHaveLength(TAGS.length);
  });

  it("exposes aria-pressed reflecting selection", () => {
    setup(["praise"]);
    expect(
      screen.getByRole("button", { name: /^Tag praise,/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /^Tag communion,/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("uses roving tabindex (only one chip in the tab order)", () => {
    setup();
    const chips = screen.getAllByRole("button");
    const inTabOrder = chips.filter((c) => c.getAttribute("tabindex") === "0");
    expect(inTabOrder).toHaveLength(1);
  });
});

describe("TagFilterBar — keyboard navigation", () => {
  it("ArrowRight / ArrowLeft / Home / End move focus", async () => {
    const user = userEvent.setup();
    setup();
    const chips = screen.getAllByRole("button");
    chips[0].focus();
    expect(chips[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(chips[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(chips[chips.length - 1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(chips[0]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    // Does not wrap past the start.
    expect(chips[0]).toHaveFocus();
  });

  it("Enter toggles the focused chip", async () => {
    const user = userEvent.setup();
    const { onToggle } = setup();
    const chip = screen.getByRole("button", { name: /^Tag praise,/i });
    chip.focus();
    await user.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledWith("praise");
  });

  it("Escape clears all selections when any are active", async () => {
    const { onClear } = setup(["praise"]);
    const chip = screen.getAllByRole("button")[0];
    chip.focus();
    fireEvent.keyDown(chip, { key: "Escape" });
    expect(onClear).toHaveBeenCalled();
  });
});

describe("TagFilterBar — screen-reader announcements", () => {
  it("announces when a tag is applied", async () => {
    const user = userEvent.setup();
    setup();
    const announcer = screen.getByTestId("tag-filter-announcer");
    await user.click(screen.getByRole("button", { name: /^Tag praise,/i }));
    expect(announcer).toHaveTextContent(/Filter praise applied/i);
  });

  it("announces when filters are cleared", async () => {
    setup(["praise", "communion"]);
    const announcer = screen.getByTestId("tag-filter-announcer");
    const chip = screen.getAllByRole("button")[0];
    chip.focus();
    fireEvent.keyDown(chip, { key: "Escape" });
    expect(announcer).toHaveTextContent(/cleared/i);
  });
});