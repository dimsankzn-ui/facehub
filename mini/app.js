(function () {
  "use strict";

  var cfg = window.FACEHUB_MINI || {};
  var initData = "";
  var currentUser = null;
  var sdkLoaded = false;
  var launchParams = parseLaunchParams();

  function byId(id) {
    return document.getElementById(id);
  }

  function hasClass(node, name) {
    return (" " + node.className + " ").indexOf(" " + name + " ") >= 0;
  }

  function addClass(node, name) {
    if (!node || hasClass(node, name)) return;
    node.className = node.className ? node.className + " " + name : name;
  }

  function removeClass(node, name) {
    if (!node) return;
    var parts = node.className.split(/\s+/);
    var next = [];
    var i;
    for (i = 0; i < parts.length; i += 1) {
      if (parts[i] && parts[i] !== name) next.push(parts[i]);
    }
    node.className = next.join(" ");
  }

  function showScreen(id) {
    var ids = ["loadingScreen", "bindingScreen", "homeScreen"];
    var i;
    for (i = 0; i < ids.length; i += 1) {
      var node = byId(ids[i]);
      if (ids[i] === id) addClass(node, "active");
      else removeClass(node, "active");
    }
  }

  function parseQueryString(raw) {
    var result = {};
    var source = raw || "";
    if (source.charAt(0) === "#" || source.charAt(0) === "?") source = source.slice(1);
    if (!source) return result;

    var pairs = source.split("&");
    var i;
    for (i = 0; i < pairs.length; i += 1) {
      if (!pairs[i]) continue;
      var pos = pairs[i].indexOf("=");
      var key = pos >= 0 ? pairs[i].slice(0, pos) : pairs[i];
      var value = pos >= 0 ? pairs[i].slice(pos + 1) : "";
      try { key = decodeURIComponent(key.replace(/\+/g, "%20")); } catch (e) {}
      try { value = decodeURIComponent(value.replace(/\+/g, "%20")); } catch (e2) {}
      if (!(key in result)) result[key] = value;
    }
    return result;
  }

  function parseLaunchParams() {
    var hash = parseQueryString(window.location.hash || "");
    var search = parseQueryString(window.location.search || "");
    var merged = {};
    var key;
    for (key in search) if (Object.prototype.hasOwnProperty.call(search, key)) merged[key] = search[key];
    for (key in hash) if (Object.prototype.hasOwnProperty.call(hash, key)) merged[key] = hash[key];
    return merged;
  }

  function rawInitDataFromUrl() {
    var key = cfg.hashKey || "";
    if (key && launchParams[key]) return launchParams[key];

    if (cfg.platform === "telegram" && launchParams.tgWebAppData) return launchParams.tgWebAppData;
    if (cfg.platform === "max" && launchParams.WebAppData) return launchParams.WebAppData;

    return "";
  }

  function nativeObject() {
    if (cfg.platform === "telegram") {
      if (window.Telegram && window.Telegram.WebApp) return window.Telegram.WebApp;
      return null;
    }
    if (cfg.platform === "max") {
      return window.WebApp || null;
    }
    return null;
  }

  function rawInitDataFromNative() {
    var native = nativeObject();
    if (!native || typeof native.initData !== "string") return "";
    return native.initData || "";
  }

  function applyNativeEnhancements() {
    var native = nativeObject();
    if (!native) {
      updateRuntimeInfo(false);
      return;
    }

    try {
      if (typeof native.ready === "function") native.ready();
    } catch (e) {}
    try {
      if (typeof native.expand === "function") native.expand();
    } catch (e2) {}

    updateRuntimeInfo(true);
  }

  function loadSdk() {
    if (!cfg.sdk || document.getElementById("facehubMiniSdk")) return;

    var script = document.createElement("script");
    script.id = "facehubMiniSdk";
    script.src = cfg.sdk;
    script.async = true;
    script.onload = function () {
      sdkLoaded = true;
      applyNativeEnhancements();
    };
    script.onerror = function () {
      sdkLoaded = false;
      updateRuntimeInfo(false);
    };
    document.head.appendChild(script);
  }

  function updateRuntimeInfo(hasBridge) {
    var node = byId("runtimeInfo");
    if (!node) return;
    node.textContent = cfg.label + (hasBridge ? " · Bridge" : " · совместимый режим");
  }

  function encodeBody(action, data) {
    var pairs = [];
    pairs.push("action=" + encodeURIComponent(action));
    pairs.push("init_data=" + encodeURIComponent(initData || ""));

    var key;
    data = data || {};
    for (key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(data[key] == null ? "" : String(data[key])));
    }
    return pairs.join("&");
  }

  function api(action, data, done, fail) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", cfg.api + "?_t=" + new Date().getTime(), true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
    xhr.setRequestHeader("Cache-Control", "no-store");
    xhr.withCredentials = true;

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      var payload;
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch (e) {
        if (fail) fail("Сервер вернул некорректный ответ.");
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300 || payload.success === false) {
        if (fail) fail(payload.message || "Ошибка сервера.");
        return;
      }

      if (done) done(payload);
    };

    xhr.onerror = function () {
      if (fail) fail("Нет связи с сервером.");
    };

    xhr.send(encodeBody(action, data));
  }

  function avatarUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return "../" + String(path).replace(/^\/+/, "") + "?t=" + new Date().getTime();
  }

  function avatarFallback() {
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect width="100" height="100" rx="50" fill="#e5edf4"/>' +
      '<circle cx="50" cy="37" r="18" fill="#8297aa"/>' +
      '<path d="M17 88c5-23 21-34 33-34s28 11 33 34" fill="#8297aa"/>' +
      '</svg>'
    );
  }

  function withMiniParam(target) {
    var separator = target.indexOf("?") >= 0 ? "&" : "?";
    return target + separator + "mini=" + encodeURIComponent(cfg.platform || "");
  }

  function wireLinks() {
    var links = document.querySelectorAll("[data-target]");
    var i;
    for (i = 0; i < links.length; i += 1) {
      links[i].setAttribute("href", withMiniParam(links[i].getAttribute("data-target")));
    }
  }

  function renderHome(user) {
    currentUser = user || {};
    var name = [];
    if (currentUser.first_name) name.push(currentUser.first_name);
    if (currentUser.last_name) name.push(currentUser.last_name);

    byId("userName").textContent = name.length ? name.join(" ") : (currentUser.email || "Профиль");
    byId("platformState").textContent = cfg.label + " · facehub";

    var avatar = byId("userAvatar");
    avatar.src = currentUser.avatar_thumb ? avatarUrl(currentUser.avatar_thumb) : avatarFallback();
    avatar.onerror = function () { avatar.src = avatarFallback(); };

    if (currentUser.role === "admin") removeClass(byId("adminPanel"), "hidden");
    else addClass(byId("adminPanel"), "hidden");

    wireLinks();
    showScreen("homeScreen");
    applyNativeEnhancements();
  }

  function showBinding(message, allowLogin) {
    byId("bindingText").textContent = message || ("Свяжите " + cfg.label + " с существующим аккаунтом facehub.");
    byId("bindingError").textContent = "";
    if (allowLogin === false) addClass(byId("loginForm"), "hidden");
    else removeClass(byId("loginForm"), "hidden");

    var note = byId("compatNote");
    if (!initData) {
      note.textContent = "Не получены данные запуска " + cfg.label + ". Закройте окно и откройте mini-app повторно из бота.";
    } else {
      note.textContent = "Данные запуска получены. Связь с аккаунтом выполняется защищённо на сервере.";
    }

    showScreen("bindingScreen");
  }

  function bootstrapWithData(raw) {
    initData = raw || "";
    if (!initData) {
      showBinding("Не удалось получить данные запуска " + cfg.label + ".", false);
      return;
    }

    byId("loadingStatus").textContent = "Проверяю привязку…";

    api("bootstrap", {}, function (data) {
      if (data.status === "authenticated" && data.user) {
        renderHome(data.user);
        return;
      }

      if (data.site_session) {
        removeClass(byId("currentSessionButton"), "hidden");
        byId("bindingText").textContent =
          "Найден авторизованный аккаунт " + data.site_session.email +
          ". Его можно привязать без повторного ввода пароля.";
      } else {
        byId("bindingText").textContent =
          "Свяжите " + cfg.label + " с существующим аккаунтом facehub.";
      }

      showBinding(byId("bindingText").textContent, true);
    }, function (message) {
      showBinding(message, true);
      byId("bindingError").textContent = message;
    });
  }

  function discoverInitData() {
    var raw = rawInitDataFromUrl();
    if (raw) {
      bootstrapWithData(raw);
      return;
    }

    loadSdk();

    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      var nativeRaw = rawInitDataFromNative();
      if (nativeRaw) {
        window.clearInterval(timer);
        bootstrapWithData(nativeRaw);
        return;
      }

      if (attempts >= 24) {
        window.clearInterval(timer);
        bootstrapWithData("");
      }
    }, 200);
  }

  function setBusy(button, busy, busyText, normalText) {
    button.disabled = !!busy;
    button.textContent = busy ? busyText : normalText;
  }

  function bindLogin(event) {
    if (event && event.preventDefault) event.preventDefault();

    var button = byId("loginButton");
    byId("bindingError").textContent = "";
    setBusy(button, true, "Проверяю…", "Привязать аккаунт");

    api("bind_login", {
      email: byId("email").value.replace(/^\s+|\s+$/g, "").toLowerCase(),
      password: byId("password").value
    }, function (data) {
      setBusy(button, false, "Проверяю…", "Привязать аккаунт");
      if (data.user) renderHome(data.user);
    }, function (message) {
      setBusy(button, false, "Проверяю…", "Привязать аккаунт");
      byId("bindingError").textContent = message;
    });

    return false;
  }

  function bindCurrentSession() {
    var button = byId("currentSessionButton");
    byId("bindingError").textContent = "";
    setBusy(button, true, "Связываю…", "Использовать текущую сессию");

    api("bind_current_session", {}, function (data) {
      setBusy(button, false, "Связываю…", "Использовать текущую сессию");
      if (data.user) renderHome(data.user);
    }, function (message) {
      setBusy(button, false, "Связываю…", "Использовать текущую сессию");
      byId("bindingError").textContent = message;
    });
  }

  function unbind() {
    var button = byId("unbindButton");
    if (!window.confirm("Отвязать " + cfg.label + " от аккаунта facehub?")) return;

    button.disabled = true;
    api("unbind", {}, function () {
      var native = nativeObject();
      try {
        if (native && typeof native.close === "function") {
          native.close();
          return;
        }
      } catch (e) {}
      window.location.reload();
    }, function (message) {
      button.disabled = false;
      window.alert(message);
    });
  }

  function start() {
    wireLinks();
    updateRuntimeInfo(false);
    byId("platformState").textContent = cfg.label + " · facehub";
    byId("loginForm").onsubmit = bindLogin;
    byId("currentSessionButton").onclick = bindCurrentSession;
    byId("unbindButton").onclick = unbind;

    loadSdk();
    discoverInitData();
  }

  window.FacehubMini = {
    parseLaunchParams: parseLaunchParams,
    rawInitDataFromUrl: rawInitDataFromUrl,
    nativeObject: nativeObject
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}());