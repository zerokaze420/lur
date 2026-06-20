import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

const root = process.cwd();
const distDir = path.join(root, "dist");
const lpkDir = path.join(root, "build", "lpk");
const workDir = path.join(root, "build", "manual-lpk");
const sourceDir = path.join(root, "build", "sources");
const cacheDir = path.join(root, "build", "cache");
const cacheLpkDir = path.join(cacheDir, "lpk");
const cacheLockFile = path.join(cacheDir, "lpk-cache.lock.json");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cacheSchema = 2;

function formatCommand(command, args = []) {
  return [command, ...args].join(" ");
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });

  if (result.status !== 0) {
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    const stderr = typeof result.stderr === "string" ? result.stderr : "";

    throw new Error(
      `${formatCommand(command, args)} failed in ${options.cwd ?? root}\n${stdout}\n${stderr}`,
    );
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function runShell(command, options = {}) {
  const result = spawnSync(command, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    stdio: "pipe",
    ...options,
  });

  if (result.status !== 0) {
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    const stderr = typeof result.stderr === "string" ? result.stderr : "";

    throw new Error(
      `${command} failed in ${options.cwd ?? root}\n${stdout}\n${stderr}`,
    );
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function normalizeCommand(command, label) {
  if (typeof command === "string") {
    return {
      command,
      args: [],
      shell: true,
    };
  }

  if (Array.isArray(command) && command.length > 0) {
    const [binary, ...args] = command.map((part) => requiredString(part, label));

    return {
      command: binary,
      args,
      shell: false,
    };
  }

  throw new Error(`${label} must be a non-empty string or string array`);
}

async function readYaml(file) {
  const text = await readFile(file, "utf8");
  return YAML.parse(text);
}

async function readJsonIfExists(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function sha256File(file) {
  const data = await readFile(file);
  return createHash("sha256").update(data).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function githubReleaseUrl(repo, tag, fileName) {
  return `https://github.com/${repo}/releases/download/${tag}/${fileName}`;
}

function currentCommit() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });

  return result.status === 0 ? result.stdout.trim() : "local";
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function validateAppId(id) {
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(id)) {
    throw new Error(
      `apps[].id must use lowercase letters, numbers, dots or dashes: ${id}`,
    );
  }
}

function insideRoot(file, label) {
  const resolved = path.resolve(root, file);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside repository root: ${file}`);
  }

  return resolved;
}

function insideDirectory(base, file, label) {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(base, file);
  const relative = path.relative(resolvedBase, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside ${resolvedBase}: ${file}`);
  }

  return resolved;
}

async function ensureFile(file, label) {
  try {
    const info = await stat(file);

    if (!info.isFile()) {
      throw new Error(`${label} must be a file: ${file}`);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${label} does not exist: ${file}`);
    }

    throw error;
  }
}

async function ensureDirectory(dir, label) {
  try {
    const info = await stat(dir);

    if (!info.isDirectory()) {
      throw new Error(`${label} must be a directory: ${dir}`);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${label} does not exist: ${dir}`);
    }

    throw error;
  }
}

