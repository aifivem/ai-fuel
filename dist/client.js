/*aicore-client-errors*/(function(){var n=GetCurrentResourceName(),s={},c=0;var r=function(t){t=String(t).replace(/\^\d/g,"");var k=t.slice(0,300);if(s[k]||c>=20)return;s[k]=1;c++;try{TriggerServerEvent("ai-core:clientError",n,t.slice(0,4000))}catch(e){}};globalThis.__aicoreReportError=r;var l=console.log;console.log=function(){var a=arguments[0];if(typeof a==="string"&&a.indexOf("SCRIPT ERROR")!==-1)r(a);return l.apply(console,arguments)}})();
try{
(function() {

// ../../../packages/lib/src/fivem/callbackNames.ts
/**
	* Callback wire format, the same on both sides:
	*   request  `aicore:cb:<name>`              (callerResource, id, ...args)
	*   response `aicore:cbr:<callerResource>`   (id, ok, result)
	* The response goes only to the resource that asked, so two resources never see each other's replies.
	*/
	const requestEvent = (name) => `aicore:cb:${name}`;
	const responseEvent = (resource) => `aicore:cbr:${resource}`;
	/** Default time a caller waits for an answer before the promise rejects. */
	const DEFAULT_CALLBACK_TIMEOUT = 3e4;

// ../../../packages/lib/src/shared/wait.ts
/**
	* Resolves with the first value `check` returns that is not undefined, checking once per tick.
	* Rejects after `timeoutMs` (default 10 s); pass `false` to wait forever.
	* Return `cond || undefined` from `check` to wait for a truthy condition.
	*/
	function waitFor(check, timeoutMs = 1e4) {
		return new Promise((resolve, reject) => {
			const started = Date.now();
			const poll = () => {
				const value = check();
				if (value !== void 0) return resolve(value);
				if (timeoutMs !== false && Date.now() - started > timeoutMs) return reject(/* @__PURE__ */ new Error(`waitFor timed out after ${timeoutMs} ms`));
				setTimeout(poll, 0);
			};
			poll();
		});
	}

// ../../../packages/lib/src/shared/read.ts
/** Small readers for panel content (`data/*.json`): every one returns the fallback when the value is missing or wrong. */
	/** A finite number clamped to `[min, max]`, else the fallback. */
	function num(value, fallback, min = -Infinity, max = Infinity) {
		return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
	}
	/** A boolean, else the fallback. */
	function bool(value, fallback) {
		return typeof value === "boolean" ? value : fallback;
	}
	/** A trimmed non-empty string cut to `max`, else the fallback. */
	function str(value, fallback, max = 64) {
		return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
	}
	/** The value as a plain object, or an empty one. */
	function record(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
	}

// ../../../packages/lib/src/shared/index.ts
	function isRecord(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
	/** Fills `{0}`, `{1}`... with the arguments by position (a translation may reorder or repeat them). */
	function formatText(template, args) {
		return template.replace(/\{(\d+)\}/g, (match, index) => {
			const value = args[Number(index)];
			return value === void 0 ? match : String(value);
		});
	}
	/** Console output prefixed with the resource name, so server logs show where a line came from. */
	function createLogger(resource) {
		const prefix = `[${resource}]`;
		return {
			info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
			warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
			error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
		};
	}

// ../../../packages/lib/src/client/netEvent.ts
	const log$2 = createLogger(GetCurrentResourceName());
	/**
	* Whether the net event being handled came from the server (read it before the first `await`). On a client only
	* events from the server carry a source (65535 in the docs); a local emit by any resource carries none.
	*/
	const fromServer = () => Boolean(globalThis.source);
	function onServerEvent(name, first, second) {
		const [handler, parse] = typeof first === "function" ? [first, null] : [second, first.args];
		onNet(name, (...raw) => {
			if (!fromServer() || !handler) return;
			const args = parse ? parse(raw) : [];
			if (!args) return log$2.warn(`event ${name} from the server had invalid arguments`);
			Promise.resolve().then(() => handler(...args)).catch((error) => log$2.error(`event ${name} failed`, error));
		});
	}

// ../../../packages/lib/src/client/callback.ts
	const resource = GetCurrentResourceName();
	const log$1 = createLogger(resource);
	const pending = /* @__PURE__ */ new Map();
	let nextId = 0;
	onNet(responseEvent(resource), (id, ok, result) => {
		if (!fromServer()) return;
		const entry = typeof id === "number" ? pending.get(id) : void 0;
		if (!entry) return;
		pending.delete(id);
		clearTimeout(entry.timer);
		if (ok === true) entry.resolve(result);
		else entry.reject(/* @__PURE__ */ new Error("server callback failed"));
	});
	/**
	* Asks the server (`onClientCallback(name, ...)` there) and resolves with its answer. The answer is unknown:
	* parse it. Rejects when the server reports an error or does not answer within `timeoutMs`.
	*/
	function triggerServerCallback(name, args = [], timeoutMs = DEFAULT_CALLBACK_TIMEOUT) {
		const id = ++nextId;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(/* @__PURE__ */ new Error(`server callback ${name} timed out`));
			}, timeoutMs);
			pending.set(id, {
				resolve,
				reject,
				timer
			});
			emitNet(requestEvent(name), resource, id, ...args);
		});
	}

