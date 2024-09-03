import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"
import { version } from "../../package.json"
import { i18n } from "../i18n"



export default (() => {
  const Footer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const year = new Date().getFullYear()
    return (
      <footer class={`${displayClass ?? ""}`}>
        <hr />
        <ul>
          <li>
            <a href={"https://github.com/TolgaOk"}>
            <svg width="70px" height="70px" viewBox="0 0 2.1 2.1" xmlns="http://www.w3.org/2000/svg"><path d="M1.05 0.175a0.875 0.875 0 0 0 -0.277 1.706c0.044 0.007 0.058 -0.02 0.058 -0.044v-0.148C0.589 1.742 0.537 1.575 0.537 1.575A0.236 0.236 0 0 0 0.438 1.444c-0.08 -0.054 0.006 -0.052 0.006 -0.052a0.184 0.184 0 0 1 0.134 0.088 0.188 0.188 0 0 0 0.255 0.073 0.193 0.193 0 0 1 0.055 -0.117C0.7 1.415 0.492 1.34 0.492 1.006a0.35 0.35 0 0 1 0.088 -0.237 0.315 0.315 0 0 1 0.009 -0.231s0.074 -0.024 0.241 0.088a0.84 0.84 0 0 1 0.438 0c0.167 -0.113 0.241 -0.088 0.241 -0.088a0.315 0.315 0 0 1 0.009 0.231 0.35 0.35 0 0 1 0.088 0.237c0 0.334 -0.205 0.408 -0.4 0.43a0.21 0.21 0 0 1 0.06 0.162V1.838c0 0.024 0.014 0.052 0.059 0.044A0.875 0.875 0 0 0 1.05 0.175"/></svg>            </a>
          </li>
          <li>
            <a href={"https://scholar.google.com/citations?user=fUZamLEAAAAJ&hl=en"}>
            <svg xmlns="http://www.w3.org/2000/svg" aria-label="Google Scholar" role="img" viewBox="0 0 70 70" width="70" height="70"><path d="M29.121 15.176 14.492 28.028h9.434c0.684 6.152 5.605 8.75 10.665 9.161 -0.958 2.462 -0.547 3.691 0.958 5.333 -5.879 0.137 -14.083 3.555 -14.083 9.161 0.547 6.152 8.614 7.384 12.578 7.384 5.196 0.137 11.074 -2.598 12.305 -7.384 0.547 -4.786 -1.367 -7.384 -4.239 -9.707 -3.145 -2.462 -3.828 -3.828 -2.871 -5.469 2.051 -2.324 4.786 -3.691 5.333 -6.973 0.274 -2.324 -0.274 -3.828 -0.821 -5.879l6.152 -5.196 -0.137 2.188c-0.411 0.274 -0.684 0.821 -0.684 1.23v14.083c0.274 1.777 3.009 1.504 3.145 0V21.875c0 -0.411 -0.274 -0.958 -0.684 -1.094v-3.417l2.188 -2.188zm7.93 19.277c-8.339 1.367 -11.894 -11.894 -5.196 -13.536 7.657 -1.504 11.348 11.759 5.196 13.536m-0.684 9.981c8.203 1.777 8.339 8.614 1.367 10.665 -6.015 1.23 -11.212 -0.547 -11.074 -4.102 0 -3.417 4.786 -6.563 9.707 -6.563"/></svg>
            </a>
          </li>
        </ul>
        <p>
          {i18n(cfg.locale).components.footer.createdWith}{" "}
          <a href="https://quartz.jzhao.xyz/">Quartz v{version}</a> © {year}
        </p>
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
