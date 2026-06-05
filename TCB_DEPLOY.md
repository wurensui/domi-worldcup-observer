# DOMI CloudBase 部署说明

## 方案

- 静态网站托管：部署 `out/`，用于展示 DOMI H5 页面。
- 云函数：`domiReservations`，用于接收预订表单。
- 云数据库：集合 `domi_reservations`，用于保存订单。
- 后台查看：访问 `/api/reservations?admin=1`，使用 Basic Auth。

## 首次部署

1. 在腾讯云 CloudBase 创建环境，记下环境 ID。
2. 在本地登录 CloudBase：

```bash
npm run tcb:login
```

3. 设置环境 ID，并部署：

```bash
export TCB_ENV_ID="你的 CloudBase 环境 ID"
npm run tcb:deploy
```

部署脚本会先把环境 ID 写入 `cloudbaserc.json`，再构建 Next.js 静态文件、部署云函数，最后上传静态网站。
云函数会按 HTTP 云函数部署，并创建 `/api/reservations` 访问路径；静态网站会创建 `/` 访问路径。
构建静态页面时，会默认把表单提交地址写成：

```text
https://你的环境 ID.service.tcloudbase.com/api/reservations
```

## 后台

云函数 HTTP 访问路径部署为：

```text
https://你的环境 ID.service.tcloudbase.com/api/reservations
```

后台地址：

```text
https://你的环境 ID.service.tcloudbase.com/api/reservations?admin=1
```

建议在 CloudBase 云函数环境变量里设置后台账号密码：

```text
DOMI_ADMIN_USER
DOMI_ADMIN_PASSWORD
```

世界杯管理端首次初始化密码也建议设置：

```text
WC26_DEFAULT_ADMIN_PASSWORD
WC26_DEFAULT_CLIENT_PASSWORD
```

## 如果提交失败

如果静态托管域名和 HTTP 访问服务域名不是同一个，部署脚本已经默认使用完整接口地址。若要手动指定，请设置：

```text
NEXT_PUBLIC_RESERVATION_ENDPOINT
```

然后重新执行：

```bash
npm run tcb:deploy
```

## 如果访问出现 INVALID_PATH

`INVALID_PATH` 表示 HTTP 访问服务没有匹配到域名 + 路径的转发规则。
本项目需要两类路由：

```text
/                 -> 静态网站托管 staticstore
/api/reservations -> HTTP 云函数 domiReservations
```

注意静态网站根路由应配置为 `/`，不要配置成 `/*`。如果重新绑定域名或手动改过 HTTP 访问服务配置，可以执行：

```bash
export TCB_ENV_ID="你的 CloudBase 环境 ID"
npm run tcb:route:http
```

如需覆盖默认域名列表，可设置：

```bash
export TCB_HTTP_DOMAINS="*,domigarden.cn,www.domigarden.cn"
```

## 预订通知

云函数支持可选 webhook 通知。配置云函数环境变量：

```text
DOMI_NOTIFY_WEBHOOK
```

客人提交预订后，云函数会把订单 JSON POST 到该地址。可以接企业微信、Server 酱或自建通知服务。
