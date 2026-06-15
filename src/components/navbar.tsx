"use client";

import { Button, Link, Separator } from "@heroui/react";

import { GithubIcon, Logo } from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";
import { siteConfig } from "@/config/site";
import { useI18n } from "@/i18n";

export const Navbar = () => {
  const { locale, setLocale, t } = useI18n();
  const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";

  return (
    <nav className="sticky top-0 z-40 w-full bg-content1/90 backdrop-blur">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2 text-foreground" href="#/">
          <Logo />
          <span className="font-semibold">{t("repositoryName")}</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            className="hidden text-sm font-medium text-default-600 sm:inline-flex"
            href="#/docs"
          >
            {t("docsNav")}
          </Link>
          <Link
            className="hidden text-sm font-medium text-default-600 sm:inline-flex"
            href="#/build-script"
          >
            {t("buildScriptNav")}
          </Link>
          <Link
            className="hidden text-sm font-medium text-default-600 sm:inline-flex"
            href={siteConfig.links.repository}
          >
            {t("indexJson")}
          </Link>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setLocale(nextLocale)}
          >
            {locale === "zh-CN" ? "EN" : "中"}
          </Button>
          <ThemeSwitch />
          <Link
            aria-label="GitHub"
            href={siteConfig.links.github}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GithubIcon className="text-default-600" />
          </Link>
        </div>
      </header>
      <Separator />
    </nav>
  );
};
