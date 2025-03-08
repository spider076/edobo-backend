const express = require('express');
const router = express.Router();
const delete_fileController = require('../controllers/delete');
router.delete('/delete-file/:id', delete_fileController.delete_file);

module.exports = router;
