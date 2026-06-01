import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Search,
  ImageIcon,
  Video,
  Globe,
  ExternalLink,
  Check,
  X,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createSong,
  deleteSong,
  fetchSongs,
  updateSong,
  approvedVideoUrl,
  normalizeTags,
  setSongVideoCandidate,
  setSongVideoStatus,
  type Song,
  type SongInput,
} from "@/lib/songs";
import { buildSongIndex, searchRanked } from "@/lib/search";
import { SongFormDialog } from "@/components/SongFormDialog";
import { Pager } from "@/components/Pager";
import { TagFilterBar } from "@/components/TagFilterBar";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin · SBC Worship Songs" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  return session ? <AdminDashboard /> : <LoginForm />;
}

/* ----------------------------- Login ----------------------------- */
function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } =
        mode === "signin" ? await signIn(email, password) : await signUp(email, password);
      if (error) {
        toast.error(error.message);
      } else if (mode === "signup") {
        toast.success("Account created. If email confirmation is on, check your inbox.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-cn text-lg text-foreground">森峇旺浸信教会</p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-1">
            Worship Songs · Admin
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h1 className="font-serif-display text-2xl text-foreground">
            {mode === "signin" ? "Admin sign in" : "Create admin account"}
          </h1>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? "First time? Create the admin account"
              : "Have an account? Sign in"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to song library
          </Link>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Dashboard --------------------------- */
function AdminDashboard() {
  const { email, signOut } = useAuth();
  const qc = useQueryClient();
  const { data: songs = [] } = useQuery({ queryKey: ["songs", "all"], queryFn: fetchSongs });

  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [videoFilter, setVideoFilter] = useState<"all" | "missing" | "pending">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);

  const fuse = useMemo(() => buildSongIndex(songs), [songs]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of songs) {
      for (const t of normalizeTags(s.tags)) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [songs]);

  const toggleTag = (tag: string) =>
    setSelectedTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  const rows = useMemo(() => {
    let list = query.trim() ? searchRanked(fuse, query) : songs;
    if (selectedTags.length > 0) {
      list = list.filter((s) => selectedTags.every((t) => (s.tags ?? []).includes(t)));
    }
    if (videoFilter === "missing") list = list.filter((s) => !approvedVideoUrl(s));
    if (videoFilter === "pending")
      list = list.filter((s) => s.video_status === "pending" && !!s.video_url?.trim());
    return list;
  }, [query, fuse, songs, selectedTags, videoFilter]);

  // Pagination — 20 songs per page.
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [query, selectedTags, videoFilter]);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const createMut = useMutation({
    mutationFn: (input: SongInput) => createSong(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Song added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SongInput }) => updateSong(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSong(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const videoCandidateMut = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => setSongVideoCandidate(id, url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      toast.success("YouTube video queued for approval");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const videoStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      setSongVideoStatus(id, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      toast.success(vars.status === "approved" ? "Video approved" : "Video rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = async (input: SongInput) => {
    const videoChanged = (input.video_url ?? "").trim() !== (editing?.video_url ?? "").trim();
    const nextInput =
      videoChanged && input.video_url.trim()
        ? { ...input, video_status: "pending" as const }
        : input;
    if (editing) await updateMut.mutateAsync({ id: editing.id, input: nextInput });
    else await createMut.mutateAsync(nextInput);
  };

  const openYouTubeSearch = (song: Song) => {
    const terms = [
      song.title_en || song.title,
      song.title_en && song.title,
      "worship song",
      "lyrics",
    ]
      .filter(Boolean)
      .join(" ");
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(terms)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const queueYouTubeCandidate = (song: Song) => {
    const url = window.prompt(`Paste the YouTube URL to queue for "${song.title}"`);
    if (!url?.trim()) return;
    videoCandidateMut.mutate({ id: song.id, url: url.trim() });
  };

  const liveVideoCount = songs.filter((s) => approvedVideoUrl(s)).length;
  const pendingVideoCount = songs.filter(
    (s) => s.video_status === "pending" && s.video_url?.trim(),
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-serif-display text-xl text-foreground">Song Admin</span>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {songs.length} songs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">View site</span>
              </Button>
            </Link>
            <span className="hidden md:inline text-xs text-muted-foreground">{email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search to find a song to edit…"
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" /> Add song
          </Button>
        </div>

        {allTags.length > 0 && (
          <div className="mb-4">
            <TagFilterBar
              tags={allTags}
              selected={selectedTags}
              onToggle={toggleTag}
              onClear={() => setSelectedTags([])}
            />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <VideoFilterButton active={videoFilter === "all"} onClick={() => setVideoFilter("all")}>
            All videos <span>{liveVideoCount}</span>
          </VideoFilterButton>
          <VideoFilterButton
            active={videoFilter === "missing"}
            onClick={() => setVideoFilter("missing")}
          >
            Needs video <span>{songs.length - liveVideoCount}</span>
          </VideoFilterButton>
          <VideoFilterButton
            active={videoFilter === "pending"}
            onClick={() => setVideoFilter("pending")}
          >
            Pending approval <span>{pendingVideoCount}</span>
          </VideoFilterButton>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Title 中文</TableHead>
                <TableHead className="hidden md:table-cell">English</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="w-14 text-center">谱</TableHead>
                <TableHead className="w-[280px]">视频</TableHead>
                <TableHead className="w-24 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </TableCell>
                  <TableCell className="font-cn font-medium text-foreground">{s.title}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {s.title_en || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(s.tags ?? []).slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {s.score_url ? (
                      <ImageIcon className="h-4 w-4 mx-auto text-accent" />
                    ) : (
                      <span className="text-muted-foreground/40">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.video_url ? (
                      <VideoWorkflow
                        song={s}
                        onSearch={() => openYouTubeSearch(s)}
                        onQueue={() => queueYouTubeCandidate(s)}
                        onApprove={() => videoStatusMut.mutate({ id: s.id, status: "approved" })}
                        onReject={() => videoStatusMut.mutate({ id: s.id, status: "rejected" })}
                        busy={videoCandidateMut.isPending || videoStatusMut.isPending}
                      />
                    ) : (
                      <VideoWorkflow
                        song={s}
                        onSearch={() => openYouTubeSearch(s)}
                        onQueue={() => queueYouTubeCandidate(s)}
                        onApprove={() => videoStatusMut.mutate({ id: s.id, status: "approved" })}
                        onReject={() => videoStatusMut.mutate({ id: s.id, status: "rejected" })}
                        busy={videoCandidateMut.isPending || videoStatusMut.isPending}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditing(s);
                          setFormOpen(true);
                        }}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${s.title}"? This cannot be undone.`))
                            deleteMut.mutate(s.id);
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No songs match “{query}”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} pageCount={pageCount} onPage={setPage} total={rows.length} />
      </div>

      <SongFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function VideoFilterButton({
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
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors " +
        (active
          ? "border-accent/40 bg-accent/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function VideoWorkflow({
  song,
  onSearch,
  onQueue,
  onApprove,
  onReject,
  busy,
}: {
  song: Song;
  onSearch: () => void;
  onQueue: () => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const liveUrl = approvedVideoUrl(song);
  const pending = song.video_status === "pending" && !!song.video_url?.trim();
  const rejected = song.video_status === "rejected" && !!song.video_url?.trim();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {liveUrl ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[11px] text-foreground">
          <Check className="h-3 w-3" />
          Approved
        </span>
      ) : pending ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      ) : rejected ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          <X className="h-3 w-3" />
          Rejected
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground">No approved video</span>
      )}

      {song.video_url?.trim() && (
        <a
          href={song.video_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Open video"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
      {pending && (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-accent"
            onClick={onApprove}
            disabled={busy}
            aria-label="Approve YouTube video"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            onClick={onReject}
            disabled={busy}
            aria-label="Reject YouTube video"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
      {!liveUrl && (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onSearch}
            aria-label="Search YouTube"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            onClick={onQueue}
            disabled={busy}
          >
            Queue
          </Button>
        </>
      )}
    </div>
  );
}
