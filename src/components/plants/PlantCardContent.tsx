import { useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import ActionTeaserCard from "@/components/plants/ActionTeaserCard";
import AddActionForm from "@/components/plants/AddActionForm";
import GrowthTimeline from "@/components/plants/GrowthTimeline";
import { PlantAvatar, plannedBadgeClass, teaserElevationClass } from "@/components/plants/ActionTeaser";
import { Button } from "@/components/ui/button";
import { formatActionDate } from "@/lib/action-dates";
import { fetchPlantCardClient, formatPlantSinceDate, partitionActionsByPlanned } from "@/lib/plant-card-client";
import type { PlantCardPlant } from "@/lib/plant-page";
import { cn } from "@/lib/utils";

interface Props {
  plant: PlantCardPlant;
}

export default function PlantCardContent({ plant: initialPlant }: Props) {
  const [plant, setPlant] = useState(initialPlant);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDeletePlant, setConfirmDeletePlant] = useState(false);
  const [isDeletingPlant, setIsDeletingPlant] = useState(false);
  const [deletePlantError, setDeletePlantError] = useState("");

  const refreshPlant = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const updated = await fetchPlantCardClient(plant.id);
      setPlant(updated);
    } finally {
      setIsRefreshing(false);
    }
  }, [plant.id]);

  const { planned, history } = partitionActionsByPlanned(plant.actions);
  const lastHistoryAction = history.at(0);

  async function handleDeletePlant() {
    setIsDeletingPlant(true);
    setDeletePlantError("");

    try {
      const response = await fetch(`/api/plants/${plant.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: { message: string } };
      if (!response.ok) {
        setDeletePlantError(data.error?.message ?? "Failed to delete plant");
        return;
      }

      window.location.href = "/plants";
    } catch {
      setDeletePlantError("Network error. Please try again.");
    } finally {
      setIsDeletingPlant(false);
    }
  }

  return (
    <div className="relative space-y-8">
      <div className="flex items-start gap-4">
        <PlantAvatar
          signedPhotoUrl={plant.signed_photo_url}
          alt={plant.display_name}
          className={cn("size-48 rounded-2xl", teaserElevationClass)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="from-primary to-secondary bg-gradient-to-r bg-clip-text text-2xl font-bold">
              {plant.display_name}
            </h1>
            {plant.planned_action_count > 0 ? (
              <span className={plannedBadgeClass}>{plant.planned_action_count} planned</span>
            ) : null}
            {isRefreshing ? <span className="text-muted-foreground text-xs">Updating...</span> : null}
          </div>
        </div>
      </div>

      <dl className="border-border/60 bg-muted/20 flex flex-wrap gap-x-6 gap-y-3 rounded-xl border px-4 py-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Grid cell</dt>
          <dd className="text-foreground font-medium">{plant.grid_label}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Tracking since</dt>
          <dd className="text-foreground font-medium">{formatPlantSinceDate(plant.created_at)}</dd>
        </div>
        {lastHistoryAction ? (
          <div>
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Last activity</dt>
            <dd className="text-foreground font-medium">{formatActionDate(lastHistoryAction.date)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Planned</dt>
          <dd className="text-foreground font-medium">{plant.planned_action_count}</dd>
        </div>
      </dl>

      <GrowthTimeline actions={plant.actions} />

      {planned.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-lg font-semibold">Upcoming</h2>
          <div className="space-y-3">
            {planned.map((action) => (
              <ActionTeaserCard key={action.id} action={action} />
            ))}
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-lg font-semibold">History</h2>
          <div className="space-y-3">
            {history.map((action) => (
              <ActionTeaserCard key={action.id} action={action} />
            ))}
          </div>
        </section>
      ) : null}

      {plant.actions.length === 0 ? (
        <div className="border-border bg-muted/20 rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Add your first action to start tracking this plant&apos;s story.
          </p>
        </div>
      ) : null}

      <AddActionForm
        plantId={plant.id}
        onActionAdded={() => {
          void refreshPlant();
        }}
      />

      <section className="border-border border-t pt-6">
        {!confirmDeletePlant ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setConfirmDeletePlant(true);
              setDeletePlantError("");
            }}
          >
            <Trash2 className="size-4" />
            Delete plant
          </Button>
        ) : (
          <div className="border-destructive/30 bg-destructive/5 space-y-3 rounded-xl border p-4">
            <p className="text-foreground text-sm">
              Delete <strong>{plant.display_name}</strong> and all its actions? This cannot be undone.
            </p>
            {deletePlantError ? <p className="text-destructive text-sm">{deletePlantError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isDeletingPlant}
                onClick={() => {
                  void handleDeletePlant();
                }}
              >
                {isDeletingPlant ? "Deleting..." : "Yes, delete plant"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmDeletePlant(false);
                  setDeletePlantError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
