const { createServer } = require("node:http");
const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();
const collection = db.collection("domi_reservations");
const worldcupDeskCollection = db.collection("worldcup_desk");
const worldcupDeskDocId = "main";
const adminUser = process.env.DOMI_ADMIN_USER || "domi";
const adminPassword = process.env.DOMI_ADMIN_PASSWORD || "change-me-reservation-admin";
const defaultDeskAdminPassword = process.env.WC26_DEFAULT_ADMIN_PASSWORD || "change-me-admin";
const defaultDeskClientPassword = process.env.WC26_DEFAULT_CLIENT_PASSWORD || "change-me-client";
const port = Number(process.env.PORT || 9000);

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

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    ...headers
  });
  res.end(body);
}

function getHeader(req, name) {
  return String(req.headers[name.toLowerCase()] || "");
}

function isAuthorized(req) {
  const authorization = getHeader(req, "authorization");
  if (!authorization.startsWith("Basic ")) return false;

  const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  return decoded === `${adminUser}:${adminPassword}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  const contentType = getHeader(req, "content-type");

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
    const result = await worldcupDeskCollection.doc(worldcupDeskDocId).get();
    const row = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (row) return normalizeWorldcupDesk(row);
  } catch (error) {
    console.warn("[World Cup desk read fallback]", error);
  }

  const initial = normalizeWorldcupDesk(defaultWorldcupDesk);
  try {
    await worldcupDeskCollection.doc(worldcupDeskDocId).set(initial);
  } catch (error) {
    console.warn("[World Cup desk init skipped]", error);
  }
  return initial;
}

async function writeWorldcupDesk(data) {
  const normalized = normalizeWorldcupDesk(data);
  await worldcupDeskCollection.doc(worldcupDeskDocId).set(normalized);
  return normalized;
}

async function handleWorldcupDesk(req, res, preloadedBody) {
  const current = await readWorldcupDesk();

  if (req.method === "GET") {
    send(res, 200, JSON.stringify({ ok: true, data: current }), { "content-type": "application/json; charset=utf-8" });
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, JSON.stringify({ ok: false, message: "Method not allowed" }), { "content-type": "application/json; charset=utf-8" });
    return;
  }

  const body = preloadedBody ?? (await parseBody(req));
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

  const saved = await writeWorldcupDesk(next);
  send(res, 200, JSON.stringify({ ok: true, data: saved }), { "content-type": "application/json; charset=utf-8" });
}

async function maybeNotify(order) {
  const webhook = process.env.DOMI_NOTIFY_WEBHOOK;
  if (!webhook || typeof fetch !== "function") return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "DOMI 新预订",
        text: `${order.product || "节令产品"} ${order.quantity || 1}份｜${order.name || "客人"} ${order.phone || ""}`,
        order
      })
    });
  } catch (error) {
    console.warn("[DOMI notify failed]", error);
  }
}

async function saveReservation(req, res, preloadedBody) {
  const body = preloadedBody ?? (await parseBody(req));
  const order = {
    submittedAt: body.submittedAt || new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }),
    createdAt: Date.now(),
    product: body.product || "",
    name: body.name || "",
    phone: body.phone || "",
    wechat: body.wechat || "",
    quantity: body.quantity || "",
    delivery: body.delivery || "",
    enterprise: body.enterprise || "",
    note: body.note || "",
    source: body.source || "DOMI Seasonal H5",
    userAgent: getHeader(req, "user-agent")
  };

  await collection.add(order);
  await maybeNotify(order);
  send(res, 200, JSON.stringify({ ok: true }), { "content-type": "application/json; charset=utf-8" });
}

async function showReservations(req, res) {
  if (!isAuthorized(req)) {
    send(res, 401, "需要后台账号密码", {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": 'Basic realm="DOMI Reservations"'
    });
    return;
  }

  const result = await collection.orderBy("createdAt", "desc").limit(200).get();
  const rows = result.data || [];
  const tableRows = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.submittedAt)}</td>
          <td>${escapeHtml(row.product)}</td>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.phone)}</td>
          <td>${escapeHtml(row.wechat)}</td>
          <td>${escapeHtml(row.quantity)}</td>
          <td>${escapeHtml(row.delivery)}</td>
          <td>${escapeHtml(row.enterprise)}</td>
          <td>${escapeHtml(row.note)}</td>
        </tr>`
    )
    .join("");

  send(
    res,
    200,
    `<!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>DOMI 云端预订后台</title>
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
            <h1>DOMI 云端预订后台</h1>
            <p>CloudBase 云数据库记录，共 ${rows.length} 条。</p>
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
    { "content-type": "text/html; charset=utf-8" }
  );
}

createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  try {
    if (requestUrl.pathname === "/api/worldcup-desk" || requestUrl.pathname.endsWith("/worldcup-desk")) {
      await handleWorldcupDesk(req, res);
      return;
    }

    if (req.method === "GET" && requestUrl.searchParams.get("admin") === "1") {
      await showReservations(req, res);
      return;
    }

    if (req.method === "GET") {
      await handleWorldcupDesk(req, res);
      return;
    }

    if (req.method === "POST") {
      const body = await parseBody(req);
      if (["createOrder", "upsertCustomer", "updateAdminProfile", "importOdds", "importResults"].includes(body.action)) {
        await handleWorldcupDesk(req, res, body);
        return;
      }

      await saveReservation(req, res, body);
      return;
    }

    send(res, 405, JSON.stringify({ ok: false, message: "Method not allowed" }), {
      "content-type": "application/json; charset=utf-8"
    });
  } catch (error) {
    console.error("[DOMI reservation error]", error);
    send(res, 500, JSON.stringify({ ok: false }), { "content-type": "application/json; charset=utf-8" });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`DOMI CloudBase reservation function listening on ${port}`);
});
