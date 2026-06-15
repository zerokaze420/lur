export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "LazyCat 第三方仓库",
  description: "由 GitHub Actions 构建的 LazyCat 第三方应用包。",
  navItems: [
    {
      label: "应用",
      href: "/",
    },
    {
      label: "索引 JSON",
      href: "./repository.json",
    },
  ],
  navMenuItems: [],
  links: {
    github: "https://github.com/zerokaze420/lur",
    repository: "./repository.json",
  },
};
