import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Heart, Pencil, Trash2, ExternalLink } from "lucide-react";
import { type Song, youtubeEmbed, tokenizeQuery } from "@/lib/songs";
import { useFavorites } from "@/hooks/use-favorites";

interface Props {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (song: Song) => void;
  onDelete: (song: Song) => void;
  query?: string;
}

/**
 * Storage key includes a version AND the current stanza count so persisted
 * indices auto-invalidate when content changes (e.g. lyrics edited and stanzas
 * shift). Stale entries from older versions are ignored and overwritten lazily.
 */
const STANZA_KEY_VERSION = "v2";
function stanzaStorageKey(songId: string, stanzaCount: number): string {
  return `sbc-active-stanza-${STANZA_KEY_VERSION}:${songId}:${stanzaCount}`;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function SongSheet({ song, open, onOpenChange, onEdit, onDelete, query = "" }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const tokens = useMemo(() => tokenizeQuery(query), [query]);
  const [activeStanza, setActiveStanza] = useState<number | null>(null);
  // Used to announce the active stanza to assistive tech.
  const [announcement, setAnnouncement] = useState("");

  // Lyric stanza count drives keyboard navigation bounds + the versioned key.
  const lyricStanzaCount = useMemo(
    () => (song?.lyrics ? song.lyrics.split(/\n\s*\n/).length : 0),
    [song?.lyrics],
  );

  // Restore the previously locked stanza for this song from localStorage.
  // Safe fallback: if the stored index is out of range for the current
  // stanza count (content changed), discard it instead of throwing.
  useEffect(() => {
    if (!song?.id || lyricStanzaCount === 0) {
      setActiveStanza(null);
      return;
    }
    try {
      const key = stanzaStorageKey(song.id, lyricStanzaCount);
      const raw = window.localStorage.getItem(key);
      if (raw === null) {
        setActiveStanza(null);
        return;
      }
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0 && n < lyricStanzaCount) {
        setActiveStanza(n);
      } else {
        // Stale / out-of-range — drop it silently.
        window.localStorage.removeItem(key);
        setActiveStanza(null);
      }
    } catch {
      setActiveStanza(null);
    }
  }, [song?.id, lyricStanzaCount]);

  // Persist whenever the user locks/clears a stanza.
  useEffect(() => {
    if (!song?.id || lyricStanzaCount === 0) return;
    try {
      const key = stanzaStorageKey(song.id, lyricStanzaCount);
      if (activeStanza === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, String(activeStanza));
    } catch {
      /* ignore */
    }
  }, [song?.id, activeStanza, lyricStanzaCount]);

  // Announce stanza changes for screen readers.
  useEffect(() => {
    if (activeStanza === null) {
      setAnnouncement("");
    } else if (lyricStanzaCount > 0) {
      setAnnouncement(
        `Stanza ${activeStanza + 1} of ${lyricStanzaCount} locked`,
      );
    }
  }, [activeStanza, lyricStanzaCount]);

  // Arrow-key navigation between stanzas while the sheet is open.
  useEffect(() => {
    if (!open || lyricStanzaCount === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "j") {
        setActiveStanza((cur) => {
          const next = cur === null ? 0 : Math.min(lyricStanzaCount - 1, cur + 1);
          // Only swallow the keystroke when navigation actually moves —
          // otherwise let the page scroll naturally instead of trapping at the end.
          if (next !== cur) e.preventDefault();
          return next;
        });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        setActiveStanza((cur) => {
          const next = cur === null ? 0 : Math.max(0, cur - 1);
          if (next !== cur) e.preventDefault();
          return next;
        });
      } else if (e.key === "Escape" && activeStanza !== null) {
        e.preventDefault();
        setActiveStanza(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lyricStanzaCount, activeStanza]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto bg-card p-0"
      >
        {/* Polite live region for stanza-lock announcements (screen readers). */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="stanza-announcer"
        >
          {announcement}
        </div>
        {song && (
          <div className="flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-8 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    Worship Song · 诗歌
                  </p>
                  <h2 className="font-serif-display text-3xl sm:text-4xl font-medium text-foreground leading-tight break-words">
                    {song.title}
                  </h2>
                  {song.description && (
                    <p className="mt-2 text-sm text-muted-foreground italic">
                      {song.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggle(song.id)}
                    aria-label="Toggle favorite"
                  >
                    <Heart
                      className={
                        isFavorite(song.id)
                          ? "fill-accent text-accent"
                          : "text-muted-foreground"
                      }
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(song)}
                    aria-label="Edit song"
                  >
                    <Pencil className="text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(song)}
                    aria-label="Delete song"
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8 space-y-10">
              {/* Video */}
              {song.video_url &&
                (() => {
                  const embed = youtubeEmbed(song.video_url);
                  return (
                    <section>
                      <SectionLabel>Video</SectionLabel>
                      {embed ? (
                        <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
                          <iframe
                            src={embed}
                            title={song.title}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : song.video_url.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video
                          src={song.video_url}
                          controls
                          className="w-full rounded-md border border-border"
                        />
                      ) : (
                        <a
                          href={song.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                        >
                          Open video <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </section>
                  );
                })()}

              {/* Lyrics */}
              {song.lyrics && (
                <section>
                  <SectionLabel>Lyrics · 歌词</SectionLabel>
                  <Stanzas
                    text={song.lyrics}
                    tokens={tokens}
                    active={activeStanza}
                    onSelect={setActiveStanza}
                  ariaLabelPrefix="Lyrics stanza"
                    className="lyric-text font-cn text-foreground"
                  />
                </section>
              )}

              {/* Pinyin */}
              {song.pinyin && (
                <section>
                  <SectionLabel>Hanyu Pinyin</SectionLabel>
                  <Stanzas
                    text={song.pinyin}
                    tokens={tokens}
                    active={activeStanza}
                    onSelect={setActiveStanza}
                  ariaLabelPrefix="Pinyin stanza"
                    className="text-[15px] leading-loose text-muted-foreground"
                  />
                </section>
              )}

              {/* Score */}
              {song.score_url && (
                <section>
                  <SectionLabel>Score · 乐谱</SectionLabel>
                  {song.score_url.match(/\.pdf($|\?)/i) ? (
                    <iframe
                      src={song.score_url}
                      title="Score"
                      className="h-[80vh] w-full rounded-md border border-border bg-white"
                    />
                  ) : (
                    <img
                      src={song.score_url}
                      alt={`${song.title} score`}
                      className="w-full rounded-md border border-border bg-white"
                    />
                  )}
                </section>
              )}

              {!song.lyrics && !song.score_url && !song.video_url && (
                <p className="text-sm text-muted-foreground italic">
                  No content yet. Edit this song to add lyrics, a score image, or a video.
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Render text split into stanzas (separated by blank lines). Click to focus. */
function Stanzas({
  text,
  tokens,
  active,
  onSelect,
  ariaLabelPrefix = "Stanza",
  className = "",
}: {
  text: string;
  tokens: string[];
  active: number | null;
  onSelect: (i: number | null) => void;
  ariaLabelPrefix?: string;
  className?: string;
}) {
  const stanzas = useMemo(() => text.split(/\n\s*\n/), [text]);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  // Scroll active stanza into view whenever it changes. Honors
  // prefers-reduced-motion and waits a frame so the sheet's open animation
  // doesn't fight the scroll (esp. on mobile / touch).
  useEffect(() => {
    if (active === null) return;
    const el = refs.current[active];
    if (!el) return;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    const raf =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16);
    const id = raf(() => {
      el.scrollIntoView({ behavior, block: "center", inline: "nearest" });
    });
    return () => {
      if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(id);
    };
  }, [active]);

  const handleSelect = useCallback(
    (i: number, isActive: boolean) => {
      onSelect(isActive ? null : i);
    },
    [onSelect],
  );

  return (
    <div className="space-y-5" role="list">
      {stanzas.map((stanza, i) => {
        const isActive = active === i;
        const dimmed = active !== null && !isActive;
        const label = `${ariaLabelPrefix} ${i + 1} of ${stanzas.length}${isActive ? ", locked" : ""}`;
        return (
          <button
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            onClick={() => handleSelect(i, isActive)}
            aria-pressed={isActive}
            aria-label={label}
            role="listitem"
            data-stanza-index={i}
            data-active={isActive ? "true" : "false"}
            style={{ touchAction: "manipulation" }}
            className={
              "block w-full text-left rounded-md px-4 py-3 -mx-4 scroll-mt-32 transition-all " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card " +
              (isActive
                ? "bg-accent/10 ring-1 ring-accent/40 "
                : "hover:bg-secondary/50 ") +
              (dimmed ? "opacity-40 " : "")
            }
          >
            <pre className={"whitespace-pre-wrap m-0 " + className}>
              <Highlight text={stanza} tokens={tokens} />
            </pre>
          </button>
        );
      })}
    </div>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wrap occurrences of any token (case-insensitive, diacritic-insensitive) in <mark>. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length || !text) return <>{text}</>;
  // Strip diacritics from text for matching, but render original chars.
  const folded = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // Folded string preserves character count because we only remove combining marks.
  const pattern = new RegExp(
    "(" + tokens.map(escapeRegExp).join("|") + ")",
    "gi",
  );
  const parts: Array<{ start: number; end: number; match: boolean }> = [];
  let last = 0;
  for (const m of folded.matchAll(pattern)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (start > last) parts.push({ start: last, end: start, match: false });
    parts.push({ start, end, match: true });
    last = end;
  }
  if (last < text.length) parts.push({ start: last, end: text.length, match: false });
  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="bg-accent/25 text-foreground rounded-sm px-0.5">
            {text.slice(p.start, p.end)}
          </mark>
        ) : (
          <span key={i}>{text.slice(p.start, p.end)}</span>
        ),
      )}
    </>
  );
}