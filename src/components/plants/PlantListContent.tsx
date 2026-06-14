import PlantListItem from "@/components/plants/PlantListItem";
import type { PlantListItem as PlantListItemData } from "@/lib/plant-page";

interface PlantListContentProps {
  plants: PlantListItemData[];
}

export default function PlantListContent({ plants }: PlantListContentProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="from-primary to-secondary bg-gradient-to-r bg-clip-text text-2xl font-bold">
          Plant List
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {plants.length > 0 ? (
            <a
              href="/garden-map"
              className="border-border bg-muted hover:bg-muted/80 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            >
              Garden map
            </a>
          ) : null}
          <a
            href="/plants/new"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Add plant
          </a>
        </div>
      </div>

      {plants.length === 0 ? (
        <div className="border-border bg-muted/20 space-y-4 rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">You have no plants yet. Add your first one to start tracking.</p>
          <a
            href="/plants/new"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Add your first plant
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {plants.map((plant) => (
            <PlantListItem key={plant.id} plant={plant} />
          ))}
        </div>
      )}
    </div>
  );
}
