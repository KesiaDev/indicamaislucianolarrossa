import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "whatsapp" | "copy" | "native";

interface Props {
  icon: LucideIcon;
  label: string;
  tone?: Tone;
  onClick?: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}

const TONE: Record<
  Tone,
  { iconBg: string; iconColor: string; hover: string; ring: string }
> = {
  whatsapp: {
    iconBg: "bg-[#25D366]/15",
    iconColor: "text-[#1FAA52]",
    hover: "hover:bg-[#25D366]/10",
    ring: "focus-visible:ring-[#25D366]",
  },
  copy: {
    iconBg: "bg-secondary/15",
    iconColor: "text-secondary",
    hover: "hover:bg-secondary/10",
    ring: "focus-visible:ring-secondary",
  },
  native: {
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    hover: "hover:bg-primary/10",
    ring: "focus-visible:ring-primary",
  },
};

export function ShareButton({
  icon: Icon,
  label,
  tone = "native",
  onClick,
  ariaLabel,
  disabled,
}: Props) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className={cn(
        "group flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-4 min-h-[88px] shadow-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "active:scale-[0.98] hover:scale-[1.02]",
        t.hover,
        t.ring,
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "h-12 w-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110",
          t.iconBg,
        )}
        aria-hidden
      >
        <Icon className={cn("h-6 w-6", t.iconColor)} />
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
