import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "out");
const dataDir = path.join(__dirname, "data");
const jsonlPath = path.join(dataDir, "reservations.jsonl");
const csvPath = path.join(dataDir, "reservations.csv");
const worldcupDeskPath = path.join(dataDir, "worldcup-desk.json");
const port = Number(process.env.PORT || 3000);
const adminUser = process.env.DOMI_ADMIN_USER || "domi";
const adminPassword = process.env.DOMI_ADMIN_PASSWORD || "change-me-reservation-admin";
const defaultDeskAdminPassword = process.env.WC26_DEFAULT_ADMIN_PASSWORD || "change-me-admin";
const defaultDeskClientPassword = process.env.WC26_DEFAULT_CLIENT_PASSWORD || "change-me-client";

const defaultWorldcupDesk = {
  adminProfile: {
    account: "admin",
    password: defaultDeskAdminPassword,
    updatedAt: "2026-05-31T00:00:00.000Z"
  },
  customers: [
    {
      account: "client",
      password: defaultDeskClientPassword,
      name: "示例客户",
      status: "启用",
      createdAt: "2026-05-31T00:00:00.000Z"
    }
  ],
  orders: [],
  odds: {},
  results: {}
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, headers);
  response.end(body);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function notifyReservation(order) {
  const title = "DOMI 新预订";
  const message = `${order.product || "节令产品"} ${order.quantity || 1}份｜${order.name || "客人"} ${order.phone || ""}`;

  execFile(
    "osascript",
    ["-e", `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`],
    () => {}
  );
}

function isAuthorized(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Basic ")) return false;

  const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  return decoded === `${adminUser}:${adminPassword}`;
}

function requireAdminAuth(response) {
  send(response, 401, "需要后台账号密码", {
    "Content-Type": "text/plain; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="DOMI Reservations"'
  });
}

async function parseRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const contentType = request.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    return JSON.parse(rawBody || "{}");
  }

  return Object.fromEntries(new URLSearchParams(rawBody));
}

function normalizeWorldcupDesk(data) {
  return {
    adminProfile: {
      ...defaultWorldcupDesk.adminProfile,
      ...(data?.adminProfile && typeof data.adminProfile === "object" ? data.adminProfile : {})
    },
    customers: Array.isArray(data?.customers) && data.customers.length ? data.customers : defaultWorldcupDesk.customers,
    orders: Array.isArray(data?.orders) ? data.orders : [],
    odds: data?.odds && typeof data.odds === "object" ? data.odds : {},
    results: data?.results && typeof data.results === "object" ? data.results : {}
  };
}

async function readWorldcupDesk() {
  try {
    const contents = await readFile(worldcupDeskPath, "utf8");
    return normalizeWorldcupDesk(JSON.parse(contents));
  } catch {
    return normalizeWorldcupDesk(defaultWorldcupDesk);
  }
}

async function writeWorldcupDesk(data) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(worldcupDeskPath, `${JSON.stringify(normalizeWorldcupDesk(data), null, 2)}\n`, "utf8");
}

