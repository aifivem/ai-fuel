import { sleep } from "@aicore-fivem/lib/shared";

/** Left hand (SKEL_L_Hand). */
const HAND_BONE = 18905;
/** Tried in order; the ones after the tank bones stand in for models without a cap bone. */
const CAP_BONES = [
  "petrolcap",
  "petroltank",
  "petroltank_l",
  "petroltank_r",
  "wheel_lr",
  "wheel_lf",
  "engine",
  "chassis_dummy",
];
/** The visible cap sits about this far above the cap bone and this far out of the body side (metres). */
const CAP_UP = 0.5;
const CAP_OUT = 0.15;
/** Where the hose leaves each pump model, metres above its origin. */
const HOSE_TOP = new Map<number, number>([
  [GetHashKey("prop_gas_pump_1a"), 2.3],
  [GetHashKey("prop_gas_pump_1b"), 2.3],
  [GetHashKey("prop_gas_pump_1c"), 2.3],
  [GetHashKey("prop_gas_pump_1d"), 2.3],
  [GetHashKey("prop_vintage_pump"), 1.8],
  [GetHashKey("prop_gas_pump_old2"), 1.6],
  [GetHashKey("prop_gas_pump_old3"), 1.6],
]);
const HOSE_TOP_DEFAULT = 2.1;
/** The hose end on the nozzle model (its grip), in the nozzle's own axes. */
const HOSE_END = [0, -0.033, -0.195] as const;

/** Holds the nozzle in the ped's left hand. */
export function attachToHand(prop: number, ped: number): void {
  AttachEntityToEntity(
    prop,
    ped,
    GetPedBoneIndex(ped, HAND_BONE),
    0.13,
    0.04,
    0.01,
    -42,
    -115,
    -63.42,
    false,
    true,
    false,
    true,
    0,
    true,
  );
}

/** The vehicle's fuel cap bone and its world position. */
export function fuelCap(
  vehicle: number,
): { bone: number; x: number; y: number; z: number } | null {
  for (const name of CAP_BONES) {
    const bone = GetEntityBoneIndexByName(vehicle, name);
    if (bone === -1) continue;
    const [x = 0, y = 0, z = 0] = GetWorldPositionOfEntityBone(vehicle, bone);
    return { bone, x, y, z };
  }
  return null;
}

/**
 * Plugs the nozzle into the vehicle's fuel cap, pointing into the body side the cap is on. With `syncRot` false the
 * engine takes offset and rotation in world axes, so both are built from the vehicle's matrix and rotation; the
 * nozzle does not turn with the vehicle afterwards (it stands still while refuelling).
 */
export function attachToVehicle(prop: number, vehicle: number): boolean {
  const cap = fuelCap(vehicle);
  if (!cap) return false;
  const [local = 0] = GetOffsetFromEntityGivenWorldCoords(
    vehicle,
    cap.x,
    cap.y,
    cap.z,
  );
  const side = local > 0 ? 1 : -1;
  const [, right = [], up = []] = GetEntityMatrix(vehicle);
  const out = side * CAP_OUT;
  const [rx = 0, ry = 0, rz = 0] = right;
  const [ux = 0, uy = 0, uz = 0] = up;
  const [pitch = 0, roll = 0, yaw = 0] = GetEntityRotation(vehicle, 2);
  AttachEntityToEntity(
    prop,
    vehicle,
    cap.bone,
    rx * out + ux * CAP_UP,
    ry * out + uy * CAP_UP,
    rz * out + uz * CAP_UP,
    pitch - 45,
    roll,
    yaw + side * 90,
    false,
    false,
    false,
    false,
    2,
    false,
  );
  return true;
}

/** A hose from the top of the pump to the nozzle's grip. Rope textures must be loaded. */
export async function addHose(pump: number, prop: number): Promise<number> {
  const top = HOSE_TOP.get(GetEntityModel(pump)) ?? HOSE_TOP_DEFAULT;
  const [px = 0, py = 0, pz = 0] = GetOffsetFromEntityInWorldCoords(
    pump,
    0,
    0,
    top,
  );
  const [rope] = AddRope(
    px,
    py,
    pz,
    0,
    0,
    0,
    4,
    1,
    10,
    0,
    1,
    false,
    false,
    false,
    1,
    true,
  );
  ActivatePhysics(rope);
  // The rope needs a moment of physics before it takes an attachment.
  await sleep(100);
  if (!DoesEntityExist(prop) || !DoesEntityExist(pump)) {
    DeleteRope(rope);
    return 0;
  }
  const [ex = 0, ey = 0, ez = 0] = GetOffsetFromEntityInWorldCoords(
    prop,
    ...HOSE_END,
  );
  AttachEntitiesToRope(
    rope,
    pump,
    prop,
    px,
    py,
    pz,
    ex,
    ey,
    ez,
    30,
    false,
    false,
    "",
    "",
  );
  return rope;
}
