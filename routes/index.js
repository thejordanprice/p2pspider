const express = require('express');
const router = express.Router();
const magnetController = require('../controllers/magnetController');

router.get('/', magnetController.index);
router.get('/latest', magnetController.latest);
router.get('/statistics', magnetController.statistics);
router.get('/infohash', magnetController.infohash);
router.get('/search', magnetController.search);
router.get('/api/count', magnetController.count);

module.exports = router;
