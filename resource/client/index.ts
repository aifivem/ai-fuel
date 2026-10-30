import {
  AdminWorld,
  cache,
  loadLocaleTexts,
  notify,
  onCache,
  Points,
  progress,
  triggerServerCallback,
} from "@aicore-fivem/lib/client"
import { Locale } from "common"
import {
  burnPerSecond,
  ELECTRIC,
  EVENTS,
  FUEL_BAG,
  readSettings,
  readStations,
} from "common/fuel"

const world = new AdminWorld(["settings", "stations"])
const texts = loadLocaleTexts()

/**
 * Fuel of the vehicle the player drives: burned on a 1 s timer from the engine's rpm, applied to the game, reported to
 * the server every 5 s (the server keeps the `fuel` state bag). Nothing runs on foot or as a passenger.
 */
class Burner {
  settings = readSettings(world.get("settings"))
  private timer: ReturnType<typeof setInterval> | null = null
  private fuel = 100
  private reported = 100
  private ticks = 0

  start(vehicle: number): void {
    this.stop()
    const model = GetDisplayNameFromVehicleModel(
      GetEntityModel(vehicle)
    ).toLowerCase()
    if (ELECTRIC.has(model)) return
    const bag: unknown = Entity(vehicle).state[FUEL_BAG]
    this.fuel = typeof bag === "number" ? bag : 100
    this.reported = this.fuel
    this.timer = setInterval(() => this.tick(vehicle), 1000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private tick(vehicle: number): void {
    if (cache.vehicle !== vehicle || cache.seat !== -1) return this.stop()
    // A refuel or another driver may have changed the bag.
    const bag: unknown = Entity(vehicle).state[FUEL_BAG]
    if (typeof bag === "number" && bag > this.fuel + 0.5)
      this.fuel = this.reported = bag
    if (GetIsVehicleEngineRunning(vehicle))
      this.fuel = Math.max(
        0,
        this.fuel -
          burnPerSecond(
            GetVehicleCurrentRpm(vehicle),
            GetVehicleClass(vehicle),
            this.settings.consumption
          )
      )
    if (this.fuel <= 0) SetVehicleEngineOn(vehicle, false, true, true)
    SetVehicleFuelLevel(vehicle, Math.max(this.fuel, 1) * 0.65)
    if (++this.ticks % 5 === 0 && this.reported - this.fuel >= 0.1) {
      this.reported = this.fuel
      emitNet(
        EVENTS.consume,
        NetworkGetNetworkIdFromEntity(vehicle),
        Math.round(this.fuel * 100) / 100
      )
    }
  }
}

const burner = new Burner()
world.onChange(
  "settings",
  () => (burner.settings = readSettings(world.get("settings")))
)
onCache("seat", (seat) =>
  seat === -1 && cache.vehicle !== false
    ? burner.start(cache.vehicle)
    : burner.stop()
)
if (cache.seat === -1 && cache.vehicle !== false) burner.start(cache.vehicle)

async function refuel(stationId: string): Promise<void> {
  const vehicle = cache.vehicle
  if (vehicle === false || cache.seat !== -1)
    return notify(Locale("FUEL_ERR_NO_VEHICLE"), "error")
  const bag: unknown = Entity(vehicle).state[FUEL_BAG]
  const missing = 100 - (typeof bag === "number" ? bag : 100)
  if (missing < 1) return notify(Locale("FUEL_ERR_FULL"), "info")
  SetVehicleEngineOn(vehicle, false, true, true)
  const done = await progress({
    label: Locale("FUEL_REFUELING"),
    duration: Math.max(
      1000,
      missing * burner.settings.refuelSecondsPerLiter * 1000
    ),
    allowVehicle: true,
  })
  if (!done) return
  const result: unknown = await triggerServerCallback(EVENTS.refuel, [
    NetworkGetNetworkIdFromEntity(vehicle),
    stationId,
  ]).catch(() => null)
  if (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    result.ok === true
  ) {
    const price =
      "price" in result && typeof result.price === "number" ? result.price : 0
    notify(Locale("FUEL_PAID", price), "success")
  } else {
    const error =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "FUEL_ERR_FAR"
    notify(texts[error] ?? error, "error")
  }
}

/** Stations: a point each, offered to the driver inside its radius, and a blip. */
const points = new Points()
function rebuild(): void {
  points.clear()
  for (const station of readStations(world.get("stations")).values()) {
    points.add(`station:${station.id}`, {
      coords: { x: station.x, y: station.y, z: station.z },
      label: Locale("FUEL_PROMPT", station.price),
      icon: "gas-pump",
      radius: station.radius,
      height: 8,
      promptOnly: true,
      canShow: () => cache.vehicle !== false && cache.seat === -1,
      blip: station.blip
        ? { sprite: 361, color: 1, scale: 0.6, label: station.label }
        : undefined,
      onPressed: () => refuel(station.id),
    })
  }
}

rebuild()
world.onChange("stations", rebuild)
onCache("seat", () => points.refresh())
