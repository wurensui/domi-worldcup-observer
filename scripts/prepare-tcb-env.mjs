import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "cloudbaserc.json");
const envId = process.env.TCB_ENV_ID;

if (!envId) {
  console.error("请先设置 TCB_ENV_ID，例如：export TCB_ENV_ID=\"你的 CloudBase 环境 ID\"");
  process.exit(1);
}

const config = JSON.parse(await readFile(configPath, "utf8"));
config.envId = envId;
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log(`CloudBase envId 已写入：${envId}`);
