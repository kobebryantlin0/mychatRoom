'use strict';

var path = require('path')
  , DB   = require(path.join(__dirname, '..', 'metrics', 'names')).DB
  ;

/**
 *
 * @param type
 * @param operation
 * @param model
 * @param raw   : The raw sql string, like 'SELECT * FROM ....'
 */
function ParsedStatement(type, operation, model, raw) {
  this.type      = type;
  this.operation = operation;
  this.model     = model;

  this.trace     = null;
  this.raw       = '';

  if( typeof raw === 'string' ) {
    this.trace = new Error();
    this.raw   = raw;
  }
}

ParsedStatement.prototype.recordMetrics = function recordMetrics(segment, scope) {
  var duration    = segment.getDurationInMillis()
    , exclusive   = segment.getExclusiveDurationInMillis()
    , transaction = segment.trace.transaction
    , type        = transaction.isWeb() ? DB.WEB : DB.OTHER
    , operation   = DB.OPERATION + '/' + this.type + '/' + this.operation
    , model       = DB.STATEMENT + '/' + this.type +
                      '/' + this.model + '/' + this.operation
    ;
  
  // Database/update
  var globalOperation   = DB.PREFIX + this.operation;

  if (scope) transaction.measure(model, scope, duration, exclusive);

  transaction.measure(model,     null, duration, exclusive);
  transaction.measure(operation, null, duration, exclusive);
  transaction.measure(type,      null, duration, exclusive);
  transaction.measure(DB.ALL,    null, duration, exclusive);
  
  transaction.measure(globalOperation,    null, duration, exclusive);

  if (segment.port > 0) {
    var hostname = segment.host || 'localhost'
      , location = hostname + ':' + segment.port
      , instance = DB.INSTANCE + '/' + this.type + '/' + location
      ;

    transaction.measure(instance, null, duration, exclusive);
  }

  if( this.raw ) { // If the ParsedStatment contains a raw SQL statement, add it to the agent's QueryTracer
    transaction.agent.queries.addQuery( segment, this.type.toLowerCase(), this.raw, this.trace );
  }
};

module.exports = ParsedStatement;
