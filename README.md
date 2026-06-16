# LazyCat 第三方仓库

这是一个基于 GitHub Actions 和 GitHub Pages 的 LazyCat 第三方 LPK
仓库模板。

应用列表维护在 `apps.yml`。默认推荐引用远程 Git 源码并固定 commit `rev`，
构建脚本会在 GitHub Actions 中拉取源码、执行应用自己的构建命令、收集 `.lpk`
产物并生成仓库索引。

## 工作方式

1. 在应用自己的仓库中准备 LazyCat 打包配置，并保证能生成 `.lpk`。
2. Fork 本仓库，修改 `apps.yml`，添加远程 Git source 和构建命令。
3. 提交分支并向本仓库发起 Pull Request。
4. PR 合并到 `main` 后，GitHub Actions 自动构建 LPK 和仓库索引。
5. GitHub Actions 在 `build/lpk` 下生成 `.lpk` 文件。
6. 每个 `.lpk` 会上传到类似 `<app-id>-v<version>` 的 GitHub Release。
7. 静态前端和 `repository.json` 会部署到 GitHub Pages。
8. 前端下载按钮指向 GitHub Release 历史产物，所以只要 release tag
   存在，旧版本也能继续下载。

## 配置

发布前先修改 `apps.yml`：

```yml
repository:
  name: LazyCat 第三方仓库
  description: 基于 GitHub Pages 的 LazyCat 应用仓库。
  homepage: https://<owner>.github.io/<repo>/
  owner: <owner>
  repo: <repo>
apps:
  - id: attic
    source:
      git: https://github.com/zerokaze420/lazy-attic.git
      rev: 402385eb48c8af545dda8099c65f8d3ef19eaf38
    summary: 带轻量 Web 控制台的 Nix 二进制缓存服务器。
    categories:
      - developer
      - cache
      - nix
    build:
      type: command
      command:
        - nix
        - build
        - .#lpk
      artifact: result/*.lpk
```

每个应用的 `package.yml` 提供静态元数据，例如 package id、版本、名称、
描述、作者、许可证、主页和最低系统版本。对于远程 Git source，这些文件来自
被拉取的应用仓库。

## 本地开发

使用 `flake.nix` 提供的 Nix 开发环境：

```bash
nix develop
bun install
bun run build
bun run build:lpk
bun run dev
```

`bun run build:lpk` 会生成：

- `build/lpk/*.lpk`
- `dist/repository.json`
- `dist/apps.yml`

`bun run build` 会在 `dist/` 中生成 GitHub Pages 前端。因为 Vite 构建会清空
`dist/`，完整发布验证时请先运行 `bun run build`，再运行
`bun run build:lpk`，这样 `repository.json` 会保留在最终 Pages 目录里。

## GitHub 设置

在仓库设置中启用 GitHub Pages，并把来源设置为 GitHub Actions。工作流文件是
`.github/workflows/pages-and-release.yml`。提交到 `main` 后会自动构建 LPK、
创建/更新 GitHub Release，并部署 GitHub Pages；也可以在 Actions 页面手动触发。

如果希望 workflow 自动启用 GitHub Pages，需要在仓库 secrets 里添加
`PAGES_TOKEN`。这个 token 不能是默认 `GITHUB_TOKEN`，需要具备仓库 Pages
写入权限；否则请在 GitHub 仓库设置中手动启用 Pages，并选择 GitHub Actions
作为来源。

工作流已经声明需要的权限：

- `contents: write`：创建 release tag 和上传 release asset
- `pages: write`：部署 GitHub Pages
- `id-token: write`：GitHub Pages 部署身份

## 添加应用

默认使用方案 B：**远程 Git source + 固定 commit rev + PR 合并后自动构建**。
这样本仓库不用 vendor 一整份源码，也不用 Git submodule，构建输入仍然可追踪。

### 1. 准备应用仓库

应用仓库需要能独立生成完整 `.lpk`。推荐提供：

```text
my-app/
├── package.yml
├── lzc-manifest.yml
├── lzc-build.yml
├── flake.nix
└── ...
```

例如应用仓库中可以用 Nix 构建：

```bash
nix build .#lpk
```

构建成功后应能在 `result/*.lpk` 找到唯一一个 LPK 文件。

### 2. 固定源码 commit

不要直接引用浮动分支作为发布输入。先取得应用仓库当前 commit：

```bash
git ls-remote --heads https://github.com/<owner>/<app-repo>.git main
```

输出第一列就是 `rev`。例如：

```text
402385eb48c8af545dda8099c65f8d3ef19eaf38 refs/heads/main
```

### 3. Fork 并创建分支

在 GitHub 页面点击 Fork，然后克隆自己的 fork：

```bash
git clone git@github.com:<your-name>/lur.git
cd lur
git switch -c add-my-app
```

进入 Nix 开发环境并安装依赖：

```bash
nix develop
bun install
```

### 4. 修改 apps.yml

在 `apps.yml` 的 `apps:` 下添加应用：

