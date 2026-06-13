import { PLANT_ICON_OPTIONS, type PlantIconId } from "@/lib/plant-icons";
import { cn } from "@/lib/utils";

interface PlantIconPickerProps {
  value: PlantIconId;
  onChange: (id: PlantIconId) => void;
}

export default function PlantIconPicker({ value, onChange }: PlantIconPickerProps) {
  return (
    <div role="group" aria-label="Plant icon" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {PLANT_ICON_OPTIONS.map(({ id, label, Icon }) => {
        const isSelected = value === id;

        return (
          <button
            key={id}
            type="button"
            aria-pressed={isSelected}
            aria-label={label}
            title={label}
            onClick={() => {
              onChange(id);
            }}
            className={cn(
              "border-border hover:bg-accent flex size-10 items-center justify-center rounded-md border transition-colors",
              isSelected && "border-primary bg-primary/10 ring-primary ring-2",
            )}
          >
            <Icon className="text-foreground size-5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
