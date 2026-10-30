import { bool, num, record, str } from "@aicore-fivem/lib/shared"

/** ai-fuel's contracts and panel content. No natives. */

export const EVENTS = {
  /** Client -> server: (netId, fuel) the driver's vehicle burned fuel (only lower values are taken). */
  consume: "ai-fuel:consume",
  /** Callback: (netId, stationId) -> { ok } fill the tank at a station (after the client's progress). */
  refuel: "ai-fuel:refuel",
} as const

/** The vehicle state bag holding fuel 0-100 (ai-vehicles seeds it on spawn, ai-hud shows it). */
export const FUEL_BAG = "fuel"

export interface Settings {
  /** Multiplier on the burn rate (1 = a full tank lasts about 25 minutes at mixed driving). */
  consumption: number
  accounts: string[]
  refuelSecondsPerLiter: number
}

export interface Station {
  id: string
  label: string
  x: number
  y: number
  z: number
  radius: number
  /** Dollars per percent of a tank. */
  price: number
  blip: boolean
}

export function readSettings(raw: unknown): Settings {
  const s = record(raw)
  const accounts = Array.isArray(s.accounts)
    ? s.accounts.filter((a): a is string => typeof a === "string")
    : []
  return {
    consumption: num(s.consumption, 1, 0, 10),
    accounts: accounts.length ? accounts : ["cash", "bank"],
    refuelSecondsPerLiter: num(s.refuelSecondsPerLiter, 0.15, 0, 5),
  }
}

export function readStations(raw: unknown): Map<string, Station> {
  const out = new Map<string, Station>()
  for (const [id, value] of Object.entries(record(raw))) {
    const v = record(value)
    const c = record(v.coords)
    out.set(id, {
      id,
      label: str(v.label, id, 48),
      x: num(c.x, 0),
      y: num(c.y, 0),
      z: num(c.z, 0),
      radius: num(v.radius, 12, 2, 40),
      price: num(v.price, 3, 0, 1000),
      blip: bool(v.blip, true),
    })
  }
  return out
}

/** Fuel burned per second: idle trickle plus load from the engine's rpm, scaled by the vehicle class. */
export function burnPerSecond(
  rpm: number,
  vehicleClass: number,
  multiplier: number
): number {
  // Classes: 13 cycles burn nothing, 8 motorcycles less, 10 / 20 industrial and commercial more, 15 / 16 air more.
  const classFactor =
    vehicleClass === 13
      ? 0
      : vehicleClass === 8
        ? 0.6
        : vehicleClass === 10 || vehicleClass === 20
          ? 1.4
          : vehicleClass === 15 || vehicleClass === 16
            ? 1.8
            : 1
  return (0.01 + rpm * rpm * 0.12) * classFactor * multiplier
}

/** Electric models: no fuel use (no charging stations yet). */
export const ELECTRIC = new Set([
  "voltic",
  "voltic2",
  "raiden",
  "cyclone",
  "tezeract",
  "neon",
  "surge",
  "dilettante",
  "dilettante2",
  "imorgon",
  "khamelion",
  "iwagen",
  "omnisegt",
  "virtue",
  "caddy",
  "caddy2",
  "caddy3",
  "airtug",
  "rcbandito",
])
