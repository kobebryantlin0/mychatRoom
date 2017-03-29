'use strict';

var path  = require('path')
  , NAMES = require(path.join(__dirname, '..', 'names.js'))
  ;

/*
 *
 * CONSTANTS
 *
 */
var TO_MILLIS = 1e3;

function recordThrift(segment, scope) {
  // in web metrics, scope is required
  if (!scope) return;

  var duration         = segment.getDurationInMillis()
    , exclusive        = segment.getExclusiveDurationInMillis()
    , transaction      = segment.trace.transaction
    , partial          = segment.partialName
    , config           = segment.trace.transaction.agent.config
    // named / key transaction support requires per-name apdexT
    , keyApdexInMillis = config.web_transactions_apdex[scope] * TO_MILLIS
    ;
    
  // transaction.measure(scope,      scope, duration, exclusive);

  // Lance: Maybe we don't need so many types for thrift?
  
  transaction.measure(NAMES.WEB,   null, duration, exclusive);
  transaction.measure(NAMES.HTTP,  null, duration, exclusive);
  transaction.measure(scope,       null, duration, exclusive);

  if (transaction.queueTime > 0) {
    transaction.measure(NAMES.QUEUETIME, null, transaction.queueTime);
  }

  transaction._setApdex(NAMES.APDEX + '/' + 'thrift', duration, keyApdexInMillis);
  transaction._setApdex(NAMES.APDEX,                 duration, null);
}

module.exports = recordThrift;