async function handleWorldcupDesk(request, response) {
  try {
    const current = await readWorldcupDesk();

    if (request.method === "GET") {
      send(response, 200, JSON.stringify({ ok: true, data: current }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    const body = await parseRequestBody(request);
    let next = current;

    if (body.action === "createOrder") {
      const order = {
        ...body.order,
        id: body.order?.id || `WC${Date.now().toString(36).toUpperCase()}`,
        createdAt: body.order?.createdAt || new Date().toISOString()
      };
      next = { ...current, orders: [order, ...current.orders.filter((item) => item.id !== order.id)] };
    } else if (body.action === "upsertCustomer") {
      const customer = body.customer;
      if (!customer?.account) throw new Error("missing customer account");
      const exists = current.customers.some((item) => item.account === customer.account);
      next = {
        ...current,
        customers: exists
          ? current.customers.map((item) => (item.account === customer.account ? { ...item, ...customer } : item))
          : [...current.customers, { ...customer, status: customer.status || "启用", createdAt: customer.createdAt || new Date().toISOString() }]
      };
    } else if (body.action === "updateAdminProfile") {
      const adminProfile = body.adminProfile;
      if (!adminProfile?.account || !adminProfile?.password) throw new Error("missing admin profile");
      next = {
        ...current,
        adminProfile: {
          ...current.adminProfile,
          account: String(adminProfile.account).trim() || current.adminProfile.account,
          password: String(adminProfile.password),
          updatedAt: adminProfile.updatedAt || new Date().toISOString()
        }
      };
    } else if (body.action === "importOdds") {
      next = { ...current, odds: { ...current.odds, ...(body.odds || {}) } };
    } else if (body.action === "importResults") {
      next = { ...current, results: { ...current.results, ...(body.results || {}) } };
    } else {
      throw new Error("unknown action");
    }

    await writeWorldcupDesk(next);
    send(response, 200, JSON.stringify({ ok: true, data: next }), { "Content-Type": "application/json; charset=utf-8" });
  } catch (error) {
    console.error("[World Cup desk error]", error);
    send(response, 500, JSON.stringify({ ok: false, error: "worldcup desk error" }), { "Content-Type": "application/json; charset=utf-8" });
  }
}

async function saveReservation(request, response) {
  try {
    const body = await parseRequestBody(request);
    const order = {
      submittedAt: body.submittedAt || new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }),
      product: body.product || "",
      name: body.name || "",
      phone: body.phone || "",
      wechat: body.wechat || "",
      quantity: body.quantity || "",
      delivery: body.delivery || "",
      enterprise: body.enterprise || "",
      note: body.note || "",
      source: body.source || "DOMI Seasonal H5",
      userAgent: request.headers["user-agent"] || ""
    };

    await mkdir(dataDir, { recursive: true });
    await appendFile(jsonlPath, `${JSON.stringify(order)}\n`, "utf8");

    try {
      await stat(csvPath);
    } catch {
      await appendFile(csvPath, "submittedAt,product,name,phone,wechat,quantity,delivery,enterprise,note,source\n", "utf8");
    }

    await appendFile(
      csvPath,
      `${[
        order.submittedAt,
        order.product,
        order.name,
        order.phone,
        order.wechat,
        order.quantity,
        order.delivery,
        order.enterprise,
        order.note,
        order.source
      ].map(csvCell).join(",")}\n`,
      "utf8"
    );

    notifyReservation(order);
    console.log(`[DOMI reservation] ${order.submittedAt} ${order.product} ${order.quantity} ${order.name} ${order.phone}`);
    send(response, 200, JSON.stringify({ ok: true }), { "Content-Type": "application/json; charset=utf-8" });
  } catch (error) {
    console.error("[DOMI reservation error]", error);
    send(response, 500, JSON.stringify({ ok: false }), { "Content-Type": "application/json; charset=utf-8" });
  }
}

async function showReservations(response) {
  let rows = [];

  try {
    const contents = await readFile(jsonlPath, "utf8");
    rows = contents
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .reverse();
  } catch {
    rows = [];
  }

  const tableRows = rows
    .map(
      (row) => `
        <tr>
          <td>${row.submittedAt || ""}</td>
          <td>${row.product || ""}</td>
          <td>${row.name || ""}</td>
          <td>${row.phone || ""}</td>
          <td>${row.wechat || ""}</td>
          <td>${row.quantity || ""}</td>
          <td>${row.delivery || ""}</td>
          <td>${row.enterprise || ""}</td>
          <td>${row.note || ""}</td>
        </tr>`
    )
    .join("");

  send(
    response,
    200,
    `<!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>DOMI 预订后台</title>
          <style>
            body { margin: 0; background: #f6f0e6; color: #2b211b; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
            main { max-width: 1180px; margin: 0 auto; padding: 40px 18px; }
            h1 { margin: 0 0 10px; font-size: 32px; font-weight: 600; }
            p { color: rgba(43, 33, 27, .62); }
            table { width: 100%; border-collapse: collapse; background: #fffdf8; box-shadow: 0 22px 60px rgba(43, 33, 27, .09); }
            th, td { border-bottom: 1px solid rgba(43, 33, 27, .1); padding: 12px; text-align: left; vertical-align: top; font-size: 14px; }
            th { color: rgba(43, 33, 27, .55); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
            .empty { margin-top: 24px; padding: 28px; background: #fffdf8; border: 1px solid rgba(43, 33, 27, .1); }
          </style>
        </head>
        <body>
          <main>
            <h1>DOMI 预订后台</h1>
            <p>当前本机临时接单记录，共 ${rows.length} 条。数据文件：data/reservations.csv</p>
            ${
              rows.length
                ? `<table>
                    <thead>
                      <tr>
                        <th>时间</th><th>产品</th><th>姓名</th><th>手机</th><th>微信</th><th>数量</th><th>方式</th><th>企业</th><th>备注</th>
                      </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                  </table>`
                : `<div class="empty">暂时还没有预订记录。</div>`
            }
          </main>
        </body>
      </html>`,
    { "Content-Type": "text/html; charset=utf-8" }
  );
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(publicDir, safePath);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    const htmlPath = path.join(publicDir, `${safePath}.html`);
    try {
      await stat(htmlPath);
      filePath = htmlPath;
    } catch {
      filePath = path.join(publicDir, "index.html");
    }
  }

  try {
    const file = await readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    send(response, 200, file, { "Content-Type": contentType });
  } catch {
    const htmlPath = path.join(publicDir, `${safePath}.html`);
    try {
      const file = await readFile(htmlPath);
      send(response, 200, file, { "Content-Type": "text/html; charset=utf-8" });
    } catch {
      send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
    }
  }
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (["GET", "POST"].includes(request.method) && requestUrl.pathname === "/api/worldcup-desk") {
    await handleWorldcupDesk(request, response);
    return;
  }

  if (request.method === "POST" && ["/", "/api/reservations"].includes(requestUrl.pathname)) {
    await saveReservation(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/admin/reservations") {
    if (!isAuthorized(request)) {
      requireAdminAuth(response);
      return;
    }

    await showReservations(response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  await serveStatic(request, response);
}).listen(port, () => {
  console.log(`DOMI site and reservation receiver running at http://localhost:${port}`);
  console.log(`Reservation admin: http://localhost:${port}/admin/reservations`);
});
