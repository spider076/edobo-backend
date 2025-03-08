const { singleFileDelete } = require('../config/uploader');
const deleteFile = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await singleFileDelete(id);
    res.status(200).json({ success: true, message: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
module.exports = { deleteFile };
