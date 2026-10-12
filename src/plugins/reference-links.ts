import type { Element, ElementContent, Root, RootContent } from "hast";

// Turns each bibliography entry into a link to its URL, replacing the plain-text URL with an icon,
// and points in-text citations to the paper's PDF when one is openly available.
const TRAILING_URL = /\s*(https?:\/\/\S+)\s*$/;

const ICON_PATHS = [
  "M15 3h6v6",
  "M10 14 21 3",
  "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
];

const externalIcon = (): Element => ({
  type: "element",
  tagName: "svg",
  properties: {
    viewBox: "0 0 24 24",
    width: "0.85em",
    height: "0.85em",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ariaHidden: "true",
  },
  children: ICON_PATHS.map(
    (d): Element => ({
      type: "element",
      tagName: "path",
      properties: { d },
      children: [],
    }),
  ),
});

// CSL title-cases journal names, giving "arXiv Preprint arXiv:2605.21654".
const ARXIV = /arXiv Preprint arXiv:\s*(\S+)/g;

function formatArxiv(node: Element) {
  for (const child of node.children) {
    if (child.type === "text") {
      child.value = child.value.replace(ARXIV, "arXiv preprint: $1");
    } else if (child.type === "element") {
      formatArxiv(child);
    }
  }
}

// PDF locations for publishers with predictable URLs; other references open their landing page.
const PDF_RULES: [RegExp, string][] = [
  [/^https:\/\/arxiv\.org\/abs\/(.+)$/, "https://arxiv.org/pdf/$1"],
  [/^https:\/\/openreview\.net\/forum\?id=(.+)$/, "https://openreview.net/pdf?id=$1"],
  [/^https:\/\/proceedings\.mlr\.press\/(v\d+)\/([^/]+)\.html$/, "https://proceedings.mlr.press/$1/$2/$2.pdf"],
  [/^https:\/\/jmlr\.org\/papers\/v(\d+)\/([^/]+)\.html$/, "https://jmlr.org/papers/volume$1/$2/$2.pdf"],
  [/^(https:\/\/proceedings\.neurips\.cc\/paper\/\d+)\/hash\/(\w+)-Abstract\.html$/, "$1/file/$2-Paper.pdf"],
];

function pdfUrl(url: string) {
  for (const [pattern, replacement] of PDF_RULES) {
    if (pattern.test(url)) return url.replace(pattern, replacement);
  }
  return url;
}

function linkEntry(entry: Element, urls: Map<string, string>) {
  formatArxiv(entry);
  const last = entry.children.at(-1);
  if (last?.type !== "text") return;
  const match = last.value.match(TRAILING_URL);
  if (!match || match.index === undefined) return;
  if (typeof entry.properties.id === "string") urls.set(entry.properties.id, match[1]);
  // Keep the icon on the same line as the final word of the entry.
  const text = last.value.slice(0, match.index);
  const split = text.search(/\S+$/);
  last.value = split > 0 ? text.slice(0, split) : "";
  const tail = split >= 0 ? text.slice(split) : text;
  const tailSpan: ElementContent = {
    type: "element",
    tagName: "span",
    properties: { className: ["reference-link-tail"] },
    children: [{ type: "text", value: `${tail}\u00a0` }, externalIcon()],
  };
  // The whole entry becomes one link, and the icon marks it as external.
  entry.children = [
    {
      type: "element",
      tagName: "a",
      properties: {
        href: match[1],
        className: ["reference-link"],
        target: "_blank",
        rel: ["noopener", "noreferrer"],
      },
      children: [...entry.children, tailSpan],
    },
  ];
}

// MDX components such as <Aside> are not hast elements, but their children still hold citations.
const hasChildren = (node: Root | RootContent): node is Root | Element =>
  "children" in node && Array.isArray(node.children);

function linkEntries(node: Root | RootContent, urls: Map<string, string>) {
  if (!hasChildren(node)) return;
  const className = node.type === "element" ? node.properties.className : undefined;
  if (Array.isArray(className) && className.includes("csl-entry")) {
    linkEntry(node as Element, urls);
    return;
  }
  for (const child of node.children as RootContent[]) linkEntries(child, urls);
}

// rehype-citation links each citation to "#bib-<key>" in the reference list.
function linkCitations(node: Root | RootContent, urls: Map<string, string>) {
  if (!hasChildren(node)) return;
  const href = node.type === "element" && node.tagName === "a" ? node.properties.href : undefined;
  const url = typeof href === "string" && href.startsWith("#") ? urls.get(href.slice(1)) : undefined;
  if (node.type === "element" && url) {
    node.properties.href = pdfUrl(url);
    node.properties.target = "_blank";
    node.properties.rel = ["noopener", "noreferrer"];
    return;
  }
  for (const child of node.children as RootContent[]) linkCitations(child, urls);
}

export function rehypeReferenceLinks() {
  return (tree: Root) => {
    const urls = new Map<string, string>();
    linkEntries(tree, urls);
    linkCitations(tree, urls);
  };
}
