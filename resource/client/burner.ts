import {
  cache,
  drivenVehicle,
  EntityState,
  every,
  type Job,
  onCache,
  stateNumber,
} from "@aifivem/lib/client";
import { EVENTS, FUEL_BAG, readSettings } from "common/fuel";
import { world } from "./world";

const fuelState = new EntityState(FUEL_BAG, stateNumber);

/** Game consumption per settings unit: at 1 a full tank lasts about 25 minutes of mixed driving. */
const RATE = 10;

/**
 * Fuel of the vehicle the player drives: the game burns it (FiveM fuel consumption: rpm x the vehicle's handling rate
 * x the global rate). The `fuel` state bag is the truth (as ox_fuel): the tank takes it on entering and on every change
 * the server makes (refuel, a script or an admin, up or down), and lower levels are reported to the server every 5 s
 * (the bag change that report causes is our own echo and is skipped). Electric models and vehicles with no tank burn
 * nothing.
 */
class Burner {
  settings = readSettings(world.get("settings"));
  private electric = new Set<number>();
  private timer: Job | null = null;
  /** Network id of the vehicle being burned, 0 when none. */
  private netId = 0;
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
    this.netId = NetworkGetNetworkIdFromEntity(vehicle);
    this.timer = every(1000, () => this.tick(vehicle), { name: "burn" });
  }

  stop(): void {
    this.timer?.stop();
    this.timer = null;
    this.netId = 0;
  }

  /** A server change of the bag of the vehicle being burned goes into its tank at once. */
  bagChanged(netId: number, level: number | undefined): void {
    if (netId !== this.netId || level === undefined || level === this.reported)
      return;
    const vehicle = NetworkGetEntityFromNetworkId(netId);
    if (vehicle !== cache.vehicle) return;
    SetVehicleFuelLevel(vehicle, (level / 100) * this.tank);
    this.reported = level;
  }

  private tick(vehicle: number): void {
    if (cache.vehicle !== vehicle || cache.seat !== -1) return this.stop();
    const fuel = (GetVehicleFuelLevel(vehicle) / this.tank) * 100;
    if (fuel <= 0) SetVehicleEngineOn(vehicle, false, true, true);
    if (++this.ticks % 5 === 0 && this.reported - fuel >= 0.1) {
      // The exact value the server writes back, so its bag change is recognised as our own.
      this.reported = Math.round(Math.max(0, fuel) * 100) / 100;
      emitNet(
        EVENTS.consume,
        NetworkGetNetworkIdFromEntity(vehicle),
        this.reported,
      );
    }
  }
}

export const burner = new Burner();
fuelState.onChange((netId, level) => burner.bagChanged(netId, level));
world.onChange("settings", () => {
  burner.settings = readSettings(world.get("settings"));
  burner.applyRate();
});
/** The tank burns while the player drives. */
function follow(): void {
  const vehicle = drivenVehicle();
  if (vehicle !== false) burner.start(vehicle);
  else burner.stop();
}
onCache("seat", follow);
follow();
