import { tv } from "tailwind-variants";

export const tabs = tv({ base: "starwind-tabs" });

export const tabsContent = tv({
  base: "mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 **:my-0",
});

export const tabsList = tv({
  base: "mx-auto flex w-fit flex-wrap items-center justify-center gap-2",
});

export const tabsTrigger = tv({
  base: [
    "control-button inline-flex items-center justify-center gap-2",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
});
