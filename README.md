# LazyCat 第三方仓库

这是一个基于 GitHub Actions 和 GitHub Pages 的 LazyCat 第三方 LPK
仓库模板。

应用列表维护在 `apps.yml`。每个应用源码目录包含 LazyCat 运行配置和静态内容：

```text
apps/<app-id>/
├── manifest.yml
├── package.yml
└── content/
```

工作流不使用 `lzc-cli`，而是直接按 LPK tar 结构手工打包：

```text
release.lpk
├── manifest.yml
├── package.yml
└── content.tar
```

## 工作方式

1. 修改 `apps.yml`，添加应用条目。
2. 在 `apps/<app-id>/` 下添加应用文件。
3. 推送到 `main`，或手动运行 GitHub Actions。
4. GitHub Actions 在 `build/lpk` 下生成 `.lpk` 文件。
5. 每个 `.lpk` 会上传到类似 `<app-id>-v<version>` 的 GitHub Release。
6. 静态前端和 `repository.json` 会部署到 GitHub Pages。
7. 前端下载按钮指向 GitHub Release 历史产物，所以只要 release tag
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
  - id: hello-lazycat
    source: apps/hello-lazycat
    summary: 不依赖 lzc-cli 构建的最小静态 LPK。
    categories:
      - demo
```

每个应用的 `package.yml` 提供静态元数据，例如 package id、版本、名称、
描述、作者、许可证、主页和最低系统版本。`manifest.yml` 提供 LazyCat
运行路由。

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

创建新的应用目录：

```text
apps/my-app/
├── manifest.yml
├── package.yml
└── content/web/index.html
```

把它加入 `apps.yml`：

```yml
apps:
  - id: my-app
    source: apps/my-app
    summary: 我的 LazyCat 应用。
    categories:
      - utility
```

对于纯静态前端，把 `/` 路由到打包后的内容目录：

```yml
application:
  subdomain: my-app
  routes:
    - /=file:///lzcapp/pkg/content/web
```

每次需要生成新的 release tag 和历史下载项时，递增
`apps/my-app/package.yml` 里的 `version`。

### 添加命令构建的 LPK

如果应用本身已经能生成完整 `.lpk`，例如包含镜像、`lzc-build.yml` 或 Nix
构建产物，不要使用默认的 content-only 打包。把源码放到 `apps/<app-id>/`
后，在 `apps.yml` 中配置命令构建：

```yml
apps:
  - id: attic
    source: apps/attic
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

`command` 推荐使用字符串数组，避免 shell 转义差异；也可以写成字符串。构建命令
会在应用源码目录内执行。`artifact` 必须匹配唯一一个 `.lpk`，脚本会把它复制到
`build/lpk/<app-id>-<version>.lpk`，再计算大小、SHA256 并写入
`dist/repository.json`。

## 说明

- 当前手工构建器支持 content-only LPK。
- 带镜像或自定义构建流程的 LPK 可以使用 `build.type: command`，交给应用自己的
  Nix 或 lzc-cli 构建流程生成完整 `.lpk`。
- Release asset URL 是确定的：
  `https://github.com/<owner>/<repo>/releases/download/<app-id>-v<version>/<app-id>-<version>.lpk`.

## 许可证

MIT
