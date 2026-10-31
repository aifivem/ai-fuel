# ai-fuel

Fuel use and gas stations. The fuel of a vehicle is the `fuel` entity state bag (0-100) the server keeps; ai-vehicles seeds it on spawn and stores it for owned vehicles, ai-hud shows it. Depends on ai-core (money, prompts, admin panel); ai-vehicles optional.

## Decisions

- The game burns fuel (FiveM's fuel consumption: `SetFuelConsumptionState(true)`, rate = rpm x the vehicle's `fPetrolConsumptionRate` x the global multiplier `consumption x 10`); the driver's client sets the tank from the `fuel` bag on entering (percent of `fPetrolTankVolume`), raises it after a refuel and reports lower values every 5 s; the server takes only lower values and writes the bag. Bicycles, tankless vehicles and the panel's electric models (`settings.electricModels`, spawn names compared by hash; their consumption rate set to 0) burn nothing.
- Refuelling happens at the map's pump models (a lib `Points` model point, on foot): the player takes the nozzle, plugs it into a vehicle within the hose's reach (8 m from the pump), the server runs lib `progressFor` (time per missing litre) in the `refuel` callback, then checks the nozzle (still plugged into the same vehicle), the pump's station and the distance again, charges the accounts in order and fills the bag. Walking past the hose's end or getting into a vehicle hangs the nozzle back up.
- The nozzle and hose are shown to everyone near: the server keeps who holds which pump's nozzle in a lib `PlayerMap` and in the player state `aiFuelNozzle` (`{ x, y, z, netId }`), and every client draws a local nozzle prop and a rope from the pump object (`client/nozzle.ts`, numbers in `client/placement.ts`). Nothing is networked. Every nozzle change makes each client near build or drop a prop and a rope, so take and return are rated 1/s per player and plug 2/s. The pump position comes from the client (the server cannot see map objects): only "inside a station and within 3 m of the player" is checked; a forged one draws no hose (no pump object there).
- Client timers run only while needed: the holder's 250 ms reach / prompt watcher from the local `aiFuelNozzle` change until it is gone, the drawing sweep (1 s) while a nozzle is drawn or its holder is out of scope (redrawn when the ped comes back).
- Station blip look is one panel `blip` widget (`settings.blip`); each station switches its blip on or off.
- Nozzle placement: in the hand on SKEL_L_Hand (18905) with `syncRot` true. At a vehicle it goes on the first bone found of `petrolcap`, `petroltank`, `petroltank_l/_r`, then rough stand-ins (`wheel_lr`, `wheel_lf`, `engine`, `chassis_dummy`), 0.5 m up and 0.15 m out of the body side the bone is on (sign of the bone's local x), pitched -45 and yawed 90 toward the body. That attach uses `syncRot` false: the engine then reads offset and rotation in world axes, so both are built from the vehicle's matrix and `GetEntityRotation(vehicle, 2)` (rotation order 2 on both calls); the nozzle does not follow if the vehicle moves. Odd models (vans, trucks, rear caps) sit wrong with the one default; a per-model offset table is not built.
- Hose: `AddRope` at the pump's top (offset along the pump's up axis: 2.3 m for `prop_gas_pump_1a-1d`, 1.8 vintage, 1.6 old2/old3, else 2.1), 100 ms of physics, then `AttachEntitiesToRope` from there to the nozzle's grip (nozzle offset `0, -0.033, -0.195`), rope length 30. `RopeUnloadTextures` unloads for the whole scene: it runs only when the last drawn hose goes.
- Animations: a 300 ms reach (`anim@am_hold_up@male` `shoplift_high`) on take and hang-up, and on plugging in the ped turns to the cap and plays a 1 s push (`weapons@misc@jerrycan@` `fire`); the progress bar runs without an animation and the player may move inside the hose's reach.
- Stations (panel records) give the price and the blip, and decide which pumps sell fuel.
- Station defaults (27): centres and blip look are qb-fuel's (`Config.GasStations`, its duplicate dropped; `Config.Blip`), radii come from ox_fuel's station list (GPL-3.0).

## Contracts

- ai-fuel is the default adapter of ai-core's fuel layer (`docs/compat/fuel.md`): other scripts read and set fuel through lib `fuel`, which reads and writes this `fuel` bag while ai-fuel runs.
- Events: `resource/common/fuel.ts`. State bag `fuel` on vehicles, player state `aiFuelNozzle`. Owned vehicles' fuel goes to ai-vehicles `SaveVehicle` when the whole number changes.

## Entry points

- Server: consume and refuel `resource/server/index.ts`; panel `server/schema.ts`.
- Client: burner and station blips (lib `RecordObjects`: an edited station redraws only its blip, a settings change all of them) `resource/client/index.ts`, pump flow `client/pump.ts`, nozzle and hose drawing `client/nozzle.ts`, attach and rope numbers `client/placement.ts`.
