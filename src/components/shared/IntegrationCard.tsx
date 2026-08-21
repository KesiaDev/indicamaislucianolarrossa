import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/StatusPill";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  connected: boolean;
  enabled?: boolean;
  canEdit?: boolean;
  onToggleEnabled?: (v: boolean) => void;
  onSave?: () => void;
  onTest?: () => void;
  saving?: boolean;
  testing?: boolean;
  extraActions?: ReactNode;
  saveLabel?: string;
  children: ReactNode;
}

export function IntegrationCard({
  title,
  description,
  icon: Icon,
  connected,
  enabled,
  canEdit = true,
  onToggleEnabled,
  onSave,
  onTest,
  saving,
  testing,
  extraActions,
  saveLabel = "Salvar",
  children,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusPill tone={connected ? "success" : "neutral"}>
              {connected ? "Conectado" : "Desconectado"}
            </StatusPill>
            {onToggleEnabled && (
              <Switch
                checked={!!enabled}
                onCheckedChange={onToggleEnabled}
                disabled={!canEdit}
                aria-label="Ativar integração"
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-secondary/10 p-2.5 text-secondary shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            {children}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {extraActions}
              {onTest && (
                <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={testing}>
                  {testing ? "Testando..." : "Testar"}
                </Button>
              )}
              {onSave && (
                <Button type="button" size="sm" onClick={onSave} disabled={!canEdit || saving}>
                  {saving ? "Salvando..." : saveLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
