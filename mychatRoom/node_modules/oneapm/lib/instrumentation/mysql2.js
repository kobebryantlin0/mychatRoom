'use strict';

var path = require('path')
  , logger = require(path.join(__dirname, '..', 'logger')).child({component: 'mysql'})
  , shimmer = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  , MYSQL2 = require(path.join(__dirname, '..', 'metrics', 'names')).MYSQL2
  ;

var formatSqlString = require( 'mysql/lib/protocol/SqlString' ).format;

var RE_NAMED_PLACEHOLDERS = /(?:\?)|(?::(\d+|(?:[a-zA-Z][a-zA-Z0-9_]*)))/g;

module.exports = function initialize(agent, mysql2) {
  var tracer = agent.tracer;

  // Comment the Connection class warpping, since mysql2 doesn't export it to the user( Connection is exported, while the essential ConnectionConfig is not, weird).
  // TODO Uncomment it once mysql2 exports it completely to the user.
  // Wrap the Connection class
  /*
  shimmer.wrapMethod( mysql2, 'mysql2.Connection', 'Connection', connectionWrapper );
  function connectionWrapper( Connection ) {
    function wrapConnection() {
      var connection = Connection.apply( this, arguments );
      if( connection === undefined )
        connection = this;

      shimmer.wrapMethod( connection, 'mysql2.Connection.query', 'query', queryWrapper );
      shimmer.wrapMethod( connection, 'mysql2.Connection.query', 'execute', queryWrapper );

      return connection;
    }

    return wrapConnection;
  }
  */

  shimmer.wrapMethod( mysql2, 'mysql2', 'createConnection', createConnectionWrapper );
  shimmer.wrapMethod( mysql2, 'mysql2', 'connect', createConnectionWrapper );
  function createConnectionWrapper( createConnection ) {
    function wrapCreateConnection() {
      var connection = createConnection.apply( this, arguments );
      shimmer.wrapMethod( connection, 'mysql2.Connection', 'query', queryWrapper );
      shimmer.wrapMethod( connection, 'mysql2.Connection', 'execute', queryWrapper );
      shimmer.wrapMethod( connection, 'mysql2.Connection', 'prepare', prepareWrapper );

      return connection;
    }
    return wrapCreateConnection;
  }



  shimmer.wrapMethod(mysql2, 'mysql', 'createPool', createPoolWrapper );

  // Copied from mysql instrumentation.
  // TODO Extract the code for reusing.
  function createPoolWrapper(createPool) {
    return function () {
      var pool = createPool.apply(mysql2, arguments);
      shimmer.wrapMethod(pool, 'pool', 'getConnection', function (getConnection) {
        return function (connectionCallback) {
          getConnection.call(pool, tracer.callbackProxy(function (err, connection) {

            if (connection && !connection.query.__NR_original) {
              shimmer.wrapMethod(connection, 'connection', 'query', queryWrapper);
              shimmer.wrapMethod(connection, 'connection', 'execute', queryWrapper);
              shimmer.wrapMethod(connection, 'connection', 'prepare', prepareWrapper);
            }

            connectionCallback.call(this, err, connection);
          }));
        };
      });

      /* mysql2's pool just call its connection(by getConnection method) to make the query or execution, so pool wrapping is not needed.
      shimmer.wrapMethod(pool, 'pool', 'query', queryWrapper);
      shimmer.wrapMethod(pool, 'pool', 'execute', queryWrapper);
      */

      return pool;
    };
  };


  function prepareWrapper( prepare ) {
    return function( options, callback ) {
      return prepare.call( this, options, tracer.callbackProxy( function( err, statement ) {
        statement['oneapm:prepare'] = true; // Make a special mark on statment, which is used in queryWrapper.
        shimmer.wrapMethod( statement, 'statement', 'execute', queryWrapper );
        callback.call( this, err, statement );
      } ) );
    }
  }

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

      if( this['oneapm:prepare'] ) { // The arguments is just values and callback, the sql is stored in this.query('this' is a PreparedStatement instance).
        actualSql = this.query;
        actualValues = sql;
        actualCallback = values;
      }
      else { // Not in a prepare statment.
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
      }

      // Get the real SQL string, by replacing the holder '?' with correct content, with the help of 'mysql' module.
      var sqlStr = formatSqlString( typeof actualSql === 'object' ? actualSql.sql : actualSql, actualValues );

      var ps = parseSql(MYSQL2.PREFIX, sqlStr)
        , wrapped = tracer.callbackProxy(actualCallback)
        , name = MYSQL2.STATEMENT + ps.model + '/' + ps.operation
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


      var returned;
      if( this['oneapm:prepare'] ) { // A prepare statment's execute method just accepts the values and callback.
        returned = query.call(this, actualValues, wrapped);
      }
      else {
        returned = query.call(this, actualSql, actualValues, wrapped);
      }
      returned.once('end', function handle_end() {
        segment.end();
        logger.trace("node-mysql 2 query finished for transaction %d.",
          transaction.id);
      });

      return returned;
    });
  }

};
