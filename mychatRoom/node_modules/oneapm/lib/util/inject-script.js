/**
 * Created by yan on 15-8-5.
 */
var path = require('path');
var logger = require(path.join(__dirname, '../logger'))
  .child({component: 'api-inject-script'});

var loading = false;
var inline_content_cache = {};

/**
 *
 * @param js_agent_loader
 */
function set_cache(js_agent_loader) {
  loading = true;
  var js_agent_loader_url = "http:" + js_agent_loader;
  var req = require('http').request(js_agent_loader_url, function (res) {
    var buf = [];
    var buf_len = 0;
    res.on('data', function (r) {
      buf.push(r);
      buf_len += r.length;
    });
    res.on('end', function () {
      loading = false;
      var content = Buffer.concat(buf, buf_len);
      inline_content_cache[js_agent_loader] = '</script><script type="text/javascript">' + content.toString('UTF-8');
      logger.debug('get inline script content ', {
        js_agent_loader: js_agent_loader,
        content: inline_content_cache[js_agent_loader]
      });
      logger.info('updated inline_content_cache', Object.keys(inline_content_cache));
    });
  });

  logger.info('requesting %s ', js_agent_loader_url);
  req.end();
}

/**
 *  return inline or external script for BI features
 *
 * @since v1.2.5
 *
 * @param js_agent_loader {string} BI script file location, normally it will look like //tpm.oneapm.com/static/js/bw-loader-411.4.3.js
 * @param config {Object} agent config object
 * @returns {string}
 */
module.exports = function (js_agent_loader, config) {
  var external_link = '</script><script type="text/javascript" src="' + js_agent_loader + '">';

  var isProxy = (config.proxy.length + config.proxy_host.length) > 0;

  if (config.is_js_text && !isProxy) {

    if (inline_content_cache[js_agent_loader]) {
      return inline_content_cache[js_agent_loader];
    } else if (!loading) {
      set_cache(js_agent_loader);
    }
  }

  return external_link;
};