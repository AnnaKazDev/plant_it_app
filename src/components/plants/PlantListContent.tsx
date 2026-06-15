import PlantListItem from "@/components/plants/PlantListItem";
import type { PlantListItem as PlantListItemData } from "@/lib/plant-page";

interface PlantListContentProps {
  plants: PlantListItemData[];
}

export default function PlantListContent({ plants }: PlantListContentProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h1 className="from-primary to-secondary bg-gradient-to-r bg-clip-text text-2xl font-bold">
              My plants
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Your garden roster in one place. Each card highlights the latest care activity for that plant — open it
              for the full timeline, or add a new entry right away.
            </p>
          </div>
        </div>

        {plants.length > 0 ? (
          <dl className="border-border/60 bg-muted/20 flex flex-wrap gap-x-6 gap-y-3 rounded-xl border px-4 py-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Sorting</dt>
              <dd className="text-foreground font-medium">Most recent activity first</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Plants</dt>
              <dd className="text-foreground font-medium">
                {plants.length} plant{plants.length === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
        ) : null}
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