// ../../../packages/shared/src/core.ts
/** Names owned by ai-core that other resources, the bridges and the build step use. */
	const CORE = {
		resource: "ai-core",
		/** Client -> server: (resource: string, text: string). Sent by the reporter every client bundle carries. */
		clientErrorEvent: "ai-core:clientError",
		/** (src, character: CharacterInfo) after a character is loaded and spawned. */
		playerLoadedEvent: "ai-core:playerLoaded",
		/** (src, charId, reason: UnloadReason) before a character's state is dropped. */
		playerUnloadedEvent: "ai-core:playerUnloaded",
		/** (src, account: string, balance: number, delta: number, reason: string) */
		moneyChangedEvent: "ai-core:moneyChanged",
		/** (src, jobs: JobMembership[]) */
		jobsChangedEvent: "ai-core:jobsChanged",
		/** (src, job: string | null) */
		dutyChangedEvent: "ai-core:dutyChanged",
		/** (src, gangs: GangMembership[]) */
		gangsChangedEvent: "ai-core:gangsChanged",
		/** (src, gang: string | null) */
		activeGangChangedEvent: "ai-core:activeGangChanged",
		/** (src, charIds: number[]) each time a player's character screen loads; an appearance resource answers with portraits. */
		characterScreenEvent: "ai-core:characterScreen",
		clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
		clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
		/** (charId: number, url: string) a portrait image of a character on the character screen (e.g. `https://nui-img/<txd>/<txd>`). */
		clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
		/** (resource: string, id: string) the interaction key was pressed while that resource's prompt was on top. */
		clientPromptPressedEvent: "ai-core:client:promptPressed",
		/** (key: keyof PlayerCache, value) a cached value of the local player changed (one watcher in ai-core for every resource). */
		clientCacheEvent: "ai-core:client:cache",
		charactersCallback: "ai-core:characters",
		createCharacterCallback: "ai-core:createCharacter",
		deleteCharacterCallback: "ai-core:deleteCharacter",
		selectCharacterCallback: "ai-core:selectCharacter",
		/** Server -> client: (notification: Notification) a notification card on the player's screen. */
		clientNotifyEvent: "ai-core:client:notify",
		/** Server -> client: (spawn: SpawnPoint) puts the loaded character into the world. */
		spawnEvent: "ai-core:client:spawn",
		/** Server -> client: () the character was let go (switch); show the character screen again. */
		openCharactersEvent: "ai-core:client:openCharacters"
	};

// ../../../packages/shared/src/admin.ts
/** Event names of the admin panel (owned by ai-core). */
	const ADMIN = {
		/** ACE every panel action checks: `add_ace group.admin ai.admin allow`. */
		ace: "ai.admin",
		openCallback: "ai-core:admin:open",
		applyCallback: "ai-core:admin:apply",
		closeEvent: "ai-core:admin:close",
		/** Server -> admins with the panel open: (delta: AdminDelta). */
		deltaEvent: "ai-core:admin:delta",
		/** Server -> client of a world (`sync: "all"`) file: (file, key | null, value). Prefixed with the resource name. */
		worldEvent: (resource) => `${resource}:admin:world`,
		/** Callback: () -> { [file]: { key: value } } world records changed since the resource started. */
		worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
	};