```yml
apps:
  - id: my-app
    source:
      git: https://github.com/<owner>/<app-repo>.git
      rev: <固定 commit sha>
    summary: 我的 LazyCat 应用。
    categories:
      - utility
    build:
      type: command
      command:
        - nix
        - build
        - .#lpk
      artifact: result/*.lpk
```

字段说明：

- `id`：仓库内应用 ID，也会用于 release tag 和文件名。
- `source.git`：应用源码仓库。
- `source.rev`：固定 commit，推荐必填，保证构建可复现。
- `summary`：仓库页面上的短说明。
- `categories`：搜索和分类标签。
- `build.type`：`content` 会打包静态内容；`command` 会执行应用自己的构建命令；
  `lzc` 会读取应用仓库的 `lzc-build.yml`，内嵌服务镜像并手工打包 LPK。
- `build.command`：在应用源码目录内执行的构建命令。
- `build.artifact`：构建完成后匹配 `.lpk` 的路径，必须匹配唯一文件。

`build.type: lzc` 的应用需要在应用仓库里直接维护可构建的
`lzc-build.yml` 和 manifest。manifest 中的 `services.*.image` 必须使用 GitHub
Actions 可匿名拉取的公开镜像，并固定到明确版本标签或 digest；不要引用个人账号下的
私有 registry 镜像，也不要依赖本仓库在打包时替换镜像。需要更新镜像时，先在应用仓库
提交 manifest 变更，再把本仓库 `apps.yml` 的 `source.rev` 更新到新的提交。

### 5. 本地验证

先验证前端：

```bash
bun run build
```

再验证 LPK 和仓库索引：

```bash
bun run build:lpk
```

`bun run build:lpk` 会生成：

- `build/lpk/*.lpk`
- `dist/repository.json`
- `dist/apps.yml`

如果应用构建依赖远程 Nix builder、Docker registry 或外部缓存，本地网络和
builder DNS 也必须可用。

### 6. 提交并发起 PR

```bash
git add apps.yml
git commit -m "Add my-app"
git push origin add-my-app
```

在 GitHub 上从 fork 的 `add-my-app` 分支向本仓库 `main` 发起 Pull Request。
PR 描述建议包含：

- 应用仓库链接。
- 固定的 `rev`。
- 本地执行 `bun run build` 和 `bun run build:lpk` 的结果。
- 应用用途、权限和持久化目录说明。

### 7. 自动构建和发布

PR 合并后，`.github/workflows/pages-and-release.yml` 会在 `main` 上自动运行：

1. 安装 Bun 和 Nix。
2. 执行 `bun install --frozen-lockfile`。
3. 执行 `bun run build` 构建 GitHub Pages 前端。
4. 执行 `bun run build:lpk` 拉取远程源码、构建 LPK、生成 `repository.json`。
5. 上传 `build/lpk/*.lpk` 为 GitHub Actions artifact。
6. 按应用矩阵创建或更新 GitHub Release，并上传 `.lpk`。
7. 部署 `dist/` 到 GitHub Pages。

Release tag 和文件名由 `apps.yml` 的 `id` 与应用 `package.yml` 的 `version`
决定：

```text
tag: <app-id>-v<version>
file: <app-id>-<version>.lpk
```

每次需要生成新的 release tag 和历史下载项时，递增应用仓库 `package.yml` 里的
`version`，更新 `apps.yml` 的 `source.rev`，再提交新的 PR。

### 本地 content-only 应用

纯静态示例或极小应用也可以继续放在本仓库 `apps/<app-id>/` 下，由脚本手工打包。
目录结构：

```text
apps/my-static-app/
├── manifest.yml
├── package.yml
└── content/web/index.html
```

配置：

```yml
apps:
  - id: my-static-app
    source: apps/my-static-app
    summary: 我的静态 LazyCat 应用。
    categories:
      - static
```

对于纯静态前端，把 `/` 路由到打包后的内容目录：

```yml
application:
  subdomain: my-static-app
  routes:
    - /=file:///lzcapp/pkg/content/web
```

## 说明

- 当前手工构建器支持 content-only LPK，也支持 `build.type: lzc` 从
  `lzc-build.yml` 打包 `manifest`、`package.yml`、`contentdir`、`icon` 和
  `lzc-deploy-params.yml`，并把 `services.*.image` 指向的远程镜像转为包内
  `images/` + `images.lock`。
- 所有 LPK 在写入仓库索引前都会校验：`services.*.image` 必须是
  `embed:<alias>@sha256:<digest>`，且 digest 必须能在包内 OCI blobs 找到。
- 自定义构建流程的 LPK 可以使用 `build.type: command`，交给应用自己的 Nix
  构建流程生成完整 `.lpk`，但产物仍必须通过内嵌镜像校验。
- Release asset URL 是确定的：
  `https://github.com/<owner>/<repo>/releases/download/<app-id>-v<version>/<app-id>-<version>.lpk`.

## 许可证

MIT
