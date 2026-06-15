import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Locale = "zh-CN" | "en-US";

type Messages = Record<string, string>;

const messages: Record<Locale, Messages> = {
  "zh-CN": {
    appCount: "应用数",
    apps: "应用",
    builtFromYaml: "基于 YAML 和 GitHub Actions 发布 LazyCat 第三方应用。",
    catalogDescription:
      "修改 apps.yml 添加应用。工作流会手工生成 LPK 归档、发布 release 产物，并更新这个静态目录。",
    downloadLpk: "下载 LPK",
    downloadsFromReleases: "下载链接指向 GitHub Release 中的历史产物。",
    generatedAt: "生成时间",
    githubPagesRepository: "GitHub Pages 仓库",
    indexJson: "索引 JSON",
    localPreviewData: "正在使用本地预览数据，直到 repository.json 生成。",
    minimumOs: "最低系统版本",
    packageId: "包 ID",
    packages: "应用包",
    pending: "待生成",
    repository: "仓库",
    repositoryFooter: "LazyCat 第三方仓库",
    repositoryName: "LazyCat 第三方仓库",
    searchPlaceholder: "搜索应用、包名、分类",
    searchPackages: "搜索应用包",
    size: "大小",
    source: "源码",
    unspecified: "未指定",
  },
  "en-US": {
    appCount: "Apps",
    apps: "Apps",
    builtFromYaml:
      "Publish LazyCat third-party app releases with YAML and GitHub Actions.",
    catalogDescription:
      "Edit apps.yml to add packages. The workflow manually creates LPK archives, publishes release assets, and updates this static catalog.",
    downloadLpk: "Download LPK",
    downloadsFromReleases:
      "Downloads point to historical GitHub Release assets.",
    generatedAt: "Generated",
    githubPagesRepository: "GitHub Pages Repository",
    indexJson: "Index JSON",
    localPreviewData: "Using local preview data until repository.json exists.",
    minimumOs: "Minimum OS",
    packageId: "Package ID",
    packages: "Packages",
    pending: "pending",
    repository: "Repository",
    repositoryFooter: "LazyCat third-party repository",
    repositoryName: "LazyCat Repository",
    searchPlaceholder: "Search app, package, category",
    searchPackages: "Search packages",
    size: "Size",
    source: "Source",
    unspecified: "unspecified",
  },
};

const localeStorageKey = "lazycat-repository-locale";

function detectLocale(): Locale {
  if (typeof window === "undefined") {
    return "zh-CN";
  }

  const stored = window.localStorage.getItem(localeStorageKey);

  if (stored === "zh-CN" || stored === "en-US") {
    return stored;
  }

  return window.navigator.language.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en-US";
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof (typeof messages)["zh-CN"]) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(localeStorageKey, locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale: setLocaleState,
      t: (key) => messages[locale][key] ?? messages["zh-CN"][key],
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