// ../../../packages/shared/src/menu.ts
	const MENU_EVENTS = {
		/** Client local: (resource, requestId, itemId | null) the player picked an item or closed the menu. */
		menuResult: "ai-core:client:menuResult",
		/** Client local: (resource, requestId, itemId) the pointer or focus is on an item (previews). */
		menuHover: "ai-core:client:menuHover",
		/** Client local: (resource, requestId, values | null) the player confirmed or closed the input dialog. */
		inputResult: "ai-core:client:inputResult"
	};

// ../../../packages/lib/src/client/adminWorld.ts
/**
	* The client copy of a resource's world panel files (`sync: "all"`): the file FiveM cached at start, then the
	* records changed since start (asked once), then live changes. Never polls.
	*/
	var AdminWorld = class {
		data = /* @__PURE__ */ new Map();
		handlers = /* @__PURE__ */ new Map();
		resource = GetCurrentResourceName();
		/** `files`: the world files this client mirrors (each must be in the resource's `files`). */
		constructor(files) {
			const log = createLogger(this.resource);
			for (const file of files) {
				const raw = LoadResourceFile(this.resource, `data/${file}.json`);
				try {
					const parsed = raw ? JSON.parse(raw) : {};
					this.data.set(file, isRecord(parsed) ? parsed : {});
				} catch (error) {
					log.error(`data/${file}.json is not valid JSON`, error);
					this.data.set(file, {});
				}
			}
			onServerEvent(ADMIN.worldEvent(this.resource), { args: ([file, key, value]) => typeof file === "string" ? [
				file,
				typeof key === "string" && key !== "" ? key : void 0,
				value
			] : null }, (file, key, value) => this.put(file, key, value));
			triggerServerCallback(ADMIN.worldChangesCallback(this.resource)).then((changes) => {
				if (!isRecord(changes)) return;
				for (const [file, records] of Object.entries(changes)) {
					if (!isRecord(records)) continue;
					for (const [key, value] of Object.entries(records)) this.put(file, key === "" ? void 0 : key, value);
				}
			}, (error) => log.error("loading the panel changes since start failed", error));
		}
		/** The current content of a file: the settings object, or `{ key: record }`. Read only; parse what you use. */
		get(file) {
			return this.data.get(file) ?? {};
		}
		onChange(file, handler) {
			this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
		}
		put(file, key, value) {
			const data = this.data.get(file);
			if (!data) return;
			if (key === void 0) {
				if (isRecord(value)) this.data.set(file, value);
			} else if (value === null) delete data[key];
			else data[key] = value;
			for (const handler of this.handlers.get(file) ?? []) handler(key, value);
		}
	};

// ../../../packages/lib/src/client/cache.ts
/** The unarmed "weapon" hash: cached as `false`. */
	const UNARMED = GetHashKey("WEAPON_UNARMED") | 0;
	/** The vehicle, seat and weapon of a ped right now (also ai-core's watcher). */
	function readPlayerState(ped) {
		const vehicle = GetVehiclePedIsIn(ped, false);
		let seat = false;
		if (vehicle) for (let i = -1; i < GetVehicleMaxNumberOfPassengers(vehicle); i++) {
			if (GetPedInVehicleSeat(vehicle, i) !== ped) continue;
			seat = i;
			break;
		}
		const weapon = GetSelectedPedWeapon(ped) | 0;
		return {
			vehicle: vehicle || false,
			seat,
			weapon: weapon === UNARMED ? false : weapon
		};
	}
	/**
	* The local player's often read values (ped, player id, server id, vehicle, seat, weapon), like ox_lib's `cache`:
	* read `cache.ped` instead of calling PlayerPedId() in loops. One watcher in ai-core updates every resource through
	* a local event, so no resource polls for these itself. Read only.
	*/
	const ped = PlayerPedId();
	const cache = {
		ped,
		playerId: PlayerId(),
		serverId: GetPlayerServerId(PlayerId()),
		...readPlayerState(ped)
	};
	const handlers = /* @__PURE__ */ new Map();
	const valid = (key, value) => key === "ped" || key === "playerId" || key === "serverId" ? typeof value === "number" : typeof value === "number" || value === false;
	on(CORE.clientCacheEvent, (key, value) => {
		if (typeof key !== "string" || !(key in cache)) return;
		const name = key;
		if (!valid(name, value) || cache[name] === value) return;
		const old = cache[name];
		cache[name] = value;
		for (const handler of handlers.get(name) ?? []) handler(value, old);
	});
	/** Runs `handler(value, old)` whenever a cached value changes (entering a vehicle, a new ped after a model swap...). */
	function onCache(key, handler) {
		let set = handlers.get(key);
		if (!set) handlers.set(key, set = /* @__PURE__ */ new Set());
		set.add(handler);
	}

