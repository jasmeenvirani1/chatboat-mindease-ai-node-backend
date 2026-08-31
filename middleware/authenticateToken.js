const jwt = require("jsonwebtoken");
// const RolesPermissions = require("../models/RolesPermissionsModel");
const User = require("../models/UserModel");
// const Menu = require("../models/MenuModel");

const jwtkey = require("../helper/jwtSecret");

const authenticateToken = async (req, res, next) => {
  try {
    const publicRoutes = [
      { path: "/register", method: "POST" },
      { path: "/login", method: "POST" },
      { path: "/sendOtp", method: "POST" },
      { path: "/verifyOtp", method: "POST" },
      { path: "/resetPasswordWithOtp", method: "PUT" },
      { path: "/settings", method: "GET" },
    ];

    const isPublicRoute = publicRoutes.some(
      (route) => route.path === req.path && route.method === req.method
    );

    if (isPublicRoute) {
      return next();
    }

    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      // console.log("Authorization header not provided");
      return res.status(403).json({ error: "Token required!" });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    // console.log("Token received:", token);

    const decodedToken = jwt.verify(token, jwtkey);
    // console.log("Decoded token:", JSON.stringify(decodedToken, null, 2));

    if (!decodedToken || !decodedToken.id) {
      // console.log("Invalid token payload:", decodedToken);
      return res.status(401).json({ error: "Invalid token payload!" });
    }

    const user = await User.findById(decodedToken.id).populate("email");
    // console.log("User found:", JSON.stringify(user, null, 2));
    if (!user || !user.email) {
      // console.log("User or role not found. User:", JSON.stringify(user, null, 2));
      return res.status(403).json({ error: "Invalid user email!" });
    }

    // if (user.roleId.roleId === 1) {
    //   // console.log("Admin access granted. Bypassing dynamic authorization.");
    //   req.user = user;
    //   return next();
    // } else {
    //   return res.status(403).json({ error: "User not  Authorized!" });
    // }

    // const rolePermissions = await RolesPermissions.findOne({
    //   roleId: user.roleId._id,
    //   isDeleted: false,
    // }).populate("permissions.menuId");
    // // console.log("Role permissions:", JSON.stringify(rolePermissions, null, 2));

    // if (!rolePermissions) {
    //   // console.log("No role permissions found for roleId:", user.roleId._id);
    //   return res.status(403).json({ error: "No permissions assigned to this role!" });
    // }

    const pathSegments = req.originalUrl
      .split("?")[0]
      .split("/")
      .filter((segment) => segment !== "");
    // console.log("Processed URL segments:", pathSegments);

    const extractedSlug =
      pathSegments.length > 2 ? pathSegments[2] : pathSegments[1];
    // console.log("Extracted menu slug:", extractedSlug);

    if (!extractedSlug) {
      console.log("Menu slug extraction failed, empty slug detected!");
      return res.status(400).json({ error: "Invalid or missing menu slug!" });
    }

    // const menu = await Menu.findOne({ slug: extractedSlug, isDeleted: false });

    // if (!menu) {
    //   console.log("Menu not found for slug:", extractedSlug);
    //   return res.status(404).json({ error: "Menu not found!" });
    // }

    let isMatch = false;
    // rolePermissions.permissions.forEach((permission, index) => {
    //   // console.log("permission", permission?.menuId?._id, "menu._id", menu?._id);
    //   if (permission?.menuId._id.toString() == menu?._id.toString()) {
    //     if (req.method == "GET" && permission.permissionIds.get) {
    //       console.log("permission", permission);
    //       isMatch = true;
    //     } else if (req.method == "POST" && permission.permissionIds.create) {
    //       isMatch = true;
    //     } else if (req.method == "DELETE" && permission.permissionIds.delete) {
    //       isMatch = true;
    //     } else if (req.method == "PUT" && permission.permissionIds.update) {
    //       isMatch = true;
    //     }
    //   }
    // });

    // console.log("isMatch", isMatch);

    // const permission = rolePermissions.permissions.find(p =>
    //   p.menuId._id.equals(menu._id)
    // );

    // if (!permission) {
    //   // console.log("Permission not found for menu with _id:", menu._id);
    //   return res.status(403).json({ error: "Access denied!" });
    // }

    const method = req.method.toLowerCase();
    const actionMap = {
      get: "get",
      post: "create",
      put: "update",
      delete: "delete",
    };
    const action = actionMap[method];
    // console.log("HTTP method:", method, "Mapped action:", action);

    // if (action && !permission.permissionIds[action]) {
    //   // console.log("Permission denied for action:", action, "Permission IDs:", JSON.stringify(permission.permissionIds, null, 2));
    //   return res.status(403).json({ error: `Access denied for ${action} action!` });
    // }

    req.user = user;
    // console.log("User authorized, proceeding to next middleware...");
    next();
  } catch (error) {
    console.error("Token authentication error:", error);
    res.status(401).json({ error: "Invalid token!" });
  }
};

module.exports = authenticateToken;
