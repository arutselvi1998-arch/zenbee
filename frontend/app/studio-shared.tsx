export type Series = {
  id: number;
  name: string;
  description: string;
  characters: string;
  visual_style: string;
};
export type Scene = {
  number: number;
  duration_seconds: number;
  visual_prompt: string;
  dialogue: string;
  narration: string;
  caption: string;
};
export type Story = {
  title: string;
  synopsis: string;
  continuity_notes: string;
  scenes: Scene[];
  description: string;
  hashtags: string[];
};
export type Episode = {
  id: number;
  series_id: number;
  topic: string;
  publish_at: string;
  generate_at: string;
  status: string;
  story: Story | null;
  error: string | null;
  generation_mode: string | null;
  attempts: number;
};

// Artwork is clipped from the supplied references with CSS; UI and text are live HTML.
export function Art({
  source = "series",
  crop = [310, 411, 274, 100],
  className = "",
  label = "ZENBEE cartoon artwork",
}: {
  source?: string;
  crop?: number[];
  className?: string;
  label?: string;
}) {
  const [x, y, w, h] = crop;
  return (
    <div
      className={"z-art " + className}
      style={{ aspectRatio: `${w}/${h}` }}
      role="img"
      aria-label={label}
    >
      <img
        src={`/art/${source}.png`}
        alt=""
        draggable={false}
        style={{
          width: `${(1672 / w) * 100}%`,
          maxWidth: "none",
          left: `${(-x / w) * 100}%`,
          top: `${(-y / h) * 100}%`,
          height: `${(941 / h) * 100}%`,
        }}
      />
    </div>
  );
}
