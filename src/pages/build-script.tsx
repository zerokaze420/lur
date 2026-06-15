import { Card, Chip, Code, Separator } from "@heroui/react";

import DefaultLayout from "@/layouts/default";
import { useI18n } from "@/i18n";

const zhSections = [
  {
    title: "输入配置",
    body: "构建脚本读取 apps.yml。每个应用必须有 id、source、summary 和 categories，元数据来自应用目录里的 package.yml。",
    items: [
      "source 可以是本地路径，例如 apps/hello-lazycat。",
      "source 也可以是远程 Git 对象，使用 git 加固定 rev 或 ref。",
      "固定 rev 更适合发布仓库，因为每次构建会拉取同一个提交。",
    ],
  },
  {
    title: "构建模式",
    body: "build.type 决定脚本怎样生成 LPK。未配置时默认使用 content 模式。",
    items: [
      "content 模式会把 manifest.yml、package.yml 和 content/ 打包成 LPK。",
      "command 模式会在源码目录执行指定命令，再从 artifact 匹配唯一一个 .lpk。",
      "command 推荐写成字符串数组，避免 shell 转义和 CI 环境差异。",
    ],
  },
  {
    title: "输出产物",
    body: "每个应用构建完成后都会统一复制到 build/lpk，并写入 dist/repository.json。",
    items: [
      "release tag 使用 <app-id>-v<version>。",
      "release 文件名使用 <app-id>-<version>.lpk。",
      "索引会记录 size、sha256 和 GitHub Release 下载地址。",
    ],
  },
];

const zhPipeline = [
  {
    title: "读取仓库清单",
    body: "脚本先解析 apps.yml，校验每个应用的 id、source、summary、categories 与 build 字段，形成后续构建使用的标准应用描述。",
  },
  {
    title: "准备源码目录",
    body: "本地 source 直接解析为仓库内目录；远程 Git source 会 clone 到临时构建目录，并 checkout 到固定 rev 或 ref，保证输入可复现。",
  },
  {
    title: "生成或收集 LPK",
    body: "content 模式把 manifest.yml、package.yml 和 content/ 压成 LPK；command 模式执行配置的命令，再用 artifact glob 找到唯一 LPK。",
  },
  {
    title: "计算发布元数据",
    body: "脚本读取 package.yml 里的版本和展示信息，计算 LPK 的 size 与 sha256，并按 <app-id>-v<version> 生成 Release tag。",
  },
  {
    title: "写入静态索引",
    body: "所有 LPK 复制到 build/lpk 后，脚本生成 dist/repository.json。GitHub Pages 只需要托管这个 JSON，下载地址指向 GitHub Release。",
  },
];

const enSections = [
  {
    title: "Input Config",
    body: "The build script reads apps.yml. Each app needs id, source, summary and categories, while package metadata comes from package.yml in the app source.",
    items: [
      "source can be a local path such as apps/hello-lazycat.",
      "source can also be a remote Git object with git plus a pinned rev or ref.",
      "Pinned rev is preferred for publishing because each build checks out the same commit.",
    ],
  },
  {
    title: "Build Modes",
    body: "build.type controls how the script creates the LPK. When omitted, content mode is used.",
    items: [
      "content mode packs manifest.yml, package.yml and content/ into an LPK.",
      "command mode runs a configured command in the source directory, then matches exactly one .lpk from artifact.",
      "command is best written as a string array to avoid shell quoting and CI differences.",
    ],
  },
  {
    title: "Outputs",
    body: "After each app is built, the script copies it into build/lpk and writes dist/repository.json.",
    items: [
      "Release tags use <app-id>-v<version>.",
      "Release files use <app-id>-<version>.lpk.",
      "The index records size, sha256 and the GitHub Release download URL.",
    ],
  },
];

