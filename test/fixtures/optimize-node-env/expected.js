SystemJS.registerDynamic('{}', true, function ($__require, exports, module) {
  'use strict';

  var define,
      global = this,
      GLOBAL = this;var $__pathVars = SystemJS.get('@@cjs-helpers').getPathVars(module.id),
      __filename = $__pathVars.filename,
      __dirname = $__pathVars.dirname;
  $__require.resolve = function (request) {
    return SystemJS.get('@@cjs-helpers').requireResolve(request, module.id);
  };

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

  exports.env = 'production';
  return module.exports;
});