// ../../../packages/lib/src/client/zones.ts
/**
	* Zones on this client: inside / outside checks at each zone's own interval, never per frame. Built for any count
	* (measured with 1,000,000 zones): zones sit in a grid of 64 m cells and a check looks only at the player's cell and
	* the zones the player is in.
	*/
	const log = createLogger(GetCurrentResourceName());
	const CELL = 64;
	/** A zone wider than this many cells is kept in one list checked every time instead of in the grid. */
	const MAX_CELLS = 64;
	const cellKey = (cx, cy) => cx + 32768 << 16 | cy + 32768;
	function contains(shape, x, y, z) {
		switch (shape.type) {
			case "sphere": {
				const dx = x - shape.center.x;
				const dy = y - shape.center.y;
				const dz = z - shape.center.z;
				return dx * dx + dy * dy + dz * dz <= shape.radius * shape.radius;
			}
			case "cylinder": {
				const dx = x - shape.center.x;
				const dy = y - shape.center.y;
				return dx * dx + dy * dy <= shape.radius * shape.radius && Math.abs(z - shape.center.z) <= shape.height;
			}
			case "poly": {
				if (z < shape.minZ || z > shape.maxZ) return false;
				let inside = false;
				const p = shape.points;
				for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
					const a = p[i];
					const b = p[j];
					if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
				}
				return inside;
			}
			default: return shape;
		}
	}
	/** Ground bounding box of a shape: [minX, minY, maxX, maxY]. */
	function bounds(shape) {
		if (shape.type !== "poly") return [
			shape.center.x - shape.radius,
			shape.center.y - shape.radius,
			shape.center.x + shape.radius,
			shape.center.y + shape.radius
		];
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const p of shape.points) {
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
		return [
			minX,
			minY,
			maxX,
			maxY
		];
	}
	var Zone = class {
		options;
		inside = false;
		nextCheck = 0;
		interval;
		/** Grid cells the zone is filed under; empty when it is in the large list. */
		cells = [];
		constructor(options) {
			this.options = options;
			this.interval = Math.max(50, options.interval ?? 500);
		}
	};
	/**
	* The zones of one resource. One timer serves them all at the shortest interval any zone asks for; each zone is
	* checked only when its own interval has passed. With no zones the timer stops (an active JS timer costs every frame).
	*/
	var Zones = class {
		zones = /* @__PURE__ */ new Map();
		grid = /* @__PURE__ */ new Map();
		large = /* @__PURE__ */ new Set();
		insideNow = /* @__PURE__ */ new Set();
		/** How many zones use each interval, so the shortest one is found without walking every zone. */
		intervals = /* @__PURE__ */ new Map();
		timer = null;
		period = 0;
		/** Adds (or replaces) a zone. A replaced zone the player was in fires its onExit first. */
		add(id, options) {
			this.remove(id);
			const zone = new Zone(options);
			this.zones.set(id, zone);
			const [minX, minY, maxX, maxY] = bounds(options.shape);
			const x0 = Math.floor(minX / CELL);
			const y0 = Math.floor(minY / CELL);
			const x1 = Math.floor(maxX / CELL);
			const y1 = Math.floor(maxY / CELL);
			if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) this.large.add(zone);
			else for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
				const key = cellKey(cx, cy);
				let cell = this.grid.get(key);
				if (!cell) this.grid.set(key, cell = /* @__PURE__ */ new Set());
				cell.add(zone);
				zone.cells.push(key);
			}
			this.intervals.set(zone.interval, (this.intervals.get(zone.interval) ?? 0) + 1);
			this.schedule();
		}
		remove(id) {
			const zone = this.zones.get(id);
			if (!zone) return;
			this.zones.delete(id);
			this.large.delete(zone);
			for (const key of zone.cells) {
				const cell = this.grid.get(key);
				cell?.delete(zone);
				if (cell?.size === 0) this.grid.delete(key);
			}
			const left = (this.intervals.get(zone.interval) ?? 1) - 1;
			if (left > 0) this.intervals.set(zone.interval, left);
			else this.intervals.delete(zone.interval);
			if (this.insideNow.delete(zone)) this.fire(zone, false);
			this.schedule();
		}
		/** Removes every zone (exits fire for the ones the player is in). */
		clear() {
			const inside = [...this.insideNow];
			this.zones.clear();
			this.grid.clear();
			this.large.clear();
			this.insideNow.clear();
			this.intervals.clear();
			for (const zone of inside) this.fire(zone, false);
			this.schedule();
		}
		isInside(id) {
			return this.zones.get(id)?.inside ?? false;
		}
		get size() {
			return this.zones.size;
		}
		schedule() {
			let period = 0;
			for (const interval of this.intervals.keys()) period = period === 0 ? interval : Math.min(period, interval);
			if (period === this.period) return;
			if (this.timer) clearInterval(this.timer);
			this.timer = period ? setInterval(() => this.check(), period) : null;
			this.period = period;
		}
		check() {
			const now = GetGameTimer();
			const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
			for (const zone of this.insideNow) this.test(zone, now, x, y, z);
			for (const zone of this.large) this.test(zone, now, x, y, z);
			const cell = this.grid.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));
			if (cell) for (const zone of cell) this.test(zone, now, x, y, z);
		}
		test(zone, now, x, y, z) {
			if (now < zone.nextCheck) return;
			zone.nextCheck = now + zone.interval;
			const inside = contains(zone.options.shape, x, y, z);
			if (inside === zone.inside) return;
			if (inside) this.insideNow.add(zone);
			else this.insideNow.delete(zone);
			this.fire(zone, inside);
		}
		fire(zone, inside) {
			zone.inside = inside;
			try {
				if (inside) zone.options.onEnter?.();
				else zone.options.onExit?.();
			} catch (error) {
				log.error("zone handler failed", error);
			}
		}
	};

