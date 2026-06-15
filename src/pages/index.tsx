import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/i18n";
import DefaultLayout from "@/layouts/default";

type ReleaseInfo = {
  tag: string;
  file: string;
  size: number;
  sha256: string;
  download_url: string;
};

type RepositoryApp = {
  id: string;
  package: string;
  name: string;
  version: string;
  description: string;
  summary: string;
  categories: string[];
  min_os_version: string;
  homepage: string;
  license: string;
  author: string;
  locales?: Record<string, { name?: string; description?: string }>;
  release: ReleaseInfo;
  source: string;
};

type RepositoryIndex = {
  schema: string;
  repository: {
    name: string;
    description: string;
    homepage: string;
    source: string;
    commit: string;
    run_number: string;
    generated_at: string;
  };
  apps: RepositoryApp[];
};

const fallbackIndex: RepositoryIndex = {
  schema: "cloud.lazycat.third-party-repository.v1",
  repository: {
    name: "LazyCat 第三方仓库",
    description: "基于 GitHub Pages 的 LazyCat 应用仓库。",
    homepage: "",
    source: "https://github.com/zerokaze420/lur",
    commit: "local",
    run_number: "local",
    generated_at: new Date().toISOString(),
  },
  apps: [
    {
      id: "hello-lazycat",
      package: "cloud.lazycat.app.hello-lazycat",
      name: "Hello LazyCat",
      version: "0.1.0",
      description: "不依赖 lzc-cli 手工打包的最小静态 LazyCat 应用。",
      summary: "不依赖 lzc-cli 构建的最小静态 LPK。",
      categories: ["demo", "static"],
      min_os_version: "1.5.0",
      homepage: "https://github.com/zerokaze420/lur",
      license: "MIT",
      author: "LazyCat Repository Maintainers",
      locales: {
        "zh-CN": {
          name: "Hello LazyCat",
          description: "不依赖 lzc-cli 的最小静态 LPK 示例。",
        },
        "en-US": {
          name: "Hello LazyCat",
          description: "Minimal static LPK example built without lzc-cli.",
        },
      },
      release: {
        tag: "hello-lazycat-v0.1.0",
        file: "hello-lazycat-0.1.0.lpk",
        size: 0,
        sha256: "generated-by-github-actions",
        download_url:
          "https://github.com/zerokaze420/lur/releases/download/hello-lazycat-v0.1.0/hello-lazycat-0.1.0.lpk",
      },
      source: "apps/hello-lazycat",
    },
  ],
};

function formatBytes(bytes: number, pendingLabel: string) {
  if (!bytes) {
    return pendingLabel;
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function shortSha(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

export default function IndexPage() {
  const { locale, t } = useI18n();
  const [index, setIndex] = useState<RepositoryIndex>(fallbackIndex);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("./repository.json", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`repository.json returned ${response.status}`);
        }

        return response.json() as Promise<RepositoryIndex>;
      })
      .then(setIndex)
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setLoadError(t("localPreviewData"));
        }
      });

    return () => controller.abort();
  }, [t]);

  const filteredApps = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return index.apps;
    }

    return index.apps.filter((app) => {
      return [
        app.locales?.[locale]?.name ?? app.name,
        app.package,
        app.summary,
        app.locales?.[locale]?.description ?? app.description,
        ...app.categories,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [index.apps, locale, query]);

  return (
    <DefaultLayout>
      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#1f7a56]">
            {t("githubPagesRepository")}
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-[#172033] sm:text-5xl">
            {t("builtFromYaml")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5a687d]">
            {t("catalogDescription")}
          </p>
        </div>

        <aside className="self-start border border-[#dbe2ee] bg-white p-5 shadow-sm">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-[#65738a]">{t("repository")}</dt>
              <dd className="mt-1 font-medium text-[#172033]">
                {index.repository.name}
              </dd>
            </div>
            <div>
              <dt className="text-[#65738a]">{t("appCount")}</dt>
              <dd className="mt-1 font-medium text-[#172033]">
                {index.apps.length}
              </dd>
            </div>
            <div>
              <dt className="text-[#65738a]">{t("generatedAt")}</dt>
              <dd className="mt-1 font-medium text-[#172033]">
                {new Date(index.repository.generated_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="mt-10">
        <div className="flex flex-col gap-3 border-y border-[#dbe2ee] py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#172033]">
              {t("packages")}
            </h2>
            {loadError ? (
              <p className="mt-1 text-sm text-[#8a5c00]">{loadError}</p>
            ) : (
              <p className="mt-1 text-sm text-[#65738a]">
                {t("downloadsFromReleases")}
              </p>
            )}
          </div>
          <input
            aria-label={t("searchPackages")}
            className="h-11 w-full border border-[#cbd5e3] bg-white px-3 text-sm outline-none transition focus:border-[#0b5cad] sm:w-80"
            placeholder={t("searchPlaceholder")}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="divide-y divide-[#dbe2ee]">
          {filteredApps.map((app) => (
            <article
              key={app.id}
              className="grid gap-5 py-6 lg:grid-cols-[1fr_240px]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-semibold text-[#172033]">
                    {app.locales?.[locale]?.name ?? app.name}
                  </h3>
                  <span className="border border-[#b9c7d9] px-2 py-1 text-xs font-medium text-[#516076]">
                    v{app.version}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-[#5a687d]">
                  {app.locales?.[locale]?.description ??
                    (app.summary || app.description)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {app.categories.map((category) => (
                    <span
                      key={category}
                      className="bg-[#eaf1f8] px-2.5 py-1 text-xs font-medium text-[#36506f]"
                    >
                      {category}
                    </span>
                  ))}
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[#65738a]">{t("packageId")}</dt>
                    <dd className="mt-1 break-all font-mono text-[#172033]">
                      {app.package}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#65738a]">SHA256</dt>
                    <dd className="mt-1 break-all font-mono text-[#172033]">
                      {shortSha(app.release.sha256)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#65738a]">{t("minimumOs")}</dt>
                    <dd className="mt-1 text-[#172033]">
                      {app.min_os_version || t("unspecified")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#65738a]">{t("size")}</dt>
                    <dd className="mt-1 text-[#172033]">
                      {formatBytes(app.release.size, t("pending"))}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex items-start gap-3 lg:flex-col">
                <a
                  className="inline-flex h-11 items-center justify-center bg-[#0b5cad] px-5 text-sm font-semibold text-white transition hover:bg-[#084b8d]"
                  href={app.release.download_url}
                >
                  {t("downloadLpk")}
                </a>
                <a
                  className="inline-flex h-11 items-center justify-center border border-[#b9c7d9] px-5 text-sm font-semibold text-[#284158] transition hover:border-[#0b5cad] hover:text-[#0b5cad]"
                  href={app.homepage || index.repository.source}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t("source")}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DefaultLayout>
  );
}
