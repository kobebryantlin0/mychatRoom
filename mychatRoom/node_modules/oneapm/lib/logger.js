'use strict';

var path   = require('path')
  , Logger = require('bunyan')
  , options
  ;

//"trace" (10): Logging from external libraries used by your app or very detailed application logging.
//"debug" (20): Anything else, i.e. too verbose to be included in "info" level.
//"info" (30): Detail on regular operation.
//"warn" (40): A note on something that should probably be looked at by an operator eventually.
//"error" (50): Fatal for a particular request, but the service/app continues servicing other requests. An operator should look at this soon(ish).
//"fatal" (60): The service/app is going to stop or become unusable now. An operator should definitely look into this soon.

var LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal'
];

function coerce(value) {
  if (!isNaN(parseInt(value, 10)) && isFinite(value)) {
    // value is numeric
    if (value < 10) value = 10;
    if (value > 60) value = 60;
  }
  else if (LEVELS.indexOf(value) === -1) {
    value = 'info';
  }

  return value;
}

// can't use shimmer here because shimmer depends on logger
var _level = Logger.prototype.level;
Logger.prototype.level = function validatingLevel(value) {
  return _level.call(this, coerce(value));
};

options = {
  name   : 'oneapm_bootstrap',
  stream : process.stdout,
  level  : 'info'
};

// create bootstrapping logger
module.exports = new Logger(options);


/**
 * Don't load config.js until this point, because it requires this
 * module, and if it gets loaded too early, module.exports will have no
 * value.
 */
var config = require(path.join(__dirname, 'config.js')).initialize();
options = {
  name    : 'oneapm',
  streams : [{level : coerce(config.logging.level)}]
};

switch (config.logging.filepath) {
  case 'stdout':
    options.streams[0].stream = process.stdout;
  break;

  case 'stderr':
    options.streams[0].stream = process.stderr;
  break;

  default:
    options.streams[0].path = config.logging.filepath;
}

// create the "real" logger
module.exports = new Logger(options);

// now tell the config module to switch to the real logger
config.setLogger(module.exports);
