import { QuartzComponentConstructor } from "./types";
import heroStyle from "./styles/hero.scss";

export default ((image_name?: string) => {
    const HeroComponent = () => {
        return (
            <div class="hero-container">
                <img src={"static/" + image_name} alt="Image" class="hero-image" style="border-radius: 20%;"/>
            </div>
        );
    };
    HeroComponent.css = heroStyle;
    return HeroComponent;
}) satisfies QuartzComponentConstructor;