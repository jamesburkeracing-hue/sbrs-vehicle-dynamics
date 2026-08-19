(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBRSPowerPointPoc = api;
  if (typeof document !== "undefined") api.start();
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const config = root.SBRSPocConfig || (typeof require === "function" ? require("./poc-config.js") : null);
  const assignedSceneSetting = "assignedScene";

  function configuredScene(value) {
    return config.scenes.some((item) => item.id === value) ? value : null;
  }

  function validScene(value) {
    return configuredScene(value) || config.defaultScene;
  }

  function validVehicle(value) {
    const normalized = config.legacyVehicleAliases[value] || value;
    return config.vehicles.some((item) => item.id === normalized) ? normalized : config.defaultVehicle;
  }

  function runtimeVehicle(value) {
    return config.vehicles.find((item) => item.id === validVehicle(value)).runtimeId;
  }

  function permittedRuntimeOverride(value, locationLike) {
    if (!value) return null;
    try {
      const url = new URL(value, locationLike && locationLike.href);
      return url.origin === runtimeOrigin(defaultRuntimeBase(locationLike)) ? url.href : null;
    } catch (_error) {
      return null;
    }
  }

  function buildRuntimeUrl(base, scene, vehicle, revision) {
    const url = new URL(base);
    const flags = config.runtimeFlags;
    url.searchParams.set("scene", validScene(scene));
    url.searchParams.set("vehicle", runtimeVehicle(vehicle));
    Object.keys(flags).forEach((key) => url.searchParams.set(key, flags[key]));
    if (revision) url.searchParams.set("shell", revision);
    return url.href;
  }

  function defaultRuntimeBase(locationLike) {
    const hostname = locationLike && locationLike.hostname;
    return ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
      ? config.developmentRuntimeBase
      : config.runtimeBase;
  }

  function runtimeOrigin(base) {
    try {
      return new URL(base).origin;
    } catch (_error) {
      return null;
    }
  }

  function storageKey(partitionKey) {
    return `${config.storageNamespace}:${partitionKey || "standalone"}`;
  }

  function readState(storage, key) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || "{}");
      return { scene: validScene(parsed.scene), vehicle: validVehicle(parsed.vehicle) };
    } catch (_error) {
      return { scene: config.defaultScene, vehicle: config.defaultVehicle };
    }
  }

  function writeState(storage, key, state) {
    const clean = { scene: validScene(state.scene), vehicle: validVehicle(state.vehicle) };
    storage.setItem(key, JSON.stringify(clean));
    return clean;
  }

  function resolvePartitionKey(office) {
    const value = office && office.context && office.context.partitionKey;
    return typeof value === "string" && value ? value : "standalone";
  }

  function readAssignedScene(office) {
    const settings = office && office.context && office.context.document && office.context.document.settings;
    return settings && typeof settings.get === "function" ? configuredScene(settings.get(assignedSceneSetting)) : null;
  }

  function saveAssignedScene(office, scene, callback) {
    const settings = office && office.context && office.context.document && office.context.document.settings;
    const assigned = validScene(scene);
    if (!settings || typeof settings.set !== "function" || typeof settings.saveAsync !== "function") {
      if (callback) callback(false);
      return false;
    }
    settings.set(assignedSceneSetting, assigned);
    settings.saveAsync(function (result) {
      if (callback) callback(!result || !root.Office || result.status === root.Office.AsyncResultStatus.Succeeded);
    });
    return true;
  }

  function isTrustedRuntimeEvent(event, frame, trustedOrigin) {
    return event && event.source === frame.contentWindow && event.origin === trustedOrigin &&
      event.data && event.data.type === "sbrs-model-event";
  }

  function populate(select, items) {
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function start() {
    let mounted = false;
    const mount = function () {
      if (mounted) return;
      mounted = true;
      const office = root.Office;
      const partition = resolvePartitionKey(office);
      const key = storageKey(partition);
      const params = new URLSearchParams(root.location.search);
      const stored = readState(root.localStorage, key);
      const assignedScene = readAssignedScene(office);
      const setupMode = params.get("setup") === "1" || !assignedScene;
      const requestedScene = setupMode ? configuredScene(params.get("scene")) : null;
      let state = {
        scene: requestedScene || assignedScene || config.defaultScene,
        vehicle: validVehicle(params.get("vehicle") || stored.vehicle),
      };
      const runtimeOverride = permittedRuntimeOverride(params.get("runtimeBase"), root.location);
      const runtimeBase = runtimeOverride || defaultRuntimeBase(root.location);
      const trustedRuntimeOrigin = runtimeOrigin(runtimeBase);
      const revision = root.SBRS_POC_BUILD_VERSION || "dev";
      const sceneSelect = document.getElementById("scene-select");
      const vehicleSelect = document.getElementById("vehicle-select");
      const frame = document.getElementById("vehicle-frame");
      const status = document.getElementById("status-text");
      const saveAssignment = document.getElementById("save-scene-assignment");
      const replay = document.getElementById("replay-button");
      const version = document.getElementById("build-version");
      const startedAt = root.performance.now();

      populate(sceneSelect, config.scenes);
      populate(vehicleSelect, config.vehicles);
      sceneSelect.value = state.scene;
      vehicleSelect.value = state.vehicle;
      sceneSelect.disabled = !setupMode;
      saveAssignment.hidden = !setupMode;
      document.body.dataset.setupMode = setupMode ? "true" : "false";
      version.textContent = revision;

      function setStatus(text, level) {
        status.textContent = text;
        status.dataset.level = level || "info";
      }

      function loadFrame(reason) {
        state = writeState(root.localStorage, key, state);
        setStatus(reason || "Loading hosted Vehicle Dynamics…", "loading");
        frame.src = buildRuntimeUrl(runtimeBase, state.scene, state.vehicle, revision);
      }

      function updateSelection() {
        state = { scene: sceneSelect.value, vehicle: vehicleSelect.value };
        loadFrame("Changing teaching scenario…");
      }

      sceneSelect.addEventListener("change", updateSelection);
      vehicleSelect.addEventListener("change", updateSelection);
      saveAssignment.addEventListener("click", function () {
        saveAssignedScene(office, state.scene, function (saved) {
          setStatus(saved ? "Slide scene assignment saved" : "Unable to save slide scene assignment", saved ? "ready" : "error");
        });
      });
      replay.addEventListener("click", function () {
        state = { scene: sceneSelect.value, vehicle: vehicleSelect.value };
        state = writeState(root.localStorage, key, state);
        if (!trustedRuntimeOrigin || new URL(frame.src, root.location.href).origin !== trustedRuntimeOrigin) {
          setStatus("Replay blocked: untrusted runtime origin", "error");
          return;
        }
        frame.contentWindow.postMessage({ type: "skip-model-command", command: "replay" }, trustedRuntimeOrigin);
        setStatus("Replaying current scenario…", "loading");
      });
      root.addEventListener("message", function (event) {
        if (!isTrustedRuntimeEvent(event, frame, trustedRuntimeOrigin)) return;
        if (event.data.event === "replay-complete") setStatus("Current scenario replayed", "ready");
      });
      frame.addEventListener("load", function () {
        const elapsed = Math.round(root.performance.now() - startedAt);
        setStatus(`Hosted runtime loaded in ${elapsed} ms`, "ready");
        document.body.dataset.runtimeLoaded = "true";
        document.body.dataset.loadMs = String(elapsed);
      });
      frame.addEventListener("error", function () {
        setStatus("Hosted runtime failed to load. Check network access.", "error");
      });
      root.addEventListener("pageshow", function () {
        const restored = readState(root.localStorage, key);
        sceneSelect.value = restored.scene;
        vehicleSelect.value = restored.vehicle;
      });
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
          const restored = readState(root.localStorage, key);
          sceneSelect.value = restored.scene;
          vehicleSelect.value = restored.vehicle;
        }
      });

      if (office && office.context && office.context.document &&
          typeof office.context.document.getActiveViewAsync === "function") {
        office.context.document.getActiveViewAsync(function (result) {
          const view = result && result.value ? String(result.value) : "PowerPoint";
          document.body.dataset.officeView = view;
        });
      }

      loadFrame();
    };

    if (root.Office && typeof root.Office.onReady === "function") {
      root.Office.onReady().then(mount, mount);
      root.setTimeout(mount, 1500);
    } else {
      window.addEventListener("DOMContentLoaded", mount, { once: true });
    }
  }

  return Object.freeze({
    buildRuntimeUrl,
    configuredScene,
    defaultRuntimeBase,
    isTrustedRuntimeEvent,
    permittedRuntimeOverride,
    readAssignedScene,
    readState,
    resolvePartitionKey,
    runtimeVehicle,
    runtimeOrigin,
    saveAssignedScene,
    storageKey,
    validScene,
    validVehicle,
    writeState,
    start,
  });
});
