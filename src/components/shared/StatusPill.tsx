import { cn } from "@/lib/utils";

type Tone = "success" | "neutral" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success/15 text-success border-success/30",
  neutral: "bg-muted text-muted-foreground border-border",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-secondary/15 text-secondary border-secondary/30",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-success": tone === "success",
        "bg-muted-foreground": tone === "neutral",
        "bg-warning": tone === "warning",
        "bg-destructive": tone === "danger",
        "bg-secondary": tone === "info",
      })} />
      {children}
    </span>
  );
}
