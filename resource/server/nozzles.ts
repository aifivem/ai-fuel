import {
  entityCoords,
  PlayerMap,
  PlayerState,
  vehicleFromNet,
} from "@aicore-fivem/lib/server";
import { distance, flatDistance, type Vec3 } from "@aicore-fivem/lib/shared";
import {
  HOSE_LENGTH,
  NOZZLE_BAG,
  toNozzle,
  type Nozzle,
  type Station,
} from "common/fuel";
import { stations } from "./content";

/** Who holds which pump's nozzle (memory is the truth; the player state shows it to everyone near). */
export const nozzles = new PlayerMap<Nozzle>();
const nozzleState = new PlayerState(NOZZLE_BAG, toNozzle);
export const setNozzle = (source: number, nozzle: Nozzle | undefined) => {
  if (nozzle) nozzles.set(source, nozzle);
  else nozzles.delete(source);
  nozzleState.set(source, nozzle);
};

/** The station a pump stands in. */
export function stationAt(pump: Vec3) {
  for (const s of stations.values())
    if (flatDistance(pump, s) <= s.radius + 2 && Math.abs(pump.z - s.z) <= 10)
      return s;
  return undefined;
}

/** The plugged vehicle next to the player's nozzle at a station, or null. */
export function plugged(
  source: number,
): { nozzle: Nozzle; vehicle: number; station: Station } | null {
  const nozzle = nozzles.get(source);
  const station = nozzle ? stationAt(nozzle) : undefined;
  const vehicle = nozzle?.netId != null ? vehicleFromNet(nozzle.netId) : 0;
  if (
    !nozzle ||
    !station ||
    !vehicle ||
    distance(entityCoords(vehicle), nozzle) > HOSE_LENGTH + 2
  )
    return null;
  return { nozzle, vehicle, station };
}
