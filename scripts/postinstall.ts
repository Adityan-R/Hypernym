import { spawnSync } from 'child_process';

// Prevent infinite recursion during postinstall
if (process.env.SUPERSET_POSTINSTALL_RUNNING) {
  process.exit(0);
}

process.env.SUPERSET_POSTINSTALL_RUNNING = '1';

// Run sherif for workspace validation
const sherifRes = spawnSync('bunx', ['sherif'], { stdio: 'inherit', env: process.env, shell: true });
if (sherifRes.status !== 0) {
  process.exit(sherifRes.status || 1);
}

// Skip in CI
if (process.env.CI) {
  process.exit(0);
}

// Install native dependencies for desktop app
const desktopRes = spawnSync('bun', ['run', '--filter=@superset/desktop', 'install:deps'], { stdio: 'inherit', env: process.env, shell: true });
if (desktopRes.status !== 0) {
  process.exit(desktopRes.status || 1);
}
