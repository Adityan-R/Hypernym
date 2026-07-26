import { spawnSync } from "node:child_process";

// Prevent infinite recursion during postinstall
if (process.env.SUPERSET_POSTINSTALL_RUNNING) {
	process.exit(0);
}

process.env.SUPERSET_POSTINSTALL_RUNNING = "1";

// Run sherif for workspace validation
const sherifRes = spawnSync("bunx", ["sherif"], {
	stdio: "inherit",
	env: process.env,
	shell: true,
});
if (sherifRes.status !== 0) {
	process.exit(sherifRes.status || 1);
}

// Skip in CI
if (process.env.CI) {
	process.exit(0);
}

// Install native dependencies for desktop app
const desktopRes = spawnSync(
	"bun",
	["run", "--filter=@superset/desktop", "install:deps"],
	{ stdio: "inherit", env: process.env, shell: true },
);
if (desktopRes.status !== 0) {
	console.warn(
		"⚠️ electron-builder install-app-deps failed. Falling back to copy:native-modules...",
	);
	const copyRes = spawnSync(
		"bun",
		["run", "--filter=@superset/desktop", "copy:native-modules"],
		{ stdio: "inherit", env: process.env, shell: true },
	);
	if (copyRes.status !== 0) {
		console.warn("⚠️ copy:native-modules failed or skipped.");
	}
}
