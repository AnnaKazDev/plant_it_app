import { useState } from "react";
import { CircleAlert, ImagePlus, Sprout } from "lucide-react";
import GardenGridPicker from "@/components/plants/GardenGridPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_FILE_SIZE } from "@/lib/photo-validation";
import { cn } from "@/lib/utils";

interface Props {
  gardenWidth: number;
  gardenHeight: number;
  gardenName?: string;
}

interface FormErrors {
  name?: string;
  photo?: string;
  submit?: string;
}

export default function AddPlantForm({ gardenWidth, gardenHeight, gardenName }: Props) {
  const [name, setName] = useState("");
  const [gridX, setGridX] = useState(0);
  const [gridY, setGridY] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const next: FormErrors = {};
    const trimmed = name.trim();

    if (!trimmed) {
      next.name = "Plant name is required";
    } else if (trimmed.length > 200) {
      next.name = "Name must be at most 200 characters";
    }

    if (photoFile) {
      if (!ALLOWED_PHOTO_MIME_TYPES.includes(photoFile.type as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])) {
        next.photo = "Photo must be JPEG, PNG, or WebP";
      } else if (photoFile.size > MAX_PHOTO_FILE_SIZE) {
        next.photo = "Photo must be 10 MB or smaller";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      let response: Response;

      if (photoFile) {
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("grid_x", String(gridX));
        formData.append("grid_y", String(gridY));
        formData.append("file", photoFile);

        response = await fetch("/api/plants", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/plants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            grid_x: gridX,
            grid_y: gridY,
          }),
        });
      }

      const data = (await response.json()) as {
        success?: boolean;
        plant?: { id: string };
        error?: { message: string };
      };

      if (!response.ok || !data.plant?.id) {
        setErrors({
          submit: data.error?.message ?? "Failed to create plant. Please try again.",
        });
        return;
      }

      window.location.href = `/plants/${data.plant.id}`;
    } catch {
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {gardenName ? (
        <p className="text-muted-foreground text-sm">
          Garden: <span className="text-foreground font-medium">{gardenName}</span> ({gardenWidth}×{gardenHeight} m)
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="plant-name">Plant name</Label>
        <Input
          id="plant-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          placeholder="e.g., Calendula"
          aria-invalid={Boolean(errors.name)}
          autoComplete="off"
        />
        {errors.name ? (
          <p className="text-destructive flex items-center gap-1 text-xs">
            <CircleAlert className="size-3" />
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="plant-photo">Plant photo (optional)</Label>
        <div className="relative">
          <Input
            id="plant-photo"
            type="file"
            accept={ALLOWED_PHOTO_MIME_TYPES.join(",")}
            className={cn("cursor-pointer pl-9", errors.photo && "border-destructive")}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPhotoFile(file);
              if (errors.photo) setErrors((prev) => ({ ...prev, photo: undefined }));
            }}
          />
          <ImagePlus className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        </div>
        {errors.photo ? (
          <p className="text-destructive flex items-center gap-1 text-xs">
            <CircleAlert className="size-3" />
            {errors.photo}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">JPEG, PNG, or WebP — max 10 MB</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Garden location</Label>
        <GardenGridPicker
          gardenWidth={gardenWidth}
          gardenHeight={gardenHeight}
          gridX={gridX}
          gridY={gridY}
          onChange={(x, y) => {
            setGridX(x);
            setGridY(y);
          }}
        />
      </div>

      {errors.submit ? (
        <p className="text-destructive flex items-center gap-1 text-sm">
          <CircleAlert className="size-4 shrink-0" />
          {errors.submit}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
            Adding plant...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sprout className="size-4" />
            Add plant
          </span>
        )}
      </Button>
    </form>
  );
}
