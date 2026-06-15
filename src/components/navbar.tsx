"use client";

import { Link } from "@heroui/react";

import { GithubIcon, Logo } from "@/components/icons";
import { siteConfig } from "@/config/site";
import { useI18n } from "@/i18n";

export const Navbar = () => {
  const { locale, setLocale, t } = useI18n();
  const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-[#dbe2ee] bg-white/90 backdrop-blur">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <a className="flex items-center gap-2 text-[#172033]" href="./">
          <Logo />
          <span className="font-semibold">{t("repositoryName")}</span>
        </a>

        <div className="flex items-center gap-4">
          <a
            className="hidden text-sm font-medium text-[#516076] transition-colors hover:text-[#0b5cad] sm:inline-flex"
            href="./build-script"
          >
            {t("buildScriptNav")}
          </a>
          <a
            className="hidden text-sm font-medium text-[#516076] transition-colors hover:text-[#0b5cad] sm:inline-flex"
            href={siteConfig.links.repository}
          >
            {t("indexJson")}
          </a>
          <button
            className="h-9 border border-[#cbd5e3] px-3 text-sm font-semibold text-[#36506f] transition hover:border-[#0b5cad] hover:text-[#0b5cad]"
            type="button"
            onClick={() => setLocale(nextLocale)}
          >
            {locale === "zh-CN" ? "EN" : "中"}
          </button>
          <Link
            aria-label="GitHub"
            href={siteConfig.links.github}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GithubIcon className="text-[#516076]" />
          </Link>
        </div>
      </header>
    </nav>
  );
};
