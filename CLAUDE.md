# ai-fuel

Fuel use and gas stations. The fuel of a vehicle is the `fuel` entity state bag (0-100) the server keeps; ai-vehicles seeds it on spawn and stores it for owned vehicles, ai-hud shows it. Depends on ai-core (money, prompts, admin panel); ai-vehicles optional. Research and decisions: `docs/research/vehicles.md`.

## Decisions

- Only the driver's client burns fuel (1 s timer from rpm and vehicle class, `common/fuel.ts`), applies it to the game and reports it every 5 s; the server takes only lower values and writes the state bag. Bicycles and electric models burn nothing.
- Refuelling: inside a station zone the prompt shows; the client plays the progress (time per percent), then the server checks distance, charges the accounts in order and fills the bag.
- Stations are panel records (27 defaults converted from ox_fuel's station list, GPL-3.0).

## Contracts

- Events: `resource/common/fuel.ts`. State bag `fuel` on vehicles. Owned vehicles' fuel goes to ai-vehicles `SaveVehicle` when the whole number changes.

## Entry points

- Server: consume and refuel `resource/server/index.ts`; panel `server/schema.ts`.
- Client: burner and stations `resource/client/index.ts`.
