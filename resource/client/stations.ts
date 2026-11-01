import { Blips } from "@aicore-fivem/lib/client";
import { RecordObjects } from "@aicore-fivem/lib/shared";
import { readStation } from "common/fuel";
import { burner } from "./burner";
import { configurePump } from "./pump";
import { world } from "./world";

configurePump(burner.settings.refuelSecondsPerLiter);
/** Station blips, one record at a time; refuelling itself happens at the map's pumps (`pump.ts`). */
const blips = new Blips();
const stations = new RecordObjects(world, "stations", readStation, (id, s) => {
  if (!s.blip) return;
  blips.add(id, {
    coords: { x: s.x, y: s.y, z: s.z },
    ...burner.settings.blip,
    label: s.label,
  });
  return () => blips.remove(id);
});
world.onChange("settings", () => {
  configurePump(burner.settings.refuelSecondsPerLiter);
  // The blip look is a setting every station reads.
  stations.rebuildAll();
});
