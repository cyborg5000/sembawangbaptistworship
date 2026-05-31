import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type Song, type SongInput } from "@/lib/songs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Song | null;
  onSubmit: (input: SongInput) => Promise<void>;
}

const empty: SongInput = {
  title: "",
  description: "",
  lyrics: "",
  pinyin: "",
  score_url: "",
  video_url: "",
  tags: [],
};

export function SongFormDialog({ open, onOpenChange, initial, onSubmit }: Props) {
  const [form, setForm] = useState<SongInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              title: initial.title,
              description: initial.description,
              lyrics: initial.lyrics,
              pinyin: initial.pinyin,
              score_url: initial.score_url,
              video_url: initial.video_url,
              tags: initial.tags ?? [],
            }
          : empty,
      );
    }
  }, [open, initial]);

  const update = <K extends keyof SongInput>(k: K, v: SongInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="font-serif-display text-2xl">
            {initial ? "Edit song" : "Add a song"}
          </DialogTitle>
          <DialogDescription>
            All fields except title are optional. Paste a YouTube link or a direct video URL.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title 标题" required>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="奇异恩典 / Amazing Grace"
              required
            />
          </Field>
          <Field label="Description 描述">
            <Input
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Hymn · Key of G"
            />
          </Field>
          <Field label="Tags 标签">
            <Input
              value={form.tags.join(", ")}
              onChange={(e) =>
                update(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                )
              }
              placeholder="christmas, communion, praise"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Comma-separated. Tags are searchable from the main search bar.
            </p>
          </Field>
          <Field label="Lyrics 歌词">
            <Textarea
              value={form.lyrics}
              onChange={(e) => update("lyrics", e.target.value)}
              rows={6}
              className="font-cn"
              placeholder={"奇异恩典 何等甘甜\n我罪已得赦免..."}
            />
          </Field>
          <Field label="Hanyu Pinyin">
            <Textarea
              value={form.pinyin}
              onChange={(e) => update("pinyin", e.target.value)}
              rows={4}
              placeholder="qí yì ēn diǎn hé děng gān tián..."
            />
          </Field>
          <Field label="Score URL (image or PDF)">
            <Input
              value={form.score_url}
              onChange={(e) => update("score_url", e.target.value)}
              placeholder="https://res.cloudinary.com/.../score.jpg"
            />
          </Field>
          <Field label="Video URL (YouTube or direct)">
            <Input
              value={form.video_url}
              onChange={(e) => update("video_url", e.target.value)}
              placeholder="https://youtu.be/..."
            />
          </Field>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>
              {saving ? "Saving…" : initial ? "Save changes" : "Add song"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {label} {required && <span className="text-accent">*</span>}
      </Label>
      {children}
    </div>
  );
}