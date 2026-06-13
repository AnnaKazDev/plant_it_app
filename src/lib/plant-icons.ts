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
  Flower,
  Flower2,
  Grape,
  Leaf,
  LeafyGreen,
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
  "leaf",
  "leafy-green",
  "cherry",
  "carrot",
  "bean",
  "apple",
  "grape",
  "citrus",
  "clover",
  "tree-palm",
  "wheat",
  "banana",
  "shrub",
  "salad",
  "rose",
  "tree-deciduous",
] as const;

export type PlantIconId = (typeof PLANT_ICON_IDS)[number];

export const DEFAULT_PLANT_ICON_ID: PlantIconId = "sprout";

const PLANT_ICON_COMPONENTS: Record<PlantIconId, LucideIcon> = {
  sprout: Sprout,
  "flower-2": Flower2,
  flower: Flower,
  "tree-pine": TreePine,
  trees: Trees,
  leaf: Leaf,
  "leafy-green": LeafyGreen,
  cherry: Cherry,
  carrot: Carrot,
  bean: Bean,
  apple: Apple,
  grape: Grape,
  citrus: Citrus,
  clover: Clover,
  "tree-palm": TreePalm,
  wheat: Wheat,
  banana: Banana,
  shrub: Shrub,
  salad: Salad,
  rose: Rose,
  "tree-deciduous": TreeDeciduous,
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
