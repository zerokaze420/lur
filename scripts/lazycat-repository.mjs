import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import YAML from "yaml";

const root = process.cwd();
const distDir = path.join(root, "dist");
const lpkDir = path.join(root, "build", "lpk");
const workDir = path.join(root, "build", "manual-lpk");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`,
    );
  }

  return result.stdout.trim();
}

async function readYaml(file) {
  const text = await readFile(file, "utf8");
  return YAML.parse(text);
}

async function sha256File(file) {
  const data = await readFile(file);
  return createHash("sha256").update(data).digest("hex");
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

  await rm(lpkDir, { force: true, recursive: true });
  await rm(workDir, { force: true, recursive: true });
  await mkdir(lpkDir, { recursive: true });
  await mkdir(distDir, { recursive: true });

  const entries = [];

  for (const app of apps) {
    const id = requiredString(app.id, "apps[].id");
    const source = path.join(root, requiredString(app.source, `${id}.source`));
    const packageFile = path.join(source, "package.yml");
    const manifestFile = path.join(source, "manifest.yml");
    const contentDir = path.join(source, "content");
    const packageMeta = await readYaml(packageFile);
    const packageId = requiredString(packageMeta.package, `${id}.package`);
    const version = requiredString(packageMeta.version, `${id}.version`);
    const name = requiredString(packageMeta.name, `${id}.name`);
    const tag = `${id}-v${version}`;
    const fileName = `${id}-${version}.lpk`;
    const appWorkDir = path.join(workDir, id);
    const lpkFile = path.join(lpkDir, fileName);

    await rm(appWorkDir, { force: true, recursive: true });
    await mkdir(appWorkDir, { recursive: true });
    run("cp", [packageFile, path.join(appWorkDir, "package.yml")]);
    run("cp", [manifestFile, path.join(appWorkDir, "manifest.yml")]);
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

    const size = Number(run("wc", ["-c", lpkFile]).split(/\s+/)[0]);
    const sha256 = await sha256File(lpkFile);

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
      source: app.source,
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
  console.log(`built ${entries.length} LPK(s)`);
}

buildLpks().catch((error) => {
  console.error(error);
  process.exit(1);
});
