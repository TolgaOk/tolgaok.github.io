import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
    header: [Component.TopHead(), Component.Darkmode()],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}
// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    // Component.ArticleTitle(),
    Component.TagList(),
    
  ],
  left: [
    // Component.ContentMeta(),
    // Component.PageTitle(),
    Component.Search(),
    Component.MobileOnly(Component.Spacer()),
    
    // Component.DesktopOnly(Component.Graph()),
    // Component.DesktopOnly(Component.Backlinks()),
    Component.DesktopOnly(Component.Explorer()),
    // Component.Graph(),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    // Component.DesktopOnly(Component.TableOfContents()),
    // Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    // Component.ArticleTitle(),
    // Component.ContentMeta()
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    Component.DesktopOnly(Component.Explorer()),
  ],
  right: [],
}
