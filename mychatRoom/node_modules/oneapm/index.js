'use strict';

// this file can be included multiple times

var logger = require('./lib/logger.js');
var locales = require('./locales');
var semver = require('semver');
var agent;
var API;

/**
 * pipe error to both process.stderr and logger
 *
 * @param error {Error}
 * @param message {String}
 */
function show_error(error, message) {
  logger.error(error, message);

  // Skip the 500 page error, wait for the server to fix it.
  if (error && error.statusCode && error.statusCode !== 500 ) {
    console.error(message);
    console.error(error.stack);
  }
}

/**
 * @param error
 * @returns {*}
 */
function agent_start_cb(error) {
  if (error) {
    show_error(error, locales.AGENT_STARTUP_ERROR);
  } else {
    return logger.debug(locales.AGENT_CONNECTED);
  }
}

try {

  // nodejs: 0.8.0
  // iojs  : 1.0.0 2.0.0
  if (process.version && semver.lt(process.version,'0.8.0')) {
    throw new Error(locales.NODE_VERSION_TOO_LOW);
  }

  logger.debug("Process uptime  is %d.", process.uptime());
  logger.debug("process cwd     is %s.", process.cwd());
  logger.debug("Process title   is %s.", process.title);
  logger.debug("Process argv    is %s.", process.argv.join(' '));

  /**
   * @throw Error if oneapm.js is not found, use ONEAPM_NO_CONFIG_FILE to mute
   */
  var config = require('./lib/config.js').initialize();

  if (!config.agent_enabled) {
    logger.info(locales.AGENT_NOT_ENABLED_ERROR);

  } else {

    var Agent = require('./lib/agent.js');
    agent = new Agent(config);

    var appNames = agent.config.applications();
    if (appNames.length < 1) {
      throw new Error(locales.AGENT_NO_NAME_ERROR);
    }

    var shimmer = require('./lib/shimmer.js');
    shimmer.patchModule(agent);
    shimmer.bootstrapInstrumentation(agent);
    agent.start(agent_start_cb);

    API = require('./api.js');

  }
} catch (error) {
  show_error(error, locales.AGENT_BOOTSTRAP_ERROR);
}

if (!API) {
  API = require('./stub_api.js');
}

module.exports = new API(agent);
