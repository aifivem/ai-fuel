import {
  aiLog,
  aiLogChannels,
  notify,
  onClientCallback,
  progressFor,
} from "@aicore-fivem/lib/server";
import { fail } from "@aicore-fivem/lib/shared";
import type { ActionResult } from "@aicore-fivem/shared";
import { Locale } from "common";
import { EVENTS } from "common/fuel";
import { core, settings } from "./content";
import { plugged } from "./nozzles";
import { fuelOf, fuelState, persist } from "./tank";

aiLogChannels({ refuels: {} });

onClientCallback(
  EVENTS.refuel,
  async (source): Promise<ActionResult> => {
    const first = plugged(source);
    if (!first) return fail("FUEL_ERR_FAR");
    const missing = 100 - (fuelOf(first.vehicle) ?? 0);
    if (Math.floor(missing) <= 0) return fail("FUEL_ERR_FULL");
    const done = await progressFor(source, {
      label: Locale("FUEL_REFUELING"),
      duration: Math.max(
        1000,
        missing * settings.value.refuelSecondsPerLiter * 1000,
      ),
    });
    // A cancelled bar ends quietly.
    if (!done) return { ok: true };
    const now = plugged(source);
    if (!now || now.vehicle !== first.vehicle) return fail("FUEL_ERR_FAR");
    const { vehicle, station } = now;
    const before = fuelOf(vehicle) ?? 0;
    const liters = Math.floor(100 - before);
    if (liters <= 0) return fail("FUEL_ERR_FULL");
    const price = Math.ceil(liters * station.price);
    if (
      !settings.value.accounts.some((account) =>
        core.RemoveMoney(source, account, price, `fuel:${station.id}`),
      )
    )
      return fail("FUEL_ERR_MONEY");
    fuelState.set(vehicle, 100);
    persist(vehicle, 100, null);
    aiLog("refuels", `refuelled ${liters} for $${price} at ${station.id}`, {
      source,
      metadata: { station: station.id, liters, price },
    });
    notify(source, Locale("FUEL_PAID", price), "success");
    return { ok: true };
  },
  { lock: true },
);
