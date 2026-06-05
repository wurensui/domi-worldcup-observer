# World Cup 2026 Match Observer

世界杯赛事观察室是一个面向手机端的 2026 世界杯赛事观察与互动项目，包含客户页面、管理端、CloudBase 云函数接口和一个 Android WebView 客户端外壳。

> 竞猜仅为现场娱乐互动，不涉及任何有奖竞猜、现金奖励或赌博行为。

## Features

- 客户端登录后查看赛事、常玩盘口、全部盘口和已开赛赛事
- 单注单选，下单前填写数值并确认
- 客户端可查看交易状况、账户历史和日期详情
- 管理端可新增客户、修改密码、导入盘口、手工录入盘口水位、导入或手工录入赛果
- 报表支持按会员、日期查看历史订单
- CloudBase HTTP 云函数保存客户、订单、盘口和赛果数据
- Android 客户端壳可直接打开线上客户页面

## Local Development

```bash
npm install
npm run dev
```

本地访问：

- 客户端：`http://localhost:3000/worldcup-board`
- 管理端：`http://localhost:3000/worldcup-admin`

## Environment

正式部署前请设置自己的账号、密码和 CloudBase 环境 ID。不要使用源码里的占位密码。

```bash
export TCB_ENV_ID="your-cloudbase-env-id"
export DOMI_ADMIN_USER="your-basic-auth-user"
export DOMI_ADMIN_PASSWORD="your-basic-auth-password"
export WC26_DEFAULT_ADMIN_PASSWORD="your-initial-admin-password"
export WC26_DEFAULT_CLIENT_PASSWORD="your-initial-client-password"
```

客户端构建时可选：

```bash
export NEXT_PUBLIC_WC26_ADMIN_PASSWORD="your-local-demo-admin-password"
export NEXT_PUBLIC_WC26_CLIENT_PASSWORD="your-local-demo-client-password"
```

## CloudBase Deploy

```bash
export TCB_ENV_ID="your-cloudbase-env-id"
npm run tcb:deploy
```

部署脚本会构建静态页面、部署 `domiReservations` 云函数，并同步以下路由：

- `/`
- `/api/reservations`
- `/api/worldcup-desk`

## Android Client

Android 工程在 `android-client/`。调试包构建：

```bash
cd android-client
./gradlew assembleDebug
```

如需发布正式 APK，请使用 Android Studio 配置签名证书后打 release 包。

## Runtime Data

以下内容不会提交到 GitHub：

- `data/worldcup-desk.json`
- `data/*.csv`
- `data/*.jsonl`
- `logs/`
- `output/`
- `outputs/`
- `.next/`
- `out/`
- `node_modules/`
- Android 本地 SDK 路径和构建缓存

## License

MIT
