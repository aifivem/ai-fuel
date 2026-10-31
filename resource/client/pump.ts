import {
  cache,
  callAction,
  EntityState,
  every,
  notify,
  onCache,
  onStop,
  player,
  Points,
  stateNumber,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { EVENTS, FUEL_BAG, HOSE_LENGTH, PUMP_MODELS } from "common/fuel";
import { nozzles } from "./nozzle";
import { fuelCap } from "./placement";

const fuelState = new EntityState(FUEL_BAG, stateNumber);
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
  // A target on the pump models (owner decision): a prompt here would scan the object pool twice a second.
  preferTarget: true,
  canShow: () => cache.vehicle === false,
  onPressed: async (pump) => {
    grab();
    if (holding()) return emitNet(EVENTS.returnNozzle);
    const [x = 0, y = 0, z = 0] = GetEntityCoords(pump, false);
    await callAction(EVENTS.takeNozzle, [x, y, z], FAR);
  },
});
onCache("vehicle", () => points.refresh());

/** The refuel point on vehicles: only while a nozzle is held (the vehicle scan runs only then). */
function setRefuelPoint(on: boolean): void {
  if (!on) return points.remove("refuel");
  points.addVehicle("refuel", {
    label: Locale("FUEL_PROMPT_REFUEL"),
    icon: "gas-pump",
    radius: 3,
    preferTarget: true,
    canShow: () => cache.vehicle === false && holding()?.netId === null,
    onPressed: (vehicle) => refuel(vehicle),
  });
}

/** While the player holds a nozzle: it goes back by itself past the hose's reach or in a vehicle. */
function watch(): void {
  const nozzle = holding();
  if (!nozzle) return;
  if (cache.vehicle !== false || player.distanceTo(nozzle) > HOSE_LENGTH + 1) {
    emitNet(EVENTS.returnNozzle);
    return notify(Locale("FUEL_HOSE_END"), "info");
  }
}
const watcher = every(250, watch, { active: false, name: "nozzle" });
nozzles.onChange((id) => {
  if (id !== cache.serverId) return;
  points.refresh();
  const held = holding() !== undefined;
  watcher.set(held);
  setRefuelPoint(held);
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
  // Face the cap and push the nozzle in; the player is free while the tank fills.
  const cap = fuelCap(vehicle);
  if (cap) TaskTurnPedToFaceCoord(cache.ped, cap.x, cap.y, cap.z, 1000);
  void player.playAnim("weapons@misc@jerrycan@", "fire", {
    blendIn: 2,
    blendOut: 8,
    duration: 1000,
    flag: 50,
  });
  // The server runs the progress bar and charges when it ran out.
  await callAction(EVENTS.refuel, [], {
    ...FAR,
    timeout: missing * secondsPerLiter * 1000 + 30_000,
  });
  await callAction(EVENTS.plug, [null], { ...FAR, silent: true });
}

onStop(() => {
  if (holding()) emitNet(EVENTS.returnNozzle);
});
