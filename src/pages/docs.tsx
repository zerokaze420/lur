import { Card, Chip, Code } from "@heroui/react";

import DefaultLayout from "@/layouts/default";
import { useI18n } from "@/i18n";

const zhSteps = [
  {
    title: "准备应用仓库",
    body: "应用仓库需要能独立生成完整 LPK。推荐提供 package.yml、lzc-manifest.yml、lzc-build.yml 和 flake.nix，并确保 nix build .#lpk 后 result/*.lpk 只匹配一个文件。",
  },
  {
    title: "固定源码提交",
    body: "不要直接引用浮动分支作为发布输入。使用 git ls-remote 取得目标仓库 main 分支当前 commit，把第一列写入 source.rev。",
  },
  {
    title: "Fork 并提交分支",
    body: "Fork 本仓库，创建 add-my-app 之类的分支，只修改 apps.yml。进入 nix develop 后执行 bun install，保证本地环境与 CI 接近。",
  },
  {
    title: "发起 Pull Request",
    body: "PR 描述里写清应用仓库链接、固定 rev、本地 build 结果、应用用途、权限和持久化目录。合并后 main 分支会自动构建和发布。",
  },
  {
    title: "自动构建发布",
    body: "GitHub Actions 会安装 Bun 和 Nix，执行 bun run build 与 bun run build:lpk，上传 LPK 到 Release，并部署 dist/ 到 GitHub Pages。",
  },
];

const enSteps = [
  {
    title: "Prepare The App Repository",
    body: "The app repository should build a complete LPK by itself. Provide package.yml, lzc-manifest.yml, lzc-build.yml and flake.nix, and make sure nix build .#lpk leaves exactly one file under result/*.lpk.",
  },
  {
    title: "Pin The Source Commit",
    body: "Do not use a floating branch as the publishing input. Use git ls-remote to read the current commit for the target main branch, then put the first column into source.rev.",
  },
  {
    title: "Fork And Branch",
    body: "Fork this repository, create a branch such as add-my-app, and only edit apps.yml. Enter nix develop and run bun install so local tooling matches CI closely.",
  },
  {
    title: "Open A Pull Request",
    body: "Include the app repository URL, pinned rev, local build result, app purpose, permissions and persistent data paths in the PR description. After merge, main builds and publishes automatically.",
  },
  {
    title: "Automatic Publishing",
    body: "GitHub Actions installs Bun and Nix, runs bun run build and bun run build:lpk, uploads LPK assets to Releases, and deploys dist/ to GitHub Pages.",
  },
];

const configExample = `apps:
  - id: my-app
    source:
      git: https://github.com/<owner>/<app-repo>.git
      rev: <fixed commit sha>
    summary: My LazyCat app.
    categories:
      - utility
    build:
      type: command
      command:
        - nix
        - build
        - .#lpk
      artifact: result/*.lpk`;

const commandsExample = `git ls-remote --heads https://github.com/<owner>/<app-repo>.git main
git clone git@github.com:<your-name>/lur.git
cd lur
git switch -c add-my-app
nix develop
bun install
bun run build
bun run build:lpk
git add apps.yml
git commit -m "Add my-app"
git push origin add-my-app`;

export default function DocsPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const steps = isZh ? zhSteps : enSteps;

  return (
    <DefaultLayout>
      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <Chip color="success" size="sm" variant="soft">
            {isZh ? "添加应用" : "Add Apps"}
          </Chip>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {isZh
              ? "默认使用远程 Git source，通过 PR 合并后自动构建。"
              : "Use remote Git sources by default and publish after PR merge."}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-default-600">
            {isZh
              ? "推荐方案 B：应用源码留在自己的仓库，本仓库只记录 Git URL、固定 rev 和构建命令。这样无需 vendor 源码，也不需要 submodule。"
              : "Recommended path B keeps app source in its own repository. This repository only records the Git URL, pinned rev and build command, without vendoring or submodules."}
          </p>
        </div>

        <Card className="self-start">
          <Card.Header>
            <Card.Title className="text-sm uppercase tracking-[0.14em] text-default-600">
              {isZh ? "发布产物" : "Published Artifacts"}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-default-500">Release tag</dt>
                <dd className="mt-1">
                  <Code>&lt;app-id&gt;-v&lt;version&gt;</Code>
                </dd>
              </div>
              <div>
                <dt className="text-default-500">LPK file</dt>
                <dd className="mt-1">
                  <Code>&lt;app-id&gt;-&lt;version&gt;.lpk</Code>
                </dd>
              </div>
              <div>
                <dt className="text-default-500">Index</dt>
                <dd className="mt-1">
                  <Code>dist/repository.json</Code>
                </dd>
              </div>
            </dl>
          </Card.Content>
        </Card>
      </section>

      <section className="mt-10 grid gap-6">
        {steps.map((step, index) => (
          <Card key={step.title}>
            <Card.Content className="grid gap-4 md:grid-cols-[96px_1fr]">
              <Chip color="accent" size="lg" variant="soft">
                {String(index + 1).padStart(2, "0")}
              </Chip>
              <div>
                <Card.Title className="text-2xl">{step.title}</Card.Title>
                <Card.Description className="mt-3 max-w-3xl leading-7">
                  {step.body}
                </Card.Description>
              </div>
            </Card.Content>
          </Card>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title className="text-2xl">
              {isZh ? "apps.yml 示例" : "apps.yml Example"}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <pre className="overflow-x-auto text-sm leading-6">
              <Code className="block whitespace-pre bg-transparent p-0">
                {configExample}
              </Code>
            </pre>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="text-2xl">
              {isZh ? "Fork 到 PR 命令" : "Fork To PR Commands"}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <pre className="overflow-x-auto text-sm leading-6">
              <Code className="block whitespace-pre bg-transparent p-0">
                {commandsExample}
              </Code>
            </pre>
          </Card.Content>
        </Card>
      </section>
    </DefaultLayout>
  );
}
