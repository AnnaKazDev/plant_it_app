import React, { useState } from "react";
import { MapPin, Home, Ruler, Sprout } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
  next?: string | null;
  initialCity?: string;
  initialGardenName?: string;
  initialGardenWidth?: string;
  initialGardenHeight?: string;
}

export default function GardenSetupForm({
  serverError,
  next,
  initialCity = "",
  initialGardenName = "",
  initialGardenWidth = "",
  initialGardenHeight = "",
}: Props) {
  const [city, setCity] = useState(initialCity);
  const [gardenName, setGardenName] = useState(initialGardenName);
  const [gardenWidth, setGardenWidth] = useState(initialGardenWidth);
  const [gardenHeight, setGardenHeight] = useState(initialGardenHeight);
  const [errors, setErrors] = useState<{
    city?: string;
    gardenName?: string;
    gardenWidth?: string;
    gardenHeight?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const action = next ? `/api/profile/setup?next=${encodeURIComponent(next)}` : "/api/profile/setup";

  function validate() {
    const nextErrors: typeof errors = {};

    if (!city.trim()) {
      nextErrors.city = "City is required";
    } else if (city.length < 2 || city.length > 100) {
      nextErrors.city = "City name must be between 2 and 100 characters";
    }

    if (!gardenName.trim()) {
      nextErrors.gardenName = "Garden name is required";
    } else if (gardenName.length > 100) {
      nextErrors.gardenName = "Garden name must be at most 100 characters";
    }

    if (!gardenWidth.trim()) {
      nextErrors.gardenWidth = "Garden width is required";
    } else {
      const width = Number.parseFloat(gardenWidth);
      if (Number.isNaN(width)) {
        nextErrors.gardenWidth = "Enter a valid number";
      } else if (width < 0.1 || width > 100) {
        nextErrors.gardenWidth = "Width must be between 0.1 and 100 meters";
      }
    }

    if (!gardenHeight.trim()) {
      nextErrors.gardenHeight = "Garden height is required";
    } else {
      const height = Number.parseFloat(gardenHeight);
      if (Number.isNaN(height)) {
        nextErrors.gardenHeight = "Enter a valid number";
      } else if (height < 0.1 || height > 100) {
        nextErrors.gardenHeight = "Height must be between 0.1 and 100 meters";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
      return;
    }
    setIsSubmitting(true);
  }

  return (
    <form method="POST" action={action} className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="city"
        label="City"
        value={city}
        onChange={(v) => {
          setCity(v);
          clearError("city");
        }}
        placeholder="e.g., Warsaw"
        error={errors.city}
        icon={<MapPin className="size-4" />}
        hint={
          !errors.city && (
            <p className="text-muted-foreground mt-1 text-xs">
              Polish characters are fine (e.g. Gdańsk) — we normalize them for weather lookup
            </p>
          )
        }
      />

      <FormField
        id="gardenName"
        name="garden_name"
        label="Garden name"
        value={gardenName}
        onChange={(v) => {
          setGardenName(v);
          clearError("gardenName");
        }}
        placeholder="e.g., My Garden, Balcony"
        error={errors.gardenName}
        hint={
          !errors.gardenName && <p className="text-muted-foreground mt-1 text-xs">Give your garden a friendly name</p>
        }
        icon={<Home className="size-4" />}
      />

      <FormField
        id="gardenWidth"
        name="garden_width"
        label="Garden width (0.1-100 m)"
        type="number"
        value={gardenWidth}
        onChange={(v) => {
          setGardenWidth(v);
          clearError("gardenWidth");
        }}
        placeholder="e.g., 5.5"
        error={errors.gardenWidth}
        hint={
          !errors.gardenWidth && <p className="text-muted-foreground mt-1 text-xs">Width of your garden in meters</p>
        }
        icon={<Ruler className="size-4" />}
        min="0.1"
        max="100"
        step="0.1"
      />

      <FormField
        id="gardenHeight"
        name="garden_height"
        label="Garden height (0.1-100 m)"
        type="number"
        value={gardenHeight}
        onChange={(v) => {
          setGardenHeight(v);
          clearError("gardenHeight");
        }}
        placeholder="e.g., 8.0"
        error={errors.gardenHeight}
        hint={
          !errors.gardenHeight && <p className="text-muted-foreground mt-1 text-xs">Height of your garden in meters</p>
        }
        icon={<Ruler className="size-4" />}
        min="0.1"
        max="100"
        step="0.1"
      />

      <ServerError message={serverError} />

      <SubmitButton pending={isSubmitting} pendingText="Saving garden..." icon={<Sprout className="size-4" />}>
        Save garden setup
      </SubmitButton>
    </form>
  );
}
