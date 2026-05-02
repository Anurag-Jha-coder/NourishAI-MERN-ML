const mongoose = require('mongoose');

// Singleton collection – always one document with key='global'
const settingsSchema = new mongoose.Schema({
  key:              { type: String, default: 'global', unique: true },
  last_retrain_at:  { type: Date,   default: null },
});

module.exports = mongoose.model('Settings', settingsSchema);
