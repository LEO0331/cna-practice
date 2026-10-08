import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function buildOfflineCache(outputDirectory) {
  const template = await readFile(new URL("./offline-worker.js", import.meta.url), "utf8");
  const files = [];
  async function walk(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), `${relative}/`);
      else if (/\.(html|txt|js|css|svg|png|jpg|jpeg|webp|ico|woff2?)$/.test(entry.name) && relative !== "sw.js") files.push(relative);
    }
  }
  await walk(outputDirectory);
  files.sort();
  const hash = createHash("sha256").update(template);
  let bytes = 0;
  for (const file of files) {
    const content = await readFile(path.join(outputDirectory, file));
    hash.update(file).update(content);
    bytes += content.length;
  }
  const version = hash.digest("hex").slice(0, 20);
  // Directory URLs are the URLs used by Next links and the exported site.
  const urls = files.map((file) => file === "index.html" ? "./" : file.endsWith("/index.html") ? file.slice(0, -10) : file);
  const manifest = `const OFFLINE_VERSION = ${JSON.stringify(version)};\nconst OFFLINE_FILES = ${JSON.stringify(urls)};`;
  await writeFile(path.join(outputDirectory, "sw.js"), template.replace("/* OFFLINE_MANIFEST */", manifest));
  return { version, files: urls, bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildOfflineCache(path.resolve("out"));
  console.log(`Offline cache: ${result.files.length} files, ${(result.bytes / 1024 / 1024).toFixed(1)} MB (uncompressed), version ${result.version}`);
}
