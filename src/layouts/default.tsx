import { Link, Separator } from "@heroui/react";

import { Navbar } from "@/components/navbar";
import { useI18n } from "@/i18n";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen flex-col bg-default-50 text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-grow px-5 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <Separator />
      <footer className="w-full bg-content1">
        <Link
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 text-sm text-default-500 sm:px-6 lg:px-8"
          href="./repository.json"
          rel="noopener noreferrer"
        >
          <span>{t("repositoryFooter")}</span>
          <span>repository.json</span>
        </Link>
      </footer>
    </div>
  );
}
