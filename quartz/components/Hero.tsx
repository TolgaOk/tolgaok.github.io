import { QuartzComponentConstructor } from "./types";
import heroStyle from "./styles/hero.scss";

export const Hero = () => {
    const HeroComponent = () => {
        return (
            <div class="hero-container">
                <img src="static/selfie.jpg" alt="Hero Image" class="hero-image" style="border-radius: 20%;"/>
            </div>
        );
    };
    HeroComponent.css = heroStyle;
    return HeroComponent;
};

export default (() => Hero()) satisfies QuartzComponentConstructor;