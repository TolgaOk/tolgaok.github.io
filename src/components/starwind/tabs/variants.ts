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
    "inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-3 py-1.5 font-medium whitespace-nowrap transition-[background-color]",
    "data-[state=active]:bg-zinc-200 hover:bg-zinc-300 hover:data-[state=active]:bg-zinc-300",
    "dark:data-[state=active]:bg-zinc-700 hover:dark:bg-zinc-600 hover:dark:data-[state=active]:bg-zinc-600",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "focus-visible:border-outline focus-visible:ring-outline/50 focus-visible:outline-outline focus-visible:ring-3 focus-visible:outline-1",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
});
