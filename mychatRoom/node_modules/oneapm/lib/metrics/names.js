'use strict';

var ERRORS = {
  PREFIX : 'Errors/',
  ALL    : 'Errors/all',
  WEB    : 'Errors/allWeb',
  OTHER    : 'Errors/allOther'
};

var EVENTS = {
  WAIT : 'Events/wait'
};

var MEMORY = {
  PHYSICAL : 'Memory/Used'
};

var CPU = {
  USERUtilization    :  'CPU/User/Utilization'
}

var VIEW = {
  PREFIX : 'View/',
  RENDER : '/Rendering'
};

var DATASTORE = {
  PREFIX    : 'Datastore/',
  STATEMENT : 'Datastore/statement',
  OPERATION : 'Datastore/operation',
  INSTANCE  : 'Datastore/instance',
  ALL       : 'Datastore/all',
  WEB       : 'Datastore/allWeb',
  OTHER     : 'Datastore/allOther'
};

var DB = {
  PREFIX    : 'Database/',
  STATEMENT : 'Database/statement',
  OPERATION : 'Database/operation',
  INSTANCE  : 'Database/instance',
  ALL       : 'Database/all',
  WEB       : 'Database/allWeb',
  OTHER     : 'Database/allOther'
};

var EXTERNAL = {
  PREFIX : 'External/',
  ALL    : 'External/all',
  WEB    : 'External/allWeb',
  THRIFT : 'External/allThrift',
  OTHER  : 'External/allOther'
};

var MEMCACHE = {
  PREFIX    : 'Memcached',
  OPERATION : DATASTORE.OPERATION + '/Memcached/',
  INSTANCE  : DATASTORE.INSTANCE  + '/Memcached/'
};

var MONGODB = {
  PREFIX    : 'MongoDB',
  STATEMENT : DATASTORE.STATEMENT + '/MongoDB/',
  OPERATION : DATASTORE.OPERATION + '/MongoDB/',
  INSTANCE  : DATASTORE.INSTANCE  + '/MongoDB/'
};

var MYSQL = {
  PREFIX    : 'MySQL',
  STATEMENT : DB.STATEMENT + '/MySQL/',
  OPERATION : DB.OPERATION + '/MySQL/',
  INSTANCE  : DB.INSTANCE  + '/MySQL/'
};

var MYSQL2 = {
  PREFIX    : 'MySQL2',
  STATEMENT : DB.STATEMENT + '/MySQL2/',
  OPERATION : DB.OPERATION + '/MySQL2/',
  INSTANCE  : DB.INSTANCE  + '/MySQL2/'
};

var POSTGRES = {
  PREFIX    : 'Postgres',
  STATEMENT : DB.STATEMENT + '/Postgres/',
  OPERATION : DB.OPERATION + '/Postgres/',
  INSTANCE  : DB.INSTANCE  + '/Postgres/'
};

var REDIS = {
  PREFIX    : 'Redis',
  OPERATION : DATASTORE.OPERATION + '/Redis/',
  INSTANCE  : DATASTORE.INSTANCE  + '/Redis/'
};

var THRIFT = {
  PREFIX    : 'Thrift'
};

var CASSANDRA = {
  PREFIX    : 'Cassandra',
  OPERATION : DATASTORE.OPERATION + '/Cassandra/',
  INSTANCE  : DATASTORE.INSTANCE  + '/Cassandra/'
};

var EXPRESS = {
  PREFIX : 'Expressjs/'
};

var RESTIFY = {
  PREFIX : 'Restify/'
};

var HAPI = {
  PREFIX : 'Hapi/'
};

var THINKJS = {
    PREFIX : 'Thinkjs'
};

module.exports = {
  URI              : 'Uri',
  NORMALIZED       : 'NormalizedUri',
  APDEX            : 'Apdex',
  WEB              : 'WebTransaction',
  HTTP             : 'HttpDispatcher',
  CONTROLLER       : 'Controller',
  CUSTOM           : 'Custom',
  SUPPORTABILITY   : 'Supportability/',
  QUEUETIME        : 'WebFrontend/QueueTime',
  ERRORS           : ERRORS,
  EVENTS           : EVENTS,
  CPU              : CPU,
  MEMORY           : MEMORY,
  VIEW             : VIEW,
  DB               : DB,
  DATASTORE        : DATASTORE,
  EXTERNAL         : EXTERNAL,
  MEMCACHE         : MEMCACHE,
  MONGODB          : MONGODB,
  MYSQL            : MYSQL,
  MYSQL2           : MYSQL2,
  POSTGRES         : POSTGRES,
  CASSANDRA        : CASSANDRA,
  REDIS            : REDIS,
  THRIFT           : THRIFT,
  EXPRESS          : EXPRESS,
  RESTIFY          : RESTIFY,
  HAPI             : HAPI,
  THINKJS       :THINKJS, 
  ACTION_DELIMITER : '/'
};
