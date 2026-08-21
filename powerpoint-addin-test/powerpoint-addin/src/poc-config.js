(function (root, factory) {
  const config = factory();
  if (typeof module === "object" && module.exports) module.exports = config;
  root.SBRSPocConfig = config;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Replace this one placeholder when SBRS IT supplies the approved HTTPS host.
  const PRODUCTION_BASE_URL = "https://YOUR-SBRS-HTTPS-ORIGIN.example";

  return Object.freeze({
    productionBaseUrl: PRODUCTION_BASE_URL,
    storageNamespace: "sbrs-vehicle-dynamics-ppt-poc-v1",
    defaultScene: "vd-01",
    defaultVehicle: "f4",
    runtimeBase: `${PRODUCTION_BASE_URL}/Vehicle_Dynamics_Teaching_Tool_OFFLINE.html`,
    developmentRuntimeBase:
      "https://localhost:3000/Final_Classroom_Package/Vehicle_Dynamics_Teaching_Tool_OFFLINE.html",
    scenes: Object.freeze([
      Object.freeze({ id: "vd-01", label: "vd-01 — Moving Load Platform" }),
      Object.freeze({ id: "vd-02", label: "vd-02 — Tire / Contact Patch" }),
      Object.freeze({ id: "vd-03", label: "vd-03 — Braking / Nose Down" }),
      Object.freeze({ id: "vd-04", label: "vd-04 — Throttle / Nose Up" }),
      Object.freeze({ id: "vd-05", label: "vd-05 — Brake + Turn" }),
      Object.freeze({ id: "vd-06", label: "vd-06 — Throttle + Turn / Over-Limit" }),
    ]),
    vehicles: Object.freeze([
      Object.freeze({ id: "f4", runtimeId: "f4", label: "F4" }),
      // Keep the established runtime routes: `gtx` resolves to the Mustang
      // asset and `srx` resolves to the SRX asset now presented as GTX.
      Object.freeze({ id: "gtx", runtimeId: "gtx", label: "Mustang GT" }),
      Object.freeze({ id: "srx", runtimeId: "srx", label: "GTX" }),
    ]),
    legacyVehicleAliases: Object.freeze({ gt: "gtx" }),
    runtimeFlags: Object.freeze({ present: "1", instructor: "1" }),
  });
});
