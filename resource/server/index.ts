import {
  AdminPanel,
  aiLog,
  aiLogChannels,
  EntityState,
  onClientCallback,
  onClientEvent,
  optionalExport,
  PlayerState,
  resourceExport,
  stateNumber,
} from "@aicore-fivem/lib/server";
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
/** Settings and stations, parsed again after every panel change. */
const content = {
  settings: readSettings(panel.get("settings")),
  stations: readStations(panel.get("stations")),
};
panel.onChange(
  "settings",
  () => (content.settings = readSettings(panel.get("settings"))),
);
panel.onChange(
  "stations",
  () => (content.stations = readStations(panel.get("stations"))),
);
aiLogChannels({ refuels: {} });

/** The vehicle's net id, if the player is its driver. */
function drivenBy(source: number, netId: number): number | null {
  const vehicle = NetworkGetEntityFromNetworkId(netId);
  if (!vehicle || !DoesEntityExist(vehicle) || GetEntityType(vehicle) !== 2)
    return null;
  return GetPedInVehicleSeat(vehicle, -1) === GetPlayerPed(String(source))
    ? vehicle
    : null;
}

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
    args: ([netId, fuel]) =>
      typeof netId === "number" &&
      typeof fuel === "number" &&
      fuel >= 0 &&
      fuel <= 100
        ? [netId, fuel]
        : null,
    rate: { count: 2, windowMs: 1000 },
  },
  (source, netId, fuel) => {
    const vehicle = drivenBy(source, netId);
    if (vehicle === null) return;
    const before = fuelOf(vehicle);
    // Fuel only goes down from the client; a vehicle without the bag starts from what its driver saw.
    if (before !== null && fuel >= before) return;
    fuelState.set(vehicle, fuel);
    persist(vehicle, fuel, before);
  },
);

/** Who holds which pump's nozzle (memory is the truth; the player state shows it to everyone near). */
const nozzles = new Map<number, Nozzle>();
const nozzleState = new PlayerState(NOZZLE_BAG, toNozzle);
const setNozzle = (source: number, nozzle: Nozzle | undefined) => {
  if (nozzle) nozzles.set(source, nozzle);
  else nozzles.delete(source);
  nozzleState.set(source, nozzle);
};
on("playerDropped", () => nozzles.delete(Number(globalThis.source)));

type Vec = { x: number; y: number; z: number };
const posOf = (entity: number): Vec => {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
  return { x, y, z };
};
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
/** The station a pump stands in. */
const stationAt = (pump: Vec) =>
  [...content.stations.values()].find(
    (s) =>
      Math.hypot(pump.x - s.x, pump.y - s.y) <= s.radius + 2 &&
      Math.abs(pump.z - s.z) <= 10,
  );
const pedOf = (source: number) => GetPlayerPed(String(source));

onClientCallback(
  EVENTS.takeNozzle,
  {
    args: ([x, y, z]) =>
      typeof x === "number" && typeof y === "number" && typeof z === "number"
        ? [x, y, z]
        : null,
    lock: true,
  },
  (source, x, y, z) => {
    const pump = { x, y, z };
    if (
      nozzles.has(source) ||
      !stationAt(pump) ||
      dist(posOf(pedOf(source)), pump) > 3
    )
      return { ok: false, error: "FUEL_ERR_FAR" };
    setNozzle(source, { ...pump, netId: null });
    return { ok: true };
  },
);

onClientCallback(
  EVENTS.plug,
  {
    args: ([netId]) =>
      netId === null || typeof netId === "number" ? [netId] : null,
    lock: true,
  },
  (source, netId) => {
    const nozzle = nozzles.get(source);
    if (!nozzle) return { ok: false, error: "FUEL_ERR_FAR" };
    if (netId !== null) {
      const vehicle = NetworkGetEntityFromNetworkId(netId);
      if (
        !vehicle ||
        GetEntityType(vehicle) !== 2 ||
        dist(posOf(vehicle), posOf(pedOf(source))) > 4 ||
        dist(posOf(vehicle), nozzle) > HOSE_LENGTH + 2
      )
        return { ok: false, error: "FUEL_ERR_FAR" };
    }
    setNozzle(source, { ...nozzle, netId });
    return { ok: true };
  },
);

onClientEvent(EVENTS.returnNozzle, (source) => setNozzle(source, undefined));

onClientCallback(
  EVENTS.refuel,
  (source) => {
    const nozzle = nozzles.get(source);
    const station = nozzle ? stationAt(nozzle) : undefined;
    const vehicle =
      nozzle?.netId != null ? NetworkGetEntityFromNetworkId(nozzle.netId) : 0;
    if (
      !nozzle ||
      !station ||
      !vehicle ||
      !DoesEntityExist(vehicle) ||
      dist(posOf(vehicle), nozzle) > HOSE_LENGTH + 2
    )
      return { ok: false, error: "FUEL_ERR_FAR" };
    const before = fuelOf(vehicle) ?? 0;
    const liters = Math.floor(100 - before);
    if (liters <= 0) return { ok: false, error: "FUEL_ERR_FULL" };
    const price = Math.ceil(liters * station.price);
    if (
      !content.settings.accounts.some((account) =>
        core.RemoveMoney(source, account, price, `fuel:${station.id}`),
      )
    )
      return { ok: false, error: "FUEL_ERR_MONEY" };
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
