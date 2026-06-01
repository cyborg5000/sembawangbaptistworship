import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SongSheet } from "./SongSheet";
import type { Song } from "@/lib/songs";

const song: Song = {
  id: "song-1",
  title: "奇异恩典",
  title_en: "",
  description: "Hymn",
  lyrics: "奇异恩典何等甘甜\n\n我罪已得赦免\n\n前我失丧今被寻回",
  lyrics_en: "",
  pinyin: "qí yì ēn diǎn\n\njiù wǒ huí jiā",
  score_url: "",
  video_url: "",
  video_status: "none",
  video_source: "",
  tags: [],
  created_at: "",
  updated_at: "",
};

function setup(overrides: Partial<React.ComponentProps<typeof SongSheet>> = {}) {
  const props = {
    song,
    open: true,
    onOpenChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    query: "grace",
    ...overrides,
  };
  return { ...render(<SongSheet {...props} />), props };
}

function getLyricStanzas() {
  return screen
    .getAllByRole("listitem")
    .filter((el) => el.getAttribute("aria-label")?.startsWith("Lyrics stanza"));
}

describe("SongSheet stanza interaction", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders ARIA-labeled lyric stanza buttons + a pinyin toggle for Chinese lyrics", () => {
    setup();
    expect(screen.getByLabelText(/Lyrics stanza 1 of 3/i)).toBeInTheDocument();
    // Pinyin is now an interlinear toggle rather than a separate section.
    expect(screen.getByText(/拼音 Pinyin/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Close song details/i)).toBeInTheDocument();
  });

  it("hides the pinyin toggle when the lyrics are English-only", () => {
    setup({
      song: {
        ...song,
        title: "Amazing Grace",
        lyrics:
          "Amazing grace how sweet the sound\n\nThat saved a wretch like me\n\nI once was lost but now am found",
        pinyin: "",
      },
    });
    expect(screen.queryByText(/拼音 Pinyin/i)).not.toBeInTheDocument();
  });

  it("closes the sheet from the header close button", async () => {
    const { props } = setup();
    await userEvent.click(screen.getByLabelText(/Close song details/i));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("locks a stanza on click, centers it via scrollIntoView, and updates aria-pressed", async () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
    setup();

    const stanzas = getLyricStanzas();
    expect(stanzas[1]).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(stanzas[1]);

    expect(stanzas[1]).toHaveAttribute("aria-pressed", "true");
    // Wait a frame for the rAF-scheduled scroll.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(scrollSpy).toHaveBeenCalled();
    const lastCall = scrollSpy.mock.calls.at(-1)?.[0] as ScrollIntoViewOptions;
    expect(lastCall.block).toBe("center");
  });

  it("announces the locked stanza via aria-live region", async () => {
    setup();
    const stanzas = getLyricStanzas();
    await userEvent.click(stanzas[0]);
    const announcer = screen.getByTestId("stanza-announcer");
    expect(announcer).toHaveTextContent(/Stanza 1 of 3 locked/i);
  });

  it("clicking the active stanza again unlocks it", async () => {
    setup();
    const stanzas = getLyricStanzas();
    await userEvent.click(stanzas[0]);
    expect(stanzas[0]).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(stanzas[0]);
    expect(stanzas[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("keyboard ArrowDown / ArrowUp navigates and stays in sync", () => {
    setup();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    let stanzas = getLyricStanzas();
    expect(stanzas[0]).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    stanzas = getLyricStanzas();
    expect(stanzas[1]).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, { key: "ArrowUp" });
    stanzas = getLyricStanzas();
    expect(stanzas[0]).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, { key: "Escape" });
    stanzas = getLyricStanzas();
    expect(stanzas[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("ArrowDown at the last stanza does not preventDefault (no overscroll trap)", () => {
    setup();
    // Step to the last stanza.
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    const stanzas = getLyricStanzas();
    expect(stanzas[2]).toHaveAttribute("aria-pressed", "true");

    // One more should be a no-op AND must not preventDefault.
    const ev = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("persists the locked stanza under a versioned + stanza-count-scoped key", async () => {
    setup();
    await userEvent.click(getLyricStanzas()[1]);
    expect(window.localStorage.getItem("sbc-active-stanza-v2:song-1:3")).toBe("1");
  });

  it("restores a valid stored stanza on mount", () => {
    window.localStorage.setItem("sbc-active-stanza-v2:song-1:3", "2");
    setup();
    const stanzas = getLyricStanzas();
    expect(stanzas[2]).toHaveAttribute("aria-pressed", "true");
  });

  it("safely discards a stored stanza when the index is out of range (content changed)", () => {
    // Older content had 9 stanzas — current song has 3, so this is stale.
    window.localStorage.setItem("sbc-active-stanza-v2:song-1:3", "99");
    setup();
    const stanzas = getLyricStanzas();
    for (const s of stanzas) {
      expect(s).toHaveAttribute("aria-pressed", "false");
    }
    // And it should be cleaned up.
    expect(window.localStorage.getItem("sbc-active-stanza-v2:song-1:3")).toBeNull();
  });

  it("ignores stored values written under an older key version", () => {
    window.localStorage.setItem("sbc-active-stanza-v1:song-1", "1");
    setup();
    for (const s of getLyricStanzas()) {
      expect(s).toHaveAttribute("aria-pressed", "false");
    }
  });
});
