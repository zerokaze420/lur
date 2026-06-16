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

import YAML from "yaml";

const root = process.cwd();
const distDir = path.join(root, "dist");
const lpkDir = path.join(root, "build", "lpk");
const workDir = path.join(root, "build", "manual-lpk");
const sourceDir = path.join(root, "build", "sources");
const cacheDir = path.join(root, "build", "cache");
const cacheLpkDir = path.join(cacheDir, "lpk");
const cacheLockFile = path.join(cacheDir, "lpk-cache.lock.json");
const cacheSchema = 1;

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
  await copyFile(lpkFile, path.join(cacheLpkDir, cacheFile));

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
      } else {
        throw new Error(`${id}.build.type must be "content" or "command"`);
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
      name: repository.name ?? "LazyCat Third-party Repository",
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
