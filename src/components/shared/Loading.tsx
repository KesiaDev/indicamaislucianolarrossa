import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Loading({ className, label = "Carregando…" }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex min-h-[200px] items-center justify-center text-muted-foreground", className)}>
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> {label}
    </div>
  );
}
