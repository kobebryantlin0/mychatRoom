'use strict';

var os = require('os');

module.exports = function facts(agent) {
    var lang = 'nodejs',
    app_names = agent.config.applications(),
    settings = agent.config.publicSettings();
    return {
        pid           : process.pid,
        host          : os.hostname(),
        language      : lang,
        identifier    : lang+':'+app_names[0],//TODO app port
        app_name      : app_names,
        agent_version : agent.version,
        environment   : agent.environment,
        settings      : settings,
        high_security : agent.config.high_security
    };
};
