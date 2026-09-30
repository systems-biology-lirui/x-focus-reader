(() => {
  if (document.getElementById("x-collector-focus")) return;

  const STORAGE_KEY = "savedTweets";
  const SESSION_KEY = "xCollectorFocusSession";
  const root = document.createElement("div");
  root.id = "x-collector-focus";
  root.hidden = true;
  root.innerHTML = `
    <div class="x-collector-glass"></div>
    <div class="x-collector-shell">
      <header class="x-collector-header">
        <div class="x-collector-brand"><span class="x-collector-spark">✦</span><strong>专注阅读</strong><span class="x-collector-count"></span></div>
        <button type="button" class="x-collector-close" aria-label="退出专注阅读">退出 <kbd>Esc</kbd></button>
      </header>
      <main class="x-collector-workspace">
        <section class="x-collector-feed" aria-label="已收集的推文"><div class="x-collector-cards"></div></section>
      </main>
    </div>
  `;

  const nativeGlass = document.createElement("div");
  nativeGlass.id = "x-collector-native-glass";
  nativeGlass.hidden = true;

  const plus = document.createElement("div");
  plus.id = "x-collector-plus";
  plus.setAttribute("aria-label", "放开鼠标以加入专注阅读");
  plus.innerHTML = '<span>＋</span><small>加入专注阅读</small>';
  plus.hidden = true;
  const ghost = document.createElement("div");
  ghost.id = "x-collector-ghost";
  ghost.textContent = "拖向 ＋ 收集推文";
  ghost.hidden = true;
  const toast = document.createElement("div");
  toast.id = "x-collector-toast";
  toast.setAttribute("role", "status");
  toast.hidden = true;
  document.documentElement.append(nativeGlass, root, plus, ghost, toast);

  const cards = root.querySelector(".x-collector-cards");
  let tweets = [];
  let selectedId = null;
  let originUrl = location.href;
  let pointer = null;
  let lastToggle = 0;
  let toastTimer = null;

  const normalizeUrl = (value) => {
    try {
      const url = new URL(value, location.href);
      if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname)) return null;
      const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
      return match ? `https://x.com/${match[1]}/status/${match[2]}` : null;
    } catch { return null; }
  };

  const snapshotArticle = (article) => {
    const clone = article.cloneNode(true);
    clone.querySelectorAll("script, style, iframe, form, input, textarea, canvas").forEach((node) => node.remove());
    for (const element of [clone, ...clone.querySelectorAll("*")]) {
      for (const attr of [...element.attributes]) {
        const key = attr.name.toLowerCase();
        if (key === "id" || key === "contenteditable" || key.startsWith("on")) element.removeAttribute(attr.name);
        if ((key === "href" || key === "src" || key === "poster") && /^(?:javascript:|data:|blob:)/i.test(attr.value.trim())) element.removeAttribute(attr.name);
      }
    }
    const html = clone.outerHTML;
    return html.length < 350000 ? html : "";
  };

  const readTweet = (article) => {
    const time = article.querySelector("time");
    const timeLink = time?.closest("a[href]");
    const link = timeLink || article.querySelector('a[href*="/status/"]');
    const url = normalizeUrl(link?.href);
    if (!url) return null;
    const user = article.querySelector('[data-testid="User-Name"]');
    const text = article.querySelector('[data-testid="tweetText"]')?.innerText?.trim() || "（媒体推文）";
    return {
      id: url.split("/").pop(),
      url,
      author: user?.querySelector("span")?.textContent?.trim()?.slice(0, 100) || "未知用户",
      handle: user?.textContent?.match(/@[^\s·]+/)?.[0]?.slice(0, 100) || "",
      text: text.slice(0, 10000),
      savedAt: new Date().toISOString(),
      snapshot: snapshotArticle(article)
    };
  };

  const showToast = (message) => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  };

  const save = async (next) => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      tweets = next;
      render();
      return true;
    } catch {
      showToast("保存失败：Chrome 本地存储空间不足");
      return false;
    }
  };

  const addTweet = async (tweet) => {
    if (!tweet) return showToast("无法找到这条推文的链接");
    const index = tweets.findIndex((item) => item.id === tweet.id);
    if (index >= 0) {
      if (!tweets[index].snapshot && tweet.snapshot) {
        const next = [...tweets];
        next[index] = { ...tweet, savedAt: tweets[index].savedAt };
        if (await save(next)) showToast("已更新这条推文");
      } else showToast("这条推文已经加入了");
      return;
    }
    if (await save([tweet, ...tweets])) showToast("已加入专注阅读");
  };

  const nativeView = (tweet) => {
    const view = document.createElement("div");
    view.className = "x-collector-native";
    if (tweet.snapshot) {
      const template = document.createElement("template");
      template.innerHTML = tweet.snapshot;
      const article = template.content.querySelector("article");
      if (article) {
        view.append(article);
        return view;
      }
    }
    const fallback = document.createElement("div");
    fallback.className = "x-collector-fallback";
    const author = document.createElement("strong");
    author.textContent = tweet.author || "未知用户";
    const handle = document.createElement("span");
    handle.textContent = tweet.handle || "";
    const body = document.createElement("p");
    body.textContent = tweet.text || "（媒体推文）";
    fallback.append(author, handle, body);
    view.append(fallback);
    return view;
  };

  const render = () => {
    root.querySelector(".x-collector-count").textContent = `${tweets.length} 条推文`;
    root.classList.toggle("x-collector-split", Boolean(selectedId));
    cards.replaceChildren();
    if (!tweets.length) {
      const empty = document.createElement("div");
      empty.className = "x-collector-empty";
      empty.innerHTML = '<span>✦</span><strong>还没有推文</strong><p>退出专注模式，按住 Ctrl 将推文拖到左侧的 ＋</p>';
      cards.append(empty);
    }
    for (const tweet of tweets) {
      const card = document.createElement("div");
      card.className = "x-collector-card";
      if (tweet.id === selectedId) card.classList.add("x-collector-selected");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `查看 ${tweet.author || "用户"} 的推文`);
      card.append(nativeView(tweet));
      const remove = document.createElement("button");
      remove.className = "x-collector-remove";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "从专注阅读中移除";
      remove.setAttribute("aria-label", "移除这条推文");
      remove.addEventListener("click", async (event) => {
        event.stopPropagation();
        const removingSelected = selectedId === tweet.id;
        if (await save(tweets.filter((item) => item.id !== tweet.id))) {
          if (removingSelected) {
            selectedId = null;
            writeSession();
            if (originUrl !== location.href) location.assign(originUrl);
            else showFocus(false);
          }
          showToast("已移除推文");
        }
      });
      card.append(remove);
      const select = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openNativeTweet(tweet);
      };
      card.addEventListener("click", select);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") select(event);
      });
      cards.append(card);
    }
  };

  const readSession = () => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  };
  const writeSession = () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ open: true, selectedId, originUrl }));
  };
  const decoratePrimary = () => {
    if (!root.classList.contains("x-collector-native-detail")) return;
    const column = document.querySelector('[data-testid="primaryColumn"]');
    if (!column) return;
    let parent = column.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      parent.classList.add("x-collector-primary-ancestor");
      parent = parent.parentElement;
    }
  };
  let decorateScheduled = false;
  new MutationObserver(() => {
    if (decorateScheduled || !root.classList.contains("x-collector-native-detail")) return;
    decorateScheduled = true;
    requestAnimationFrame(() => { decorateScheduled = false; decoratePrimary(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  const showFocus = (native) => {
    root.hidden = false;
    root.classList.toggle("x-collector-native-detail", native);
    nativeGlass.hidden = !native;
    document.documentElement.classList.toggle("x-collector-focus-open", !native);
    document.documentElement.classList.toggle("x-collector-native-focus", native);
    render();
    if (native) decoratePrimary();
  };
  const closeFocus = () => {
    const wasNative = root.classList.contains("x-collector-native-detail");
    sessionStorage.removeItem(SESSION_KEY);
    root.hidden = true;
    root.classList.remove("x-collector-native-detail");
    nativeGlass.hidden = true;
    document.documentElement.classList.remove("x-collector-focus-open", "x-collector-native-focus");
    if (wasNative && originUrl !== location.href) location.assign(originUrl);
  };
  const openNativeTweet = (tweet) => {
    selectedId = tweet.id;
    writeSession();
    if (normalizeUrl(location.href) === tweet.url) {
      showFocus(true);
    } else {
      location.assign(tweet.url);
    }
  };
  const toggleFocus = () => {
    if (Date.now() - lastToggle < 300) return;
    lastToggle = Date.now();
    if (!root.hidden) {
      closeFocus();
    } else {
      originUrl = location.href;
      selectedId = null;
      writeSession();
      showFocus(false);
    }
  };

  root.querySelector(".x-collector-close").addEventListener("click", closeFocus);
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "x") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) toggleFocus();
    } else if (event.key === "Escape" && !root.hidden) {
      event.preventDefault();
      closeFocus();
    }
  }, true);
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "toggle-focus") toggleFocus();
  });

  const placePlus = (article) => {
    const rect = article.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - 74, rect.left - 82));
    const top = Math.max(60, Math.min(window.innerHeight - 82, rect.top + Math.min(70, rect.height / 2)));
    plus.style.left = `${left}px`;
    plus.style.top = `${top}px`;
  };
  const overPlus = (x, y) => {
    const rect = plus.getBoundingClientRect();
    return !plus.hidden && x >= rect.left - 10 && x <= rect.right + 10 && y >= rect.top - 10 && y <= rect.bottom + 10;
  };
  const cleanupDrag = () => {
    if (pointer?.dragging) {
      try { document.documentElement.releasePointerCapture(pointer.id); } catch { /* Already released. */ }
    }
    pointer?.article?.classList.remove("x-collector-source");
    pointer = null;
    plus.hidden = true;
    plus.classList.remove("x-collector-over");
    ghost.hidden = true;
    document.documentElement.classList.remove("x-collector-dragging");
  };

  window.addEventListener("pointerdown", (event) => {
    if (!root.hidden || event.button !== 0 || !event.ctrlKey) return;
    const article = event.target instanceof Element ? event.target.closest('article[data-testid="tweet"]') : null;
    if (article) pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, article, dragging: false, tweet: null };
  }, true);
  window.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.dragging) {
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 7) return;
      pointer.dragging = true;
      pointer.tweet = readTweet(pointer.article);
      pointer.article.classList.add("x-collector-source");
      placePlus(pointer.article);
      plus.hidden = false;
      ghost.hidden = false;
      document.documentElement.classList.add("x-collector-dragging");
      try { document.documentElement.setPointerCapture(pointer.id); } catch { /* Pointer may already be captured. */ }
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    ghost.style.left = `${event.clientX + 15}px`;
    ghost.style.top = `${event.clientY + 15}px`;
    plus.classList.toggle("x-collector-over", overPlus(event.clientX, event.clientY));
  }, { capture: true, passive: false });
  window.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dropped = pointer.dragging && overPlus(event.clientX, event.clientY);
    const tweet = pointer.tweet;
    const wasDragging = pointer.dragging;
    cleanupDrag();
    if (wasDragging) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (dropped) addTweet(tweet);
  }, true);
  window.addEventListener("pointercancel", cleanupDrag, true);
  window.addEventListener("blur", cleanupDrag);
  window.addEventListener("dragstart", (event) => {
    if (pointer) event.preventDefault();
  }, true);
  window.addEventListener("scroll", () => {
    if (pointer?.dragging) placePlus(pointer.article);
  }, true);

  chrome.storage.local.get({ [STORAGE_KEY]: [] }).then((data) => {
    tweets = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY].filter((item) => item && normalizeUrl(item.url)) : [];
    const session = readSession();
    if (session?.open) {
      selectedId = typeof session.selectedId === "string" ? session.selectedId : null;
      try {
        const candidate = new URL(session.originUrl);
        originUrl = candidate.origin === location.origin ? candidate.href : location.href;
      } catch { originUrl = location.href; }
      showFocus(Boolean(selectedId));
    } else render();
  }).catch(() => showToast("读取推文失败"));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    tweets = Array.isArray(changes[STORAGE_KEY].newValue) ? changes[STORAGE_KEY].newValue : [];
    if (selectedId && !tweets.some((tweet) => tweet.id === selectedId)) selectedId = null;
    render();
  });
})();
