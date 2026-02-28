import fs from "node:fs";
import path from "node:path";

const sourceBackend = path.resolve("src/desktop/backend/mock-backend.mjs");
const targetDir = path.resolve("src/desktop/resources/bin");
const targetBackend = path.join(targetDir, "mock-backend.mjs");

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(sourceBackend, targetBackend);

process.stdout.write(`Prepared desktop resource: ${targetBackend}\n`);
