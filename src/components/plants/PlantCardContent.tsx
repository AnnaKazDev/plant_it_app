import type { PlantCardPageData } from "@/lib/plant-page";
import ActionTeaser, { PlantAvatar } from "@/components/plants/ActionTeaser";
import AddActionForm from "@/components/plants/AddActionForm";

interface Props {
  plant: NonNullable<PlantCardPageData["plant"]>;
}

export default function PlantCardContent({ plant }: Props) {
  return (
    <div className="space-y-8">
      <a href="/plants" className="text-muted-foreground hover:text-foreground inline-block text-sm transition-colors">
        ← All plants
      </a>

      <div className="flex items-start gap-4">
        <PlantAvatar signedPhotoUrl={plant.signed_photo_url} alt={plant.display_name} />
        <div>
          <h1 className="from-primary to-secondary bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent">
            {plant.display_name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {plant.actions.length === 0
              ? "No actions yet — add your first action below."
              : `${String(plant.actions.length)} action${plant.actions.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {plant.actions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-foreground text-lg font-semibold">Actions</h2>
          <div className="space-y-3">
            {plant.actions.map((action) => (
              <ActionTeaser key={action.id} action={action} />
            ))}
          </div>
        </section>
      ) : (
        <div className="border-border bg-muted/20 rounded-xl border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Add your first action to start tracking this plant&apos;s story.
          </p>
        </div>
      )}

      <AddActionForm plantId={plant.id} />
    </div>
  );
}
