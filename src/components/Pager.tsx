import { ChevronLeft, ChevronRight } from "lucide-react";

/** Simple Prev / page X of Y / Next pager. Renders nothing for a single page. */
export function Pager({
  page,
  pageCount,
  onPage,
  total,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  total?: number;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-8">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Prev
      </button>
      <span className="text-sm text-muted-foreground tabular-nums">
        Page {page} / {pageCount}
        {total != null && <span className="hidden sm:inline"> · {total} songs</span>}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
