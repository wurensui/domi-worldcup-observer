import { spawnSync } from "node:child_process";

const envId = process.env.TCB_ENV_ID;

if (!envId) {
  console.error('Please set TCB_ENV_ID first, for example: export TCB_ENV_ID="your CloudBase env ID"');
  process.exit(1);
}

const domains = (process.env.TCB_HTTP_DOMAINS || "*,domigarden.cn,www.domigarden.cn")
  .split(",")
  .map((domain) => domain.trim())
  .filter(Boolean);

const routes = [
  {
    path: "/",
    upstreamResourceType: "STATIC_STORE",
    upstreamResourceName: "staticstore",
    enable: true,
    enableAuth: false,
    enableSafeDomain: false
  },
  {
    path: "/api/reservations",
    upstreamResourceType: "WEB_SCF",
    upstreamResourceName: "domiReservations",
    enable: true,
    enableAuth: false,
    enableSafeDomain: false
  },
  {
    path: "/api/worldcup-desk",
    upstreamResourceType: "WEB_SCF",
    upstreamResourceName: "domiReservations",
    enable: true,
    enableAuth: false,
    enableSafeDomain: false
  }
];

function runTcb(args, input) {
  return spawnSync("npx", ["--yes", "-p", "@cloudbase/cli@latest", "tcb", ...args], {
    encoding: "utf8",
    input
  });
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function syncRoute(domain, route) {
  const data = JSON.stringify({ domain, routes: [route] });
  const commonArgs = ["routes", "edit", "-e", envId, "--data", data, "--json"];
  const editResult = runTcb(commonArgs, "y\n");

  if (editResult.status === 0) {
    printResult(editResult);
    return;
  }

  const addResult = runTcb(["routes", "add", "-e", envId, "--data", data, "--json"], "y\n");
  printResult(addResult);

  if (addResult.status !== 0) {
    process.exit(addResult.status || 1);
  }
}

for (const domain of domains) {
  for (const route of routes) {
    syncRoute(domain, route);
  }
}
