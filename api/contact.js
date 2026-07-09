const { handleContact } = require('../lib/mailer');

module.exports = async (req, res) => {
  await handleContact(req, res);
};
