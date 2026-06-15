import { Navbar } from "@/components/navbar";
import { useI18n } from "@/i18n";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen flex-col bg-[#f6f8fb] text-[#172033]">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-grow px-5 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="w-full border-t border-[#dbe2ee] bg-white">
        <a
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 text-sm text-[#65738a] no-underline sm:px-6 lg:px-8"
          href="./repository.json"
          rel="noopener noreferrer"
        >
          <span>{t("repositoryFooter")}</span>
          <span>repository.json</span>
        </a>
      </footer>
    </div>
  );
}