async function fileExists(file) {
  try {
    const info = await stat(file);
    return info.isFile();
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function optionalString(value, label) {
  if (value == null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value.trim();
}

function resolveSourcePath(source, file, label) {
  return insideDirectory(source, requiredString(file, label), label);
}

function shouldIgnoreSourceEntry(relativePath) {
  const parts = relativePath.split(path.sep);

  return (
    parts.includes(".git") ||
    parts.includes("result") ||
    parts.includes("node_modules") ||
    parts.includes(".direnv")
  );
}

async function sourceDigest(source) {
  const entries = [];

  async function walk(dir) {
    const dirEntries = await readdir(dir, { withFileTypes: true });

    for (const entry of dirEntries) {
      const file = path.join(dir, entry.name);
      const relative = path.relative(source, file);

      if (shouldIgnoreSourceEntry(relative)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(file);
      } else if (entry.isSymbolicLink()) {
        entries.push({
          path: relative,
          type: "symlink",
          target: await readlink(file),
        });
      } else if (entry.isFile()) {
        entries.push({
          path: relative,
          type: "file",
          sha256: await sha256File(file),
        });
      }
    }
  }

  await walk(source);
  entries.sort((left, right) => left.path.localeCompare(right.path));

  return sha256Text(stableStringify(entries));
}

async function removeSymlink(file) {
  try {
    const info = await lstat(file);

    if (info.isSymbolicLink()) {
      await rm(file);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function cacheFileName(inputHash, fileName) {
  return `${inputHash}-${fileName}`;
}

function normalizeBuild(app, id) {
  if (app.build == null) {
    return { type: "content" };
  }

  if (typeof app.build === "string") {
    return { type: app.build };
  }

  if (typeof app.build !== "object" || Array.isArray(app.build)) {
    throw new Error(`${id}.build must be a string or object`);
  }

  return {
    ...app.build,
    type: app.build.type ?? "content",
  };
}

function normalizeSource(source, id) {
  if (typeof source === "string") {
    return {
      type: "local",
      path: requiredString(source, `${id}.source`),
    };
  }

  if (typeof source !== "object" || source == null || Array.isArray(source)) {
    throw new Error(`${id}.source must be a string path or object`);
  }

  const git = requiredString(source.git, `${id}.source.git`);
  const rev = typeof source.rev === "string" ? source.rev.trim() : "";
  const ref = typeof source.ref === "string" ? source.ref.trim() : "";

  if (!rev && !ref) {
    throw new Error(`${id}.source must set rev or ref for git sources`);
  }

  return {
    type: "git",
    git,
    rev,
    ref,
  };
}

function repositorySource(source) {
  if (source.type === "local") {
    return source.path;
  }

  return {
    type: "git",
    url: source.git,
    ...(source.rev ? { rev: source.rev } : {}),
    ...(source.ref ? { ref: source.ref } : {}),
  };
}

async function prepareSource(id, source) {
  if (source.type === "local") {
    const localSource = insideRoot(source.path, `${id}.source`);
    await ensureDirectory(localSource, `${id}.source`);
    return localSource;
  }

  const checkoutDir = insideDirectory(sourceDir, id, `${id}.source checkout`);

  await rm(checkoutDir, { force: true, recursive: true });
  await mkdir(sourceDir, { recursive: true });

  if (source.ref) {
    run("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      source.ref,
      source.git,
      checkoutDir,
    ]);
  } else {
    run("git", ["clone", "--no-checkout", source.git, checkoutDir]);
  }

  if (source.rev) {
    run("git", ["checkout", "--detach", source.rev], { cwd: checkoutDir });
  }

  return checkoutDir;
}

function appInputHash({ id, sourceConfig, build, packageId, version, sourceHash }) {
  return sha256Text(
    stableStringify({
      schema: cacheSchema,
      id,
      package: packageId,
      version,
      source: repositorySource(sourceConfig),
      sourceHash,
      build,
    }),
  );
}

async function copyCachedLpk({ id, cacheLock, inputHash, fileName, lpkFile }) {
  const cached = cacheLock.apps?.[id];

  if (
    cached?.schema !== cacheSchema ||
    cached.inputHash !== inputHash ||
    cached.file !== fileName
  ) {
    return false;
  }

  const cachedFile = path.join(cacheLpkDir, cached.cacheFile);

  try {
    const info = await stat(cachedFile);

    if (!info.isFile()) {
      return false;
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }

  await copyFile(cachedFile, lpkFile);

  const size = Number(run("wc", ["-c", lpkFile]).split(/\s+/)[0]);
  const sha256 = await sha256File(lpkFile);

  if (size !== cached.size || sha256 !== cached.sha256) {
    return false;
  }

  console.log(`cache hit: ${id}`);
  return true;
}

async function updateCachedLpk({
  id,
  cacheLock,
  inputHash,
  fileName,
  lpkFile,
  size,
  sha256,
}) {
  await mkdir(cacheLpkDir, { recursive: true });

  const cacheFile = cacheFileName(inputHash, fileName);
  const cachePath = path.join(cacheLpkDir, cacheFile);
  await rm(cachePath, { force: true });
  await copyFile(lpkFile, cachePath);

  cacheLock.apps ??= {};
  cacheLock.apps[id] = {
    schema: cacheSchema,
    inputHash,
    file: fileName,
    cacheFile,
    size,
    sha256,
  };
}

async function findOneArtifact(source, pattern, label) {
  const normalized = requiredString(pattern, label);

  if (!normalized.endsWith("*.lpk")) {
    const file = path.resolve(source, normalized);
    await ensureFile(file, label);
    return file;
  }

  const dirPart = normalized.slice(0, -"*.lpk".length);
  const artifactDir = path.resolve(source, dirPart || ".");
  const relative = path.relative(source, artifactDir);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside app source: ${pattern}`);
  }

  await ensureDirectory(artifactDir, label);

  const files = (await readdir(artifactDir))
    .filter((file) => file.endsWith(".lpk"))
    .sort();

  if (files.length !== 1) {
    throw new Error(
      `${label} must match exactly one .lpk, found ${files.length}: ${pattern}`,
    );
  }

  return path.join(artifactDir, files[0]);
}

async function buildContentLpk({
  id,
  source,
  packageFile,
  manifestFile,
  contentDir,
  appWorkDir,
  lpkFile,
}) {
  await ensureFile(manifestFile, `${id}.manifest`);
  await ensureDirectory(contentDir, `${id}.content`);

  await rm(appWorkDir, { force: true, recursive: true });
  await mkdir(appWorkDir, { recursive: true });
  await copyFile(packageFile, path.join(appWorkDir, "package.yml"));
  await copyFile(manifestFile, path.join(appWorkDir, "manifest.yml"));
  run("tar", ["-C", contentDir, "-cf", path.join(appWorkDir, "content.tar"), "."]);
  run("tar", [
    "-C",
    appWorkDir,
    "-cf",
    lpkFile,
    "manifest.yml",
    "package.yml",
    "content.tar",
  ]);

  return source;
}

async function copyIfExists(sourceFile, targetFile) {
  if (await fileExists(sourceFile)) {
    await copyFile(sourceFile, targetFile);
    return true;
  }

  return false;
}

async function tarDirectoryContents(base, output) {
  const entries = (await readdir(base)).sort();
  run("tar", ["-C", base, "-cf", output, ...entries]);
}

function unsupportedLzcBuildKeys(config) {
  return [
    "buildscript",
    "images",
    "compose_override",
    "resource_exports",
  ].filter((key) => config[key] != null);
}

function imageAlias(serviceName) {
  return serviceName.replace(/[^a-zA-Z0-9_.-]/g, "-");
}

function dockerImageReference(image) {
  if (image.includes("://")) {
    return image;
  }

  return `docker://${image}`;
}

function logBuildDecision(id, type, action) {
  console.log(`[build:${id}] type=${type} -> ${action}`);
}

function buildTypeAction(type) {
  if (type === "content") {
    return "pack manifest, package and content directory";
  }

  if (type === "command") {
    return "run configured command and copy artifact";
  }

  if (type === "lzc") {
    return "read lzc-build.yml and embed remote service images";
  }

  return "unsupported build type";
}

function lzcServiceImages(manifest, id, { log = false } = {}) {
  const services = manifest.services ?? {};

  if (typeof services !== "object" || services == null || Array.isArray(services)) {
    return [];
  }

  return Object.entries(services)
    .map(([serviceName, serviceConfig]) => {
      if (
        typeof serviceConfig !== "object" ||
        serviceConfig == null ||
        Array.isArray(serviceConfig) ||
        typeof serviceConfig.image !== "string" ||
        serviceConfig.image.trim() === ""
      ) {
        return null;
      }

      const image = serviceConfig.image.trim();

      if (image.startsWith("embed:")) {
        if (log) {
          console.log(
            `[build:${id}] service=${serviceName} image=${image} -> already embedded, skipping`,
          );
        }

        return null;
      }

      if (log) {
        console.log(
          `[build:${id}] service=${serviceName} image=${image} -> embed with skopeo`,
        );
      }

      return {
        serviceName,
        alias: imageAlias(serviceName),
        image,
      };
    })
    .filter(Boolean)
    .map((entry) => {
      if (!/^[a-zA-Z0-9_.-]+$/.test(entry.alias)) {
        throw new Error(`${id}.services.${entry.serviceName}.image alias is invalid`);
      }

      return entry;
    });
}

async function embedDockerImage({
  id,
  serviceName,
  image,
  alias,
  appWorkDir,
  imageWorkDir,
}) {
  await mkdir(imageWorkDir, { recursive: true });
  const archive = path.join(imageWorkDir, `${alias}.docker-archive.tar`);
  const imagesDir = path.join(appWorkDir, "images");

  console.log(`embedding image for ${id}: ${alias} <- ${image}`);
  run("skopeo", [
    "--insecure-policy",
    "copy",
    "--src-no-creds",
    "--dest-compress=false",
    dockerImageReference(image),
    `docker-archive:${archive}`,
  ], {
    stdio: "inherit",
  });

  const output = run("python3", [
    path.join(scriptDir, "docker-archive-to-oci.py"),
    "--docker-archive",
    archive,
    "--images-dir",
    imagesDir,
    "--ref-name",
    alias,
  ]);

  return {
    ...JSON.parse(output),
    serviceName,
  };
}

async function writeImagesLock(appWorkDir, embeddedImages) {
  if (embeddedImages.length === 0) {
    return;
  }

  const lines = ["version: 1", "images:"];

  for (const image of embeddedImages) {
    lines.push(`  ${image.alias}:`);
    lines.push(`    image_id: ${image.image_id}`);
    lines.push("    upstream: ''");
    lines.push("    layers:");

    for (const digest of image.layers) {
      lines.push(`      - digest: ${digest}`);
      lines.push("        source: embed");
    }
  }

  await writeFile(path.join(appWorkDir, "images.lock"), `${lines.join("\n")}\n`);
}

function rewriteManifestImages(manifest, images) {
  const next = structuredClone(manifest);

  for (const image of images) {
    next.services[image.serviceName].image = `embed:${image.alias}@${image.image_id}`;
  }

  return next;
}

async function verifyEmbeddedImages(appWorkDir) {
  const manifestFile = path.join(appWorkDir, "manifest.yml");
  const imagesLockFile = path.join(appWorkDir, "images.lock");
  const imagesDir = path.join(appWorkDir, "images");
  const blobsDir = path.join(imagesDir, "blobs", "sha256");

  if (!(await fileExists(imagesLockFile))) {
    return;
  }

  await ensureDirectory(imagesDir, "images");
  await ensureFile(path.join(imagesDir, "index.json"), "images/index.json");

  const manifestText = await readFile(manifestFile, "utf8");
  const imagesLockText = await readFile(imagesLockFile, "utf8");
  const index = JSON.parse(await readFile(path.join(imagesDir, "index.json"), "utf8"));

  for (const entry of index.manifests ?? []) {
    const alias = entry.annotations?.["org.opencontainers.image.ref.name"];
    const manifestDigest = entry.digest;

    if (!alias || !manifestDigest?.startsWith("sha256:")) {
      throw new Error("images/index.json contains invalid embedded image entry");
    }

    const manifestBlob = path.join(blobsDir, manifestDigest.slice("sha256:".length));
    await ensureFile(manifestBlob, `embedded image ${alias} manifest blob`);
    const ociManifest = JSON.parse(await readFile(manifestBlob, "utf8"));
    const configDigest = ociManifest.config?.digest;

    if (!configDigest?.startsWith("sha256:")) {
      throw new Error(`embedded image ${alias} is missing config digest`);
    }

    await ensureFile(
      path.join(blobsDir, configDigest.slice("sha256:".length)),
      `embedded image ${alias} config blob`,
    );

    if (!manifestText.includes(`embed:${alias}@${configDigest}`)) {
      throw new Error(`manifest.yml does not reference embed:${alias}@${configDigest}`);
    }

    if (!imagesLockText.includes(`  ${alias}:`) || !imagesLockText.includes(`image_id: ${configDigest}`)) {
      throw new Error(`images.lock does not record ${alias} ${configDigest}`);
    }

    for (const layer of ociManifest.layers ?? []) {
      const digest = layer.digest;

      if (!digest?.startsWith("sha256:")) {
        throw new Error(`embedded image ${alias} has invalid layer digest`);
      }

      await ensureFile(
        path.join(blobsDir, digest.slice("sha256:".length)),
        `embedded image ${alias} layer blob`,
      );
    }
  }
}

async function verifyLpk(lpkFile, label) {
  const verifyDir = path.join(workDir, `${label}-verify`);

  await rm(verifyDir, { force: true, recursive: true });
  await mkdir(verifyDir, { recursive: true });
  run("tar", ["-xf", lpkFile, "-C", verifyDir]);
  await ensureFile(path.join(verifyDir, "manifest.yml"), `${label}.manifest.yml`);
  await ensureFile(path.join(verifyDir, "package.yml"), `${label}.package.yml`);
  const manifest = await readYaml(path.join(verifyDir, "manifest.yml"));
  const remoteImages = lzcServiceImages(manifest, label);

  if (remoteImages.length > 0) {
    throw new Error(
      `${label}.lpk contains non-embedded service images: ${remoteImages
        .map((image) => `${image.serviceName}=${image.image}`)
        .join(", ")}`,
    );
  }

  await verifyEmbeddedImages(verifyDir);
  await rm(verifyDir, { force: true, recursive: true });
}

async function buildLzcConfigLpk({
  id,
  source,
  packageFile,
  appWorkDir,
  lpkFile,
}) {
  const buildFile = path.join(source, "lzc-build.yml");
  await ensureFile(buildFile, `${id}.lzc-build.yml`);

  const config = await readYaml(buildFile);
  if (typeof config !== "object" || config == null || Array.isArray(config)) {
    throw new Error(`${id}.lzc-build.yml must be an object`);
  }

  const unsupported = unsupportedLzcBuildKeys(config);
  if (unsupported.length > 0) {
    throw new Error(
      `${id}.lzc-build.yml uses unsupported manual build keys: ${unsupported.join(", ")}`,
    );
  }

  if (config.package_override != null) {
    throw new Error(`${id}.lzc-build.yml package_override is not supported`);
  }

  const manifestName = config.manifest ?? "lzc-manifest.yml";
  const manifestFile = resolveSourcePath(
    source,
    manifestName,
    `${id}.lzc-build.yml manifest`,
  );
  await ensureFile(manifestFile, `${id}.manifest`);
  const manifest = await readYaml(manifestFile);
  const serviceImages = lzcServiceImages(manifest, id, { log: true });

  await rm(appWorkDir, { force: true, recursive: true });
  await mkdir(appWorkDir, { recursive: true });
  await copyFile(packageFile, path.join(appWorkDir, "package.yml"));

  const contentDirName = optionalString(
    config.contentdir,
    `${id}.lzc-build.yml contentdir`,
  );
  if (contentDirName) {
    const contentDir = resolveSourcePath(
      source,
      contentDirName,
      `${id}.lzc-build.yml contentdir`,
    );
    await ensureDirectory(contentDir, `${id}.contentdir`);
    run("tar", ["-C", contentDir, "-cf", path.join(appWorkDir, "content.tar"), "."]);
  }

  const iconName = optionalString(config.icon, `${id}.lzc-build.yml icon`);
  if (iconName) {
    const iconFile = resolveSourcePath(
      source,
      iconName,
      `${id}.lzc-build.yml icon`,
    );
    await ensureFile(iconFile, `${id}.icon`);
    await copyFile(iconFile, path.join(appWorkDir, "icon.png"));
  }

  await copyIfExists(
    path.join(source, "lzc-deploy-params.yml"),
    path.join(appWorkDir, "deploy_params.yml"),
  );

  const embeddedImages = [];
  const imageWorkDir = path.join(appWorkDir, ".image-work");

  for (const serviceImage of serviceImages) {
    embeddedImages.push(
      await embedDockerImage({
        id,
        serviceName: serviceImage.serviceName,
        image: serviceImage.image,
        alias: serviceImage.alias,
        appWorkDir,
        imageWorkDir,
      }),
    );
  }

  await rm(imageWorkDir, { force: true, recursive: true });
  const finalManifest =
    embeddedImages.length > 0 ? rewriteManifestImages(manifest, embeddedImages) : manifest;
  await writeFile(
    path.join(appWorkDir, "manifest.yml"),
    YAML.stringify(finalManifest),
  );
  await writeImagesLock(appWorkDir, embeddedImages);
  await verifyEmbeddedImages(appWorkDir);
  await tarDirectoryContents(appWorkDir, lpkFile);

  return buildFile;
}

async function buildCommandLpk({ id, source, build, lpkFile }) {
  const command = normalizeCommand(build.command, `${id}.build.command`);
  const artifactPattern = build.artifact ?? "result/*.lpk";

  await removeSymlink(path.join(source, "result"));

  if (command.shell) {
    runShell(command.command, { cwd: source, stdio: "inherit" });
  } else {
    run(command.command, command.args, {
      cwd: source,
      stdio: "inherit",
    });
  }

  const artifact = await findOneArtifact(
    source,
    artifactPattern,
    `${id}.build.artifact`,
  );

  if (path.resolve(artifact) === path.resolve(lpkFile)) {
    await access(lpkFile);
  } else {
    await copyFile(artifact, lpkFile);
  }

  return artifact;
}

async function buildLpks() {
  const config = await readYaml(path.join(root, "apps.yml"));
  const repository = config.repository ?? {};
  const repo =
    process.env.GITHUB_REPOSITORY ??
    `${requiredString(repository.owner, "repository.owner")}/${requiredString(
      repository.repo,
      "repository.repo",
    )}`;
  const pagesBaseUrl =
    process.env.PAGES_BASE_URL ??
    process.env.GITHUB_PAGES_URL ??
    repository.homepage ??
    "";
  const commit = currentCommit();
  const runNumber = process.env.GITHUB_RUN_NUMBER ?? "local";
  const apps = Array.isArray(config.apps) ? config.apps : [];
  const builtAt = new Date().toISOString();
  const seenIds = new Set();
  const cacheLock = await readJsonIfExists(cacheLockFile, {
    schema: cacheSchema,
    apps: {},
  });

  await rm(lpkDir, { force: true, recursive: true });
  await rm(workDir, { force: true, recursive: true });
  await rm(sourceDir, { force: true, recursive: true });
  await mkdir(lpkDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  await mkdir(distDir, { recursive: true });

  const entries = [];

  for (const app of apps) {
    if (typeof app !== "object" || app == null || Array.isArray(app)) {
      throw new Error("apps[] entries must be objects");
    }

    const id = requiredString(app.id, "apps[].id");
    validateAppId(id);

    if (seenIds.has(id)) {
      throw new Error(`duplicate app id: ${id}`);
    }

    seenIds.add(id);

    const sourceConfig = normalizeSource(app.source, id);
    const source = await prepareSource(id, sourceConfig);

    const packageFile = path.join(source, "package.yml");
    await ensureFile(packageFile, `${id}.package.yml`);

    const build = normalizeBuild(app, id);
    const manifestName = build.manifest ?? app.manifest ?? "manifest.yml";
    const contentName = build.content ?? app.content ?? "content";
    const manifestFile = path.join(source, manifestName);
    const packageMeta = await readYaml(packageFile);
    const packageId = requiredString(packageMeta.package, `${id}.package`);
    const version = requiredString(packageMeta.version, `${id}.version`);
    const name = requiredString(packageMeta.name, `${id}.name`);
    const tag = `${id}-v${version}`;
    const fileName = `${id}-${version}.lpk`;
    const appWorkDir = path.join(workDir, id);
    const lpkFile = path.join(lpkDir, fileName);
    const sourceHash = await sourceDigest(source);
    const inputHash = appInputHash({
      id,
      sourceConfig,
      build,
      packageId,
      version,
      sourceHash,
    });
    logBuildDecision(id, build.type, buildTypeAction(build.type));

    const cached = await copyCachedLpk({
      id,
      cacheLock,
      inputHash,
      fileName,
      lpkFile,
    });

    if (!cached) {
      console.log(`cache miss: ${id}`);

      if (build.type === "content") {
        await buildContentLpk({
          id,
          source,
          packageFile,
          manifestFile,
          contentDir: path.join(source, contentName),
          appWorkDir,
          lpkFile,
        });
      } else if (build.type === "command") {
        await buildCommandLpk({ id, source, build, lpkFile });
      } else if (build.type === "lzc") {
        await buildLzcConfigLpk({
          id,
          source,
          packageFile,
          appWorkDir,
          lpkFile,
        });
      } else {
        throw new Error(`${id}.build.type must be "content", "command" or "lzc"`);
      }
    }

    const size = Number(run("wc", ["-c", lpkFile]).split(/\s+/)[0]);
    const sha256 = await sha256File(lpkFile);

    if (!cached) {
      await updateCachedLpk({
        id,
        cacheLock,
        inputHash,
        fileName,
        lpkFile,
        size,
        sha256,
      });
    }

    await verifyLpk(lpkFile, id);

    entries.push({
      id,
      package: packageId,
      name,
      version,
      description: packageMeta.description ?? "",
      summary: app.summary ?? packageMeta.description ?? "",
      categories: Array.isArray(app.categories) ? app.categories : [],
      min_os_version: packageMeta.min_os_version ?? "",
      homepage: packageMeta.homepage ?? "",
      license: packageMeta.license ?? "",
      author: packageMeta.author ?? "",
      locales: packageMeta.locales ?? {},
      release: {
        tag,
        file: fileName,
        size,
        sha256,
        download_url: githubReleaseUrl(repo, tag, fileName),
      },
      source: repositorySource(sourceConfig),
      build: {
        type: build.type,
      },
    });
  }

  const repositoryJson = {
    schema: "cloud.lazycat.third-party-repository.v1",
    repository: {
      name: repository.name ?? "LazyCat Personal Repository",
      description: repository.description ?? "",
      homepage: pagesBaseUrl,
      source: `https://github.com/${repo}`,
      commit,
      run_number: runNumber,
      generated_at: builtAt,
    },
    apps: entries,
  };

  await writeFile(
    path.join(distDir, "repository.json"),
    `${JSON.stringify(repositoryJson, null, 2)}\n`,
  );
  await writeFile(path.join(distDir, "apps.yml"), await readFile("apps.yml"));
  await writeFile(
    cacheLockFile,
    `${JSON.stringify(
      {
        schema: cacheSchema,
        apps: cacheLock.apps ?? {},
      },
      null,
      2,
    )}\n`,
  );
  console.log(`built ${entries.length} LPK(s)`);
}

buildLpks().catch((error) => {
  console.error(error);
  process.exit(1);
});
