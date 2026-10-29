import type { PanelSchema } from "@aicore-fivem/shared";

/** ai-fuel's panel: how fast vehicles burn fuel, how refuelling is paid, where the stations are. */
export const fuelSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "gas-pump",
  files: {
    settings: {
      kind: "settings",
      sync: "all",
      sections: {
        consumption: { type: "number", min: 0, max: 10 },
        accounts: { type: "names", max: 5, itemMax: 32, pattern: "^[a-z0-9_]{2,32}$" },
        refuelSecondsPerLiter: { type: "number", min: 0, max: 5 },
      },
    },
    stations: {
      kind: "records",
      sync: "all",
      labelPath: "label",
      newRecord: { label: "Gas Station", coords: { x: 0, y: 0, z: 0 }, radius: 12, price: 3, blip: true },
      sections: { label: { type: "text", min: 1, max: 48 }, coords: { type: "vec3" }, radius: { type: "number", min: 2, max: 40 }, price: { type: "number", min: 0, max: 1000 }, blip: { type: "bool" } },
    },
  },
  tabs: [
    {
      id: "stations",
      file: "stations",
      icon: "gas-pump",
      label: "ADMIN_TAB_STATIONS",
      desc: "ADMIN_TAB_STATIONS_DESC",
      createLabel: "ADMIN_NEW_STATION",
      deleteLabel: "ADMIN_DELETE_STATION",
      cards: [
        {
          icon: "gas-pump",
          title: "ADMIN_C_STATION",
          desc: "ADMIN_C_STATION_DESC",
          fields: [
            { widget: "text", path: "label", label: "ADMIN_F_LABEL", placeholder: "ADMIN_P_LABEL" },
            { widget: "point", path: "coords", label: "ADMIN_F_COORDS", hint: "ADMIN_H_COORDS", ground: true },
            { widget: "number", path: "radius", label: "ADMIN_F_RADIUS", hint: "ADMIN_H_RADIUS", min: 2, max: 40, unit: "m" },
            { widget: "number", path: "price", label: "ADMIN_F_PRICE", hint: "ADMIN_H_PRICE", min: 0, max: 1000, step: 0.5, unit: "$" },
            { widget: "switch", path: "blip", label: "ADMIN_F_BLIP" },
          ],
        },
      ],
    },
    {
      id: "settings",
      file: "settings",
      icon: "sliders",
      label: "ADMIN_TAB_SETTINGS",
      desc: "ADMIN_TAB_SETTINGS_DESC",
      cards: [
        {
          icon: "gas-pump",
          title: "ADMIN_C_FUEL",
          desc: "ADMIN_C_FUEL_DESC",
          fields: [
            { widget: "number", path: "consumption", label: "ADMIN_F_CONSUMPTION", hint: "ADMIN_H_CONSUMPTION", min: 0, max: 10, step: 0.1 },
            { widget: "number", path: "refuelSecondsPerLiter", label: "ADMIN_F_REFUEL_TIME", hint: "ADMIN_H_REFUEL_TIME", min: 0, max: 5, step: 0.05, unit: "s" },
            { widget: "tags", path: "accounts", label: "ADMIN_F_ACCOUNTS", hint: "ADMIN_H_ACCOUNTS", placeholder: "ADMIN_P_ACCOUNTS" },
          ],
        },
      ],
    },
  ],
};
