var BaseColors = require('./base_colors');
var util = require('util');
var fs = require('fs');
var SourceMapConsumer = require('source-map').SourceMapConsumer;

var KarmaPhantomJSSourceMapReporter = function(formatError, baseReporterDecorator) {
  baseReporterDecorator(this);
  BaseColors.call(this);

  this.writeCommonMsg = function(msg) {
    this.write(this._remove() + msg + this._render());
  };


  this.specSuccess = function() {
    this.write(this._refresh());
  };

  this.specFailure = function(browser, result) {
    var specName = result.suite.join(' ') + ' ' + result.description;
    var msg = util.format(this.SPEC_FAILURE, browser, specName);

    var testRx = new RegExp('((app/tests)/(.*?\\.spec\\.js)|(public/js/)(.*?\\.js))(?:\\?[a-z0-9]+?)?(?::(\\d+):(\\d+)| \\(line (\\d+)\\))');

    result.log.forEach(function(log) {

      var testMatch = null;

      // Rewrite stack trace to make use of source maps
      while ((testMatch = testRx.exec(log)) && testMatch[1]) {
        var file = fs.readFileSync(testMatch[1]
          .replace('public/js/', 'public/js/__maps__/')
          .replace('app/tests/client/', 'app/tests/__maps__/') + '.map', 'utf8');
        var sm = new SourceMapConsumer(file);
        sm.computeColumnSpans();

        var isLineMatch = Boolean(testMatch[8]),
            originalLine = testMatch[6] || testMatch[8],
            originalColumn = Math.max(testMatch[7] - 1, 0),
            isTest = Boolean(testMatch[2]);

        // I'm sorry for this. I'm sure there's a way to do it with the provided
        // source map functions, but I have neither the time nor energy to
        // figure it out.
        var bestMapping = {};
        sm._generatedMappings.forEach(function (mapping) {
          if (mapping.generatedLine <= originalLine) {
            if (!isLineMatch) {
              if (mapping.generatedColumn <= originalColumn) {
                bestMapping = mapping;
              }
            } else {
              bestMapping = mapping;
            }
          }
        });

        var dir;
        if (isTest) {
          dir = 'app/tests/client/';
        } else {
          dir = 'app/[...]/';
        }
        log = log.replace(testRx,
          dir+bestMapping.source+':formatted:'+bestMapping.originalLine+':'+bestMapping.originalColumn);
      }
      msg += formatError(log, '\t');
    }.bind(this));

    this.writeCommonMsg(msg);
  };

  this.onBrowserComplete = function() {
    this.write(this._refresh());
  };

  this.onRunStart = function() {
    this._browsers = [];
    this._isRendered = false;
  };

  this.onBrowserStart = function(browser) {
    this._browsers.push(browser);

    if (this._isRendered) {
      this.write('\n');
    }

    this.write(this._refresh());
  };


  this._remove = function() {
    if (!this._isRendered) {
      return '';
    }

    var cmd = '';
    this._browsers.forEach(function() {
      cmd += '\x1B[1A' + '\x1B[2K';
    });

    this._isRendered = false;

    return cmd;
  };

  this._render = function() {
    this._isRendered = true;

    return this._browsers.map(this.renderBrowser).join('\n') + '\n';
  };

  this._refresh = function() {
    return this._remove() + this._render();
  };
};

KarmaPhantomJSSourceMapReporter.$inject = ['formatError', 'baseReporterDecorator'];

module.exports = {
  'reporter:phantomjs-sourcemap': ['type', KarmaPhantomJSSourceMapReporter]
};
