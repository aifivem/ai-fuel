import {
  AdminWorld,
  Blips,
  cache,
  EntityState,
  loadLocaleTexts,
  onCache,
  stateNumber,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import {
  burnPerSecond,
  ELECTRIC,
  EVENTS,
  FUEL_BAG,
  readSettings,
  readStations,
} from "common/fuel";

import { configurePump } from "./pump";

const fuelState = new EntityState(FUEL_BAG, stateNumber);

const world = new AdminWorld(["settings", "stations"]);
const texts = loadLocaleTexts();

/**
 * Fuel of the vehicle the player drives: burned on a 1 s timer from the engine's rpm, applied to the game, reported to
 * the server every 5 s (the server keeps the `fuel` state bag). Nothing runs on foot or as a passenger.
 */
class Burner {
  settings = readSettings(world.get("settings"));
  private timer: ReturnType<typeof setInterval> | null = null;
  private fuel = 100;
  private reported = 100;
  private ticks = 0;

  start(vehicle: number): void {
    this.stop();
    const model = GetDisplayNameFromVehicleModel(
      GetEntityModel(vehicle),
    ).toLowerCase();
    if (ELECTRIC.has(model)) return;
    this.fuel = fuelState.get(vehicle) ?? 100;
    this.reported = this.fuel;
    this.timer = setInterval(() => this.tick(vehicle), 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(vehicle: number): void {
    if (cache.vehicle !== vehicle || cache.seat !== -1) return this.stop();
    // A refuel or another driver may have changed the bag.
    const bag = fuelState.get(vehicle);
    if (bag !== undefined && bag > this.fuel + 0.5)
      this.fuel = this.reported = bag;
    if (GetIsVehicleEngineRunning(vehicle))
      this.fuel = Math.max(
        0,
        this.fuel -
          burnPerSecond(
            GetVehicleCurrentRpm(vehicle),
            GetVehicleClass(vehicle),
            this.settings.consumption,
          ),
      );
    if (this.fuel <= 0) SetVehicleEngineOn(vehicle, false, true, true);
    SetVehicleFuelLevel(vehicle, Math.max(this.fuel, 1) * 0.65);
    if (++this.ticks % 5 === 0 && this.reported - this.fuel >= 0.1) {
      this.reported = this.fuel;
      emitNet(
        EVENTS.consume,
        NetworkGetNetworkIdFromEntity(vehicle),
        Math.round(this.fuel * 100) / 100,
      );
    }
  }
}

const burner = new Burner();
world.onChange(
  "settings",
  () => (burner.settings = readSettings(world.get("settings"))),
);
onCache("seat", (seat) =>
  seat === -1 && cache.vehicle !== false
    ? burner.start(cache.vehicle)
    : burner.stop(),
);
if (cache.seat === -1 && cache.vehicle !== false) burner.start(cache.vehicle);

configurePump(burner.settings.refuelSecondsPerLiter, texts);
world.onChange("settings", () =>
  configurePump(burner.settings.refuelSecondsPerLiter, texts),
);

/** Station blips; refuelling itself happens at the map's pumps (`pump.ts`). */
const blips = new Blips();
function rebuild(): void {
  blips.clear();
  for (const station of readStations(world.get("stations")).values())
    if (station.blip)
      blips.add(station.id, {
        coords: { x: station.x, y: station.y, z: station.z },
        sprite: 361,
        color: 1,
        scale: 0.6,
        label: station.label,
      });
}

rebuild();
world.onChange("stations", rebuild);
