import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "contracts", "roster.ts");

if (!existsSync(target)) {
  copyFileSync(
    path.join(root, "contracts", "roster.example.ts"),
    target,
  );
  console.log("[setup] contracts/roster.ts not found; created it from roster.example.ts");
}