// ../../../packages/lib/src/fivem/exports.ts
/** Typed access to another resource's exports (types come from CitizenExports in @aicore-fivem/shared). */
	function resourceExport(resource) {
		return globalThis.exports[resource];
	}

// ../../../packages/lib/src/client/prompt.ts
/**
	* ai-core's prompt (the "press E" box on the right): this resource shows and hides its own prompts by id; the
	* interaction key is one rebindable keybind in ai-core, so nothing polls keys per frame. Show a prompt on a zone's
	* enter, hide it on exit, act in `onPromptPressed`.
	*/
	function showPrompt(id, text) {
		resourceExport(CORE.resource).ShowPrompt(id, text);
	}
	function hidePrompt(id) {
		resourceExport(CORE.resource).HidePrompt(id);
	}
	/** The player pressed the interaction key while this resource's prompt `id` was the one on top. */
	function onPromptPressed(handler) {
		const resource = GetCurrentResourceName();
		on(CORE.clientPromptPressedEvent, (owner, id) => {
			if (owner === resource && typeof id === "string") handler(id);
		});
	}

// ../../../packages/lib/src/client/streaming.ts
/** Loads an animation dictionary. Call `RemoveAnimDict(dict)` when it is no longer played. */
	async function requestAnimDict(dict, timeoutMs = 1e4) {
		if (!DoesAnimDictExist(dict)) throw new Error(`anim dict ${dict} does not exist`);
		RequestAnimDict(dict);
		await waitFor(() => HasAnimDictLoaded(dict) || void 0, timeoutMs);
		return dict;
	}

