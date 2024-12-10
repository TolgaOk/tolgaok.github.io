import { QuartzTransformerPlugin } from "../types"

export const SubstituteMD: QuartzTransformerPlugin = () => {
    return {
        name: "SubstituteMD",
        textTransform(ctx, src) {

            async function fetchAndReplaceMarkdown(text: string): Promise<string> {
                // Regex pattern to find occurrences of {! ... !}
                const regex = /\{!\s*(.*?)\s*!\}/g;

                // Extract all matches and create a replacement map
                const matches = [...text.matchAll(regex)];
                const replacements = matches.map(async (match) => {
                    const url = match[1];
                    try {
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch: ${url}`);
                        }
                        return response.text();
                    } catch (error) {
                        console.error(error);
                        return match[0]; // Return original if fetch fails
                    }
                });

                // Wait for all the markdown content to be fetched
                const fetchedMarkdowns = await Promise.all(replacements);

                // Replace all instances with the fetched markdown content
                let result = text;
                matches.forEach((match, index) => {
                    result = result.replace(match[0], fetchedMarkdowns[index]);
                });

                return result;
            }

            // Example usage
            const inputText = "Here is some text with a markdown link: {!https://raw.githubusercontent.com/TolgaOk/UnitGym/master/README.md?token=GHSAT0AAAAAACUD3GME5FUW2Z5PGK3RJTRKZWV24DA!}";
            fetchAndReplaceMarkdown(inputText).then(result => {
                console.log(result);
            });

            return src
        },
    }
}

//   // tell typescript about our custom data fields we are adding
//   // other plugins will then also be aware of this data field
//   declare module "vfile" {
//     interface DataMap {
//       wordcount: number
//     }
//   }