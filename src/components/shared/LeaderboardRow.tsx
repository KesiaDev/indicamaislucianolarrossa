import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TierBadge } from "@/components/shared/TierBadge";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  position: number | null;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  conversions: number;
  points: number;
  isMe?: boolean;
  tier?: { name: string; color: string; icon?: string | null } | null;
  index?: number;
}

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function LeaderboardRow({
  position,
  name,
  email,
  avatarUrl,
  conversions,
  points,
  isMe,
  tier,
  index = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={cn(
        "flex items-center gap-3 py-3 px-3 rounded-xl",
        isMe && "bg-primary/10 border-l-4 border-primary shadow-sm",
      )}
    >
      <span
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
          isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        #{position ?? "—"}
      </span>
      <Avatar className="h-10 w-10">
        <AvatarImage src={avatarUrl ?? undefined} />
        <AvatarFallback>{initials(name, email)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate flex items-center gap-1.5">
          <span className="truncate">{name || email}</span>
          {isMe && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold shrink-0">
              <Star className="h-3 w-3" /> você
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground font-medium">
          {conversions} amigos · {points} pts
        </p>
      </div>
      {tier && (
        <TierBadge name={tier.name} icon={tier.icon} fallbackColor={tier.color} className="shrink-0" />
      )}
    </motion.div>
  );
}
