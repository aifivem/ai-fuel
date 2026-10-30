import {
  bool,
  int,
  num,
  readFinite,
  readId,
  record,
  str,
} from "@aicore-fivem/lib/shared";
import { VEHICLE_BAGS } from "@aicore-fivem/shared";

/** ai-fuel's contracts and panel content. No natives. */

export const EVENTS = {
  /** Client -> server: (netId, fuel) the driver's vehicle burned fuel (only lower values are taken). */
  consume: "ai-fuel:consume",
  /** Callback: (pumpX, pumpY, pumpZ) -> { ok } take the nozzle of the pump the player stands at. */
  takeNozzle: "ai-fuel:takeNozzle",
  /** Callback: (netId | null) -> { ok } put the held nozzle into a vehicle (null: back into the hand). */
  plug: "ai-fuel:plug",
  /** Client -> server: () hang the nozzle back on its pump. */
  returnNozzle: "ai-fuel:returnNozzle",
  /** Callback: () -> { ok, price } fill the tank the held nozzle is in (after the client's progress). */
  refuel: "ai-fuel:refuel",
} as const;

/** Player state: the nozzle a player holds, `{ x, y, z, netId }` (its pump, the vehicle it is in or null). */
export const NOZZLE_BAG = "aiFuelNozzle";
export interface Nozzle {
  x: number;
  y: number;
  z: number;
  netId: number | null;
}
export function toNozzle(v: unknown): Nozzle | undefined {
  const r = record(v);
  const x = readFinite(r.x);
  const y = readFinite(r.y);
  const z = readFinite(r.z);
  return x === null || y === null || z === null
    ? undefined
    : { x, y, z, netId: readId(r.netId) };
}

/** Map pump models: the nozzle is taken from these. */
export const PUMP_MODELS = [
  "prop_gas_pump_1a",
  "prop_gas_pump_1b",
  "prop_gas_pump_1c",
  "prop_gas_pump_1d",
  "prop_gas_pump_old2",
  "prop_gas_pump_old3",
  "prop_vintage_pump",
] as const;
/** How far the hose reaches from its pump, in metres. */
export const HOSE_LENGTH = 8;

/** The vehicle state bag holding fuel 0-100 (ai-vehicles seeds it on spawn, ai-hud shows it). */
export const FUEL_BAG = VEHICLE_BAGS.fuel;

export interface BlipStyle {
  sprite: number;
  color: number;
  scale: number;
}

export interface Settings {
  /** Multiplier on the burn rate (1 = a full tank lasts about 25 minutes at mixed driving). */
  consumption: number;
  accounts: string[];
  refuelSecondsPerLiter: number;
  /** Models that burn no fuel (spawn names, lower case). */
  electricModels: string[];
  /** Look of every station's map blip. */
  blip: BlipStyle;
}

export interface Station {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Dollars per percent of a tank. */
  price: number;
  blip: boolean;
}

export function readSettings(raw: unknown): Settings {
  const s = record(raw);
  const accounts = Array.isArray(s.accounts)
    ? s.accounts.filter((a): a is string => typeof a === "string")
    : [];
  const blip = record(s.blip);
  return {
    consumption: num(s.consumption, 1, 0, 10),
    accounts: accounts.length ? accounts : ["cash", "bank"],
    refuelSecondsPerLiter: num(s.refuelSecondsPerLiter, 0.15, 0, 5),
    electricModels: Array.isArray(s.electricModels)
      ? s.electricModels
          .filter((m): m is string => typeof m === "string")
          .map((m) => m.toLowerCase())
      : [...ELECTRIC_MODELS],
    blip: {
      sprite: int(blip.sprite, DEFAULT_BLIP.sprite, 0, 1000),
      color: int(blip.color, DEFAULT_BLIP.color, 0, 100),
      scale: num(blip.scale, DEFAULT_BLIP.scale, 0.3, 2),
    },
  };
}

export function readStations(raw: unknown): Map<string, Station> {
  const out = new Map<string, Station>();
  for (const [id, value] of Object.entries(record(raw))) {
    const v = record(value);
    const c = record(v.coords);
    out.set(id, {
      id,
      label: str(v.label, id, 48),
      x: num(c.x, 0),
      y: num(c.y, 0),
      z: num(c.z, 0),
      radius: num(v.radius, 12, 2, 40),
      price: num(v.price, 3, 0, 1000),
      blip: bool(v.blip, true),
    });
  }
  return out;
}

/** Default electric models (panel `electricModels`): no fuel use (no charging stations yet). */
export const ELECTRIC_MODELS = [
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
];

export const DEFAULT_BLIP: BlipStyle = { sprite: 361, color: 1, scale: 0.6 };
