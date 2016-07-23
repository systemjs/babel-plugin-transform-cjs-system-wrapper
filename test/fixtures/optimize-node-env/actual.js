console.log(__filename);

(function (require) {
  'use strict';

  if (typeof require != 'undefined' && eval('typeof require') == 'undefined') {
    exports.cjs = true;
  }

  if (false) {
    require('withoutTrailingSlash');
    require('withTrailingSlash/');
    require('some' + 'expression');
  }
})(require);

(function (require) {
  require.resolve('x');
})(require);

exports.env = process.env.NODE_ENV;