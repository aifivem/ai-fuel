import { AdminPanel, aiLog, aiLogChannels, onClientCallback, onClientEvent, optionalExport, resourceExport } from "@aicore-fivem/lib/server";
import { EVENTS, FUEL_BAG, readSettings, readStations } from "common/fuel";
import { fuelSchema } from "./schema";

const core = resourceExport("ai-core");
const panel = new AdminPanel(fuelSchema);
/** Settings and stations, parsed again after every panel change. */
const content = { settings: readSettings(panel.get("settings")), stations: readStations(panel.get("stations")) };
panel.onChange("settings", () => (content.settings = readSettings(panel.get("settings"))));
panel.onChange("stations", () => (content.stations = readStations(panel.get("stations"))));
aiLogChannels({ refuels: {} });

/** The vehicle's net id, if the player is its driver. */
function drivenBy(source: number, netId: number): number | null {
  const vehicle = NetworkGetEntityFromNetworkId(netId);
  if (!vehicle || !DoesEntityExist(vehicle) || GetEntityType(vehicle) !== 2) return null;
  return GetPedInVehicleSeat(vehicle, -1) === GetPlayerPed(String(source)) ? vehicle : null;
}

const fuelOf = (vehicle: number): number | null => {
  const value: unknown = Entity(vehicle).state[FUEL_BAG];
  return typeof value === "number" ? value : null;
};

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
    args: ([netId, fuel]) => (typeof netId === "number" && typeof fuel === "number" && fuel >= 0 && fuel <= 100 ? [netId, fuel] : null),
    rate: { count: 2, windowMs: 1000 },
  },
  (source, netId, fuel) => {
    const vehicle = drivenBy(source, netId);
    if (vehicle === null) return;
    const before = fuelOf(vehicle);
    // Fuel only goes down from the client; a vehicle without the bag starts from what its driver saw.
    if (before !== null && fuel >= before) return;
    Entity(vehicle).state.set(FUEL_BAG, fuel, true);
    persist(vehicle, fuel, before);
  },
);

onClientCallback(
  EVENTS.refuel,
  { args: ([netId, station]) => (typeof netId === "number" && typeof station === "string" ? [netId, station] : null), lock: true },
  (source, netId, stationId) => {
    const station = content.stations.get(stationId);
    const vehicle = NetworkGetEntityFromNetworkId(netId);
    if (!station || !vehicle || !DoesEntityExist(vehicle)) return { ok: false, error: "FUEL_ERR_FAR" };
    const [x = 0, y = 0, z = 0] = GetEntityCoords(vehicle);
    const [px = 0, py = 0, pz = 0] = GetEntityCoords(GetPlayerPed(String(source)));
    if (Math.hypot(x - station.x, y - station.y) > station.radius + 2 || Math.hypot(px - x, py - y, pz - z) > 6) return { ok: false, error: "FUEL_ERR_FAR" };
    const before = fuelOf(vehicle) ?? 0;
    const liters = Math.floor(100 - before);
    if (liters <= 0) return { ok: false, error: "FUEL_ERR_FULL" };
    const price = Math.ceil(liters * station.price);
    if (!content.settings.accounts.some((account) => core.RemoveMoney(source, account, price, `fuel:${station.id}`))) return { ok: false, error: "FUEL_ERR_MONEY" };
    Entity(vehicle).state.set(FUEL_BAG, 100, true);
    persist(vehicle, 100, null);
    aiLog("refuels", `refuelled ${liters} for $${price} at ${station.id}`, { source, metadata: { station: station.id, liters, price } });
    return { ok: true, price };
  },
);
