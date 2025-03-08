const express = require("express");
const router = express.Router();
const userController = require("../controllers/user");
const adminController = require("../controllers/admin");

const verifyToken = require("../config/jwt");
router.get("/users/profile", verifyToken, userController.getOneUser);

router.put("/users/profile", verifyToken, userController.updateUser);

router.get("/users/invoice", verifyToken, userController.getInvoice);

router.put(
	"/users/change-password",
	verifyToken,
	userController.changePassword
);
// router.post("/admin/users/:uid", verifyToken, userController.getUserByAdmin);
// router.post("/admin/users/role/:uid", verifyToken, userController.updateRole)
router.get("/admin/users", verifyToken, adminController.getUsersByAdmin);

router.get("/admin/users/:id", verifyToken, adminController.getOrdersByUid);

router.post(
	"/admin/users/role/:id",
	verifyToken,
	adminController.UpdateRoleByAdmin
);

module.exports = router;
