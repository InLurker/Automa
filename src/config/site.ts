import type { SidebarNavItem, SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
  name: "Automa",
  description:
    "A minimalist zen playground for interactive animations. Built with Astro v5 & shadcn/ui.",
  url: "https://astro-nomy-updated.vercel.app",
  ogImage: "https://astro-nomy-updated.vercel.app/og.jpg",
  links: {
    twitter: "https://twitter.com/dustinbturner",
    github: "https://github.com/dustinbturner/astro-nomy",
  },
};

export const footerLinks: SidebarNavItem[] = [
  {
    title: "Explore",
    items: [
      { title: "All Automa", href: "/explore" },
      { title: "Flow", href: "/explore#flow" },
      { title: "Structure", href: "/explore#structure" },
      { title: "Rhythm", href: "/explore#rhythm" },
    ],
  },
  {
    title: "Resources",
    items: [
      { title: "Blog", href: "/blog" },
      { title: "Documentation", href: "/docs/getting-started" },
      { title: "Guides", href: "/guides" },
    ],
  },
  {
    title: "Automa",
    items: [
      { title: "Drift", href: "/automa/drift" },
      { title: "Lattice", href: "/automa/lattice" },
      { title: "Pulse", href: "/automa/pulse" },
    ],
  },
];