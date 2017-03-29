'use strict';

var path        = require('path')
  , shimmer     = require(path.join(__dirname, '..', 'shimmer'))
  , parseSql    = require(path.join(__dirname, '..', 'db', 'parse-sql'))
  , logger      = require(path.join(__dirname, '..', 'logger')).child({component : 'pg'})
  , POSTGRES    = require(path.join(__dirname, '..', 'metrics', 'names')).POSTGRES
  ;

module.exports = function initialize(agent, pgsql) {
  var tracer = agent.tracer;
  if( process.env.NODE_PG_FORCE_NATIVE ) {
    return instrumentNativePG( 'pg', pgsql );
  }

  // Instrument native pg(without NODE_PG_FORCE_NATIVE specified, native pg is accessible through pg.native)

  /* The code from pg, hoping load the 'native' property lazily(which IS a good idea since the native lib may not be installed, and most of the users won't use pg.native).
   * Let's replace the deprecated '__lookupGetter__' method with Object.getOwnPropertyDescriptor here, since the former never becomes the standard.
   * Object.getOwnPropertyDescriptor works with Node.JS v0.10.8 and higher.
   *
   * By the way, the '__defineGetter__' method cannot be replaced by Object.defineProperty with a get function,
   * within a get function, passing pgsql.native to a function will cause 'maximum call stack size exceeded' error
   * it makes sense, since we are calling native within its getter.
   *
   * While in a __defineGetter__ function, the behavior won't happen, if we refer to pgsql.native in the __defineGetter__'s code,
   * the call stack size error occurs, but it works well if we pass pgsql.native to the instrumentNativePG function.
   *
   * TODO: That's weired, more digging work will be done.
   *
    // Code in pg module:
    //lazy require native module...the native module may not have installed
    module.exports.__defineGetter__("native", function() {
      delete module.exports.native;
      module.exports.native = new PG(require('./native'));
      return module.exports.native;
    });
   *
   */

  /*
  Object.defineProperty( pgsql, 'native', {
    get : function() {
      var originalNative = originalNativeGetter();
      //instrumentNativePG( 'pg.native', pgsql.native );
      return originalNative;
    }
  } );
  */

  /* Alternative way using ___lookupGetter__
  var originalNativeGetter = pgsql.__lookupGetter__( 'native' );
  */
  var nativeDescriptor = Object.getOwnPropertyDescriptor( pgsql, 'native' )
  if( nativeDescriptor && nativeDescriptor.get ) {
    var originalNativeGetter = nativeDescriptor.get;

    delete pgsql.native;

    pgsql.__defineGetter__( 'native', function getNative() {
      // Don't ref the pgsql.native in the code, only pass it to the function.
      // console.log( !!pgsql.native );
      var originalNative = originalNativeGetter();
      instrumentNativePG( 'pg.native', pgsql.native );
      return originalNative;
    } );

    /* The code won't work, leave it here for further study.
    Object.defineProperty( pgsql, 'native', {
      get : function getNative() {
        var originalNative = originalGetter();
        instrumentNativePG( 'pg.native', pgsql.native ); // Just can't ref to pgsql.native even it's a function argument.
        return originalNative; 
      }
    } );
    */
  }
  

  function instrumentNativePG( name, pg ) {

    shimmer.wrapMethod( pg, name, 'Client', pgClientWrapper );
    shimmer.wrapMethod( pg.pools, name + '.pools', 'Client', pgClientWrapper );

    function pgClientWrapper( PGClient ) {
      function wrapClient () {
        var client = PGClient.apply( this, arguments );
        if( client === undefined ) 
          client = this;
        // Wrap the connect and query method of the pg client instance.
        shimmer.wrapMethod( client, 'pgclient.connect', 'connect', wrapConnect );
        shimmer.wrapMethod( client, 'pgclient.query', 'query', wrapQuery );


        return client;
      }
      wrapClient.prototype = PGClient.prototype;

      return wrapClient;
    }
  }

  // Instrument JS implementation.
  shimmer.wrapMethod(pgsql && pgsql.Client && pgsql.Client.prototype, 'pg.Client.prototype', 'query', wrapQuery);
  shimmer.wrapMethod(pgsql && pgsql.Client && pgsql.Client.prototype, 'pg.Client.prototype', 'connect', wrapConnect );


  function finalize( target, segment, transaction ) {
    return function cls_finalize() {
      var returned = target.apply(this, arguments);
      var transaction = transaction || tracer.getTransaction();
      if( arguments[0] ) { // Capture an error, if the callback is given to pgsql Client instance's query method, the 'error' event won't be emitted, the error is only accessible in the callback.
        agent.errors.add( transaction, arguments[0] );
      }
      if( segment ) {
        segment.end();
      }
      if( transaction ) {
        logger.trace("postgres command trace segment ended for transaction %d.", transaction && transaction.id);
      }
      return returned;
    };
  }

  function wrapConnect( connect ) {
    return function( cb ) { 
      // When using native pg, the connect method only accepts a callback parameter(the connection string should be passed to pg Client constructor).
      // While for the JS implementation, the prototype could be connect( connectString, callback )
      var args      = tracer.slice( arguments );
      var position  = args.length - 1;
      var last      = args[ position ];

      if( typeof last === 'function' ) {
        args[position] = tracer.callbackProxy( finalize( last ) );
      }
      return connect.apply( this, args );
    }
  }

  function wrapQuery( query ) {
    return tracer.segmentProxy(function wrapped( config, values, callback ) {
      var transaction = tracer.getTransaction();
      if (!transaction || arguments.length < 1) {
        logger.trace("Not tracing postgres command due to no transaction state.");
        return query.apply(this, arguments);
      }

      var sql;
      // config: might be a string which is the sql string, or an object with 'text' property as the sql string
      if( typeof config === 'string' || config instanceof String ) {
        sql = config;
      }
      else if( config && config.text ) {
        sql = config.text;
      }

      var ps = parseSql( POSTGRES.PREFIX, sql );

      var args = tracer.slice(arguments)
        , name = POSTGRES.STATEMENT + ps.model + '/' + ps.operation
        , segment  = tracer.addSegment(name, ps.recordMetrics.bind(ps))
        , position = args.length - 1
        , last = args[position]
        ;

      logger.trace("Adding postgres command trace segment transaction %d.",
        transaction.id);

      transaction.addRecorder( ps.recordMetrics.bind( ps, segment ) );

      // capture connection info for datastore instance metric
      segment.port = this.port;
      segment.host = this.host;


      if (typeof last === 'function') {
        args[position] = tracer.callbackProxy(finalize(last, segment, transaction));
      }
      else { // Make up a callback which won't affect the user's logic.
        args.push(function cb_push( err ) {
          if( err ) {
            agent.errors.add( transaction, err );
          }
          segment.end();
          logger.trace("postgres command trace segment ended for transaction %d.", transaction.id);
        });
      }
      var queried = query.apply( this, args );

      queried.on( 'error', end );
      queried.on( 'end', end );
      
      function end() {
        segment.end();
      }

      return queried;
    });
  }

};
