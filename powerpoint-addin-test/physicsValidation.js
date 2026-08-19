(function () {
  "use strict";

  const EPS = 0.01;
  const ACTIVE = 0.18;
  const QUIET = 0.06;
  const NEAR_ZERO = 0.012;
  const warned = new Set();

  function nearlyEqual(a, b, tolerance = EPS) {
    return Math.abs(a - b) <= tolerance;
  }

  function greater(a, b, tolerance = EPS) {
    return a > b + tolerance;
  }

  function lower(a, b, tolerance = EPS) {
    return a < b - tolerance;
  }

  function highest(loads, key) {
    return Object.entries(loads).every(([other, value]) => other === key || loads[key] >= value - EPS);
  }

  function lowest(loads, key) {
    return Object.entries(loads).every(([other, value]) => other === key || loads[key] <= value + EPS);
  }

  function isBrakeOnly(s) {
    return s.speed > QUIET && s.longitudinalTransfer > 0.03 && s.brake > ACTIVE && s.throttle < QUIET && Math.abs(s.steer) < QUIET;
  }

  function isThrottleOnly(s) {
    return s.longitudinalTransfer < -0.03 && s.throttle > ACTIVE && s.brake < QUIET && Math.abs(s.steer) < QUIET;
  }

  function isRightSteerOnly(s) {
    return s.speed > QUIET && s.lateralTransfer > 0.03 && s.steer > ACTIVE && s.brake < QUIET && s.throttle < QUIET;
  }

  function isLeftSteerOnly(s) {
    return s.speed > QUIET && s.lateralTransfer < -0.03 && s.steer < -ACTIVE && s.brake < QUIET && s.throttle < QUIET;
  }

  function isBrakeRight(s) {
    return s.speed > QUIET && s.longitudinalTransfer > 0.18 && s.lateralTransfer > 0.18 && s.brake > ACTIVE && s.steer > ACTIVE && s.throttle < QUIET;
  }

  function isBrakeLeft(s) {
    return s.speed > QUIET && s.longitudinalTransfer > 0.18 && s.lateralTransfer < -0.18 && s.brake > ACTIVE && s.steer < -ACTIVE && s.throttle < QUIET;
  }

  function isThrottleRight(s) {
    return s.speed > QUIET && s.longitudinalTransfer < -0.18 && s.lateralTransfer > 0.18 && s.throttle > ACTIVE && s.steer > ACTIVE && s.brake < QUIET;
  }

  function isThrottleLeft(s) {
    return s.speed > QUIET && s.longitudinalTransfer < -0.18 && s.lateralTransfer < -0.18 && s.throttle > ACTIVE && s.steer < -ACTIVE && s.brake < QUIET;
  }

  function normalizeSnapshot(snapshot) {
    return {
      brake: Number(snapshot.brake) || 0,
      throttle: Number(snapshot.throttle) || 0,
      steer: Number(snapshot.steer ?? snapshot.steering) || 0,
      speed: Number(snapshot.speed) || 0,
      longitudinalTransfer: Number(snapshot.longitudinalTransfer) || 0,
      lateralTransfer: Number(snapshot.lateralTransfer) || 0,
      pitch: Number(snapshot.pitch) || 0,
      roll: Number(snapshot.roll) || 0,
      preset: snapshot.preset || "manual",
      loads: snapshot.loads || {},
      wheelSpinAxis: snapshot.wheelSpinAxis || "unknown"
    };
  }

  const rules = [
    {
      id: "brake-only",
      label: "Brake only",
      applies: isBrakeOnly,
      tests: [
        ["front tires must rise above static equally", (s) => greater(s.loads.FL, 0.23) && greater(s.loads.FR, 0.23) && nearlyEqual(s.loads.FL, s.loads.FR)],
        ["rear tires must fall below static equally", (s) => lower(s.loads.RL, 0.27) && lower(s.loads.RR, 0.27) && nearlyEqual(s.loads.RL, s.loads.RR)],
        ["chassis must pitch nose down", (s) => lower(s.pitch, 0, NEAR_ZERO)],
        ["roll must remain near zero", (s) => Math.abs(s.roll) <= NEAR_ZERO]
      ]
    },
    {
      id: "throttle-only",
      label: "Throttle only",
      applies: isThrottleOnly,
      tests: [
        ["rear tires must rise above static equally", (s) => greater(s.loads.RL, 0.27) && greater(s.loads.RR, 0.27) && nearlyEqual(s.loads.RL, s.loads.RR)],
        ["front tires must fall below static equally", (s) => lower(s.loads.FL, 0.23) && lower(s.loads.FR, 0.23) && nearlyEqual(s.loads.FL, s.loads.FR)],
        ["chassis must pitch nose up / rear squat", (s) => greater(s.pitch, 0, NEAR_ZERO)],
        ["roll must remain near zero", (s) => Math.abs(s.roll) <= NEAR_ZERO]
      ]
    },
    {
      id: "right-steer-only",
      label: "Right steer only",
      applies: isRightSteerOnly,
      tests: [
        ["left tires must increase", (s) => greater(s.loads.FL, s.loads.FR) && greater(s.loads.RL, s.loads.RR)],
        ["right tires must decrease", (s) => lower(s.loads.FR, s.loads.FL) && lower(s.loads.RR, s.loads.RL)],
        ["chassis must roll left", (s) => greater(s.roll, 0, NEAR_ZERO)],
        ["pitch must remain near zero", (s) => Math.abs(s.pitch) <= NEAR_ZERO]
      ]
    },
    {
      id: "left-steer-only",
      label: "Left steer only",
      applies: isLeftSteerOnly,
      tests: [
        ["right tires must increase", (s) => greater(s.loads.FR, s.loads.FL) && greater(s.loads.RR, s.loads.RL)],
        ["left tires must decrease", (s) => lower(s.loads.FL, s.loads.FR) && lower(s.loads.RL, s.loads.RR)],
        ["chassis must roll right", (s) => lower(s.roll, 0, NEAR_ZERO)],
        ["pitch must remain near zero", (s) => Math.abs(s.pitch) <= NEAR_ZERO]
      ]
    },
    {
      id: "brake-right",
      label: "Brake + right steer",
      applies: isBrakeRight,
      tests: [
        ["FL must be highest", (s) => highest(s.loads, "FL")],
        ["RR must be lowest", (s) => lowest(s.loads, "RR")],
        ["nose down", (s) => lower(s.pitch, 0, NEAR_ZERO)],
        ["roll left", (s) => greater(s.roll, 0, NEAR_ZERO)]
      ]
    },
    {
      id: "brake-left",
      label: "Brake + left steer",
      applies: isBrakeLeft,
      tests: [
        ["FR must be highest", (s) => highest(s.loads, "FR")],
        ["RL must be lowest", (s) => lowest(s.loads, "RL")],
        ["nose down", (s) => lower(s.pitch, 0, NEAR_ZERO)],
        ["roll right", (s) => lower(s.roll, 0, NEAR_ZERO)]
      ]
    },
    {
      id: "throttle-right",
      label: "Throttle + right steer",
      applies: isThrottleRight,
      tests: [
        ["RL must be highest", (s) => highest(s.loads, "RL")],
        ["FR must be lowest", (s) => lowest(s.loads, "FR")],
        ["nose up / rear squat", (s) => greater(s.pitch, 0, NEAR_ZERO)],
        ["roll left", (s) => greater(s.roll, 0, NEAR_ZERO)]
      ]
    },
    {
      id: "throttle-left",
      label: "Throttle + left steer",
      applies: isThrottleLeft,
      tests: [
        ["RR must be highest", (s) => highest(s.loads, "RR")],
        ["FL must be lowest", (s) => lowest(s.loads, "FL")],
        ["nose up / rear squat", (s) => greater(s.pitch, 0, NEAR_ZERO)],
        ["roll right", (s) => lower(s.roll, 0, NEAR_ZERO)]
      ]
    }
  ];

  function validate(snapshot) {
    const s = normalizeSnapshot(snapshot || {});
    const activeRules = rules.filter((rule) => rule.applies(s));
    const failures = [];

    for (const rule of activeRules) {
      for (const [expectation, test] of rule.tests) {
        let passed = false;
        try {
          passed = Boolean(test(s));
        } catch (error) {
          passed = false;
        }
        if (!passed) {
          failures.push(`${rule.label}: ${expectation}`);
        }
      }
    }

    for (const failure of failures) {
      if (!warned.has(failure)) {
        warned.add(failure);
        console.warn("[Physics validation]", failure, s);
      }
    }

    return {
      checkedRules: activeRules.map((rule) => rule.label),
      failures
    };
  }

  window.SkipBarberPhysicsValidation = {
    validate
  };
})();
