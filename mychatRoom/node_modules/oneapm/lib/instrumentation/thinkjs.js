var path = require('path');
var NAMES = require(path.join(__dirname, '..', 'metrics', 'names.js'));
var logger = require(path.join(__dirname, '..', 'logger.js')).child({component: 'thinkjs'});
var shimmer = require(path.join(__dirname, '..', 'shimmer.js'));

function nameFromHTTP(segment, http) {
    if (!segment)
        return logger.error("No OneAPM context to set Thinkjs route name on.");
    if (!http)
        return logger.debug("No Thinkjs request to use for naming.");

    var transaction = segment.trace.transaction;

    // naming convention for thinks js is
    // PREFIX / HTTP_VERB / GROUP / CONTROLLER / ACTION
    var partialName = NAMES.THINKJS.PREFIX + transaction.verb
            + NAMES.ACTION_DELIMITER + http.group
            + NAMES.ACTION_DELIMITER + http.controller
            + NAMES.ACTION_DELIMITER + http.action;
    transaction.partialName = partialName;
    logger.debug(partialName);
}

module.exports = function (agent, thinkjs) {
    agent.environment.setDispatcher('thinkjs');
    agent.environment.setFramework('thinkjs');
    function wrapBehavior(_B) {
        return function cls_wrapMethod(name, http, data) {
            var result = _B.apply(global, arguments);
            if (isString(name)) {
                if (http.controller && !http.__oneapm_marked) {
                    nameFromHTTP(agent.tracer.getSegment(), http);
                    http.__oneapm_marked=true;
                }
            }
            return result;
        }
    }
    shimmer.wrapMethod(global, "global", "B", wrapBehavior);
}