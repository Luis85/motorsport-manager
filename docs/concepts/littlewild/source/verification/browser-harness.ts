import { chromium, type Browser, type BrowserContext } from "playwright";
import { createRequire } from "node:module";

export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const args = ["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"];
  const browser = await chromium.launch({headless:true,...(executablePath ? {executablePath} : {}),args});
  try {
    const installed = createRequire(__filename);
    const version = (name: string) => (installed(`${name}/package.json`) as {version: string}).version.slice(0,96);
    console.log(JSON.stringify({kind:"littlewild-browser-provenance",node:process.version,
      playwright:version("playwright"),playwrightCore:version("playwright-core"),
      browser:browser.version().slice(0,96),selection:executablePath ? "explicit-override" : "default",args}));
  } catch {
    // Observation must preserve a successfully launched browser even if stdout is unavailable.
  }
  return browser;
}

/** Observe every page, including replacement/custom-pack pages, before its first navigation. */
export function monitorContext(context: BrowserContext) {
  const errors: string[] = [], consoleProblems: string[] = [], requests: string[] = [];
  context.on("page", page => {
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  });
  return { errors, consoleProblems, requests };
}
