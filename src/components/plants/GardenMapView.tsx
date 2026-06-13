import GardenGrid from "@/components/plants/GardenGrid";
import GardenPlantMarkers from "@/components/plants/GardenPlantMarkers";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { GardenMapPlant } from "@/lib/plant-page";

interface GardenMapViewProps {
  gardenWidth: number;
  gardenHeight: number;
  plants: GardenMapPlant[];
}

export default function GardenMapView({ gardenWidth, gardenHeight, plants }: GardenMapViewProps) {
  return (
    <TooltipProvider>
      <GardenGrid variant="map" gardenWidth={gardenWidth} gardenHeight={gardenHeight} gridAriaLabel="Garden map">
        <GardenPlantMarkers plants={plants} />
      </GardenGrid>
    </TooltipProvider>
  );
}
