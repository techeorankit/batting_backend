const MODULES = {
  USER: "User",
  AGENCY: "Agency",
  HOST: "Host",
  HOST_REQUEST: "Host Request",
  HOST_TAGS: "Host Tags",
  DAILY_CHECKIN: "Daily CheckIn",
  GIFT: "Gift",
  GIFT_CATEGORY: "Gift Category",
  PLAN: "Plan",
  PLAN_HISTORY: "Plan History",
  VIP_PLAN_BENEFITS: "Vip Plan Benefits",
  WITHDRAWAL: "Withdrawal",
  REPORT: "Report",
  REPORT_REASON: "Report Reason",
  APP_LANGUAGES: "App Languages",
};

/**
 * HTTP method → permission action(s).
 * PATCH/PUT can be stored as either "Edit" or "Update" in the DB,
 * so we check for either.
 */
const METHOD_TO_ACTIONS = {
  GET: ["List"],
  POST: ["Create"],
  PATCH: ["Edit", "Update"],
  PUT: ["Edit", "Update"],
  DELETE: ["Delete"],
};

/**
 * @param {string} module - One of the MODULES values (e.g. MODULES.CATEGORY)
 */
const checkPermission = (module) => {
  return (req, res, next) => {
    // ── 1. Super-admin bypass ──────────────────────────────────────────────
    if (req.admin) return next();

    // ── 2. Staff (sub-admin) gate ──────────────────────────────────────────
    if (req.subadmin) {
      const permissions = req.subadmin?.role?.permissions;

      if (!permissions || !Array.isArray(permissions)) {
        console.warn(`⚠️ [RBAC] Staff ${req.subadmin._id} has no permissions array on their role.`);
        return res.status(403).json({
          status: false,
          message: "Access denied. No permissions configured for your role.",
        });
      }

      // a. Module check
      const modulePermission = permissions.find((p) => p.module === module);

      if (!modulePermission) {
        console.warn(`⚠️ [RBAC] Staff ${req.subadmin._id} denied — module "${module}" not in role.`);
        return res.status(403).json({
          status: false,
          message: `Access denied. You do not have access to the "${module}" module.`,
        });
      }

      // b. Action check
      const requiredActions = METHOD_TO_ACTIONS[req.method] || [];
      const grantedActions = modulePermission.actions || [];

      const hasAction = requiredActions.some((action) => grantedActions.includes(action));

      if (!hasAction) {
        console.warn(`⚠️ [RBAC] Staff ${req.subadmin._id} denied — action [${requiredActions.join(" or ")}] not permitted on module "${module}". Granted: [${grantedActions.join(", ")}]`);
        return res.status(403).json({
          status: false,
          message: `Access denied. You do not have permission to perform this action on the "${module}" module.`,
        });
      }

      // c. All good
      return next();
    }

    // ── 3. Neither admin nor staff (auth middleware mis-order) ─────────────
    console.warn("⚠️ [RBAC] Neither req.admin nor req.subadmin is set. Possible middleware mis-order.");
    return res.status(401).json({
      status: false,
      message: "Unauthorized. Authentication required.",
    });
  };
};

module.exports = { checkPermission, MODULES };
