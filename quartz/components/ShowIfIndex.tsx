import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

export default ((component?: QuartzComponent) => {
    if (component) {
        const Component = component
        const IndexOnly: QuartzComponent = (props: QuartzComponentProps) => {
            const slug = props.fileData.slug
            if (slug === "index") {
                return <Component {...props} />
            }
            return <div></div>
        }

        IndexOnly.displayName = component.displayName
        IndexOnly.afterDOMLoaded = component?.afterDOMLoaded
        IndexOnly.beforeDOMLoaded = component?.beforeDOMLoaded
        IndexOnly.css = component?.css
        return IndexOnly
    } else {
        return () => <></>
    }
}) satisfies QuartzComponentConstructor
