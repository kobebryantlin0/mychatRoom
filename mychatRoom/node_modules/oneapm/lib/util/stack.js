var path = require( 'path' );
var ONEAPM_MODULE_ROOT = path.resolve(__dirname, '../..')

function formatStack(stack) {
  if( !stack ) return '';
  // remove error message and instrumentation frames from stack trace
  return stack.split('\n').slice(1).filter(notOneAPM).join('\n');
}

function notOneAPM(frame) {
  return frame.indexOf(ONEAPM_MODULE_ROOT) === -1
}

exports.formatStack = formatStack;
