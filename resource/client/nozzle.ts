import { PlayerState, requestModel } from "@aicore-fivem/lib/client";
import { waitFor } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { NOZZLE_BAG, PUMP_MODELS, toNozzle, type Nozzle } from "common/fuel";
import { addHose, attachToHand, attachToVehicle } from "./placement";

const NOZZLE_MODEL = "prop_cs_fuel_nozle";
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
  /** Holders whose ped is not here (out of scope): drawn again when it comes back. */
  private readonly waiting = new Set<number>();
  private sweeper: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly state: PlayerState<Nozzle>) {
    state.onChange((serverId, nozzle) => void this.update(serverId, nozzle));
    on("onResourceStop", (resource: string) => {
      if (resource === ResourceName)
        for (const id of this.drawn.keys()) this.clear(id);
    });
  }

  /** Once a second while anything is drawn or waiting: a holder who left scope takes the ped away, one who came back is drawn. */
  private sweep(): void {
    for (const [id, d] of this.drawn) {
      const ped = GetPlayerPed(GetPlayerFromServerId(id));
      if (ped && DoesEntityExist(ped) && DoesEntityExist(d.prop)) continue;
      this.clear(id);
      if (this.state.get(id)) this.waiting.add(id);
    }
    for (const id of this.waiting) {
      const nozzle = this.state.get(id);
      if (!nozzle) this.waiting.delete(id);
      else if (DoesEntityExist(GetPlayerPed(GetPlayerFromServerId(id))))
        void this.update(id, nozzle);
    }
    this.watch();
  }

  /** Starts or stops the sweep timer. */
  private watch(): void {
    const needed = this.drawn.size > 0 || this.waiting.size > 0;
    if (needed && this.sweeper === undefined)
      this.sweeper = setInterval(() => this.sweep(), 1000);
    else if (!needed && this.sweeper !== undefined) {
      clearInterval(this.sweeper);
      this.sweeper = undefined;
    }
  }

  private async update(
    serverId: number,
    nozzle: Nozzle | undefined,
  ): Promise<void> {
    const before = this.drawn.get(serverId);
    this.waiting.delete(serverId);
    if (!nozzle) {
      this.clear(serverId);
      return this.watch();
    }
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
    if (!ped || !DoesEntityExist(ped)) {
      this.waiting.add(serverId);
      return this.watch();
    }
    const hash = await requestModel(NOZZLE_MODEL).catch(() => 0);
    if (!hash || this.state.get(serverId) !== nozzle) return;
    const [x = 0, y = 0, z = 0] = GetEntityCoords(ped, false);
    const prop = CreateObject(hash, x, y, z, false, false, false);
    SetModelAsNoLongerNeeded(hash);
    SetEntityCollision(prop, false, false);
    const d: Drawn = { nozzle, prop, rope: 0 };
    this.drawn.set(serverId, d);
    this.watch();
    this.attach(serverId, d);
    await this.hose(serverId, d);
  }

  /** In the holder's hand, or at the fuel cap of the vehicle it fills. */
  private attach(serverId: number, d: Drawn): void {
    DetachEntity(d.prop, true, false);
    const vehicle =
      d.nozzle.netId !== null &&
      NetworkDoesEntityExistWithNetworkId(d.nozzle.netId)
        ? NetToVeh(d.nozzle.netId)
        : 0;
    if (vehicle && attachToVehicle(d.prop, vehicle)) return;
    attachToHand(d.prop, GetPlayerPed(GetPlayerFromServerId(serverId)));
  }

  private async hose(serverId: number, d: Drawn): Promise<void> {
    const pump = pumpAt(d.nozzle);
    if (!pump) return;
    RopeLoadTextures();
    if (
      !(await waitFor(() => RopeAreTexturesLoaded() || undefined, 3000).catch(
        () => false,
      ))
    )
      return;
    if (this.drawn.get(serverId) !== d) return;
    const rope = await addHose(pump, d.prop);
    // Cleared while the rope was being made.
    if (this.drawn.get(serverId) !== d) {
      if (rope) DeleteRope(rope);
      return;
    }
    d.rope = rope;
  }

  private clear(serverId: number): void {
    const d = this.drawn.get(serverId);
    if (!d) return;
    this.drawn.delete(serverId);
    if (d.rope && DoesRopeExist(d.rope)[0]) DeleteRope(d.rope);
    // Rope textures are loaded for the whole scene: free them only with the last hose.
    if (d.rope && ![...this.drawn.values()].some((o) => o.rope))
      RopeUnloadTextures();
    if (DoesEntityExist(d.prop)) DeleteEntity(d.prop);
  }
}

/** Nozzles of every player near this one (the local player's included). */
export const nozzles = new PlayerState(NOZZLE_BAG, toNozzle);
new NozzleView(nozzles);
