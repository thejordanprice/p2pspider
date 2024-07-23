const mongoose = require('mongoose');

const magnetSchema = new mongoose.Schema({
  name: { type: String, index: true },
  infohash: { type: String, index: true },
  magnet: String,
  fetchedAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model('Magnet', magnetSchema);
