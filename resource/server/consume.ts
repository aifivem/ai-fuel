import { onClientEvent, vehicleNearPlayer } from "@aicore-fivem/lib/server";
import { readFinite, readId } from "@aicore-fivem/lib/shared";
import { EVENTS } from "common/fuel";
import { fuelOf, fuelState, persist } from "./tank";

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
