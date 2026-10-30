import {
  cache,
  EntityState,
  hidePrompt,
  nearestVehicle,
  notify,
  onCache,
  onPromptPressed,
  player,
  Points,
  progress,
  showPrompt,
  stateNumber,
  triggerServerCallback,
} from "@aicore-fivem/lib/client";
import { record } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, FUEL_BAG, HOSE_LENGTH, PUMP_MODELS } from "common/fuel";
import { nozzles } from "./nozzle";

const fuelState = new EntityState(FUEL_BAG, stateNumber);
const PROMPT = "refuel";
let secondsPerLiter = 0.25;
let texts: Record<string, string> = {};

/** Settings and texts the pump flow needs (set by the client entry). */
export function configurePump(
  seconds: number,
  lang: Record<string, string>,
): void {
  secondsPerLiter = seconds;
  texts = lang;
}

const holding = () => nozzles.get(cache.serverId);
const fail = (result: unknown) => {
  const key =
    typeof record(result).error === "string"
      ? String(record(result).error)
      : "FUEL_ERR_FAR";
  notify(texts[key] ?? key, "error");
};

/** Every map pump: take its nozzle on foot, hang it back up. */
const points = new Points();
points.addModel("pump", {
  models: [...PUMP_MODELS],
  label: () => Locale(holding() ? "FUEL_PROMPT_RETURN" : "FUEL_PROMPT_TAKE"),
  icon: "gas-pump",
  radius: 1.6,
  canShow: () => cache.vehicle === false,
  onPressed: async (pump) => {
    if (holding()) return emitNet(EVENTS.returnNozzle);
    const [x = 0, y = 0, z = 0] = GetEntityCoords(pump, false);
    const result = await triggerServerCallback(EVENTS.takeNozzle, [
      x,
      y,
      z,
    ]).catch(() => null);
    if (record(result).ok !== true) fail(result);
  },
});
onCache("vehicle", () => points.refresh());
nozzles.onChange((id) => id === cache.serverId && points.refresh());

const vehicleInReach = () => nearestVehicle(3, { notOwn: true });

/**
 * While the player holds a nozzle: the refuel prompt at a vehicle in reach, and the nozzle goes back by itself when
 * the player walks further than the hose reaches or gets into a vehicle.
 */
let target = 0;
setInterval(() => {
  const nozzle = holding();
  if (!nozzle) {
    if (target) hidePrompt(PROMPT);
    target = 0;
    return;
  }
  if (cache.vehicle !== false || player.distanceTo(nozzle) > HOSE_LENGTH + 1) {
    emitNet(EVENTS.returnNozzle);
    return notify(Locale("FUEL_HOSE_END"), "info");
  }
  const vehicle = nozzle.netId === null ? vehicleInReach() : 0;
  if (vehicle === target) return;
  target = vehicle;
  if (vehicle) showPrompt(PROMPT, Locale("FUEL_PROMPT_REFUEL"));
  else hidePrompt(PROMPT);
}, 250);

let busy = false;
onPromptPressed((id) => {
  if (id !== PROMPT || busy || !target) return;
  busy = true;
  void refuel(target).finally(() => (busy = false));
});

async function refuel(vehicle: number): Promise<void> {
  const missing = 100 - (fuelState.get(vehicle) ?? 100);
  if (missing < 1) return notify(Locale("FUEL_ERR_FULL"), "info");
  const plugged = await triggerServerCallback(EVENTS.plug, [
    NetworkGetNetworkIdFromEntity(vehicle),
  ]).catch(() => null);
  if (record(plugged).ok !== true) return fail(plugged);
  hidePrompt(PROMPT);
  const done = await progress({
    label: Locale("FUEL_REFUELING"),
    duration: Math.max(1000, missing * secondsPerLiter * 1000),
    anim: {
      dict: "timetable@gardener@filling_can",
      clip: "gar_ig_5_filling_can",
    },
  });
  const result = done
    ? await triggerServerCallback(EVENTS.refuel).catch(() => null)
    : null;
  await triggerServerCallback(EVENTS.plug, [null]).catch(() => null);
  if (!done) return;
  if (record(result).ok === true)
    notify(Locale("FUEL_PAID", Number(record(result).price ?? 0)), "success");
  else fail(result);
}

on("onResourceStop", (resource: string) => {
  if (resource === GetCurrentResourceName() && holding())
    emitNet(EVENTS.returnNozzle);
});
