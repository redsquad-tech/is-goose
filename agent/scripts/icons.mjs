import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import icongen from "icon-gen";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const appIconsDir = path.join(root, "src", "desktop", "renderer", "assets", "app-icons");
const sourceSvg = path.join(appIconsDir, "icon.svg");
const generatedDir = path.join(appIconsDir, "generated");

const requiredArtifacts = [
  "icon.icns",
  "icon.ico",
  "icon.png",
  "icon-512.png",
  "iconTemplate.png",
  "iconTemplateUpdate.png",
];
const cleanupPatterns = [/^favicon-/, /^favicon\.ico$/, /^app\.ico$/];

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const renderPng = async (size, outputPath) => {
  const content = await fs.readFile(sourceSvg);
  await sharp(content).resize(size, size).png().toFile(outputPath);
};

const check = async () => {
  const missing = [];

  for (const file of requiredArtifacts) {
    const artifactPath = path.join(generatedDir, file);
    try {
      const stat = await fs.stat(artifactPath);
      if (stat.size <= 0) {
        missing.push(file);
      }
    } catch {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing icon artifacts: ${missing.join(", ")}`);
  }
};

const build = async () => {
  await ensureDir(generatedDir);

  const iconPng = path.join(generatedDir, "icon.png");
  const icon512 = path.join(generatedDir, "icon-512.png");
  const iconTemplate = path.join(generatedDir, "iconTemplate.png");
  const iconTemplateUpdate = path.join(generatedDir, "iconTemplateUpdate.png");

  await renderPng(1024, iconPng);
  await renderPng(512, icon512);
  await renderPng(22, iconTemplate);
  await renderPng(22, iconTemplateUpdate);

  const icoBuffers = await Promise.all(
    [16, 24, 32, 48, 64, 128, 256].map(async (size) => {
      const content = await fs.readFile(sourceSvg);
      return sharp(content).resize(size, size).png().toBuffer();
    }),
  );

  const icoData = await pngToIco(icoBuffers);
  await fs.writeFile(path.join(generatedDir, "icon.ico"), icoData);

  await icongen(iconPng, generatedDir, {
    report: false,
    modes: ["icns"],
    names: {
      icns: "icon",
    },
  });

  const generatedFiles = await fs.readdir(generatedDir);
  if (generatedFiles.includes("app.icns")) {
    await fs.rename(
      path.join(generatedDir, "app.icns"),
      path.join(generatedDir, "icon.icns"),
    );
  }

  await Promise.all(
    generatedFiles
      .filter((file) => cleanupPatterns.some((pattern) => pattern.test(file)))
      .map((file) => fs.rm(path.join(generatedDir, file), { force: true })),
  );

  await check();
};

const main = async () => {
  const mode = process.argv[2];

  if (mode === "build") {
    await build();
    return;
  }

  if (mode === "check") {
    await check();
    return;
  }

  throw new Error("Usage: node scripts/icons.mjs <build|check>");
};

await main();
