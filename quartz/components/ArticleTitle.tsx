import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const title = fileData.frontmatter?.title
  if (title) {
    return (
      <h1 class={classNames(displayClass, "article-title")}>
        <p class="internal-alias">
          {title}
        </p>
      </h1>)
  } else {
    return null
  }
}

ArticleTitle.css = `
.article-title {
  margin: 2rem 0 0 0;
  font-size: 3rem;
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
