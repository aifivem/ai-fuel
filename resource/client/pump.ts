import {
  cache,
  callAction,
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
} from "@aicore-fivem/lib/client";
import { readFinite } from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
import { EVENTS, FUEL_BAG, HOSE_LENGTH, PUMP_MODELS } from "common/fuel";
import { nozzles } from "./nozzle";
import { fuelCap } from "./placement";

const fuelState = new EntityState(FUEL_BAG, stateNumber);
const PROMPT = "refuel";
let secondsPerLiter = 0.25;

/** Settings the pump flow needs (set by the client entry). */
export function configurePump(seconds: number): void {
  secondsPerLiter = seconds;
}

const holding = () => nozzles.get(cache.serverId);
/** A short reach toward the pump when the nozzle is taken or hung up. */
const grab = () =>
  void player.playAnim("anim@am_hold_up@male", "shoplift_high", {
    blendIn: 2,
    blendOut: 8,
    duration: 300,
    flag: 50,
  });
const FAR = { fallback: "FUEL_ERR_FAR" };

/** Every map pump: take its nozzle on foot, hang it back up. */
const points = new Points();
points.addModel("pump", {
  models: [...PUMP_MODELS],
  label: () => Locale(holding() ? "FUEL_PROMPT_RETURN" : "FUEL_PROMPT_TAKE"),
  icon: "gas-pump",
  radius: 1.6,
  canShow: () => cache.vehicle === false,
  onPressed: async (pump) => {
    grab();
    if (holding()) return emitNet(EVENTS.returnNozzle);
    const [x = 0, y = 0, z = 0] = GetEntityCoords(pump, false);
    await callAction(EVENTS.takeNozzle, [x, y, z], FAR);
  },
});
onCache("vehicle", () => points.refresh());

const vehicleInReach = () => nearestVehicle(3, { notOwn: true });

/**
 * While the player holds a nozzle (the timer runs only then): the refuel prompt at a vehicle in reach, and the nozzle
 * goes back by itself when the player walks further than the hose reaches or gets into a vehicle.
 */
let target = 0;
let watcher: ReturnType<typeof setInterval> | undefined;
function watch(): void {
  const nozzle = holding();
  if (!nozzle) return;
  if (cache.vehicle !== false || player.distanceTo(nozzle) > HOSE_LENGTH + 1) {
    emitNet(EVENTS.returnNozzle);
    return notify(Locale("FUEL_HOSE_END"), "info");
  }
  const vehicle = nozzle.netId === null ? vehicleInReach() : 0;
  if (vehicle === target) return;
  target = vehicle;
  if (vehicle) showPrompt(PROMPT, Locale("FUEL_PROMPT_REFUEL"));
  else hidePrompt(PROMPT);
}
nozzles.onChange((id) => {
  if (id !== cache.serverId) return;
  points.refresh();
  if (holding()) {
    watcher ??= setInterval(watch, 250);
    return;
  }
  if (watcher !== undefined) clearInterval(watcher);
  watcher = undefined;
  if (target) hidePrompt(PROMPT);
  target = 0;
});

let busy = false;
onPromptPressed((id) => {
  if (id !== PROMPT || busy || !target) return;
  busy = true;
  void refuel(target).finally(() => (busy = false));
});

async function refuel(vehicle: number): Promise<void> {
  const missing = 100 - (fuelState.get(vehicle) ?? 100);
  if (missing < 1) return notify(Locale("FUEL_ERR_FULL"), "info");
  const plugged = await callAction(
    EVENTS.plug,
    [NetworkGetNetworkIdFromEntity(vehicle)],
    FAR,
  );
  if (!plugged) return;
  hidePrompt(PROMPT);
  // Face the cap and push the nozzle in; the player is free while the tank fills.
  const cap = fuelCap(vehicle);
  if (cap) TaskTurnPedToFaceCoord(cache.ped, cap.x, cap.y, cap.z, 1000);
  void player.playAnim("weapons@misc@jerrycan@", "fire", {
    blendIn: 2,
    blendOut: 8,
    duration: 1000,
    flag: 50,
  });
  const done = await progress({
    label: Locale("FUEL_REFUELING"),
    duration: Math.max(1000, missing * secondsPerLiter * 1000),
  });
  const result = done ? await callAction(EVENTS.refuel, [], FAR) : null;
  await callAction(EVENTS.plug, [null], { ...FAR, silent: true });
  if (result)
    notify(Locale("FUEL_PAID", readFinite(result.price) ?? 0), "success");
}

on("onResourceStop", (resource: string) => {
  if (resource === ResourceName && holding()) emitNet(EVENTS.returnNozzle);
});
