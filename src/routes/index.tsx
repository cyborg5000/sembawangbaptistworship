import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Heart,
  Music,
  Search,
  Sparkles,
  FileText,
  Languages,
  Video,
  FileMusic,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  fetchSongs,
  normalizeTags,
  type Song,
} from "@/lib/songs";
import { buildSongIndex, searchRanked } from "@/lib/search";
import { useFavorites } from "@/hooks/use-favorites";
import { SongSheet } from "@/components/SongSheet";
import { TagFilterBar } from "@/components/TagFilterBar";
import logoUrl from "@/assets/sbc-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "诗歌库 · Sembawang Baptist Church Worship Songs" },
      {
        name: "description",
        content:
          "Search worship songs by title, lyrics, description, or hanyu pinyin. A worship resource for Sembawang Baptist Church 森峇旺浸信教会.",
      },
      { property: "og:title", content: "诗歌库 · SBC Worship Songs" },
      {
        property: "og:description",
        content: "Search and select worship songs for Sembawang Baptist Church.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  // Full library: drives the ranked search, tag filter bar + counts.
  const { data: allSongs = [], isLoading } = useQuery({
    queryKey: ["songs", "all"],
    queryFn: fetchSongs,
  });
  const { favorites, isFavorite, toggle } = useFavorites();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [view, setView] = useState<"all" | "favorites">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Content filters: only show songs that HAVE the chosen resource(s).
  const [needs, setNeeds] = useState<string[]>([]);
  const toggleNeed = (n: string) =>
    setNeeds((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Debounce the typed query before searching.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  // Smart ranked fuzzy index over the whole library (rebuilt only when songs change).
  const fuse = useMemo(() => buildSongIndex(allSongs), [allSongs]);

  // All tags across songs (normalized + sorted by frequency, then alphabetical).
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allSongs) {
      for (const t of normalizeTags(s.tags)) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [allSongs]);

  const toggleTag = (tag: string) =>
    setSelectedTags((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    );

  const filtered = useMemo(() => {
    // Ranked fuzzy search when there's a query; otherwise the full list (A–Z).
    let list = debouncedQuery.trim() ? searchRanked(fuse, debouncedQuery) : allSongs;
    // Tag chips: AND semantics — keep songs carrying every selected tag.
    if (selectedTags.length > 0)
      list = list.filter((s) =>
        selectedTags.every((t) => (s.tags ?? []).includes(t)),
      );
    // Content filters (AND): keep only songs that have the chosen resources.
    if (needs.includes("lyrics")) list = list.filter((s) => s.lyrics?.trim());
    if (needs.includes("english"))
      list = list.filter((s) => s.lyrics_en?.trim() || s.title_en?.trim());
    if (needs.includes("score")) list = list.filter((s) => s.score_url?.trim());
    if (needs.includes("video")) list = list.filter((s) => s.video_url?.trim());
    if (view === "favorites") list = list.filter((s) => favorites.includes(s.id));
    return list;
  }, [fuse, allSongs, debouncedQuery, selectedTags, needs, view, favorites]);

  const openSong = (s: Song) => {
    setActiveSong(s);
    setSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={logoUrl}
              alt="Sembawang Baptist Church"
              className="h-12 w-12 object-contain shrink-0"
            />
            <div className="min-w-0">
              <p className="font-cn text-foreground text-base leading-tight truncate">
                森峇旺浸信教会
              </p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-1">
                Sembawang Baptist Church · Worship
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin
          </Link>
        </div>
      </header>

      {/* Hero search */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground mb-4">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          诗歌库 · Worship Song Library
        </div>
        <h1 className="font-serif-display text-5xl sm:text-6xl md:text-7xl font-medium text-foreground leading-[1.05] tracking-tight">
          Find the song
          <br />
          <span className="italic text-accent">that lifts the room.</span>
        </h1>
        <p className="mt-5 max-w-xl text-muted-foreground">
          Search by title, description, lyric, or hanyu pinyin. Save favourites
          for quick recall before service.
        </p>

        <div className="mt-10 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search · 搜索 · sōu suǒ…"
            className="h-16 sm:h-20 pl-14 pr-6 text-lg sm:text-xl rounded-md border-2 border-border bg-card focus-visible:border-accent focus-visible:ring-0 shadow-sm font-cn"
          />
        </div>

        <div className="mt-6 flex items-center gap-1">
          <FilterChip active={view === "all"} onClick={() => setView("all")}>
            All <span className="ml-2 text-xs text-muted-foreground">{allSongs.length}</span>
          </FilterChip>
          <FilterChip active={view === "favorites"} onClick={() => setView("favorites")}>
            <Heart className="h-3.5 w-3.5 mr-2" /> Favourites
            <span className="ml-2 text-xs text-muted-foreground">{favorites.length}</span>
          </FilterChip>
        </div>

        {/* Content filters: show only songs that have a score / video / lyrics / English */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <NeedChip active={needs.includes("score")} onClick={() => toggleNeed("score")}>
            <FileMusic className="h-3.5 w-3.5" /> Score 谱
          </NeedChip>
          <NeedChip active={needs.includes("video")} onClick={() => toggleNeed("video")}>
            <Video className="h-3.5 w-3.5" /> Video 视频
          </NeedChip>
          <NeedChip active={needs.includes("lyrics")} onClick={() => toggleNeed("lyrics")}>
            <FileText className="h-3.5 w-3.5" /> Lyrics 词
          </NeedChip>
          <NeedChip active={needs.includes("english")} onClick={() => toggleNeed("english")}>
            <Languages className="h-3.5 w-3.5" /> English
          </NeedChip>
        </div>

        {allTags.length > 0 && (
          <TagFilterBar
            tags={allTags}
            selected={selectedTags}
            onToggle={toggleTag}
            onClear={() => setSelectedTags([])}
          />
        )}
      </section>

      {/* List */}
      <section className="mx-auto max-w-5xl px-6 pb-32">
        {isLoading ? (
          <EmptyState icon={<Music />} title="Loading songs…" />
        ) : filtered.length === 0 ? (
          allSongs.length === 0 ? (
            <EmptyState
              icon={<Music />}
              title="No songs yet"
              hint="Tap “Add song” to build your library."
            />
          ) : view === "favorites" ? (
            <EmptyState
              icon={<Heart />}
              title="No favourites yet"
              hint="Tap the heart on any song to save it here."
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title="No matches"
              hint={`Nothing found for “${query}”.`}
            />
          )
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => openSong(s)}
                  className="group w-full text-left px-2 sm:px-4 py-5 flex items-center gap-5 hover:bg-secondary/60 transition-colors"
                >
                  <span className="font-serif-display text-2xl sm:text-3xl text-muted-foreground/60 group-hover:text-accent transition-colors w-10 tabular-nums shrink-0">
                    {(filtered.indexOf(s) + 1).toString().padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <p className="font-serif-display text-xl sm:text-2xl text-foreground truncate font-medium">
                        {s.title}
                      </p>
                      <SongBadges song={s} />
                    </div>
                    {(s.description || s.title_en) && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {s.description || s.title_en}
                      </p>
                    )}
                    {s.tags && s.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.tags.slice(0, 6).map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(s.id);
                    }}
                    className="p-2 rounded-sm hover:bg-background transition-colors shrink-0"
                    aria-label="Toggle favourite"
                  >
                    <Heart
                      className={
                        "h-5 w-5 " +
                        (isFavorite(s.id)
                          ? "fill-accent text-accent"
                          : "text-muted-foreground/60 group-hover:text-foreground")
                      }
                    />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>森峇旺浸信教会 · Sembawang Baptist Church</span>
          <span className="italic">“Sing to the Lord a new song” — Psalm 96:1</span>
        </div>
      </footer>

      <SongSheet
        song={activeSong}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        query={query}
      />
    </div>
  );
}

/** At-a-glance icons showing which resources a song has. */
function SongBadges({ song }: { song: Song }) {
  const hasLyrics = !!song.lyrics?.trim();
  const hasEnglish = !!(song.lyrics_en?.trim() || song.title_en?.trim());
  const hasScore = !!song.score_url?.trim();
  const hasVideo = !!song.video_url?.trim();
  return (
    <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/70">
      {hasLyrics && <FileText className="h-3.5 w-3.5" aria-label="Has lyrics" />}
      {hasEnglish && <Languages className="h-3.5 w-3.5" aria-label="Has English version" />}
      {hasScore && <FileMusic className="h-3.5 w-3.5 text-accent/80" aria-label="Has score" />}
      {hasVideo && <Video className="h-3.5 w-3.5 text-accent/80" aria-label="Has video" />}
    </div>
  );
}

/** Toggle chip for the content filters (score / video / lyrics / English). */
function NeedChip({
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
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors border " +
        (active
          ? "bg-accent/10 border-accent/40 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary")
      }
    >
      {children}
    </button>
  );
}

function FilterChip({
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
      onClick={onClick}
      className={
        "inline-flex items-center px-4 py-2 rounded-full text-sm transition-colors " +
        (active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary")
      }
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <p className="font-serif-display text-xl text-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
