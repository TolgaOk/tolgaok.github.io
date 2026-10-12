// CDP checks adapted from research-figures/template/check.mjs. No browser package needed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] || "http://127.0.0.1:4321/dev/value-gradients/";
const out = process.env.SCREENSHOT_DIR || "/tmp/value-gradients-shots";
const profile = mkdtempSync(join(tmpdir(), "value-gradient-browser-"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(
  process.env.CHROME ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try {
      target = (
        await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      ).find((page) => page.type === "page");
    } catch {
      /* Chrome is starting. */
    }
  }
  assert.ok(target, "Chrome did not start");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  let id = 0;
  const pending = new Map(),
    errors = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ||
          message.params.exceptionDetails.text,
      );
    if (
      message.method === "Runtime.consoleAPICalled" &&
      message.params.type === "error"
    )
      errors.push(
        message.params.args
          .map((arg) => arg.value || arg.description)
          .join(" "),
      );
    if (
      message.method === "Log.entryAdded" &&
      message.params.entry.level === "error"
    )
      errors.push(message.params.entry.text);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const next = ++id;
      const timer = setTimeout(() => {
        pending.delete(next);
        reject(new Error(`Timed out: ${method}`));
      }, 65000);
      pending.set(next, (message) => {
        clearTimeout(timer);
        message.error
          ? reject(new Error(JSON.stringify(message.error)))
          : resolve(message.result);
      });
      ws.send(JSON.stringify({ id: next, method, params }));
    });
  const run = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    return result.result?.value;
  };
  const svgSelector = ".chart-simulation .chart-plot > svg";
  const ready = () =>
    run(`(async () => {
    for (let i = 0; i < 240; i++) {
      const svg = document.querySelector('${svgSelector}');
      const error = document.querySelector('[data-control="error"]');
      if (error && !error.hidden) throw new Error(error.textContent);
      if (svg?.dataset.pathState === 'ready' && svg.getAttribute('aria-busy') === 'false') return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Explorer did not settle');
  })()`);
  const key = async (name, code = name) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code });
    await ready();
  };
  const select = async (name, index) => {
    await run(
      `document.querySelector('[data-control="${name}-selector"] [role="combobox"]').focus()`,
    );
    await key("Enter");
    await key("Home");
    for (let i = 0; i < index; i++) await key("ArrowDown");
    await key("Enter");
  };
  const slider = async (name, value) => {
    await run(
      `(() => { const input = document.querySelector('[data-control="${name}"]'); input.value = '${value}'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
    await ready();
  };
  const curves = () =>
    run(
      `Object.fromEntries([...document.querySelectorAll('${svgSelector} .ascent-trace')].map(node => [node.dataset.method, node.__data__]))`,
    );
  const initial = () =>
    run(
      `(() => { const svg = document.querySelector('${svgSelector}'); return [Number(svg.dataset.initialX), Number(svg.dataset.initialY)]; })()`,
    );
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1100,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url });
  await sleep(800);
  await ready();
  assert.equal(
    await run(
      `document.querySelectorAll('${svgSelector} .stream').length > 10 && document.querySelectorAll('${svgSelector} .stream-direction').length > 10`,
    ),
    true,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('${svgSelector} .ascent-trace').length`,
    ),
    2,
  );
  assert.equal(
    await run(`document.querySelectorAll('${svgSelector} .trajectory').length`),
    64,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('.chart-simulation marker, .update-arrow, .drift, .chart-simulation select, [data-control="sigma"], [data-control="horizon"], [data-control="arrow-scale"]').length`,
    ),
    0,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('.chart-simulation [role="combobox"]').length`,
    ),
    2,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('.chart-simulation input[type="range"]').length`,
    ),
    2,
  );
  assert.equal(
    await run(
      `document.querySelectorAll('.chart-simulation input[role="switch"]').length`,
    ),
    2,
  );
  assert.equal(
    await run(`document.querySelectorAll('.katex-error').length`),
    0,
  );
  assert.equal(
    await run(`document.querySelector('${svgSelector}').dataset.samples`),
    "64",
  );
  assert.equal(
    await run(`document.querySelector('.chart-simulation').dataset.field`),
    "inertial",
  );
  assert.deepEqual(
    await run(
      `[...new Set([...document.querySelectorAll('${svgSelector} .trajectory')].map(path => path.__data__.reward))].sort()`,
    ),
    [0, 1],
    "Default location should show both terminal outcomes",
  );
  const first = await curves();
  assert.deepEqual(Object.keys(first), ["reinforce", "pathwise"]);
  assert.equal(
    await run(
      `document.querySelector('[data-control="show-trajectories"]') === null`,
    ),
    true,
  );
  for (const points of Object.values(first))
    assert.deepEqual(points[0], [-0.55, 0.8]);
  await slider("path-steps", 3);
  const fields = [];
  for (const index of [0, 1, 2]) {
    await select("field", index);
    fields.push(
      await run(
        `document.querySelector('${svgSelector} .stream').getAttribute('d')`,
      ),
    );
    const start = await initial();
    await run(
      `document.querySelector('${svgSelector} .initial-handle').focus()`,
    );
    await key("ArrowRight");
    assert.ok((await initial())[0] > start[0]);
    await key("Home");
    assert.deepEqual(await initial(), start);
    for (const points of Object.values(await curves()))
      assert.deepEqual(points[0], start);
  }
  assert.equal(new Set(fields).size, 3);
  await run(`document.querySelector('[data-control="reset"]').click()`);
  await ready();
  assert.deepEqual(await curves(), first);
  for (const name of ["show-reinforce", "show-pathwise"]) {
    await run(`document.querySelector('[data-control="${name}"]').focus()`);
    await key(" ", "Space");
    assert.equal(
      await run(
        `document.querySelectorAll('${svgSelector} .ascent-trace[data-method="${name.slice(5)}"]').length`,
      ),
      0,
    );
    await key(" ", "Space");
  }
  for (const index of [0, 1, 2, 3, 4, 5, 6]) {
    await select("samples", index);
    assert.equal(
      await run(
        `document.querySelectorAll('${svgSelector} .trajectory').length`,
      ),
      Math.min(256, [4, 16, 64, 256, 1024, 4096, 8192][index]),
    );
    assert.equal(
      await run(
        `document.querySelectorAll('.chart-simulation [data-method="reference"], .chart-simulation [data-method="hybrid"]').length`,
      ),
      0,
    );
  }
  await slider("step-size", 0.005);
  assert.equal(
    await run(
      `document.querySelector('[data-control="step-size-value"]').value`,
    ),
    "0.005",
  );
  // Rapid updates must cancel a long worker request rather than restore stale paths.
  await run(
    `(() => { const slider = document.querySelector('[data-control="path-steps"]'); for (const value of [1000, 3]) { slider.value = value; slider.dispatchEvent(new Event('input', { bubbles: true })); } })()`,
  );
  await ready();
  await sleep(300);
  for (const points of Object.values(await curves()))
    assert.ok(points.length <= 4);
  await run(`document.querySelector('[data-control="reset"]').click()`);
  await ready();

  mkdirSync(out, { recursive: true });
  const snapshot = async (name, width, theme, deviceTheme = "light") => {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: deviceTheme }],
    });
    await run(`document.documentElement.dataset.theme = '${theme}'`);
    await sleep(400);
    assert.equal(
      await run(`document.documentElement.scrollWidth <= window.innerWidth`),
      true,
      `Overflow in ${name}`,
    );
    const layout = await run(`(() => {
      document.querySelector('astro-dev-toolbar')?.remove();
      const root = document.querySelector('.chart-simulation');
      const panel = root.querySelector('.chart-control-panel').getBoundingClientRect();
      const plot = root.querySelector('.chart-plot > svg').getBoundingClientRect();
      const frame = root.querySelector('.chart-plot').getBoundingClientRect();
      const plotStyle = getComputedStyle(root.querySelector('.chart-plot'));
      const stream = root.querySelector('.stream');
      const renderedStroke = Number(stream.getAttribute('stroke-width')) * plot.width / 900;
      if (Math.abs(renderedStroke - 1.2) > 0.02) throw new Error('Streamline stroke scales down on mobile');
      const caption = root.closest('figure').querySelector('figcaption');
      if (!caption?.textContent.includes('REINFORCE and value gradients')) throw new Error('Missing figure explanation');
      if (parseFloat(getComputedStyle(caption).fontSize) >= 18) throw new Error('Caption is not smaller text');
      const box = root.closest('figure').getBoundingClientRect(), style = getComputedStyle(root);
      return { panelWidth: panel.width, frameWidth: frame.width, plotWidth: plot.width, plotHeight: plot.height, border: plotStyle.borderTopWidth, x: box.x + window.scrollX, y: box.y + window.scrollY, width: box.width, height: box.height, canvas: style.getPropertyValue('--chart-canvas').trim(), font: style.fontFamily };
    })()`);
    assert.ok(
      layout.plotWidth > 300 && layout.plotHeight > 200,
      `Plot is collapsed in ${name}`,
    );
    assert.ok(Math.abs(layout.plotHeight / layout.plotWidth - 0.7) < 0.001);
    assert.ok(Math.abs(layout.panelWidth - layout.frameWidth) < 1);
    assert.equal(layout.border, "1px");
    assert.equal(
      await run(`(() => {
      const rgb = method => getComputedStyle(document.querySelector('${svgSelector} .ascent-trace[data-method="' + method + '"]')).stroke.match(/\\d+/g).map(Number);
      const red = rgb('reinforce'), blue = rgb('pathwise');
      return red[0] > red[2] && blue[2] > blue[0];
    })()`),
      true,
      `Method colors in ${name}`,
    );
    assert.ok(layout.font.includes("Noto Sans"));
    assert.equal(
      layout.canvas.replace(
        /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i,
        "#$1$1$2$2$3$3",
      ),
      theme === "dark" || (theme === "device" && deviceTheme === "dark")
        ? "#18181b"
        : "#ffffff",
    );
    const { data } = await send("Page.captureScreenshot", {
      format: "png",
      clip: {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        scale: 1,
      },
      captureBeyondViewport: true,
    });
    writeFileSync(join(out, `${name}.png`), Buffer.from(data, "base64"));
  };
  await snapshot("desktop-light", 1100, "light");
  await snapshot("desktop-dark", 1100, "dark");
  await snapshot("mobile-light", 390, "light");
  await snapshot("mobile-dark", 390, "dark");
  await snapshot("device-dark", 1100, "device", "dark");
  await snapshot("device-light", 1100, "device", "light");
  assert.deepEqual(errors, []);
  console.log(
    `Passed visible plot, shared dropdowns, sliders, toggles, keyboard, streamlines, worker cancellation and themes. Screenshots: ${out}`,
  );
} finally {
  ws?.close();
  chrome.kill();
  await new Promise((resolve) =>
    chrome.exitCode !== null ? resolve() : chrome.once("exit", resolve),
  );
  rmSync(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
