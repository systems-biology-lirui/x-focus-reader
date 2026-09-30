import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const extensionDir = path.resolve(import.meta.dirname, "..");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = await mkdtemp(path.join(tmpdir(), "x-focus-smoke-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  `--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`,
  "about:blank"
], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
let chromeErrors = "";
chrome.stderr.on("data", (chunk) => { chromeErrors += chunk.toString(); });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (fn, timeout = 10000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { const value = await fn(); if (value) return value; } catch { /* Wait for Chrome. */ }
    await sleep(100);
  }
  throw new Error("Timed out waiting for Chrome or extension");
};

try {
  const port = await waitFor(async () => Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]));
  const page = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((entry) => entry.type === "page"));
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  const handlers = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    } else handlers.get(message.method)?.(message.params);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });

  const html = `<!doctype html><html><head><style>body{margin:0;font:16px Arial}article{position:fixed;left:500px;top:200px;width:500px;min-height:220px;padding:20px;border:1px solid #ddd;background:white}</style></head><body><article data-testid="tweet"><div data-testid="User-Name"><span>测试用户</span><span>@tester</span></div><a id="permalink" href="https://x.com/tester/status/111"><time datetime="2026-09-30T00:00:00Z">今天</time></a><div data-testid="tweetText">第一条测试推文</div></article></body></html>`;
  const detailHtml = `<!doctype html><html><head><style>body{margin:0;font:16px Arial}#react-root{min-height:100vh}[data-testid=primaryColumn]{width:600px;background:white}</style></head><body><div id="react-root"><header role="banner">站点导航</header><main><div data-testid="primaryColumn"><h2>帖子</h2><article data-testid="tweet"><div data-testid="User-Name"><span>测试用户</span><span>@tester</span></div><a href="https://x.com/tester/status/5"><time>今天</time></a><div data-testid="tweetText">第五条测试推文</div></article><div id="comments"><h3>回复</h3><article>第一条评论 <a id="replyLink" href="https://x.com/tester/status/6">打开回复</a></article><article>第二条评论</article></div></div><div data-testid="sidebarColumn">推荐内容</div></main></div></body></html>`;
  handlers.set("Fetch.requestPaused", async ({ requestId, request }) => {
    await send("Fetch.fulfillRequest", {
      requestId, responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
      body: Buffer.from(request.url.includes("/status/") ? detailHtml : html).toString("base64")
    });
  });
  await send("Fetch.enable", { patterns: [{ urlPattern: "https://x.com/*", requestStage: "Request" }] });
  await send("Page.navigate", { url: "https://x.com/home" });
  await waitFor(() => evaluate("document.readyState === 'complete'"));
  const injectContent = async () => {
    if (await evaluate("Boolean(document.getElementById('x-collector-focus'))")) return;
    const source = await readFile(path.join(extensionDir, "content.js"), "utf8");
    const css = await readFile(path.join(extensionDir, "focus.css"), "utf8");
    const mock = "const chrome={storage:{local:{get:async(d)=>({...d,...JSON.parse(localStorage.getItem('__smokeStorage')||'{}')}),set:async(d)=>{localStorage.setItem('__smokeStorage',JSON.stringify(d))}},onChanged:{addListener:()=>{}}},runtime:{onMessage:{addListener:()=>{}}}};";
    await evaluate(`(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style)})()`);
    const result = await send("Runtime.evaluate", { expression: `(()=>{${mock}${source}})()`, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  };
  await injectContent();
  await waitFor(() => evaluate("Boolean(document.getElementById('x-collector-focus'))"));

  for (let n = 1; n <= 5; n++) {
    await evaluate(`document.getElementById('permalink').href='https://x.com/tester/status/${n}';document.querySelector('[data-testid=tweetText]').textContent='第${n}条测试推文'`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 650, y: 250, button: "left", buttons: 1, modifiers: 2, clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 665, y: 265, button: "left", buttons: 1, modifiers: 2 });
    const center = await waitFor(() => evaluate("(() => {const p=document.getElementById('x-collector-plus');if(p.hidden)return null;const r=p.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()"));
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: center.x, y: center.y, button: "left", buttons: 1, modifiers: 2 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", buttons: 0, modifiers: 2, clickCount: 1 });
    await waitFor(() => evaluate(`document.querySelector('.x-collector-count').textContent.includes('${n} 条')`));
  }

  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'X',ctrlKey:true,shiftKey:true,bubbles:true}))");
  if (!(await evaluate("!document.getElementById('x-collector-focus').hidden"))) throw new Error("Focus mode did not open");
  if ((await evaluate("document.querySelectorAll('.x-collector-card').length")) !== 5) throw new Error("Wrong tweet count in focus mode");
  const centered = await evaluate("(() => {const r=document.querySelector('.x-collector-feed').getBoundingClientRect();return Math.abs(r.left+r.width/2-innerWidth/2)<2})()");
  if (!centered) throw new Error("Tweet list is not centered before selecting a tweet");
  await evaluate("document.querySelector('.x-collector-card').click()");
  await waitFor(() => evaluate("location.pathname === '/tester/status/5' && document.readyState === 'complete'"));
  await injectContent();
  await waitFor(() => evaluate("document.getElementById('x-collector-focus')?.classList.contains('x-collector-native-detail')"));
  if (!(await evaluate("document.getElementById('comments')?.innerText.includes('第一条评论')"))) throw new Error("Native replies did not load");
  if (!(await evaluate("getComputedStyle(document.querySelector('[data-testid=primaryColumn]')).position === 'fixed'"))) throw new Error("Native detail was not placed on the right");
  const rects = await evaluate("(() => {const a=document.querySelector('.x-collector-shell').getBoundingClientRect(),b=document.querySelector('[data-testid=primaryColumn]').getBoundingClientRect();return {leftShell:a.left,rightShell:a.right,leftDetail:b.left,rightDetail:b.right,width:innerWidth}})()");
  const separated = rects.rightShell + 8 <= rects.leftDetail && rects.rightDetail <= rects.width;
  if (!separated) console.error(rects);
  if (!separated) throw new Error("Native detail overlaps the saved tweet list");
  await evaluate("document.getElementById('replyLink').click()");
  await waitFor(() => evaluate("location.pathname === '/tester/status/6' && document.readyState === 'complete'"));
  await injectContent();
  await waitFor(() => evaluate("document.getElementById('x-collector-focus')?.classList.contains('x-collector-native-detail')"));
  await evaluate("document.querySelector('.x-collector-close').click()");
  await waitFor(() => evaluate("location.pathname === '/home' && document.readyState === 'complete'"));
  await injectContent();
  if (!(await evaluate("document.getElementById('x-collector-focus').hidden && !sessionStorage.getItem('xCollectorFocusSession')"))) throw new Error("Exiting focus did not restore the original page");
  console.log("PASS: five drags, focus shortcut, centered list, native X replies and links, exit to original page");
  socket.close();
} finally {
  chrome.kill();
  const tempRoot = path.resolve(tmpdir()).toLowerCase() + path.sep;
  if (path.resolve(profile).toLowerCase().startsWith(tempRoot) && path.basename(profile).startsWith("x-focus-smoke-")) {
    await sleep(500);
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }
}
