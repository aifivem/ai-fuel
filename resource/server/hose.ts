import {
  entityCoords,
  isNear,
  onClientCallback,
  onClientEvent,
  vehicleNearPlayer,
} from "@aicore-fivem/lib/server";
import { distance, fail, readFinite, readId } from "@aicore-fivem/lib/shared";
import { EVENTS, HOSE_LENGTH } from "common/fuel";
import { nozzles, setNozzle, stationAt } from "./nozzles";

/** Each nozzle change makes every client near create or delete a prop and a rope: one take / return a second. */
const NOZZLE_RATE = { count: 1, windowMs: 1000 };

onClientCallback(
  EVENTS.takeNozzle,
  {
    args: ([x, y, z]) => {
      const pump = { x: readFinite(x), y: readFinite(y), z: readFinite(z) };
      return pump.x === null || pump.y === null || pump.z === null
        ? null
        : [{ x: pump.x, y: pump.y, z: pump.z }];
    },
    rate: NOZZLE_RATE,
    lock: true,
  },
  (source, pump) => {
    if (nozzles.has(source) || !stationAt(pump) || !isNear(source, pump, 3))
      return fail("FUEL_ERR_FAR");
    setNozzle(source, { ...pump, netId: null });
    return { ok: true };
  },
);

onClientCallback(
  EVENTS.plug,
  {
    args: ([netId]): [number | null] | null => {
      if (netId === null) return [null];
      const id = readId(netId);
      return id === null ? null : [id];
    },
    rate: { count: 2, windowMs: 1000 },
    lock: true,
  },
  (source, netId) => {
    const nozzle = nozzles.get(source);
    if (!nozzle) return fail("FUEL_ERR_FAR");
    if (netId !== null) {
      const vehicle = vehicleNearPlayer(source, netId, { metres: 4 });
      if (!vehicle || distance(entityCoords(vehicle), nozzle) > HOSE_LENGTH + 2)
        return fail("FUEL_ERR_FAR");
    }
    setNozzle(source, { ...nozzle, netId });
    return { ok: true };
  },
);

onClientEvent(EVENTS.returnNozzle, (source) => setNozzle(source, undefined), {
  rate: NOZZLE_RATE,
});
