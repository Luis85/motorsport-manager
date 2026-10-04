import { chromium, type Browser, type BrowserContext } from "playwright";

export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  // Exercise the full desktop browser, including its WebGL preview lifecycle.
  // Playwright otherwise selects the separate Chromium headless-shell binary.
  return chromium.launch({headless:true,...(executablePath ? {executablePath} : {channel:"chromium"}),args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"]});
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
