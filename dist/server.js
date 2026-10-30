exports = globalThis.exports;
let node_fs_promises = require("node:fs/promises");
// ../../../packages/lib/src/server/rateLimit.ts
var SourceLock = class {
	active = new Set();
	async run(source, busy, task) {
		if (this.active.has(source)) return busy;
		this.active.add(source);
		try {
			return await task();
		} finally {
			this.active.delete(source);
		}
	}
	release(source) {
		this.active.delete(source);
	}
}, RateLimit = class {
	count;
	windowMs;
	hits = new Map();
	constructor(count, windowMs) {
		this.count = count, this.windowMs = windowMs;
	}
	take(source) {
		let now = GetGameTimer(), recent = (this.hits.get(source) ?? []).filter((at) => now - at < this.windowMs);
		return recent.length >= this.count ? (this.hits.set(source, recent), !1) : (recent.push(now), this.hits.set(source, recent), !0);
	}
	release(source) {
		this.hits.delete(source);
	}
};
// ../../../packages/lib/src/shared/read.ts
function num(value, fallback, min = -Infinity, max = Infinity) {
	return typeof value == "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function bool(value, fallback) {
	return typeof value == "boolean" ? value : fallback;
}
function str(value, fallback, max = 64) {
	return typeof value == "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function record(value) {
	return typeof value == "object" && value && !Array.isArray(value) ? value : {};
}
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function createLogger(resource) {
	let prefix = `[${resource}]`;
	return {
		info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
		warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
		error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
	};
}
function withoutSchemaKey(value) {
	if (!isRecord(value) || !("$schema" in value)) return value;
	let { $schema: _schema, ...rest } = value;
	return rest;
}
var DataFile = class {
	resource;
	name;
	log;
	writes = Promise.resolve();
	pending = void 0;
	timer = null;
	schemaRef = null;
	constructor(resource, name, log) {
		this.resource = resource, this.name = name, this.log = log;
	}
	hasSchemaRef() {
		return (LoadResourceFile(this.resource, this.path) ?? "").includes("\"$schema\"");
	}
	read() {
		for (let path of [this.path, `${this.path}.bak`]) {
			let raw = LoadResourceFile(this.resource, path);
			if (raw) try {
				return withoutSchemaKey(JSON.parse(raw));
			} catch (error) {
				this.log.error(`${this.resource}/${path} is not valid JSON${path === this.path ? ", trying the backup" : ""}`, error);
			}
		}
		return null;
	}
	write(value) {
		this.pending = value, this.timer ||= setTimeout(() => {
			this.timer = null;
			let data = this.schemaRef && isRecord(this.pending) ? {
				$schema: this.schemaRef,
				...this.pending
			} : this.pending, text = `${JSON.stringify(data, null, 2)}\n`;
			this.writes = this.writes.then(() => this.flush(text)).catch((error) => this.log.error(`saving ${this.resource}/${this.path} failed`, error));
		}, 250);
	}
	get path() {
		return `data/${this.name}.json`;
	}
	async flush(text) {
		let file = `${GetResourcePath(this.resource)}/${this.path}`;
		await (0, node_fs_promises.mkdir)(file.slice(0, file.lastIndexOf("/")), { recursive: !0 }), await (0, node_fs_promises.writeFile)(`${file}.tmp`, text, "utf8"), await (0, node_fs_promises.copyFile)(file, `${file}.bak`).catch(() => void 0), await (0, node_fs_promises.rename)(`${file}.tmp`, file);
	}
};
// ../../../packages/shared/src/core.ts
const CORE = {
	resource: "ai-core",
	clientErrorEvent: "ai-core:clientError",
	playerLoadedEvent: "ai-core:playerLoaded",
	playerUnloadedEvent: "ai-core:playerUnloaded",
	moneyChangedEvent: "ai-core:moneyChanged",
	jobsChangedEvent: "ai-core:jobsChanged",
	dutyChangedEvent: "ai-core:dutyChanged",
	gangsChangedEvent: "ai-core:gangsChanged",
	activeGangChangedEvent: "ai-core:activeGangChanged",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	clientCharacterLookEvent: "ai-core:client:characterLook",
	clientPromptPressedEvent: "ai-core:client:promptPressed",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	clientNotifyEvent: "ai-core:client:notify",
	spawnEvent: "ai-core:client:spawn",
	openCharactersEvent: "ai-core:client:openCharacters"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
};
// ../../../packages/lib/src/fivem/exports.ts
function registerExport(name, handler) {
	globalThis.exports(name, handler);
}
function resourceExport(resource) {
	return globalThis.exports[resource];
}
function isResourceStarted(resource) {
	return GetResourceState(resource) === "started";
}
function optionalExport(resource) {
	return isResourceStarted(resource) ? globalThis.exports[resource] : null;
}
function readLocaleFile(resource, lang) {
	let raw = LoadResourceFile(resource, `locales/${lang}.json`);
	if (!raw) return {};
	let parsed = JSON.parse(raw);
	if (!isRecord(parsed)) return {};
	let texts = {};
	for (let [key, value] of Object.entries(parsed)) typeof value == "string" && (texts[key] = value);
	return texts;
}
function loadLocaleTexts(resource = GetCurrentResourceName()) {
	let lang = GetConvar("ai:locale", "en"), texts = {
		...readLocaleFile(resource, "en"),
		...lang === "en" ? {} : readLocaleFile(resource, lang)
	};
	for (let key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
	return texts;
}
// ../../../packages/lib/src/fivem/callbackNames.ts
const requestEvent = (name) => `aicore:cb:${name}`, responseEvent = (resource) => `aicore:cbr:${resource}`;
resourceExport(CORE.resource);
const log$4 = createLogger(GetCurrentResourceName()), gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source)) || !this.limit.take(source)) return null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, `invalid arguments ${logSafe(JSON.stringify(raw) ?? "", 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source);
	}
	refuse(source, reason) {
		log$4.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${reason}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$3 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
function onClientCallback(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 20);
	onNet(requestEvent(name), async (caller, id, ...raw) => {
		let source = Number(globalThis.source);
		if (typeof caller != "string" || caller.length > 64 || typeof id != "number") return;
		let args = gate.check(source, raw);
		if (!args) return emitNet(responseEvent(caller), source, id, !1, null);
		try {
			let result = await gate.run(source, REFUSED, () => handler(source, ...args));
			result === REFUSED ? emitNet(responseEvent(caller), source, id, !1, null) : emitNet(responseEvent(caller), source, id, !0, result ?? null);
		} catch (error) {
			log$3.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
		}
	});
}
const pending = new Map();
onNet(responseEvent(resource$1), (id, ok, result) => {
	let entry = typeof id == "number" ? pending.get(id) : void 0;
	entry && entry.source === Number(globalThis.source) && (pending.delete(id), clearTimeout(entry.timer), ok === !0 ? entry.resolve(result) : entry.reject(Error("client callback failed")));
});
// ../../../packages/lib/src/server/admin/patch.ts
function toPatch(value) {
	if (!isRecord(value) || typeof value.file != "string") return null;
	let key = typeof value.key == "string" ? value.key : void 0;
	switch (value.action) {
		case "set": return typeof value.section == "string" ? {
			file: value.file,
			action: "set",
			key,
			section: value.section,
			value: value.value
		} : null;
		case "create": return key && typeof value.label == "string" ? {
			file: value.file,
			action: "create",
			key,
			label: value.label
		} : null;
		case "delete": return key ? {
			file: value.file,
			action: "delete",
			key
		} : null;
		case "import": {
			if (!isRecord(value.records)) return null;
			let records = {};
			for (let [k, v] of Object.entries(value.records)) isRecord(v) && (records[k] = v);
			return Object.keys(records).length > 0 && Object.keys(records).length <= 500 ? {
				file: value.file,
				action: "import",
				records
			} : null;
		}
		default: return null;
	}
}
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$6 = resourceExport(CORE.resource), ERR = {
	type: "ADMIN_ERR_TYPE",
	range: "ADMIN_ERR_RANGE",
	length: "ADMIN_ERR_LENGTH",
	pattern: "ADMIN_ERR_PATTERN",
	required: "ADMIN_ERR_REQUIRED",
	lookup: "ADMIN_ERR_LOOKUP"
}, lookups = new class {
	lists = new Map();
	values(source) {
		let cached = this.lists.get(source);
		if (cached && Date.now() - cached.at < 2e3) return cached.values.size > 0 ? cached.values : null;
		let list = [];
		try {
			list = core$6.GetLookupValues(source);
		} catch {}
		let values = new Set(Array.isArray(list) ? list.filter((v) => typeof v == "string") : []);
		return this.lists.set(source, {
			at: Date.now(),
			values
		}), values.size > 0 ? values : null;
	}
}(), isVec = (value, keys) => isRecord(value) && keys.every((k) => typeof value[k] == "number" && Number.isFinite(value[k]));
function validate(spec, value, path) {
	if (value == null) return spec.optional ? null : {
		error: ERR.required,
		path
	};
	let fail = (error) => ({
		error,
		path
	});
	switch (spec.type) {
		case "text": return typeof value == "string" ? value.length < (spec.min ?? 1) || value.length > (spec.max ?? 120) ? fail(ERR.length) : spec.pattern && !new RegExp(spec.pattern).test(value) ? fail(ERR.pattern) : spec.lookup && value !== "" && lookups.values(spec.lookup)?.has(value) === !1 ? fail(ERR.lookup) : null : fail(ERR.type);
		case "number": return typeof value != "number" || !Number.isFinite(value) || spec.integer && !Number.isInteger(value) ? fail(ERR.type) : spec.min !== void 0 && value < spec.min || spec.max !== void 0 && value > spec.max ? fail(ERR.range) : null;
		case "bool": return typeof value == "boolean" ? null : fail(ERR.type);
		case "enum": return spec.values.includes(value) ? null : fail(ERR.type);
		case "names": {
			if (!Array.isArray(value) || value.length > (spec.max ?? 50)) return fail(ERR.length);
			let pattern = new RegExp(spec.pattern ?? "^[\\w.:-]+$"), seen = new Set();
			for (let name of value) {
				if (typeof name != "string" || name.length > (spec.itemMax ?? 64) || seen.has(name)) return fail(ERR.type);
				if (!pattern.test(name)) return fail(ERR.pattern);
				if (spec.lookup && lookups.values(spec.lookup)?.has(name) === !1) return fail(ERR.lookup);
				seen.add(name);
			}
			return null;
		}
		case "vec3": return isVec(value, [
			"x",
			"y",
			"z"
		]) ? null : fail(ERR.type);
		case "vec4": return isVec(value, [
			"x",
			"y",
			"z",
			"heading"
		]) ? null : fail(ERR.type);
		case "object":
			if (!isRecord(value)) return fail(ERR.type);
			for (let key of Object.keys(value)) if (!(key in spec.fields)) return {
				error: ERR.type,
				path: `${path}.${key}`
			};
			for (let [key, field] of Object.entries(spec.fields)) {
				let refusal = validate(field, value[key], `${path}.${key}`);
				if (refusal) return refusal;
			}
			return null;
		case "list":
			if (!Array.isArray(value)) return fail(ERR.type);
			if (value.length < (spec.min ?? 0) || value.length > (spec.max ?? 100)) return fail(ERR.length);
			for (let i = 0; i < value.length; i++) {
				let refusal = validate(spec.of, value[i], `${path}.${i + 1}`);
				if (refusal) return refusal;
			}
			return null;
		default: return spec;
	}
}
// ../../../packages/lib/src/server/admin/jsonSchema.ts
const SCHEMA_KEY = {
	type: "string",
	description: "This file's JSON Schema (for editors)."
};
function langFile(resource) {
	try {
		let raw = JSON.parse(LoadResourceFile(resource, "locales/en.json") ?? "{}");
		return isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter((e) => typeof e[1] == "string")) : {};
	} catch {
		return {};
	}
}
function texts(resource) {
	return {
		...langFile("ai-core"),
		...langFile(resource)
	};
}
function collect(fields, prefix, lang, out) {
	for (let field of fields) {
		let path = prefix + field.path, label = lang[field.label] ?? field.label, hint = field.hint ? lang[field.hint] ?? field.hint : "";
		out.has(path) || out.set(path, hint ? `${label}: ${hint}` : label), field.widget === "list" && collect(field.rows, `${path}[].`, lang, out);
	}
}
function describe(schema, file, lang) {
	let out = new Map();
	for (let tab of schema.tabs) if (tab.file === file) for (let card of tab.cards) collect(card.fields, "", lang, out);
	return out;
}
function toJson(spec, path, desc) {
	let description = desc.get(path), base = description ? { description } : {};
	switch (spec.type) {
		case "text": return {
			...base,
			type: "string",
			minLength: spec.min,
			maxLength: spec.max,
			pattern: spec.pattern
		};
		case "number": return {
			...base,
			type: spec.integer ? "integer" : "number",
			minimum: spec.min,
			maximum: spec.max
		};
		case "bool": return {
			...base,
			type: "boolean"
		};
		case "enum": return {
			...base,
			enum: spec.values
		};
		case "names": return {
			...base,
			type: "array",
			maxItems: spec.max,
			uniqueItems: !0,
			items: {
				type: "string",
				maxLength: spec.itemMax,
				pattern: spec.pattern
			}
		};
		case "vec3":
		case "vec4": {
			let keys = spec.type === "vec3" ? [
				"x",
				"y",
				"z"
			] : [
				"x",
				"y",
				"z",
				"heading"
			];
			return {
				...base,
				type: "object",
				required: keys,
				properties: Object.fromEntries(keys.map((k) => [k, { type: "number" }]))
			};
		}
		case "object": return {
			...base,
			...objectOf(spec.fields, path ? `${path}.` : "", desc)
		};
		case "list": return {
			...base,
			type: "array",
			minItems: spec.min,
			maxItems: spec.max,
			items: toJson(spec.of, `${path}[]`, desc)
		};
		default: return spec;
	}
}
function objectOf(fields, prefix, desc) {
	return {
		type: "object",
		properties: Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, toJson(s, prefix + k, desc)])),
		required: Object.entries(fields).filter(([, s]) => !s.optional).map(([k]) => k)
	};
}
function fileSchema(resource, schema, name, spec) {
	let desc = describe(schema, name, texts(resource)), title = `${resource}/data/${name}.json`, body = spec.kind === "settings" ? (() => {
		let obj = objectOf(spec.sections, "", desc), required = obj.required.filter((k) => !(k in (spec.defaults ?? {})));
		return {
			...obj,
			properties: {
				$schema: SCHEMA_KEY,
				...obj.properties
			},
			required
		};
	})() : {
		type: "object",
		properties: { $schema: SCHEMA_KEY },
		patternProperties: { [spec.keyPattern ?? "^[a-z0-9_]{2,32}$"]: objectOf(spec.sections, "", desc) },
		additionalProperties: !1
	};
	return `${JSON.stringify({
		$schema: "http://json-schema.org/draft-07/schema#",
		title,
		...body
	}, null, 2)}\n`;
}
function writeSchema(resource, name, text, log) {
	let path = `data/schemas/${name}.schema.json`;
	if (LoadResourceFile(resource, path) === text) return;
	let dir = `${GetResourcePath(resource)}/data/schemas`;
	(0, node_fs_promises.mkdir)(dir, { recursive: !0 }).then(() => (0, node_fs_promises.writeFile)(`${dir}/${name}.schema.json`, text, "utf8")).catch((error) => log.error(`writing ${resource}/${path} failed`, error));
}
// ../../../packages/lib/src/server/admin/panel.ts
const core$5 = resourceExport(CORE.resource), DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges)), setImmediate(() => core$5.RegisterAdminPanel(this.resource));
	}
	get(file) {
		return this.data.get(file) ?? {};
	}
	onChange(file, handler) {
		this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
	}
	rule(file, rule) {
		this.rules.set(file, rule);
	}
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: clone(Object.fromEntries(this.data))
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec || spec.memory) return {
			ok: !1,
			error: ERR.type
		};
		let error = this.check(patch, spec);
		return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${JSON.stringify(patch).slice(0, 300)}`), {
			ok: !1,
			error
		}) : (this.store(patch, spec), { ok: !0 });
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	check(patch, spec) {
		let data = this.get(patch.file);
		if (patch.action === "create") return spec.kind !== "records" || !new RegExp(spec.keyPattern ?? DEFAULT_KEY).test(patch.key) ? ERR.pattern : patch.key in data ? "ADMIN_ERR_EXISTS" : null;
		if (patch.action === "delete") return spec.kind !== "records" || !(patch.key in data) ? ERR.type : spec.locked?.includes(patch.key) ? "ADMIN_ERR_LOCKED" : null;
		if (patch.action === "import") {
			if (spec.kind !== "records") return ERR.type;
			let pattern = new RegExp(spec.keyPattern ?? DEFAULT_KEY);
			for (let [key, value] of Object.entries(patch.records)) {
				if (!pattern.test(key)) return ERR.pattern;
				let record = imported(spec, value);
				for (let [name, section] of Object.entries(spec.sections)) {
					let refusal = validate(section, record[name], name);
					if (refusal) return refusal.error;
				}
				let ruled = this.rules.get(patch.file)?.(key, record);
				if (ruled) return ruled;
			}
			return null;
		}
		let section = spec.sections[patch.section];
		if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
		let refusal = validate(section, patch.value, patch.section);
		if (refusal) return refusal.error;
		let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
			...isRecord(current) ? current : {},
			[patch.section]: patch.value
		};
		return this.rules.get(patch.file)?.(patch.key, next) ?? null;
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {};
		if (patch.action === "create") {
			let record = clone(spec.newRecord ?? {});
			spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
		} else if (patch.action === "delete") delete data[patch.key];
		else if (patch.action === "import") {
			for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
			this.data.set(patch.file, data);
			for (let key of Object.keys(patch.records)) this.changed(patch.file, key);
			return;
		} else {
			let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
			if (!isRecord(target)) return;
			patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
		}
		this.data.set(patch.file, data), this.changed(patch.file, spec.kind === "records" ? patch.key : void 0);
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$5.AdminPanelChanged({
			resource: this.resource,
			file,
			key,
			value: clone(value)
		}), spec?.sync !== "all") return;
		let changes = this.worldChanges.get(file) ?? {};
		changes[key ?? ""] = clone(value), this.worldChanges.set(file, changes), emitNet(ADMIN.worldEvent(this.resource), -1, file, key ?? null, value);
	}
	load(name, spec) {
		if (spec.memory) {
			this.data.set(name, {});
			return;
		}
		let file = new DataFile(this.resource, name, this.log);
		this.dataFiles.set(name, file), file.schemaRef = `./schemas/${name}.schema.json`, writeSchema(this.resource, name, fileSchema(this.resource, this.schema, name, spec), this.log);
		let raw = file.read(), data = isRecord(raw) ? raw : {}, filled = !1;
		if (spec.kind === "settings") for (let [section, value] of Object.entries(spec.defaults ?? {})) section in data || (data[section] = clone(value), filled = !0);
		this.data.set(name, data), (filled || raw === null || !file.hasSchemaRef()) && file.write(data);
	}
};
// ../../../packages/lib/src/server/log.ts
function aiLog(channel, message, options) {
	optionalExport("ai-core")?.Log(channel, message, options);
}
function aiLogChannels(channels) {
	optionalExport("ai-core")?.LogChannels(channels);
}
resourceExport(CORE.resource);
// ../../../packages/lib/src/server/online.ts
const core$3 = resourceExport(CORE.resource);
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.put(source, character, (core$3.GetJobs(source) ?? []).map((m) => m.job), (core$3.GetGangs(source) ?? []).map((m) => m.gang)), this.setDuty(source, core$3.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => {
			let player = this.players.get(source);
			player && (player.jobs = jobs.map((m) => m.job));
		}), on(CORE.gangsChangedEvent, (source, gangs) => {
			let player = this.players.get(source);
			player && (player.gangs = gangs.map((m) => m.gang));
		}), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$3.GetLoadedSources()) {
			let character = core$3.GetCharacter(source);
			character && load(source, character);
		}
	}
	put(source, character, jobs, gangs) {
		this.drop(source), this.players.set(source, {
			character,
			jobs,
			gangs,
			duty: null
		});
	}
	drop(source) {
		this.setDuty(source, null), this.players.delete(source);
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player || (player.duty && this.onDuty.get(player.duty)?.delete(source), player.duty = job, !job)) return;
		let set = this.onDuty.get(job);
		set || this.onDuty.set(job, set = new Set()), set.add(source);
	}
	sources() {
		return this.start(), this.players.keys();
	}
	get size() {
		return this.start(), this.players.size;
	}
	character(source) {
		return this.start(), this.players.get(source)?.character ?? null;
	}
	jobs(source) {
		return this.start(), this.players.get(source)?.jobs ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangs ?? [];
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set();
new OnlinePlayers(), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/command.ts
const resource = GetCurrentResourceName();
createLogger(resource), new class {
	list = [];
	sent = new Map();
	announced = 0;
	queued = !1;
	listening = !1;
	add(command) {
		this.listening || this.listen(), this.list.push(command), this.queued || (this.queued = !0, setImmediate(() => this.flush()));
	}
	refresh(source) {
		let before = this.sent.get(source), now = new Set(), add = [];
		for (let command of this.list) for (let name of command.info.names) command.allowed(source, name) && (now.add(name), before?.has(name) || add.push(command.suggestion(name)));
		if (this.sent.set(source, now), add.length && emitNet("chat:addSuggestions", source, add), before) for (let name of before) now.has(name) || emitNet("chat:removeSuggestion", source, `/${name}`);
	}
	flush() {
		this.queued = !1, optionalExport(CORE.resource)?.RegisterCommands(resource, this.list.slice(this.announced).map((c) => c.info)), this.announced = this.list.length;
		for (let player of getPlayers()) this.refresh(Number(player));
	}
	listen() {
		this.listening = !0;
		let refresh = (source) => this.refresh(Number(source));
		on(CORE.playerLoadedEvent, refresh), on(CORE.jobsChangedEvent, refresh), on(CORE.gangsChangedEvent, refresh), on("playerDropped", () => this.sent.delete(Number(globalThis.source))), on("onResourceStop", (name) => {
			if (name === resource) for (let command of this.list) for (let n of command.info.names) emitNet("chat:removeSuggestion", -1, `/${n}`);
		});
	}
}();
// ../../../packages/lib/src/server/netEvent.ts
const log$1 = createLogger(GetCurrentResourceName());
function onClientEvent(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 10);
	onNet(name, (...raw) => {
		let source = Number(globalThis.source), args = gate.check(source, raw);
		args && gate.run(source, void 0, () => handler(source, ...args)).catch((error) => log$1.error(`event ${name} failed for ${source}`, error));
	});
}
createLogger("aicore-lib");
// ../../../packages/lib/src/fivem/state.ts
const stateNumber = (v) => typeof v == "number" && Number.isFinite(v) ? v : void 0, isServer = IsDuplicityVersion();
var Mirror = class {
	key;
	parse;
	values = new Map();
	listeners = new Set();
	constructor(key, parse) {
		this.key = key, this.parse = parse;
	}
	onChange(listener) {
		return this.listeners.add(listener), () => this.listeners.delete(listener);
	}
	store(id, raw) {
		this.apply(id, raw == null ? void 0 : this.parse(raw));
	}
	apply(id, value) {
		let old = this.values.get(id);
		if (this.values.set(id, value), old !== value) for (let listener of this.listeners) listener(id, value, old);
	}
}, EntityState$1 = class extends Mirror {
	handles = new Map();
	constructor(key, parse) {
		super(key, parse), AddStateBagChangeHandler(key, "", (bag, _key, value) => {
			if (!bag.startsWith("entity:")) return;
			let netId = Number(bag.slice(7));
			this.handles.set(netId, GetEntityFromStateBagName(bag)), this.store(netId, value);
		}), isServer ? on("entityRemoved", (entity) => this.forget(NetworkGetNetworkIdFromEntity(entity))) : setInterval(() => this.prune(), 3e4);
	}
	get(entity) {
		if (!entity) return;
		let netId = NetworkGetNetworkIdFromEntity(entity), handle = this.handles.get(netId);
		if (handle === entity) return this.values.get(netId);
		if (handle === 0 && this.values.has(netId)) return this.handles.set(netId, entity), this.values.get(netId);
		this.handles.set(netId, entity);
		let value = this.parseRaw(Entity(entity).state[this.key]);
		return this.values.set(netId, value), value;
	}
	put(entity, value) {
		let netId = NetworkGetNetworkIdFromEntity(entity);
		this.handles.set(netId, entity), this.apply(netId, value);
	}
	getByNetId(netId) {
		return this.values.get(netId);
	}
	forget(netId) {
		this.values.delete(netId), this.handles.delete(netId);
	}
	parseRaw(raw) {
		return raw == null ? void 0 : this.parse(raw);
	}
	prune() {
		for (let netId of this.values.keys()) DoesEntityExist(NetworkGetEntityFromNetworkId(netId)) || this.forget(netId);
	}
}, PlayerState$1 = class extends Mirror {
	seen = new Set();
	constructor(key, parse) {
		super(key, parse), AddStateBagChangeHandler(key, "", (bag, _key, value) => {
			if (!bag.startsWith("player:")) return;
			let id = Number(bag.slice(7));
			this.seen.add(id), this.store(id, value);
		}), isServer && on("playerDropped", () => this.forget(Number(globalThis.source)));
	}
	get(serverId) {
		if (!this.seen.has(serverId)) {
			this.seen.add(serverId);
			let raw = Player(serverId).state[this.key];
			this.values.set(serverId, raw == null ? void 0 : this.parse(raw));
		}
		return this.values.get(serverId);
	}
	put(serverId, value) {
		this.seen.add(serverId), this.apply(serverId, value);
	}
	forget(serverId) {
		this.values.delete(serverId), this.seen.delete(serverId);
	}
}, EntityState = class extends EntityState$1 {
	set(entity, value) {
		DoesEntityExist(entity) && (Entity(entity).state.set(this.key, value ?? null, !0), this.put(entity, value));
	}
}, PlayerState = class extends PlayerState$1 {
	set(source, value) {
		Player(source).state.set(this.key, value ?? null, !0), this.put(source, value);
	}
};
// resource/common/fuel.ts
const EVENTS = {
	consume: "ai-fuel:consume",
	takeNozzle: "ai-fuel:takeNozzle",
	plug: "ai-fuel:plug",
	returnNozzle: "ai-fuel:returnNozzle",
	refuel: "ai-fuel:refuel"
};
function toNozzle(v) {
	let r = record(v);
	return typeof r.x == "number" && typeof r.y == "number" && typeof r.z == "number" ? {
		x: r.x,
		y: r.y,
		z: r.z,
		netId: typeof r.netId == "number" ? r.netId : null
	} : void 0;
}
function readSettings(raw) {
	let s = record(raw), accounts = Array.isArray(s.accounts) ? s.accounts.filter((a) => typeof a == "string") : [];
	return {
		consumption: num(s.consumption, 1, 0, 10),
		accounts: accounts.length ? accounts : ["cash", "bank"],
		refuelSecondsPerLiter: num(s.refuelSecondsPerLiter, .15, 0, 5)
	};
}
function readStations(raw) {
	let out = new Map();
	for (let [id, value] of Object.entries(record(raw))) {
		let v = record(value), c = record(v.coords);
		out.set(id, {
			id,
			label: str(v.label, id, 48),
			x: num(c.x, 0),
			y: num(c.y, 0),
			z: num(c.z, 0),
			radius: num(v.radius, 12, 2, 40),
			price: num(v.price, 3, 0, 1e3),
			blip: bool(v.blip, !0)
		});
	}
	return out;
}
// resource/server/schema.ts
const fuelSchema = {
	title: "ADMIN_TITLE",
	icon: "gas-pump",
	files: {
		settings: {
			kind: "settings",
			sync: "all",
			sections: {
				consumption: {
					type: "number",
					min: 0,
					max: 10
				},
				accounts: {
					type: "names",
					lookup: "account",
					max: 5,
					itemMax: 32,
					pattern: "^[a-z0-9_]{2,32}$"
				},
				refuelSecondsPerLiter: {
					type: "number",
					min: 0,
					max: 5
				}
			}
		},
		stations: {
			kind: "records",
			sync: "all",
			labelPath: "label",
			newRecord: {
				label: "Gas Station",
				coords: {
					x: 0,
					y: 0,
					z: 0
				},
				radius: 12,
				price: 3,
				blip: !0
			},
			sections: {
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				coords: { type: "vec3" },
				radius: {
					type: "number",
					min: 2,
					max: 40
				},
				price: {
					type: "number",
					min: 0,
					max: 1e3
				},
				blip: { type: "bool" }
			}
		}
	},
	tabs: [{
		id: "stations",
		file: "stations",
		icon: "gas-pump",
		label: "ADMIN_TAB_STATIONS",
		desc: "ADMIN_TAB_STATIONS_DESC",
		createLabel: "ADMIN_NEW_STATION",
		deleteLabel: "ADMIN_DELETE_STATION",
		cards: [{
			icon: "gas-pump",
			title: "ADMIN_C_STATION",
			desc: "ADMIN_C_STATION_DESC",
			fields: [
				{
					widget: "text",
					path: "label",
					suggest: { from: "coords" },
					label: "ADMIN_F_LABEL",
					placeholder: "ADMIN_P_LABEL"
				},
				{
					widget: "point",
					path: "coords",
					label: "ADMIN_F_COORDS",
					hint: "ADMIN_H_COORDS",
					ground: !0
				},
				{
					widget: "number",
					path: "radius",
					label: "ADMIN_F_RADIUS",
					hint: "ADMIN_H_RADIUS",
					min: 2,
					max: 40,
					unit: "m"
				},
				{
					widget: "number",
					path: "price",
					label: "ADMIN_F_PRICE",
					hint: "ADMIN_H_PRICE",
					min: 0,
					max: 1e3,
					step: .5,
					unit: "$"
				},
				{
					widget: "switch",
					path: "blip",
					label: "ADMIN_F_BLIP"
				}
			]
		}]
	}, {
		id: "settings",
		file: "settings",
		icon: "sliders",
		label: "ADMIN_TAB_SETTINGS",
		desc: "ADMIN_TAB_SETTINGS_DESC",
		cards: [{
			icon: "gas-pump",
			title: "ADMIN_C_FUEL",
			desc: "ADMIN_C_FUEL_DESC",
			fields: [
				{
					widget: "number",
					path: "consumption",
					label: "ADMIN_F_CONSUMPTION",
					hint: "ADMIN_H_CONSUMPTION",
					min: 0,
					max: 10,
					step: .1
				},
				{
					widget: "number",
					path: "refuelSecondsPerLiter",
					label: "ADMIN_F_REFUEL_TIME",
					hint: "ADMIN_H_REFUEL_TIME",
					min: 0,
					max: 5,
					step: .05,
					unit: "s"
				},
				{
					widget: "tags",
					lookup: "account",
					path: "accounts",
					label: "ADMIN_F_ACCOUNTS",
					hint: "ADMIN_H_ACCOUNTS",
					placeholder: "ADMIN_P_ACCOUNTS"
				}
			]
		}]
	}]
}, core = resourceExport("ai-core"), panel = new AdminPanel(fuelSchema), content = {
	settings: readSettings(panel.get("settings")),
	stations: readStations(panel.get("stations"))
};
panel.onChange("settings", () => content.settings = readSettings(panel.get("settings"))), panel.onChange("stations", () => content.stations = readStations(panel.get("stations"))), aiLogChannels({ refuels: {} });
function drivenBy(source, netId) {
	let vehicle = NetworkGetEntityFromNetworkId(netId);
	return !vehicle || !DoesEntityExist(vehicle) || GetEntityType(vehicle) !== 2 ? null : GetPedInVehicleSeat(vehicle, -1) === GetPlayerPed(String(source)) ? vehicle : null;
}
const fuelState = new EntityState("fuel", stateNumber), fuelOf = (vehicle) => fuelState.get(vehicle) ?? null;
function persist(vehicle, fuel, before) {
	if (before !== null && Math.floor(before) === Math.floor(fuel)) return;
	let api = optionalExport("ai-vehicles"), id = api?.GetVehicleIdByEntity(vehicle);
	api && id != null && api.SaveVehicle(id, { fuel });
}
onClientEvent(EVENTS.consume, {
	args: ([netId, fuel]) => typeof netId == "number" && typeof fuel == "number" && fuel >= 0 && fuel <= 100 ? [netId, fuel] : null,
	rate: {
		count: 2,
		windowMs: 1e3
	}
}, (source, netId, fuel) => {
	let vehicle = drivenBy(source, netId);
	if (vehicle === null) return;
	let before = fuelOf(vehicle);
	before !== null && fuel >= before || (fuelState.set(vehicle, fuel), persist(vehicle, fuel, before));
});
const nozzles = new Map(), nozzleState = new PlayerState("aiFuelNozzle", toNozzle), setNozzle = (source, nozzle) => {
	nozzle ? nozzles.set(source, nozzle) : nozzles.delete(source), nozzleState.set(source, nozzle);
};
on("playerDropped", () => nozzles.delete(Number(globalThis.source)));
const posOf = (entity) => {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
	return {
		x,
		y,
		z
	};
}, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), stationAt = (pump) => [...content.stations.values()].find((s) => Math.hypot(pump.x - s.x, pump.y - s.y) <= s.radius + 2 && Math.abs(pump.z - s.z) <= 10), pedOf = (source) => GetPlayerPed(String(source));
onClientCallback(EVENTS.takeNozzle, {
	args: ([x, y, z]) => typeof x == "number" && typeof y == "number" && typeof z == "number" ? [
		x,
		y,
		z
	] : null,
	lock: !0
}, (source, x, y, z) => {
	let pump = {
		x,
		y,
		z
	};
	return nozzles.has(source) || !stationAt(pump) || dist(posOf(pedOf(source)), pump) > 3 ? {
		ok: !1,
		error: "FUEL_ERR_FAR"
	} : (setNozzle(source, {
		...pump,
		netId: null
	}), { ok: !0 });
}), onClientCallback(EVENTS.plug, {
	args: ([netId]) => netId === null || typeof netId == "number" ? [netId] : null,
	lock: !0
}, (source, netId) => {
	let nozzle = nozzles.get(source);
	if (!nozzle) return {
		ok: !1,
		error: "FUEL_ERR_FAR"
	};
	if (netId !== null) {
		let vehicle = NetworkGetEntityFromNetworkId(netId);
		if (!vehicle || GetEntityType(vehicle) !== 2 || dist(posOf(vehicle), posOf(pedOf(source))) > 4 || dist(posOf(vehicle), nozzle) > 10) return {
			ok: !1,
			error: "FUEL_ERR_FAR"
		};
	}
	return setNozzle(source, {
		...nozzle,
		netId
	}), { ok: !0 };
}), onClientEvent(EVENTS.returnNozzle, (source) => setNozzle(source, void 0)), onClientCallback(EVENTS.refuel, (source) => {
	let nozzle = nozzles.get(source), station = nozzle ? stationAt(nozzle) : void 0, vehicle = nozzle?.netId == null ? 0 : NetworkGetEntityFromNetworkId(nozzle.netId);
	if (!nozzle || !station || !vehicle || !DoesEntityExist(vehicle) || dist(posOf(vehicle), nozzle) > 10) return {
		ok: !1,
		error: "FUEL_ERR_FAR"
	};
	let before = fuelOf(vehicle) ?? 0, liters = Math.floor(100 - before);
	if (liters <= 0) return {
		ok: !1,
		error: "FUEL_ERR_FULL"
	};
	let price = Math.ceil(liters * station.price);
	return content.settings.accounts.some((account) => core.RemoveMoney(source, account, price, `fuel:${station.id}`)) ? (fuelState.set(vehicle, 100), persist(vehicle, 100, null), aiLog("refuels", `refuelled ${liters} for $${price} at ${station.id}`, {
		source,
		metadata: {
			station: station.id,
			liters,
			price
		}
	}), {
		ok: !0,
		price
	}) : {
		ok: !1,
		error: "FUEL_ERR_MONEY"
	};
}, { lock: !0 });