// ../../../packages/lib/src/client/notify.ts
/** Shows a notification card on this player's screen (ai-core draws it); `text` is already translated. */
	function notify(text, kind = "info", duration) {
		resourceExport(CORE.resource).Notify({
			text,
			kind,
			duration
		});
	}
	/**
	* Runs a timed action with ai-core's progress bar and an optional animation; resolves true when it ran out, false
	* when cancelled (death, getting into a vehicle). Checks ten times a second, nothing per frame.
	*/
	async function progress(options) {
		const core = resourceExport(CORE.resource);
		const ped = cache.ped;
		if (options.anim) {
			await requestAnimDict(options.anim.dict);
			TaskPlayAnim(ped, options.anim.dict, options.anim.clip, 3, 3, options.duration, options.anim.flag ?? 49, 0, false, false, false);
		}
		core.ShowProgress(options.label, options.duration);
		const end = GetGameTimer() + options.duration;
		const done = await new Promise((resolve) => {
			const timer = setInterval(() => {
				const cancelled = IsEntityDead(cache.ped) || !options.allowVehicle && cache.vehicle !== false;
				if (!cancelled && GetGameTimer() < end) return;
				clearInterval(timer);
				resolve(!cancelled);
			}, 100);
		});
		if (options.anim) StopAnimTask(ped, options.anim.dict, options.anim.clip, 1);
		core.HideProgress();
		return done;
	}

// ../../../packages/lib/src/client/menu.ts
/** Menus and input dialogs this resource asked ai-core for, waiting for the player's answer. */
	var Requests = class {
		resource = GetCurrentResourceName();
		waiting = /* @__PURE__ */ new Map();
		hovers = /* @__PURE__ */ new Map();
		nextId = 0;
		constructor() {
			const answer = (owner, id, value) => {
				if (owner !== this.resource || typeof id !== "number") return;
				this.waiting.get(id)?.(value);
				this.waiting.delete(id);
				this.hovers.delete(id);
			};
			on(MENU_EVENTS.menuHover, (owner, id, item) => {
				if (owner === this.resource && typeof id === "number" && typeof item === "string") this.hovers.get(id)?.(item);
			});
			on(MENU_EVENTS.menuResult, answer);
			on(MENU_EVENTS.inputResult, answer);
		}
		ask(open, read, onHover) {
			const id = ++this.nextId;
			this.waiting.set(id, read);
			if (onHover) this.hovers.set(id, onHover);
			open(id);
		}
	};
	const requests = new Requests();

// ../../../packages/lib/src/client/vehicleProps.ts
	const MOD_TYPES = Array.from({ length: 50 }, (_, i) => i);

