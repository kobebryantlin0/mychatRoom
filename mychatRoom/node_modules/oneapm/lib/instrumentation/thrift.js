'use strict';

var path        = require('path')
  , shimmer     = require(path.join(__dirname, '..', 'shimmer'))
  , stackUtil   = require(path.join(__dirname, '..', 'util', 'stack' ) )
  , logger      = require(path.join(__dirname, '..', 'logger'))
  , recordThrift= require(path.join(__dirname, '..', 'metrics', 'recorders', 'thrift.js'))
  , NAMES       = require(path.join(__dirname, '..', 'metrics', 'names'))
  , THRIFT      = NAMES.THRIFT
  , recordExternal = require(path.join(__dirname, '..', 'metrics', 'recorders', 'http_external.js'))
  ;

module.exports = function initialize(agent, thrift) {
  var tracer = agent.tracer;

  shimmer.wrapMethod( thrift, 'thrift', 'createServer', function wrapper(createServer) {
    return tracer.callbackProxy(function wrappedHandler(service, provider) {
      for( let k in provider ) {
        shimmer.wrapMethod( provider, 'thrift_service.' + k, k, function wrapper( original ) {

          var proxied = tracer.transactionProxy( function wrapService() {
            var transaction = tracer.getTransaction();
            if (!transaction) return original.apply(this, arguments);

            // Mark it as a web transaction:
            transaction.url = THRIFT.PREFIX + '/' + k;
            transaction.verb = THRIFT.PREFIX;
            transaction.partialName = THRIFT.PREFIX + '/' + k;
            transaction.name = NAMES.WEB + '/' + transaction.partialName;

            var segment = tracer.addSegment( THRIFT.PREFIX + k, recordThrift );

            var stack = (new Error()).stack;
            segment.parameters.backtrace = stackUtil.formatStack( stack );

            var result = original.apply( null, arguments );
            //segment.markAsWeb('thrift' + k);
            transaction.end();
            segment.end();
            return result;
          } );

          // Construct the formal argument list
          var argList = [];
          for( var i=0,len=original.length; i<len; ++i ) {
            argList.push( 'arg' + i );
          }

          // Wrap the last callback into CLS, so the errors inside can be recorded.
          var args = tracer.slice(arguments)
          var position = args.length - 1
          var last     = args[position]
          if( last && typeof last === 'function') {
            function finalize(target) {
              function cls_finalize() {
                var returned = target.apply(this,  arguments );
                segment.end();
                return returned;
              };
              return cls_finalize;
            }
            arguments[position] = tracer.callbackProxy( finalize(last) );
          }

          // I know I really did something ugly with eval, but what else can I choose? 
          // The thrift framework just uses the original function's 'length' property, forcing me to construct the wrapped function with a correct number of formal arguments.
          // Uh...hope someday we can get rid of the continuation-local-storage module, which conflicts with the 'q' module.
          return eval( '(function(' + argList.toString() + '){ proxied.apply( this, arguments )  })');
        } );
      }

      var server = createServer.apply( this, arguments );
      server.on( 'error', function( error ) {
        logger.error( "Error when creating thrift server", error );
        // Since the server error is emitted in the event loop, it may not be related to a certain transaction, so just consume that there is no transaction.
        // If use tracer.getTransaction here, the error might be scoped to an unrelated transaction.
        agent.errors.add( null, error );
      } );

      return server;
    } );
  } );


  shimmer.wrapMethod( thrift, 'thrift', 'createClient', function wrapper(createClient) {
    
    return tracer.callbackProxy(function wrappedHandler(service, connection) {
      connection.on( 'error', function( error ) {
        var transaction = agent.tracer.getTransaction();
        agent.errors.add( transaction, error );
      } );

      var methods = Object.getOwnPropertyNames(service.prototype || service.Client.prototype);

      var targetMethods = [];
      methods.forEach( function( method ) {
        if( method.substr(0, 5) == 'send_' ) {
          var targetMethod = method.substring( 5, method.length );
          if( service.Client.prototype[targetMethod] ) { // Don't forget to check the existence of the target method in Client.prototype, or a method named with 'send_' will also be considered as things to wrap.
            targetMethods.push( targetMethod );
          }
        }
      } );

      targetMethods.forEach( function( method ) {
        shimmer.wrapMethod( service.Client.prototype, 'thriftClient', method, function( originalMethod ) {
          return tracer.segmentProxy( function wrapMethod() {

            if (!tracer.getTransaction() ) { // TODO Maybe a thrift client request should be considered as a complete transaction when it's not scoped with any other transaction?
              logger.trace("Not tracing thrift rpc method due to no transaction state.");
              return originalMethod.apply(this, arguments);
            }

            var host = connection.host;
            var port = connection.port;

            // Construct the thrift uri for recorder.
            var uri = 'thrift://' + host + ':' + port + '/';
            if( service.serviceName ) {
              uri += service.serviceName + '.';
            }
            uri += method;

            var transaction = agent.tracer.getTransaction()
              , name        = NAMES.EXTERNAL.PREFIX + '/thrift/' + host + ':' + port + '/' + method
              , segment     = tracer.addSegment(name, recordExternal(uri, 'thrift'))
              , args        = tracer.slice(arguments)
              , position    = args.length - 1
              , last        = args[position]
              ;

            segment.port = port;
            segment.host = host;

            function finalize(target) {
              function cls_finalize() {
                var returned = target.apply(this,  arguments );
                segment.end();
                return returned;
              };
              return cls_finalize;
            }

            if( typeof last === 'function' ) {
              args[position] = tracer.callbackProxy( finalize(last) );
            }
            else {
              logger.warn("OneAPM currently doesn't support thrift client request without a callback, this might cause unkonwn behaviors!");
            }

            return originalMethod.apply( this, args );
          } );
        } );
      } );

      return createClient.apply( this, arguments );
    } );
  } );


};
