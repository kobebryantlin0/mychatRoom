'use strict';

var path  = require('path')
  , NAMES = require(path.join(__dirname, '..', 'names'))
  , DS    = NAMES.DATASTORE
  , REDIS = NAMES.REDIS
  ;

function recordRedis(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , type        = transaction.isWeb() ? DS.WEB : DS.OTHER
    , operation   = segment.name
    ;

  if (scope) transaction.measure(operation, scope, duration, exclusive);

  transaction.measure(operation, null, duration, exclusive);
  transaction.measure(type,      null, duration, exclusive);
  transaction.measure(DS.ALL,    null, duration, exclusive);

  if (segment.port > 0) {
    var hostname = segment.host || 'localhost'
      , location = hostname + ':' + segment.port
      , instance = DS.INSTANCE + '/' + REDIS.PREFIX + '/' + location
      ;

    transaction.measure(instance, null, duration, exclusive);
  }
}

module.exports = recordRedis;
