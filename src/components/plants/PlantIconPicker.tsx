import { PLANT_ICON_OPTIONS, type PlantIconId } from "@/lib/plant-icons";
import { cn } from "@/lib/utils";

interface PlantIconPickerProps {
  value: PlantIconId;
  onChange: (id: PlantIconId) => void;
}

export default function PlantIconPicker({ value, onChange }: PlantIconPickerProps) {
  return (
    <div role="group" aria-label="Plant icon" className="-m-[3px] flex flex-wrap">
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
              "bg-primary text-primary-foreground m-[3px] flex size-10 shrink-0 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105",
              isSelected && "ring-primary-foreground scale-105 ring-2 ring-offset-2 ring-offset-background",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
