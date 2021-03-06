const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Subscription data
exports.Subscription = sequelize.define('subscriptions', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  asanaWebhookId: {
    type: Sequelize.STRING
  },
  asanaUserId: {
    type: Sequelize.STRING
  },
  groupId: {
    type: Sequelize.STRING
  }
});
