import {
  EntityState,
  optionalExport,
  stateNumber,
} from "@aicore-fivem/lib/server";
import { FUEL_BAG } from "common/fuel";

export const fuelState = new EntityState(FUEL_BAG, stateNumber);
export const fuelOf = (vehicle: number): number | null =>
  fuelState.get(vehicle) ?? null;

/** Owned vehicles keep their fuel in ai-vehicles (saved whenever the whole number changes). */
export function persist(
  vehicle: number,
  fuel: number,
  before: number | null,
): void {
  if (before !== null && Math.floor(before) === Math.floor(fuel)) return;
  const api = optionalExport("ai-vehicles");
  const id = api?.GetVehicleIdByEntity(vehicle);
  if (api && id !== null && id !== undefined) api.SaveVehicle(id, { fuel });
}
