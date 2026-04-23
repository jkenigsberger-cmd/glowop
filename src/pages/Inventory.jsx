import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NeighborhoodSection from "@/components/inventory/NeighborhoodSection";
import FacilitiesPanel from "@/components/inventory/FacilitiesPanel";
import ActivitySpacesPanel from "@/components/inventory/ActivitySpacesPanel";
import SeedButton from "@/components/inventory/SeedButton";
import { Home, Droplets, Shield, Loader2 } from "lucide-react";

export default function Inventory() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === "admin";

  const { data: neighborhoods = [], refetch: refetchNeighborhoods } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: () => base44.entities.Neighborhood.list("sort_order"),
  });

  const { data: tents = [], refetch: refetchTents } = useQuery({
    queryKey: ["tents"],
    queryFn: () => base44.entities.Tent.list("code", 200),
  });

  const { data: beds = [], refetch: refetchBeds } = useQuery({
    queryKey: ["beds"],
    queryFn: () => base44.entities.Bed.list("code", 400),
  });

  const { data: facilityAreas = [], refetch: refetchAreas } = useQuery({
    queryKey: ["facilityAreas"],
    queryFn: () => base44.entities.FacilityArea.list("sort_order"),
  });

  const { data: facilities = [], refetch: refetchFacilities } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => base44.entities.Facility.list("unit_number", 100),
  });

  const { data: activitySpaces = [], refetch: refetchSpaces } = useQuery({
    queryKey: ["activitySpaces"],
    queryFn: () => base44.entities.ActivitySpace.list("code"),
  });

  const refetchAll = useCallback(() => {
    refetchNeighborhoods();
    refetchTents();
    refetchBeds();
    refetchAreas();
    refetchFacilities();
    refetchSpaces();
  }, [refetchNeighborhoods, refetchTents, refetchBeds, refetchAreas, refetchFacilities, refetchSpaces]);

  const isLoading = neighborhoods.length === 0 && tents.length === 0;
  const isEmpty = !isLoading && neighborhoods.length === 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">מלאי פיזי</h1>
            <p className="text-sm text-muted-foreground mt-0.5">משק אהרונסון — Glow Glamping</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Summary badges */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="bg-muted px-2 py-1 rounded">{neighborhoods.length}/8 שכונות</span>
              <span className="bg-muted px-2 py-1 rounded">{tents.length}/51 אוהלים</span>
              <span className="bg-muted px-2 py-1 rounded">{beds.length}/335 מיטות</span>
            </div>
            {isAdmin && <SeedButton onSeeded={refetchAll} />}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {isEmpty && (
          <div className="text-center py-20 space-y-4">
            <p className="text-muted-foreground text-lg">אין נתוני מלאי עדיין.</p>
            {isAdmin ? (
              <p className="text-sm text-muted-foreground">לחץ על <strong>זרע מלאי ראשוני</strong> בפינה הימנית העליונה כדי לאתחל את כל הנתונים הפיזיים.</p>
            ) : (
              <p className="text-sm text-muted-foreground">יש לבקש מהמנהל לאתחל את המלאי.</p>
            )}
          </div>
        )}

        {!isEmpty && (
          <Tabs defaultValue="neighborhoods" dir="rtl">
            <TabsList className="mb-6">
              <TabsTrigger value="neighborhoods" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                שכונות ואוהלים
              </TabsTrigger>
              <TabsTrigger value="facilities" className="flex items-center gap-2">
                <Droplets className="w-4 h-4" />
                שירותים ומקלחות
              </TabsTrigger>
              <TabsTrigger value="spaces" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                מרחבי פעילות
              </TabsTrigger>
            </TabsList>

            <TabsContent value="neighborhoods">
              <div className="space-y-3">
                {neighborhoods.map((n) => (
                  <NeighborhoodSection
                    key={n.id}
                    neighborhood={n}
                    tents={tents}
                    beds={beds}
                    isAdmin={isAdmin}
                    onDataChange={refetchAll}
                  />
                ))}
              </div>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex flex-wrap gap-4">
                <span>סה"כ שכונות: <strong>{neighborhoods.length}</strong></span>
                <span>סה"כ אוהלים: <strong>{tents.length}</strong></span>
                <span>סה"כ מיטות: <strong>{beds.length}</strong></span>
              </div>
            </TabsContent>

            <TabsContent value="facilities">
              <FacilitiesPanel
                facilityAreas={facilityAreas}
                facilities={facilities}
                isAdmin={isAdmin}
                onDataChange={refetchAll}
              />
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex flex-wrap gap-4">
                <span>אזורים: <strong>{facilityAreas.length}</strong></span>
                <span>מתקנים: <strong>{facilities.length}</strong></span>
                <span>מקלחות: <strong>{facilities.filter(f => f.facility_type === "SHOWER").length}</strong></span>
                <span>שירותים: <strong>{facilities.filter(f => f.facility_type === "TOILET").length}</strong></span>
              </div>
            </TabsContent>

            <TabsContent value="spaces">
              <ActivitySpacesPanel
                spaces={activitySpaces}
                isAdmin={isAdmin}
                onDataChange={refetchAll}
              />
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                <span>סה"כ מרחבים: <strong>{activitySpaces.length}</strong>/9</span>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}