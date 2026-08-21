import { tierColorFor, tierTextColor, tierIconMap } from "@/lib/tiers";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  icon?: string | null;
  /** Cor do banco — fallback se o nome não bater na paleta canônica. */
  fallbackColor?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  interactive?: boolean;
}

export function TierBadge({
  name,
  icon,
  fallbackColor,
  size = "sm",
  className,
  interactive = false,
}: Props) {
  const bg = tierColorFor(name, fallbackColor ?? "#888");
  const fg = tierTextColor(bg);
  const Icon = tierIconMap[icon ?? "award"] ?? tierIconMap.award;

  const sizeClasses = {
    sm: "text-[11px] h-5 px-2 gap-1",
    md: "text-xs h-6 px-2.5 gap-1.5",
    lg: "text-sm h-8 px-3 gap-2",
  }[size];

  const iconSize = { sm: "h-3 w-3", md: "h-3.5 w-3.5", lg: "h-4 w-4" }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold shadow-sm whitespace-nowrap",
        sizeClasses,
        interactive && "transition-transform hover:scale-105",
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      <Icon className={iconSize} aria-hidden />
      <span>{name}</span>
    </span>
  );
}
