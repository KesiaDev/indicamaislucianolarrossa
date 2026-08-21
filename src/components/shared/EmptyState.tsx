import { forwardRef, ReactNode } from "react";
import { Inbox, LucideIcon } from "lucide-react";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, Props>(function EmptyState(
  { icon: Icon = Inbox, title, description, action, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`flex flex-col items-center justify-center text-center py-16 px-4 ${className ?? ""}`}
      {...rest}
    >
      <div className="rounded-full bg-muted p-3 mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
});
