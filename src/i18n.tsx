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
    buildScriptDescription:
      "这里说明 scripts/lazycat-repository.mjs 如何读取 apps.yml、拉取源码、构建 LPK，并生成给 GitHub Pages 使用的仓库索引。",
    buildScriptExample: "远程 Git 应用示例",
    buildScriptEyebrow: "构建流程",
    buildScriptFiles: "相关文件",
    buildScriptNav: "构建脚本",
    buildScriptTitle: "构建脚本如何把应用变成可发布的 LPK。",
    builtFromYaml: "LazyCat 第三方应用仓库。",
    catalogDescription:
      "这里收录可安装到 LazyCat 微服的第三方应用。你可以浏览应用信息、查看版本，并下载对应的 LPK 安装包。",
    downloadLpk: "下载 LPK",
    downloadsFromReleases: "选择需要的应用，下载对应版本的 LPK 安装包。",
    docsNav: "文档",
    generatedAt: "生成时间",
    githubPagesRepository: "第三方仓库",
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
    buildScriptDescription:
      "This page explains how scripts/lazycat-repository.mjs reads apps.yml, checks out sources, builds LPKs, and writes the repository index used by GitHub Pages.",
    buildScriptExample: "Remote Git App Example",
    buildScriptEyebrow: "Build Flow",
    buildScriptFiles: "Files",
    buildScriptNav: "Build Script",
    buildScriptTitle: "How the build script turns apps into publishable LPKs.",
    builtFromYaml: "LazyCat third-party app repository.",
    catalogDescription:
      "Browse third-party apps for LazyCat, review app details and versions, and download the matching LPK package.",
    downloadLpk: "Download LPK",
    downloadsFromReleases: "Choose an app and download the matching LPK package.",
    docsNav: "Docs",
    generatedAt: "Generated",
    githubPagesRepository: "Third-party Repository",
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
