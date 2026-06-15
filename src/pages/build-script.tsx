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

  return (
    <DefaultLayout>
      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#1f7a56]">
            {t("buildScriptEyebrow")}
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-[#172033] sm:text-5xl">
            {t("buildScriptTitle")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5a687d]">
            {t("buildScriptDescription")}
          </p>
        </div>

        <aside className="self-start border border-[#dbe2ee] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#516076]">
            {t("buildScriptFiles")}
          </h2>
          <ul className="mt-4 grid gap-3 text-sm text-[#172033]">
            <li>
              <code>apps.yml</code>
            </li>
            <li>
              <code>scripts/lazycat-repository.mjs</code>
            </li>
            <li>
              <code>dist/repository.json</code>
            </li>
            <li>
              <code>build/lpk/*.lpk</code>
            </li>
          </ul>
        </aside>
      </section>

      <section className="mt-10 grid gap-6">
        {sections.map((section) => (
          <article
            key={section.title}
            className="border-t border-[#dbe2ee] pt-6"
          >
            <h2 className="text-2xl font-semibold text-[#172033]">
              {section.title}
            </h2>
            <p className="mt-3 max-w-3xl leading-7 text-[#5a687d]">
              {section.body}
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-[#36506f]">
              {section.items.map((item) => (
                <li key={item} className="border-l-2 border-[#8bb8dd] pl-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mt-10 border-y border-[#dbe2ee] py-6">
        <h2 className="text-2xl font-semibold text-[#172033]">
          {t("buildScriptExample")}
        </h2>
        <pre className="mt-4 overflow-x-auto bg-[#172033] p-5 text-sm leading-6 text-[#edf4fb]">
          <code>{configExample}</code>
        </pre>
      </section>
    </DefaultLayout>
  );
}
