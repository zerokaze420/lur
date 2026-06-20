import { useEffect, useMemo, useState } from "react";
import { Card, Chip, Input, Link, ListBox, Select, Separator } from "@heroui/react";

import { useI18n } from "@/i18n";
import DefaultLayout from "@/layouts/default";

type ReleaseInfo = {
  tag: string;
  file: string;
  size: number;
  sha256: string;
  download_url: string;
};

type AppRelease = {
  key: string;
  version: string;
  source:
    | string
    | {
        type: "git";
        url: string;
        rev?: string;
        ref?: string;
      };
  release: ReleaseInfo;
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
  releases?: AppRelease[];
  source:
    | string
    | {
        type: "git";
        url: string;
        rev?: string;
        ref?: string;
      };
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
    name: "LazyCat 个人仓库",
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

function sourceHref(app: RepositoryApp, repositorySource: string) {
  if (app.homepage) {
    return app.homepage;
  }

  if (typeof app.source === "object" && app.source.type === "git") {
    return app.source.url;
  }

  return repositorySource;
}

function releaseSourceHref(release: AppRelease, fallbackSource: string) {
  if (typeof release.source === "object" && release.source.type === "git") {
    return release.source.url;
  }

  if (typeof release.source === "string") {
    return fallbackSource;
  }

  return fallbackSource;
}

function githubRepositoryName(source: string) {
  try {
    const url = new URL(source);

    if (url.hostname !== "github.com") {
      return source;
    }

    return url.pathname.replace(/^\/|\.git$|\/$/g, "");
  } catch {
    return source;
  }
}

export default function IndexPage() {
  const { locale, t } = useI18n();
  const [index, setIndex] = useState<RepositoryIndex>(fallbackIndex);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState("");
  const [selectedReleases, setSelectedReleases] = useState<Record<string, string>>({});

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

  const activeReleaseByApp = useMemo(() => {
    return Object.fromEntries(
      index.apps.map((app) => {
        const releases =
          app.releases && app.releases.length > 0
            ? app.releases
            : [
                {
                  key: "default",
                  version: app.version,
                  source: app.source,
                  release: app.release,
                },
              ];
        const selectedKey = selectedReleases[app.id];
        const active =
          releases.find((item) => item.key === selectedKey) ?? releases[0];

        return [app.id, active];
      }),
    );
  }, [index.apps, selectedReleases]);

  return (
    <DefaultLayout>
      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <Chip color="success" size="sm" variant="soft">
            {t("githubPagesRepository")}
          </Chip>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {t("builtFromYaml")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-default-600">
            {t("catalogDescription")}
          </p>
        </div>

        <Card className="self-start">
          <Card.Content>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-default-500">{t("repository")}</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {index.repository.name}
                </dd>
              </div>
              <div>
                <dt className="text-default-500">{t("githubRepository")}</dt>
                <dd className="mt-1 break-all font-mono font-medium text-foreground">
                  {githubRepositoryName(index.repository.source)}
                </dd>
              </div>
              <div>
                <dt className="text-default-500">{t("appCount")}</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {index.apps.length}
                </dd>
              </div>
              <div>
                <dt className="text-default-500">{t("generatedAt")}</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {new Date(index.repository.generated_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </Card.Content>
        </Card>
      </section>

      <section className="mt-10">
        <Separator />
        <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {t("packages")}
            </h2>
            {loadError ? (
              <p className="mt-1 text-sm text-warning-700">{loadError}</p>
            ) : (
              <p className="mt-1 text-sm text-default-500">
                {t("downloadsFromReleases")}
              </p>
            )}
          </div>
          <Input
            aria-label={t("searchPackages")}
            className="w-full sm:w-80"
            placeholder={t("searchPlaceholder")}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Separator />

        <div className="grid gap-4 pt-5">
          {filteredApps.map((app) => (
            <Card key={app.id}>
              <Card.Content className="grid gap-5 lg:grid-cols-[1fr_240px]">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-semibold text-foreground">
                      {app.locales?.[locale]?.name ?? app.name}
                    </h3>
                    <Chip size="sm" variant="secondary">
                      v{app.version}
                    </Chip>
                  </div>
                  <p className="mt-2 max-w-3xl text-default-600">
                    {app.locales?.[locale]?.description ??
                      (app.summary || app.description)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {app.categories.map((category) => (
                      <Chip key={category} color="accent" size="sm" variant="soft">
                        {category}
                      </Chip>
                    ))}
                  </div>
                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-default-500">{t("releaseVersion")}</dt>
                      <dd className="mt-1 text-foreground">
                        <Select
                          className="max-w-52"
                          selectedKey={activeReleaseByApp[app.id].key}
                          onSelectionChange={(value) => {
                            if (typeof value === "string") {
                              setSelectedReleases((current) => ({
                                ...current,
                                [app.id]: value,
                              }));
                            }
                          }}
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox aria-label={`${app.name} versions`}>
                              {(app.releases && app.releases.length > 0
                                ? app.releases
                                : [
                                    {
                                      key: "default",
                                      version: app.version,
                                      source: app.source,
                                      release: app.release,
                                    },
                                  ]
                              ).map((item) => (
                                <ListBox.Item id={item.key} key={item.key} textValue={item.version}>
                                  v{item.version}
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-default-500">{t("packageId")}</dt>
                      <dd className="mt-1 break-all font-mono text-foreground">
                        {app.package}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-default-500">SHA256</dt>
                      <dd className="mt-1 break-all font-mono text-foreground">
                        {shortSha(activeReleaseByApp[app.id].release.sha256)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-default-500">{t("minimumOs")}</dt>
                      <dd className="mt-1 text-foreground">
                        {app.min_os_version || t("unspecified")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-default-500">{t("size")}</dt>
                      <dd className="mt-1 text-foreground">
                        {formatBytes(
                          activeReleaseByApp[app.id].release.size,
                          t("pending"),
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex items-start gap-3 lg:flex-col">
                  <Link
                    className="inline-flex min-h-10 items-center rounded-medium bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    href={activeReleaseByApp[app.id].release.download_url}
                  >
                    {t("downloadLpk")}
                  </Link>
                  <Link
                    className="inline-flex min-h-10 items-center rounded-medium border border-default-300 px-4 text-sm font-semibold text-default-700"
                    href={releaseSourceHref(
                      activeReleaseByApp[app.id],
                      sourceHref(app, index.repository.source),
                    )}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("source")}
                  </Link>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>
    </DefaultLayout>
  );
}
