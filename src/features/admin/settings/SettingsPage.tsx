import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IntegrationsTab } from "./IntegrationsTab";
import { BrandingTab } from "./BrandingTab";
import { TiersTab } from "./tiers/TiersTab";
import { NotificationsTab } from "./NotificationsTab";

export default function SettingsPage() {
  return (
    <>
      <h2 className="text-2xl font-semibold mb-6">Definições</h2>
      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Marca</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="notifications">Mensagens</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
        </TabsList>
        <TabsContent value="branding" className="mt-4">
          <BrandingTab />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="tiers" className="mt-4">
          <TiersTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
