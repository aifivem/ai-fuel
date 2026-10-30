import {
  AdminWorld,
  Blips,
  cache,
  EntityState,
  every,
  type Job,
  onCache,
  stateNumber,
} from "@aicore-fivem/lib/client";
import { EVENTS, FUEL_BAG, readSettings, readStations } from "common/fuel";

import { configurePump } from "./pump";

const fuelState = new EntityState(FUEL_BAG, stateNumber);

const world = new AdminWorld(["settings", "stations"]);

/** Game consumption per settings unit: at 1 a full tank lasts about 25 minutes of mixed driving. */
const RATE = 10;

/**
 * Fuel of the vehicle the player drives: the game burns it (FiveM fuel consumption: rpm x the vehicle's handling rate
 * x the global rate), the tank's level is mirrored from the `fuel` state bag on entering and after a refuel, and lower
 * levels are reported to the server every 5 s. Electric models and vehicles with no tank burn nothing.
 */
class Burner {
  settings = readSettings(world.get("settings"));
  private electric = new Set<number>();
  private timer: Job | null = null;
  private tank = 0;
  private reported = 100;
  private ticks = 0;

  constructor() {
    SetFuelConsumptionState(true);
    this.applyRate();
  }

  applyRate(): void {
    SetFuelConsumptionRateMultiplier(this.settings.consumption * RATE);
    this.electric = new Set(
      this.settings.electricModels.map((m) => GetHashKey(m)),
    );
  }

  start(vehicle: number): void {
    this.stop();
    const electric = this.electric.has(GetEntityModel(vehicle));
    this.tank = GetVehicleHandlingFloat(
      vehicle,
      "CHandlingData",
      "fPetrolTankVolume",
    );
    if (electric)
      SetVehicleHandlingFloat(
        vehicle,
        "CHandlingData",
        "fPetrolConsumptionRate",
        0,
      );
    if (electric || this.tank <= 0) return;
    const fuel = fuelState.get(vehicle) ?? 100;
    SetVehicleFuelLevel(vehicle, (fuel / 100) * this.tank);
    this.reported = fuel;
    this.timer = every(1000, () => this.tick(vehicle), { name: "burn" });
  }

  stop(): void {
    this.timer?.stop();
    this.timer = null;
  }

  private tick(vehicle: number): void {
    if (cache.vehicle !== vehicle || cache.seat !== -1) return this.stop();
    let fuel = (GetVehicleFuelLevel(vehicle) / this.tank) * 100;
    // A refuel or another driver may have raised the bag.
    const bag = fuelState.get(vehicle);
    if (bag !== undefined && bag > fuel + 0.5) {
      SetVehicleFuelLevel(vehicle, (bag / 100) * this.tank);
      fuel = this.reported = bag;
    }
    if (fuel <= 0) SetVehicleEngineOn(vehicle, false, true, true);
    if (++this.ticks % 5 === 0 && this.reported - fuel >= 0.1) {
      this.reported = fuel;
      emitNet(
        EVENTS.consume,
        NetworkGetNetworkIdFromEntity(vehicle),
        Math.round(Math.max(0, fuel) * 100) / 100,
      );
    }
  }
}

const burner = new Burner();
world.onChange("settings", () => {
  burner.settings = readSettings(world.get("settings"));
  burner.applyRate();
});
onCache("seat", (seat) =>
  seat === -1 && cache.vehicle !== false
    ? burner.start(cache.vehicle)
    : burner.stop(),
);
if (cache.seat === -1 && cache.vehicle !== false) burner.start(cache.vehicle);

configurePump(burner.settings.refuelSecondsPerLiter);
world.onChange("settings", () => {
  configurePump(burner.settings.refuelSecondsPerLiter);
  rebuild();
});

/** Station blips; refuelling itself happens at the map's pumps (`pump.ts`). */
const blips = new Blips();
function rebuild(): void {
  blips.clear();
  for (const station of readStations(world.get("stations")).values())
    if (station.blip)
      blips.add(station.id, {
        coords: { x: station.x, y: station.y, z: station.z },
        ...burner.settings.blip,
        label: station.label,
      });
}

rebuild();
world.onChange("stations", rebuild);
