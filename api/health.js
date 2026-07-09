const { mailStatus } = require('../lib/mailer');

module.exports = (req, res) => {
  res.status(200).json(mailStatus());
};
