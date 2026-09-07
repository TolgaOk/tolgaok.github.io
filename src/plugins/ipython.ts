import type {
  ExpressiveCodeLine,
  ExpressiveCodePlugin,
} from "astro-expressive-code";
import { addClassName, h, select } from "astro-expressive-code/hast";

export function pluginIPython(): ExpressiveCodePlugin {
  const prompts = new WeakMap<
    ExpressiveCodeLine,
    { label: string; output?: string }
  >();

  return {
    name: "IPython transcripts",
    baseStyles: `
      .ipython-prompt {
        display: inline-block;
        width: 8ch;
        margin-inline-end: 1ch;
        color: color-mix(in srgb, var(--ec-codeFg) 65%, var(--ec-codeBg));
        user-select: none;
      }
      .ipython-output {
        background: color-mix(in srgb, var(--ec-codeFg) 6%, transparent);
      }
      .ipython-output .code {
        padding-block: 0.25rem;
        color: var(--ec-codeFg);
      }
    `,
    hooks: {
      preprocessCode: ({ codeBlock }) => {
        if (!codeBlock.metaOptions.getBoolean("ipython")) return;

        for (const line of codeBlock.getLines()) {
          const match = /^(In \[\d+\]:|Out\[\d+\]:|\s*\.\.\.:) ?(.*)$/.exec(
            line.text,
          );
          if (!match) continue;

          const [, label, content] = match;
          const isOutput = label.startsWith("Out[");
          prompts.set(line, { label, output: isOutput ? content : undefined });
          // Highlight and copy only Python input; restore output for display below.
          line.editText(0, undefined, isOutput ? "" : content);
        }
      },
      postprocessRenderedLine: ({ line, renderData }) => {
        const prompt = prompts.get(line);
        if (!prompt) return;

        const code = select(".code", renderData.lineAst);
        if (!code) return;

        if (prompt.output !== undefined) {
          addClassName(renderData.lineAst, "ipython-output");
          code.children = [{ type: "text", value: prompt.output }];
        }
        code.children.unshift(h("span.ipython-prompt", `${prompt.label} `));
      },
    },
  };
}
