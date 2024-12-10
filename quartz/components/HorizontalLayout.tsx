import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

export default ((component?: QuartzComponent, ...components: QuartzComponent[]) => {
  const allComponents = component ? [component, ...components] : components

  if (allComponents.length > 0) {
    const HorizontalLayout: QuartzComponent = (props: QuartzComponentProps) => {
      return (
        <div id="horizontalLayout" style={{ display: "flex", flexDirection: "row" , justifyContent: "space-between"}}>
          {allComponents.map((Component, index) => (
            <Component key={index} {...props} />
          ))}
        </div>
      )
    }

    HorizontalLayout.displayName = "HorizontalLayout"

    HorizontalLayout.afterDOMLoaded = allComponents
      .map(component => component?.afterDOMLoaded)
      .filter(Boolean)
      .join(" ")

    HorizontalLayout.beforeDOMLoaded = allComponents
      .map(component => component?.beforeDOMLoaded)
      .filter(Boolean)
      .join(" ")

    HorizontalLayout.css = allComponents.reduce((acc, component) => acc + (component?.css || ""), "")

    return HorizontalLayout
  } else {
    return () => <></>
  }
}) satisfies QuartzComponentConstructor