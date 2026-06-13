import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Banana,
  Bean,
  Carrot,
  Cherry,
  Citrus,
  Clover,
  Crop,
  Flower,
  Flower2,
  Grape,
  Leaf,
  LeafyGreen,
  Nut,
  Rose,
  Salad,
  Shrub,
  Sprout,
  TreeDeciduous,
  TreePalm,
  TreePine,
  Trees,
  Wheat,
} from "lucide-react";

export const PLANT_ICON_IDS = [
  "sprout",
  "flower-2",
  "flower",
  "tree-pine",
  "trees",
  "tree-deciduous",
  "tree-palm",
  "leaf",
  "leafy-green",
  "shrub",
  "clover",
  "rose",
  "cherry",
  "carrot",
  "bean",
  "apple",
  "grape",
  "citrus",
  "banana",
  "wheat",
  "salad",
  "nut",
  "crop",
] as const;

export type PlantIconId = (typeof PLANT_ICON_IDS)[number];

export const DEFAULT_PLANT_ICON_ID: PlantIconId = "sprout";

const PLANT_ICON_COMPONENTS: Record<PlantIconId, LucideIcon> = {
  sprout: Sprout,
  "flower-2": Flower2,
  flower: Flower,
  "tree-pine": TreePine,
  trees: Trees,
  "tree-deciduous": TreeDeciduous,
  "tree-palm": TreePalm,
  leaf: Leaf,
  "leafy-green": LeafyGreen,
  shrub: Shrub,
  clover: Clover,
  rose: Rose,
  cherry: Cherry,
  carrot: Carrot,
  bean: Bean,
  apple: Apple,
  grape: Grape,
  citrus: Citrus,
  banana: Banana,
  wheat: Wheat,
  salad: Salad,
  nut: Nut,
  crop: Crop,
};

export const PLANT_ICON_OPTIONS = PLANT_ICON_IDS.map((id) => ({
  id,
  label: id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
  Icon: PLANT_ICON_COMPONENTS[id],
}));

export function isValidPlantIconId(id: string): id is PlantIconId {
  return (PLANT_ICON_IDS as readonly string[]).includes(id);
}

export function getPlantIconComponent(iconName: string): LucideIcon {
  if (isValidPlantIconId(iconName)) {
    return PLANT_ICON_COMPONENTS[iconName];
  }

  return Sprout;
}

interface PlantIconProps {
  iconName: string;
  className?: string;
}

export function PlantIcon({ iconName, className }: PlantIconProps) {
  const Icon = getPlantIconComponent(iconName);
  return createElement(Icon, { className, "aria-hidden": true });
}
