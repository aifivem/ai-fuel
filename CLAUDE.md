# ai-fuel

Fuel use and gas stations. The fuel of a vehicle is the `fuel` entity state bag (0-100) the server keeps; ai-vehicles seeds it on spawn and stores it for owned vehicles, ai-hud shows it. Depends on ai-core (money, prompts, admin panel); ai-vehicles optional.

## Decisions

- The game burns fuel (FiveM's fuel consumption: `SetFuelConsumptionState(true)`, rate = rpm x the vehicle's `fPetrolConsumptionRate` x the global multiplier `consumption x 10`); the driver's client sets the tank from the `fuel` bag on entering (percent of `fPetrolTankVolume`), raises it after a refuel and reports lower values every 5 s; the server takes only lower values and writes the bag. Bicycles, tankless vehicles and electric models (their consumption rate set to 0) burn nothing.
- Refuelling happens at the map's pump models (a lib `Points` model point, on foot): the player takes the nozzle, plugs it into a vehicle within the hose's reach (8 m from the pump), the client plays the progress (time per litre), then the server checks the nozzle, the pump's station and the distance, charges the accounts in order and fills the bag. Walking past the hose's end or getting into a vehicle hangs the nozzle back up.
- The nozzle and hose are shown to everyone near: the server keeps who holds which pump's nozzle in memory and in the player state `aiFuelNozzle` (`{ x, y, z, netId }`), and every client draws a local nozzle prop (hand, or the vehicle's `petrolcap` bone) and a rope from the pump object (`client/nozzle.ts`). Nothing is networked.
- Stations (panel records) give the price and the blip, and decide which pumps sell fuel.
- Station defaults (27) are converted from ox_fuel's station list (GPL-3.0).

## Contracts

- Events: `resource/common/fuel.ts`. State bag `fuel` on vehicles, player state `aiFuelNozzle`. Owned vehicles' fuel goes to ai-vehicles `SaveVehicle` when the whole number changes.

## Entry points

- Server: consume and refuel `resource/server/index.ts`; panel `server/schema.ts`.
- Client: burner and station blips `resource/client/index.ts`, pump flow `client/pump.ts`, nozzle and hose drawing `client/nozzle.ts`.
