/*
 # utilities/index.js
 # Utilities Index
 */

/**
 # Module Dependencies
 */

const common = require('./common');
const async = require('./async');
const normalize = require('./normalize');
const loaders = require('./loaders');

/**
 # Module Exports
 */

module.exports = {
  ...common,
  ...async,
  ...normalize,
  ...loaders,
};
