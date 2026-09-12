import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
if (path.basename(outputDirectory) !== "dist") {
  throw new Error(`Refusing to remove unexpected output directory: ${outputDirectory}`);
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
