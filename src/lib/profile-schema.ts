import { z } from "zod";

export const gardenProfileSchema = z.object({
  city: z.string().min(2, "City name must be at least 2 characters").max(100, "City name too long"),
  garden_name: z.string().min(1, "Garden name is required").max(100, "Garden name too long"),
  garden_width: z.coerce.number().min(0.1, "Width must be at least 0.1m").max(100, "Width must be at most 100m"),
  garden_height: z.coerce.number().min(0.1, "Height must be at least 0.1m").max(100, "Height must be at most 100m"),
});

export type GardenProfileInput = z.infer<typeof gardenProfileSchema>;

export function parseGardenProfileForm(form: FormData) {
  return gardenProfileSchema.safeParse({
    city: form.get("city"),
    garden_name: form.get("garden_name"),
    garden_width: form.get("garden_width"),
    garden_height: form.get("garden_height"),
  });
}
