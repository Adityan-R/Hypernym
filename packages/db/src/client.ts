import { neon, Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";

import { env } from "./env";
import { configureLocalProxy, isLocalProxy } from "./local-proxy";
import * as schema from "./schema";

config({ path: ".env", quiet: true });

let localProxyConfigured = false;
function ensureLocalProxy(url: string) {
	if (localProxyConfigured) return;
	if (isLocalProxy(url)) {
		configureLocalProxy();
	}
	localProxyConfigured = true;
}

// Lazy-initialised clients.  `neon()` and `new Pool()` throw if called
// without a connection string, so we defer creation until the first
// property access.  This lets packages that transitively import
// `@superset/db` (e.g. desktop host bundles, tests) load the module
// without crashing when DATABASE_URL is absent.

let _db: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
	if (!_db) {
		const url = env.DATABASE_URL;
		if (!url) {
			throw new Error(
				"DATABASE_URL is not set. Cannot initialise the database client.",
			);
		}
		ensureLocalProxy(url);
		const sql = neon(url);
		_db = drizzle({ client: sql, schema, casing: "snake_case" });
	}
	return _db;
}

let _dbWs: NeonDatabase<typeof schema> | null = null;

function getDbWs(): NeonDatabase<typeof schema> {
	if (!_dbWs) {
		const url = env.DATABASE_URL;
		if (!url) {
			throw new Error(
				"DATABASE_URL is not set. Cannot initialise the WebSocket database client.",
			);
		}
		ensureLocalProxy(url);
		_dbWs = drizzleWs({
			client: new Pool({ connectionString: url }),
			schema,
			casing: "snake_case",
		});
	}
	return _dbWs;
}

// Proxy wrappers so existing `db.select(…)` / `dbWs.query.…` call-sites
// keep working without any changes.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
	get(_target, prop) {
		// Prevent accidental promise-coercion or JSON serialisation from
		// triggering lazy init.
		if (prop === "then" || prop === "toJSON") return undefined;
		const instance = getDb();
		const value = Reflect.get(instance, prop);
		return typeof value === "function" ? value.bind(instance) : value;
	},
});

export const dbWs = new Proxy({} as NeonDatabase<typeof schema>, {
	get(_target, prop) {
		if (prop === "then" || prop === "toJSON") return undefined;
		const instance = getDbWs();
		const value = Reflect.get(instance, prop);
		return typeof value === "function" ? value.bind(instance) : value;
	},
});
