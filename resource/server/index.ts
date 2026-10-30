import {
  AdminPanel,
  aiLog,
  aiLogChannels,
  entityCoords,
  EntityState,
  isNear,
  onClientCallback,
  onClientEvent,
  optionalExport,
  PlayerMap,
  PlayerState,
  resourceExport,
  stateNumber,
  vehicleFromNet,
  vehicleNearPlayer,
} from "@aicore-fivem/lib/server";
import {
  distance,
  fail,
  readFinite,
  readId,
  type Vec3,
} from "@aicore-fivem/lib/shared";
import {
  EVENTS,
  FUEL_BAG,
  HOSE_LENGTH,
  NOZZLE_BAG,
  readSettings,
  readStations,
  toNozzle,
  type Nozzle,
} from "common/fuel";
import { fuelSchema } from "./schema";

const core = resourceExport("ai-core");
const panel = new AdminPanel(fuelSchema);
const settings = panel.view("settings", readSettings);
const stations = panel.view("stations", readStations);
aiLogChannels({ refuels: {} });

const fuelState = new EntityState(FUEL_BAG, stateNumber);
const fuelOf = (vehicle: number): number | null =>
  fuelState.get(vehicle) ?? null;

/** Owned vehicles keep their fuel in ai-vehicles (saved whenever the whole number changes). */
function persist(vehicle: number, fuel: number, before: number | null): void {
  if (before !== null && Math.floor(before) === Math.floor(fuel)) return;
  const api = optionalExport("ai-vehicles");
  const id = api?.GetVehicleIdByEntity(vehicle);
  if (api && id !== null && id !== undefined) api.SaveVehicle(id, { fuel });
}

onClientEvent(
  EVENTS.consume,
  {
    args: ([netId, fuel]) => {
      const id = readId(netId);
      const level = readFinite(fuel);
      return id !== null && level !== null && level >= 0 && level <= 100
        ? [id, level]
        : null;
    },
    rate: { count: 2, windowMs: 1000 },
  },
  (source, netId, fuel) => {
    const vehicle = vehicleNearPlayer(source, netId, { driver: true });
    if (!vehicle) return;
    const before = fuelOf(vehicle);
    // Fuel only goes down from the client; a vehicle without the bag starts from what its driver saw.
    if (before !== null && fuel >= before) return;
    fuelState.set(vehicle, fuel);
    persist(vehicle, fuel, before);
  },
);

/** Who holds which pump's nozzle (memory is the truth; the player state shows it to everyone near). */
const nozzles = new PlayerMap<Nozzle>();
const nozzleState = new PlayerState(NOZZLE_BAG, toNozzle);
const setNozzle = (source: number, nozzle: Nozzle | undefined) => {
  if (nozzle) nozzles.set(source, nozzle);
  else nozzles.delete(source);
  nozzleState.set(source, nozzle);
};

/** The station a pump stands in. */
function stationAt(pump: Vec3) {
  for (const s of stations.value.values())
    if (
      Math.hypot(pump.x - s.x, pump.y - s.y) <= s.radius + 2 &&
      Math.abs(pump.z - s.z) <= 10
    )
      return s;
  return undefined;
}
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

onClientCallback(
  EVENTS.refuel,
  (source) => {
    const nozzle = nozzles.get(source);
    const station = nozzle ? stationAt(nozzle) : undefined;
    const vehicle = nozzle?.netId != null ? vehicleFromNet(nozzle.netId) : 0;
    if (
      !nozzle ||
      !station ||
      !vehicle ||
      distance(entityCoords(vehicle), nozzle) > HOSE_LENGTH + 2
    )
      return fail("FUEL_ERR_FAR");
    const before = fuelOf(vehicle) ?? 0;
    const liters = Math.floor(100 - before);
    if (liters <= 0) return fail("FUEL_ERR_FULL");
    const price = Math.ceil(liters * station.price);
    if (
      !settings.value.accounts.some((account) =>
        core.RemoveMoney(source, account, price, `fuel:${station.id}`),
      )
    )
      return fail("FUEL_ERR_MONEY");
    fuelState.set(vehicle, 100);
    persist(vehicle, 100, null);
    aiLog("refuels", `refuelled ${liters} for $${price} at ${station.id}`, {
      source,
      metadata: { station: station.id, liters, price },
    });
    return { ok: true, price };
  },
  { lock: true },
);
