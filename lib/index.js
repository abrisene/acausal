/*
 # loaders.js
 # Loader Utilities
 */

/**
 # Module Dependencies
 */

const path = require('path');
const utilities = require('./utilities');
const structures = require('./structures');

const { loadSeeds } = utilities;
const { Markov } = structures;

/**
 # Module Exports
 */

module.exports = {
  ...structures,
  utilities,
};
