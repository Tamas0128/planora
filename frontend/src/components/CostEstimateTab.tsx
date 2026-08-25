"use client";

import { useState } from "react";
import CostEstimateDetailedTab from "@/components/CostEstimateDetailedTab";
import CostEstimateRoughTab from "@/components/CostEstimateRoughTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CostEstimateTab({
  projectId,
  defaultFloorAreaSqm,
  hasCustomer,
  canEdit,
}: {
  projectId: number;
  defaultFloorAreaSqm?: number;
  hasCustomer: boolean;
  canEdit: boolean;
}) {
  const [subTab, setSubTab] = useState<"rough" | "detailed">("rough");

  return (
    <Tabs value={subTab} onValueChange={(v) => setSubTab(v as typeof subTab)}>
      <TabsList>
        <TabsTrigger value="rough">Gyorsbecslés</TabsTrigger>
        <TabsTrigger value="detailed">Tételes költségvetés</TabsTrigger>
      </TabsList>
      <TabsContent value="rough" className="mt-3">
        <CostEstimateRoughTab projectId={projectId} defaultFloorAreaSqm={defaultFloorAreaSqm} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="detailed" className="mt-3">
        <CostEstimateDetailedTab projectId={projectId} hasCustomer={hasCustomer} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