const enPipeline = [
  {
    title: "Read The Catalog",
    body: "The script parses apps.yml, validates id, source, summary, categories and build fields, then normalizes each app into the internal build description.",
  },
  {
    title: "Prepare Source",
    body: "Local sources resolve to repository paths. Remote Git sources are cloned into a temporary build directory and checked out to the pinned rev or ref for reproducible input.",
  },
  {
    title: "Create Or Collect LPK",
    body: "content mode zips manifest.yml, package.yml and content/ into an LPK. command mode runs the configured command, then finds exactly one LPK through the artifact glob.",
  },
  {
    title: "Compute Release Metadata",
    body: "The script reads version and display metadata from package.yml, computes size and sha256, and derives the Release tag as <app-id>-v<version>.",
  },
  {
    title: "Write Static Index",
    body: "After LPKs are copied into build/lpk, the script writes dist/repository.json. GitHub Pages hosts the JSON while downloads point to GitHub Release assets.",
  },
];

const configExample = `apps:
  - id: attic
    source:
      git: https://github.com/zerokaze420/lazy-attic.git
      rev: 402385eb48c8af545dda8099c65f8d3ef19eaf38
    summary: Nix binary cache server with a lightweight web console.
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
      artifact: result/*.lpk`;

export default function BuildScriptPage() {
  const { locale, t } = useI18n();
  const isZh = locale === "zh-CN";
  const sections = isZh ? zhSections : enSections;
  const pipeline = isZh ? zhPipeline : enPipeline;

  return (
    <DefaultLayout>
      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <Chip color="success" size="sm" variant="soft">
            {t("buildScriptEyebrow")}
          </Chip>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {t("buildScriptTitle")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-default-600">
            {t("buildScriptDescription")}
          </p>
        </div>

        <Card className="self-start">
          <Card.Header>
            <Card.Title className="text-sm uppercase tracking-[0.14em] text-default-600">
              {t("buildScriptFiles")}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <ul className="grid gap-3 text-sm">
              {[
                "apps.yml",
                "scripts/lazycat-repository.mjs",
                "dist/repository.json",
                "build/lpk/*.lpk",
              ].map((file) => (
                <li key={file}>
                  <Code>{file}</Code>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      </section>

      <section className="mt-10">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-foreground">
            {isZh ? "处理流程" : "Build Pipeline"}
          </h2>
          <p className="mt-2 max-w-3xl text-default-600">
            {isZh
              ? "核心原则是把发布输入固定下来，再把所有应用统一转换成 Release 产物和静态仓库索引。"
              : "The core idea is to pin publishing inputs, then normalize every app into Release assets and one static repository index."}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          {pipeline.map((step, index) => (
            <Card key={step.title}>
              <Card.Header>
                <Chip color="accent" size="sm" variant="soft">
                  {String(index + 1).padStart(2, "0")}
                </Chip>
              </Card.Header>
              <Card.Content>
                <Card.Title className="text-lg">{step.title}</Card.Title>
                <Card.Description className="mt-2 leading-6">
                  {step.body}
                </Card.Description>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6">
        {sections.map((section) => (
          <Card key={section.title}>
            <Card.Header>
              <Card.Title className="text-2xl">{section.title}</Card.Title>
            </Card.Header>
            <Card.Content>
              <p className="max-w-3xl leading-7 text-default-600">
                {section.body}
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-default-700">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Chip color="accent" size="sm" variant="soft">
                      -
                    </Chip>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card.Content>
          </Card>
        ))}
      </section>

      <section className="mt-10 py-6">
        <Separator />
        <h2 className="mt-6 text-2xl font-semibold text-foreground">
          {t("buildScriptExample")}
        </h2>
        <Card className="mt-4">
          <Card.Content>
            <pre className="overflow-x-auto text-sm leading-6">
              <Code className="block whitespace-pre bg-transparent p-0">
                {configExample}
              </Code>
            </pre>
          </Card.Content>
        </Card>
      </section>
    </DefaultLayout>
  );
}
