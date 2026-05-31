import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Heart, Pencil, Trash2, ExternalLink } from "lucide-react";
import { type Song, youtubeEmbed } from "@/lib/songs";
import { useFavorites } from "@/hooks/use-favorites";

interface Props {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (song: Song) => void;
  onDelete: (song: Song) => void;
}

export function SongSheet({ song, open, onOpenChange, onEdit, onDelete }: Props) {
  const { isFavorite, toggle } = useFavorites();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto bg-card p-0"
      >
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
                  <pre className="lyric-text whitespace-pre-wrap font-cn text-foreground">
                    {song.lyrics}
                  </pre>
                </section>
              )}

              {/* Pinyin */}
              {song.pinyin && (
                <section>
                  <SectionLabel>Hanyu Pinyin</SectionLabel>
                  <pre className="whitespace-pre-wrap text-[15px] leading-loose text-muted-foreground">
                    {song.pinyin}
                  </pre>
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