// ../../../packages/lib/src/fivem/locale.ts
/** Convar holding the language (`setr ai:locale "en"` in misc.cfg); replicated so clients read it too. */
	const LOCALE_CONVAR = "ai:locale";
	function readLocaleFile(resource, lang) {
		const raw = LoadResourceFile(resource, `locales/${lang}.json`);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (!isRecord(parsed)) return {};
		const texts = {};
		for (const [key, value] of Object.entries(parsed)) if (typeof value === "string") texts[key] = value;
		return texts;
	}
	/**
	* The resource's lang texts: `locales/en.json` (complete base) overlaid with `locales/<ai:locale>.json`.
	* `${OTHER_KEY}` inside a text is replaced by that text once at load. Returns `t(key, ...args)` filling
	* `{0}`, `{1}`...; a missing key returns the key itself so it is visible in game.
	*
	*   const t = createLocale<typeof import("../../locales/en.json")>();
	*   t("NOTIFY_NO_MONEY", price);
	*/
	function createLocale() {
		const texts = loadLocaleTexts();
		return (key, ...args) => formatText(texts[key] ?? key, args);
	}
	/**
	* The resource's merged lang table (`en.json` overlaid with the `ai:locale` language, `${KEY}` references
	* resolved). A NUI gets this once and fills `{0}` placeholders itself.
	*/
	function loadLocaleTexts(resource = GetCurrentResourceName()) {
		const lang = GetConvar(LOCALE_CONVAR, "en");
		const texts = {
			...readLocaleFile(resource, "en"),
			...lang === "en" ? {} : readLocaleFile(resource, lang)
		};
		for (const key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
		return texts;
	}

// resource/common/locale.ts
/** This resource's lang texts: `Locale("NOTIFY_NO_MONEY", price)`; keys typed from locales/en.json. */
	const Locale = createLocale();

// resource/common/resource.ts
	const ResourceName = GetCurrentResourceName();
	const ResourceContext = IsDuplicityVersion() ? "server" : "client";

// resource/common/fuel.ts
/** ai-fuel's contracts and panel content. No natives. */
	const EVENTS = {
		/** Client -> server: (netId, fuel) the driver's vehicle burned fuel (only lower values are taken). */
		consume: "ai-fuel:consume",
		/** Callback: (netId, stationId) -> { ok } fill the tank at a station (after the client's progress). */
		refuel: "ai-fuel:refuel"
	};
	/** The vehicle state bag holding fuel 0-100 (ai-vehicles seeds it on spawn, ai-hud shows it). */
	const FUEL_BAG = "fuel";
	function readSettings(raw) {
		const s = record(raw);
		const accounts = Array.isArray(s.accounts) ? s.accounts.filter((a) => typeof a === "string") : [];
		return {
			consumption: num(s.consumption, 1, 0, 10),
			accounts: accounts.length ? accounts : ["cash", "bank"],
			refuelSecondsPerLiter: num(s.refuelSecondsPerLiter, .15, 0, 5)
		};
	}
	function readStations(raw) {
		const out = /* @__PURE__ */ new Map();
		for (const [id, value] of Object.entries(record(raw))) {
			const v = record(value);
			const c = record(v.coords);
			out.set(id, {
				id,
				label: str(v.label, id, 48),
				x: num(c.x, 0),
				y: num(c.y, 0),
				z: num(c.z, 0),
				radius: num(v.radius, 12, 2, 40),
				price: num(v.price, 3, 0, 1e3),
				blip: bool(v.blip, true)
			});
		}
		return out;
	}
	/** Fuel burned per second: idle trickle plus load from the engine's rpm, scaled by the vehicle class. */
	function burnPerSecond(rpm, vehicleClass, multiplier) {
		const classFactor = vehicleClass === 13 ? 0 : vehicleClass === 8 ? .6 : vehicleClass === 10 || vehicleClass === 20 ? 1.4 : vehicleClass === 15 || vehicleClass === 16 ? 1.8 : 1;
		return (.01 + rpm * rpm * .12) * classFactor * multiplier;
	}
	/** Electric models: no fuel use (no charging stations yet). */
	const ELECTRIC = /* @__PURE__ */ new Set([
		"voltic",
		"voltic2",
		"raiden",
		"cyclone",
		"tezeract",
		"neon",
		"surge",
		"dilettante",
		"dilettante2",
		"imorgon",
		"khamelion",
		"iwagen",
		"omnisegt",
		"virtue",
		"caddy",
		"caddy2",
		"caddy3",
		"airtug",
		"rcbandito"
	]);

// resource/client/index.ts
	const world = new AdminWorld(["settings", "stations"]);
	const texts = loadLocaleTexts();
	const BLIP_TEXT = "AIFUEL_BLIP";
	AddTextEntry(BLIP_TEXT, "~a~");
	/**
	* Fuel of the vehicle the player drives: burned on a 1 s timer from the engine's rpm, applied to the game, reported to
	* the server every 5 s (the server keeps the `fuel` state bag). Nothing runs on foot or as a passenger.
	*/
	var Burner = class {
		settings = readSettings(world.get("settings"));
		timer = null;
		fuel = 100;
		reported = 100;
		ticks = 0;
		start(vehicle) {
			this.stop();
			const model = GetDisplayNameFromVehicleModel(GetEntityModel(vehicle)).toLowerCase();
			if (ELECTRIC.has(model)) return;
			const bag = Entity(vehicle).state[FUEL_BAG];
			this.fuel = typeof bag === "number" ? bag : 100;
			this.reported = this.fuel;
			this.timer = setInterval(() => this.tick(vehicle), 1e3);
		}
		stop() {
			if (this.timer) clearInterval(this.timer);
			this.timer = null;
		}
		tick(vehicle) {
			if (cache.vehicle !== vehicle || cache.seat !== -1) return this.stop();
			const bag = Entity(vehicle).state[FUEL_BAG];
			if (typeof bag === "number" && bag > this.fuel + .5) this.fuel = this.reported = bag;
			if (GetIsVehicleEngineRunning(vehicle)) this.fuel = Math.max(0, this.fuel - burnPerSecond(GetVehicleCurrentRpm(vehicle), GetVehicleClass(vehicle), this.settings.consumption));
			if (this.fuel <= 0) SetVehicleEngineOn(vehicle, false, true, true);
			SetVehicleFuelLevel(vehicle, Math.max(this.fuel, 1) * .65);
			if (++this.ticks % 5 === 0 && this.reported - this.fuel >= .1) {
				this.reported = this.fuel;
				emitNet(EVENTS.consume, NetworkGetNetworkIdFromEntity(vehicle), Math.round(this.fuel * 100) / 100);
			}
		}
	};
	const burner = new Burner();
	world.onChange("settings", () => burner.settings = readSettings(world.get("settings")));
	onCache("seat", (seat) => seat === -1 && cache.vehicle !== false ? burner.start(cache.vehicle) : burner.stop());
	if (cache.seat === -1 && cache.vehicle !== false) burner.start(cache.vehicle);
	/** Stations: a zone each (checked twice a second) with ai-core's prompt while driving inside, and a blip. */
	var Stations = class {
		zones = new Zones();
		blips = [];
		list = readStations(world.get("stations"));
		rebuild() {
			this.list = readStations(world.get("stations"));
			this.zones.clear();
			for (const blip of this.blips) RemoveBlip(blip);
			this.blips = [];
			for (const station of this.list.values()) {
				const id = `station:${station.id}`;
				this.zones.add(id, {
					shape: {
						type: "cylinder",
						center: {
							x: station.x,
							y: station.y,
							z: station.z
						},
						radius: station.radius,
						height: 8
					},
					interval: 500,
					onEnter: () => showPrompt(id, Locale("FUEL_PROMPT", station.price)),
					onExit: () => hidePrompt(id)
				});
				if (!station.blip) continue;
				const blip = AddBlipForCoord(station.x, station.y, station.z);
				SetBlipSprite(blip, 361);
				SetBlipColour(blip, 1);
				SetBlipScale(blip, .6);
				SetBlipAsShortRange(blip, true);
				BeginTextCommandSetBlipName(BLIP_TEXT);
				AddTextComponentSubstringPlayerName(station.label);
				EndTextCommandSetBlipName(blip);
				this.blips.push(blip);
			}
		}
		async refuel(stationId) {
			const vehicle = cache.vehicle;
			if (vehicle === false || cache.seat !== -1) return notify(Locale("FUEL_ERR_NO_VEHICLE"), "error");
			const bag = Entity(vehicle).state[FUEL_BAG];
			const missing = 100 - (typeof bag === "number" ? bag : 100);
			if (missing < 1) return notify(Locale("FUEL_ERR_FULL"), "info");
			SetVehicleEngineOn(vehicle, false, true, true);
			if (!await progress({
				label: Locale("FUEL_REFUELING"),
				duration: Math.max(1e3, missing * burner.settings.refuelSecondsPerLiter * 1e3),
				allowVehicle: true
			})) return;
			const result = await triggerServerCallback(EVENTS.refuel, [NetworkGetNetworkIdFromEntity(vehicle), stationId]).catch(() => null);
			if (typeof result === "object" && result !== null && "ok" in result && result.ok === true) {
				const price = "price" in result && typeof result.price === "number" ? result.price : 0;
				notify(Locale("FUEL_PAID", price), "success");
			} else {
				const error = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "FUEL_ERR_FAR";
				notify(texts[error] ?? error, "error");
			}
		}
	};
	const stations = new Stations();
	stations.rebuild();
	world.onChange("stations", () => stations.rebuild());
	onPromptPressed((id) => {
		if (id.startsWith("station:")) stations.refuel(id.slice(8));
	});

})();
}catch(e){globalThis.__aicoreReportError&&globalThis.__aicoreReportError("load: "+(e&&e.stack||e));throw e}
