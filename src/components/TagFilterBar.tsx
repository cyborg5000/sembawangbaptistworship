import { useEffect, useRef, useState } from "react";

export interface TagFilterBarProps {
  tags: Array<{ tag: string; count: number }>;
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

/**
 * Accessible tag filter chips.
 *
 * - role="toolbar" wraps the chips so SR users hear it as a control group.
 * - Each chip is a toggle button with aria-pressed reflecting selection.
 * - Roving-tabindex keyboard model: only one chip is in the tab order;
 *   ArrowLeft/ArrowRight (+ Home/End) move focus between chips,
 *   Enter/Space toggles, Esc clears all selections.
 * - A polite live region announces selection changes.
 */
export function TagFilterBar({ tags, selected, onToggle, onClear }: TagFilterBarProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [announcement, setAnnouncement] = useState("");

  // Keep focus index inside bounds when the tag list shrinks.
  useEffect(() => {
    if (focusIndex > tags.length - 1) {
      setFocusIndex(Math.max(0, tags.length - 1));
    }
  }, [tags.length, focusIndex]);

  const focusAt = (i: number) => {
    const next = Math.max(0, Math.min(tags.length - 1, i));
    setFocusIndex(next);
    // rAF: wait for tabindex to update before focusing the newly-eligible chip.
    requestAnimationFrame(() => refs.current[next]?.focus());
  };

  const handleKey = (e: React.KeyboardEvent, i: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusAt(i + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusAt(i - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(tags.length - 1);
        break;
      case "Escape":
        if (selected.length > 0) {
          e.preventDefault();
          onClear();
          setAnnouncement("All tag filters cleared");
        }
        break;
    }
  };

  const announceToggle = (tag: string, nowActive: boolean) => {
    setAnnouncement(
      nowActive
        ? `Filter ${tag} applied. ${selected.length + 1} filter${selected.length === 0 ? "" : "s"} active.`
        : `Filter ${tag} removed. ${selected.length - 1} filter${selected.length - 1 === 1 ? "" : "s"} active.`,
    );
  };

  return (
    <div className="mt-6" data-testid="tag-filter-bar">
      <div className="flex items-center gap-3 mb-2">
        <span
          id="tag-filter-label"
          className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
        >
          Tags · 标签
        </span>
        {selected.length > 0 && (
          <button
            onClick={() => {
              onClear();
              setAnnouncement("All tag filters cleared");
            }}
            className="text-[11px] uppercase tracking-wider text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1"
          >
            Clear
          </button>
        )}
      </div>
      <div
        role="toolbar"
        aria-labelledby="tag-filter-label"
        aria-orientation="horizontal"
        className="flex flex-wrap gap-1.5"
      >
        {tags.map(({ tag, count }, i) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="button"
              aria-pressed={active}
              aria-label={`Tag ${tag}, ${count} song${count === 1 ? "" : "s"}${active ? ", selected" : ""}`}
              tabIndex={i === focusIndex ? 0 : -1}
              onClick={() => {
                announceToggle(tag, !active);
                onToggle(tag);
                setFocusIndex(i);
              }}
              onKeyDown={(e) => handleKey(e, i)}
              className={
                "inline-flex items-center rounded-full px-3 py-1 text-xs transition-colors " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
                (active
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              {tag}
              <span
                aria-hidden="true"
                className={"ml-1.5 text-[10px] " + (active ? "opacity-80" : "opacity-60")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="tag-filter-announcer"
      >
        {announcement}
      </div>
    </div>
  );
}