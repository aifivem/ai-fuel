import { PlayerState, requestModel } from "@aicore-fivem/lib/client";
import { waitFor } from "@aicore-fivem/lib/shared";
import {
  HOSE_LENGTH,
  NOZZLE_BAG,
  PUMP_MODELS,
  toNozzle,
  type Nozzle,
} from "common/fuel";

const NOZZLE_MODEL = "prop_cs_fuel_nozle";
/** Left hand (SKEL_L_Hand). */
const HAND_BONE = 18905;
const PUMP_HASHES = PUMP_MODELS.map((m) => GetHashKey(m));

interface Drawn {
  nozzle: Nozzle;
  prop: number;
  rope: number;
}

/** The pump object at a nozzle's pump position (map objects have no network id). */
function pumpAt(n: Nozzle): number {
  for (const hash of PUMP_HASHES) {
    const pump = GetClosestObjectOfType(
      n.x,
      n.y,
      n.z,
      1.5,
      hash,
      false,
      false,
      false,
    );
    if (pump) return pump;
  }
  return 0;
}

/**
 * Every nozzle near this player, drawn locally from the holders' player state: the nozzle prop in the holder's hand
 * (or in the vehicle it fills) and a hose from the pump to it. Nothing is networked; every client draws the same.
 */
class NozzleView {
  private readonly drawn = new Map<number, Drawn>();

  constructor(private readonly state: PlayerState<Nozzle>) {
    state.onChange((serverId, nozzle) => void this.update(serverId, nozzle));
    // A holder who leaves this player's scope takes the ped away: drop what was drawn for them.
    setInterval(() => {
      for (const [id, d] of this.drawn) {
        const ped = GetPlayerPed(GetPlayerFromServerId(id));
        if (!ped || !DoesEntityExist(ped) || !DoesEntityExist(d.prop))
          this.clear(id);
      }
    }, 1000);
    on("onResourceStop", (resource: string) => {
      if (resource === GetCurrentResourceName())
        for (const id of [...this.drawn.keys()]) this.clear(id);
    });
  }

  private async update(
    serverId: number,
    nozzle: Nozzle | undefined,
  ): Promise<void> {
    const before = this.drawn.get(serverId);
    if (!nozzle) return this.clear(serverId);
    if (
      before &&
      before.nozzle.x === nozzle.x &&
      before.nozzle.y === nozzle.y
    ) {
      before.nozzle = nozzle;
      this.attach(serverId, before);
      return;
    }
    this.clear(serverId);
    const ped = GetPlayerPed(GetPlayerFromServerId(serverId));
    if (!ped || !DoesEntityExist(ped)) return;
    const hash = await requestModel(NOZZLE_MODEL).catch(() => 0);
    if (!hash || this.state.get(serverId) !== nozzle) return;
    const [x = 0, y = 0, z = 0] = GetEntityCoords(ped, false);
    const prop = CreateObject(hash, x, y, z, false, false, false);
    SetModelAsNoLongerNeeded(hash);
    SetEntityCollision(prop, false, false);
    const d: Drawn = { nozzle, prop, rope: 0 };
    this.drawn.set(serverId, d);
    this.attach(serverId, d);
    await this.hose(d);
  }

  /** In the holder's hand, or at the fuel cap of the vehicle it fills. */
  private attach(serverId: number, d: Drawn): void {
    DetachEntity(d.prop, true, false);
    const vehicle =
      d.nozzle.netId !== null &&
      NetworkDoesEntityExistWithNetworkId(d.nozzle.netId)
        ? NetToVeh(d.nozzle.netId)
        : 0;
    if (vehicle) {
      const cap = GetEntityBoneIndexByName(vehicle, "petrolcap");
      const bone =
        cap !== -1 ? cap : GetEntityBoneIndexByName(vehicle, "petroltank");
      AttachEntityToEntity(
        d.prop,
        vehicle,
        Math.max(bone, 0),
        0,
        0,
        0.05,
        -90,
        0,
        90,
        true,
        true,
        false,
        false,
        1,
        true,
      );
      return;
    }
    const ped = GetPlayerPed(GetPlayerFromServerId(serverId));
    AttachEntityToEntity(
      d.prop,
      ped,
      GetPedBoneIndex(ped, HAND_BONE),
      0.11,
      0.02,
      0.02,
      -80,
      -90,
      15,
      true,
      true,
      false,
      true,
      1,
      true,
    );
  }

  private async hose(d: Drawn): Promise<void> {
    const pump = pumpAt(d.nozzle);
    if (!pump) return;
    RopeLoadTextures();
    if (
      !(await waitFor(() => RopeAreTexturesLoaded() || undefined, 3000).catch(
        () => false,
      ))
    )
      return;
    if (!DoesEntityExist(d.prop)) return;
    const { x, y, z } = d.nozzle;
    const [rope] = AddRope(
      x,
      y,
      z + 1.2,
      0,
      0,
      0,
      HOSE_LENGTH,
      1,
      HOSE_LENGTH,
      1,
      1,
      false,
      false,
      false,
      1,
      true,
    );
    ActivatePhysics(rope);
    const [nx = 0, ny = 0, nz = 0] = GetEntityCoords(d.prop, false);
    AttachEntitiesToRope(
      rope,
      pump,
      d.prop,
      x,
      y,
      z + 1.2,
      nx,
      ny,
      nz,
      HOSE_LENGTH,
      false,
      false,
      "",
      "",
    );
    d.rope = rope;
  }

  private clear(serverId: number): void {
    const d = this.drawn.get(serverId);
    if (!d) return;
    this.drawn.delete(serverId);
    if (d.rope) DeleteRope(d.rope);
    if (DoesEntityExist(d.prop)) DeleteEntity(d.prop);
  }
}

/** Nozzles of every player near this one (the local player's included). */
export const nozzles = new PlayerState(NOZZLE_BAG, toNozzle);
new NozzleView(nozzles);
