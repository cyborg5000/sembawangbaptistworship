import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Heart, Pencil, Trash2, ExternalLink } from "lucide-react";
import { type Song, youtubeEmbed, tokenizeQuery } from "@/lib/songs";
import { songPinyin } from "@/lib/pinyin";
import { useFavorites } from "@/hooks/use-favorites";

interface Props {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (song: Song) => void;
  onDelete?: (song: Song) => void;
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

  // Language tab: 中文 (zh) vs English (en) version of the song's lyrics/title.
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const hasEnglish = Boolean(song?.lyrics_en?.trim() || song?.title_en?.trim());
  // Reset to Chinese whenever a different song opens.
  useEffect(() => {
    setLang("zh");
  }, [song?.id]);
  // The lyrics shown depend on the active language tab.
  const activeLyrics =
    lang === "en" && song?.lyrics_en?.trim() ? song.lyrics_en : (song?.lyrics ?? "");
  const displayTitle =
    lang === "en" && song?.title_en?.trim() ? song.title_en : (song?.title ?? "");
  // Hanyu pinyin generated from the Chinese lyrics (cached), never stored.
  const pinyinText = useMemo(
    () => (song ? songPinyin(song) : ""),
    [song?.id, song?.lyrics],
  );

  // Lyric stanza count drives keyboard navigation bounds + the versioned key.
  const lyricStanzaCount = useMemo(
    () => (activeLyrics ? activeLyrics.split(/\n\s*\n/).length : 0),
    [activeLyrics],
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
        {/* Accessible name + description for the dialog (visually hidden — visible header is below). */}
        <VisuallyHidden.Root>
          <SheetTitle>{song?.title ?? "Song details"}</SheetTitle>
          <SheetDescription>
            {song?.description || "Lyrics, pinyin, score and video for the selected worship song."}
          </SheetDescription>
        </VisuallyHidden.Root>
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
                    {displayTitle}
                  </h2>
                  {/* Show the other-language title underneath, when present */}
                  {lang === "zh" && song.title_en?.trim() && (
                    <p className="mt-1 text-base text-muted-foreground italic break-words">
                      {song.title_en}
                    </p>
                  )}
                  {lang === "en" && song.title?.trim() && (
                    <p className="mt-1 font-cn text-base text-muted-foreground break-words">
                      {song.title}
                    </p>
                  )}
                  {/* 中文 / English language tab — only when an English version exists */}
                  {hasEnglish && (
                    <div
                      role="tablist"
                      aria-label="Lyrics language"
                      className="mt-4 inline-flex rounded-full border border-border p-0.5 bg-secondary/40"
                    >
                      <LangTab active={lang === "zh"} onClick={() => { setLang("zh"); setActiveStanza(null); }}>
                        中文
                      </LangTab>
                      <LangTab active={lang === "en"} onClick={() => { setLang("en"); setActiveStanza(null); }}>
                        English
                      </LangTab>
                    </div>
                  )}
                  {song.description && (
                    <p className="mt-3 text-sm text-muted-foreground italic">
                      {song.description}
                    </p>
                  )}
                  {song.tags && song.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {song.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
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
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(song)}
                      aria-label="Edit song"
                    >
                      <Pencil className="text-muted-foreground" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(song)}
                      aria-label="Delete song"
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  )}
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

              {/* Lyrics — Chinese or English depending on the active language tab */}
              {activeLyrics && (
                <section>
                  <SectionLabel>
                    {lang === "en" ? "Lyrics · English" : "Lyrics · 歌词"}
                  </SectionLabel>
                  <Stanzas
                    text={activeLyrics}
                    tokens={tokens}
                    active={activeStanza}
                    onSelect={setActiveStanza}
                  ariaLabelPrefix="Lyrics stanza"
                    className={
                      lang === "en"
                        ? "lyric-text text-foreground"
                        : "lyric-text font-cn text-foreground"
                    }
                  />
                </section>
              )}

              {/* Pinyin — generated on the fly, only for the Chinese version */}
              {lang === "zh" && pinyinText && (
                <section>
                  <SectionLabel>Hanyu Pinyin</SectionLabel>
                  <Stanzas
                    text={pinyinText}
                    tokens={tokens}
                    active={activeStanza}
                    onSelect={setActiveStanza}
                  ariaLabelPrefix="Pinyin stanza"
                    className="text-[15px] leading-loose text-muted-foreground"
                  />
                </section>
              )}

              {/* Score — may be multiple pages (newline-separated URLs) */}
              {song.score_url && (
                <section>
                  <SectionLabel>Score · 乐谱</SectionLabel>
                  <div className="space-y-4">
                    {song.score_url
                      .split("\n")
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .map((url, i) =>
                        url.match(/\.pdf($|\?)/i) ? (
                          <iframe
                            key={i}
                            src={url}
                            title={`Score page ${i + 1}`}
                            className="h-[80vh] w-full rounded-md border border-border bg-white"
                          />
                        ) : (
                          <img
                            key={i}
                            src={url}
                            alt={`${song.title} score page ${i + 1}`}
                            className="w-full rounded-md border border-border bg-white"
                          />
                        ),
                      )}
                  </div>
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

/** A single 中文 / English tab button in the language switcher. */
function LangTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "px-4 py-1.5 rounded-full text-sm transition-colors " +
        (active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
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
    const hasRaf = typeof requestAnimationFrame !== "undefined";
    const rafId = hasRaf
      ? requestAnimationFrame(() => {
          el.scrollIntoView({ behavior, block: "center", inline: "nearest" });
        })
      : null;
    const timeoutId = !hasRaf
      ? setTimeout(() => {
          el.scrollIntoView({ behavior, block: "center", inline: "nearest" });
        }, 16)
      : null;
    return () => {
      if (rafId !== null && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) clearTimeout(timeoutId);
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