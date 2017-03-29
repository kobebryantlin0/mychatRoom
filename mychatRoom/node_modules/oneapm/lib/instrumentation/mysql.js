'use strict';

var path = require('path')
  , logger = require(path.join(__dirname, '..', 'logger')).child({component: 'mysql'})
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  , MYSQL = require(path.join(__dirname, '..', 'metrics', 'names')).MYSQL
  ;

var formatSqlString = require( 'mysql/lib/protocol/SqlString' ).format;

module.exports = function initialize(agent, mysql) {
  var tracer = agent.tracer;

  function queryWrapper(query) {
    return tracer.segmentProxy(function cb_segmentProxy(sql, values, callback) {

      logger.trace("Potentially tracing node-mysql 2 query.");

      var transaction = tracer.getTransaction();

      if (!transaction || arguments.length < 1) {

        if (!transaction) {
          logger.trace("Return early because no active context found");
        }

        return query.apply(this, arguments);
      }

      var actualSql, actualCallback, actualValues;

      // Analyse the arguments of Connection.prototype.query().
      // The prototype is:
      // query( sql, values, callback).
      //
      // sql could be a string, or an object containing the SQL string in the property 'sql', aka:
      // "SELECT * FROM users WHERE uid=13", or
      // { sql : "SELECT * FROM users WHERE uid=13" }
      // The MySQL driver also support value replacement, so the SQL string might contain place holder '?', aka:
      // "SELECT * FROM users WHERE uid=?", then the values argument should contain the content to replace '?', in an array, like [13].
      // When sql is an object, the values argument can be passed in sql.values. 
      //
      // Actually the MySQL driver compose all the content into one object in the lower level, an object like this:
      // { sql : "SELECT ... ?", values : [ 1 ] }, which is obtained in a Query instance(mysql/protocol/sequences/Query.js).

      if( typeof sql === 'object' || typeof sql === 'string' ) {
        actualSql = sql;
        if( typeof values === 'function' ) { // .query( sql, callback)
          actualCallback = values;
          actualValues = sql.values;
        }
        else { // .query( sql ) or .query( sql, null, callback ), the callback can be falsy here, since MySQL driver will handle it.
          actualValues = values || [];
          actualCallback = callback;
        }
      }
      else { // Empty sql, the original MySQL driver will return an error(saying 'Hey, the SQL should not be empty') in the callback.
        return query.apply( this, arguments );
      }

      // Get the real SQL string, by replacing the holder '?' with correct content, with the help of 'mysql' module.
      var sqlStr = formatSqlString( typeof actualSql === 'object' ? actualSql.sql : actualSql, actualValues );

      var ps = parseSql(MYSQL.PREFIX, sqlStr)
        , wrapped = tracer.callbackProxy(actualCallback)
        , name = MYSQL.STATEMENT + ps.model + '/' + ps.operation
        , segment = tracer.addSegment(name, ps.recordMetrics.bind(ps))
        ;

      tracer.getTransaction().addRecorder( ps.recordMetrics.bind( ps, segment ) );
      // capture connection info for datastore instance metric
      if (this.config) {
        segment.port = this.config.port;
        segment.host = this.config.host;
      }

      logger.trace("Adding node-mysql 2 query trace segment on transaction %d.",
        transaction.id);
      var returned = query.call(this, sql, actualValues, wrapped);
      returned.once('end', function handle_end() {
        segment.end();
        logger.trace("node-mysql 2 query finished for transaction %d.",
          transaction.id);
      });

      return returned;
    });
  }

  // FIXME: need a more general way of differentiating between driver versions
  if (mysql && mysql.createConnection) {
    // congratulations, you have node-mysql 2.0
    shimmer.wrapMethod(mysql, 'mysql', 'createConnection', function cb_wrapMethod(createConnection) {
      return tracer.segmentProxy(function cb_segmentProxy() {
        var connection = createConnection.apply(this, arguments);
        shimmer.wrapMethod(connection, 'connection', 'query', queryWrapper);
        return connection;
      });
    });

    shimmer.wrapMethod(mysql, 'mysql', 'createPool', function cb_wrapMethod(createPool) {
      return function () {
        var pool = createPool.apply(mysql, arguments);
        shimmer.wrapMethod(pool, 'pool', 'getConnection', function (getConnection) {
          return function (connectionCallback) {
            getConnection.call(pool, tracer.callbackProxy(function (err, connection) {

              if (connection && !connection.query.__NR_original) {
                shimmer.wrapMethod(connection, 'connection', 'query', queryWrapper);
              }

              connectionCallback.call(this, err, connection);
            }));
          };
        });

        shimmer.wrapMethod(pool, 'pool', 'query', queryWrapper);

        return pool;
      };
    });
  }
  else if (mysql && mysql.Client) {
    // congratulations, you have node-mysql 0.9
    shimmer.wrapMethod(mysql && mysql.Client && mysql.Client.prototype,
      'mysql.Client.prototype',
      'query',
      function cb_wrapMethod(query) {
        return tracer.segmentProxy(function cb_segmentProxy() {
          logger.trace("Potentially tracing node-mysql 0.9 query.");
          if (!tracer.getTransaction() || arguments.length < 1) {
            return query.apply(this, arguments);
          }
          var transaction = tracer.getTransaction();
          logger.trace("Tracing node-mysql 0.9 query on transaction %d.",
            transaction.id);

          var args = tracer.slice(arguments)
            , ps = parseSql(MYSQL.PREFIX, args[0])
            , name = MYSQL.STATEMENT + ps.model + '/' + ps.operation
            , segment = tracer.addSegment(name, ps.recordMetrics.bind(ps))
            ;

          tracer.getTransaction().addRecorder( ps.recordMetrics.bind( ps, segment ) );
          // capture connection info for datastore instance metric
          segment.port = this.port;
          segment.host = this.host;

          // find and wrap the callback
          if (args.length > 1 && typeof(args[args.length - 1]) === 'function') {
            args[args.length - 1] = tracer.callbackProxy(args[args.length - 1]);
          }

          // FIXME: need to grab error events as well, as they're also emitted on
          // the client

          var queried = query.apply(this, args);
          queried.once('end', function handle_end() {
            segment.end();
            logger.trace("node-mysql 0.9 query finished for transaction %d.",
              transaction.id);
          });

          return queried;
        });
      });
  }
};
