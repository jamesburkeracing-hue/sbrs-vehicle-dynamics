(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SBRSPowerPointPoc = api;
  if (typeof document !== "undefined") api.start();
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const config = root.SBRSPocConfig || (typeof require === "function" ? require("./poc-config.js") : null);

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

  function runtimeOrigin(base) {
    try {
      return new URL(base).origin;
    } catch (_error) {
      return null;
    }
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

  function defaultRuntimeBase(locationLike) {
    const hostname = locationLike && locationLike.hostname;
    return ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
      ? config.developmentRuntimeBase
      : config.runtimeBase;
  }

  function buildRuntimeUrl(base, scene, vehicle, revision) {
    const url = new URL(base);
    url.searchParams.set("scene", validScene(scene));
    url.searchParams.set("vehicle", runtimeVehicle(vehicle));
    Object.entries(config.runtimeFlags).forEach(([key, value]) => url.searchParams.set(key, value));
    if (revision) url.searchParams.set("shell", revision);
    return url.href;
  }

  function start() {
    let mounted = false;
    const mount = function () {
      if (mounted) return;
      mounted = true;
      const params = new URLSearchParams(root.location.search);
      const runtimeBase = permittedRuntimeOverride(params.get("runtimeBase"), root.location) || defaultRuntimeBase(root.location);
      const frame = document.getElementById("vehicle-frame");
      if (!frame) return;
      frame.src = buildRuntimeUrl(
        runtimeBase,
        validScene(params.get("scene")),
        validVehicle(params.get("vehicle")),
        root.SBRS_POC_BUILD_VERSION || "dev"
      );
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
    else mount();
  }

  return Object.freeze({
    buildRuntimeUrl,
    configuredScene,
    defaultRuntimeBase,
    permittedRuntimeOverride,
    runtimeOrigin,
    runtimeVehicle,
    validScene,
    validVehicle,
    start,
  });
});
