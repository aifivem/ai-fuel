import { AdminPanel, resourceExport } from "@aicore-fivem/lib/server";
import { readSettings, readStation } from "common/fuel";
import { fuelSchema } from "./schema";

export const core = resourceExport("ai-core");
export const panel = new AdminPanel(fuelSchema);
export const settings = panel.view("settings", readSettings);
export const stations = panel.records("stations", readStation);
