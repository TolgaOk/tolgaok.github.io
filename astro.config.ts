import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import mdx from "@astrojs/mdx";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeCitation from "rehype-citation";

import react from "@astrojs/react";

import astroExpressiveCode from "astro-expressive-code";
import { unified } from "@astrojs/markdown-remark";
import { pluginIPython } from "./src/plugins/ipython";

// https://astro.build/config
export default defineConfig({
  site: "https://tolgaok.github.io",
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        rehypeKatex,
        [
          rehypeCitation,
          {
            bibliography: "bibliography.bib",
            linkCitations: true,
          },
        ],
      ],
    }),
  },
  integrations: [
    icon(),
    astroExpressiveCode({
      plugins: [pluginIPython()],
      customizeTheme: (theme) => {
        const dark = theme.type === "dark";
        theme.colors["tab.activeBackground"] = dark ? "#22252A" : "#F6F7F8";
        theme.colors["editorGroupHeader.tabsBackground"] = dark
          ? "#2D3239"
          : "#E6E9ED";
        theme.colors["editorGroupHeader.tabsBorder"] = dark
          ? "#3B414A"
          : "#D7DCE2";
        theme.colors["titleBar.activeBackground"] = dark
          ? "#2D3239"
          : "#E6E9ED";
        theme.settings.push(
          {
            scope: ["meta.function-call.generic.python"],
            settings: { foreground: dark ? "#B392F0" : "#6F42C1" },
          },
          {
            scope: ["meta.attribute.python"],
            settings: { foreground: dark ? "#79B8FF" : "#005CC5" },
          },
        );
      },
      styleOverrides: {
        borderRadius: "0.5rem",
        borderWidth: "1px",
        borderColor: ({ theme }) =>
          theme.type === "dark" ? "#3B414A" : "#D7DCE2",
        codeBackground: ({ theme }) =>
          theme.type === "dark" ? "#22252A" : "#F6F7F8",
        frames: {
          shadowColor: "transparent",
          editorActiveTabIndicatorHeight: "0px",
        },
      },
      themeCssSelector: (theme) =>
        theme.type === "dark" ? `[data-theme="dark"]` : `[data-theme="light"]`,
    }),
    mdx(),
    react(),
  ],
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Noto Sans",
      cssVariable: "--font-noto-sans",
      weights: ["100 900"],
    },
  ],
  image: {
    responsiveStyles: true,
  },
});
