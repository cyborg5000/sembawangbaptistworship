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
  ArrowLeft,
  ImageIcon,
  Video,
  Globe,
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
  type Song,
  type SongInput,
} from "@/lib/songs";
import { buildSongIndex, searchRanked } from "@/lib/search";
import { SongFormDialog } from "@/components/SongFormDialog";
import { Pager } from "@/components/Pager";
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
        mode === "signin"
          ? await signIn(email, password)
          : await signUp(email, password);
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
        <form
          onSubmit={submit}
          className="space-y-4 rounded-lg border border-border bg-card p-6"
        >
          <h1 className="font-serif-display text-2xl text-foreground">
            {mode === "signin" ? "Admin sign in" : "Create admin account"}
          </h1>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Email
            </label>
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
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Song | null>(null);

  const fuse = useMemo(() => buildSongIndex(songs), [songs]);
  const rows = useMemo(
    () => (query.trim() ? searchRanked(fuse, query) : songs),
    [query, fuse, songs],
  );

  // Pagination — 20 songs per page.
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [query]);
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

  const handleSubmit = async (input: SongInput) => {
    if (editing) await updateMut.mutateAsync({ id: editing.id, input });
    else await createMut.mutateAsync(input);
  };

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

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Title 中文</TableHead>
                <TableHead className="hidden md:table-cell">English</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="w-14 text-center">谱</TableHead>
                <TableHead className="w-14 text-center">视频</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </TableCell>
                  <TableCell className="font-cn font-medium text-foreground">
                    {s.title}
                  </TableCell>
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
                      <Video className="h-4 w-4 mx-auto text-accent" />
                    ) : (
                      <span className="text-muted-foreground/40">–</span>
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
