import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.TopHead(), Component.Darkmode()],
  footer: Component.ShowIfIndex(Component.Footer()),
}
// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    // Component.ArticleTitle(),
    Component.TagList(),

  ],
  left: [
    Component.ShowIfIndex(Component.Hero("selfie.jpg")),
    Component.ShowIfNotIndex(Component.Search()),
    Component.ShowIfNotIndex(Component.MobileOnly(Component.Spacer())),

    Component.ShowIfNotIndex((Component.DesktopOnly(Component.Explorer()))),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    // Component.ShowIfNotIndex(Component.Graph()),
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
