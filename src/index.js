import template from 'babel-template';

export default function ({ types: t }) {

  const requireIdentifier = t.identifier('$__require');

  const buildTemplate = template(`
    SYSTEM_GLOBAL.registerDynamic(MODULE_NAME, [DEPS], true, BODY);
  `);

  const buildFactory = template(`
    (function ($__require, exports, module) {
      GLOBALS
      var define, global = this, GLOBAL = this;
      STATIC_FILE_PATHS
      REQUIRE_RESOLVE
      DYNAMIC_FILE_PATHS
      BODY
      return module.exports;
    })
  `);

  const buildStaticFilePaths = template(`
    var __filename = FILENAME, __dirname = DIRNAME;
  `);

  const buildDynamicFilePaths = template(`
    var $__pathVars = SYSTEM_GLOBAL.get('@@cjs-helpers').getPathVars(module.id), __filename = $__pathVars.filename, __dirname = $__pathVars.dirname;
  `);

  const buildRequireResolve = template(`
    $__require.resolve = function(request) {
       return SYSTEM_GLOBAL.get('@@cjs-helpers').requireResolve(request, module.id);
    }
  `);

  return {
    inherits: require('babel-plugin-transform-cjs-system-require'),
    visitor: {
      CallExpression({ node }, { opts = {} }) {
        let callee = node.callee,
          state = arguments[1];

        // test if require.resolve is present
        if (!opts.usesRequireResolve &&
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'require' }) &&
          t.isIdentifier(callee.property, { name: 'resolve' })) {
          state.set('usesRequireResolve', true);
        }
      },
      MemberExpression({ node }, { opts = {} }) {

        const path = arguments[0];

        // optimize process.env.NODE_ENV to 'production'
        if (opts.optimize &&
          t.isIdentifier(node.object.object, { name: 'process' }) &&
          t.isIdentifier(node.object.property, { name: 'env' }) &&
          t.isIdentifier(node.property, { name: 'NODE_ENV' })) {
          path.replaceWith(t.stringLiteral('production'));
        }

      },
      Identifier: function Identifier({ node }, state) {

        // test if file paths are used
        if (t.isIdentifier(node, { name: '__filename' }) ||
          t.isIdentifier(node, { name: '__dirname' })) {
          state.set('usesFilePaths', true);
        }
      },
      Program: {
        exit({ node }, { opts = {} }) {

          const systemGlobal = t.identifier(opts.systemGlobal || 'System');

          let state = arguments[1],
            staticFilePathStatements,
            requireResolveOverwrite,
            dynamicFilePathStatements;

          let { moduleName } = opts;
          moduleName = moduleName ? t.stringLiteral(moduleName) : null;

          let { deps = [] } = opts;
          deps = deps.map(d => t.stringLiteral(d));

          let { globals } = opts;
          if (globals && Object.keys(globals).length) {
            let globalAssignments = Object.keys(globals).filter(g => globals[g]).map(g => {
              let globalIdentifier = t.identifier(g);
              let value = t.callExpression(requireIdentifier, [t.stringLiteral(globals[g])]);
              let assignment = t.assignmentPattern(globalIdentifier, value);
              return t.variableDeclarator(assignment);
            });
            globals = t.variableDeclaration('var', globalAssignments);
          }

          if (state.get('usesFilePaths') && opts.static) {
            let filename = opts.path || '';
            let dirname = filename.split('/').slice(0, -1).join('/');

            staticFilePathStatements = buildStaticFilePaths({
              FILENAME: t.stringLiteral(filename),
              DIRNAME: t.stringLiteral(dirname)
            });
          }

          if (state.get('usesRequireResolve') && !opts.static) {
            requireResolveOverwrite = buildRequireResolve({
              SYSTEM_GLOBAL: systemGlobal
            });
          }

          if (state.get('usesFilePaths') && !opts.static) {
            dynamicFilePathStatements = buildDynamicFilePaths({
              SYSTEM_GLOBAL: systemGlobal
            });
          }

          function hasRemoveUseStrict(list) {
            for (var i = 0; i < list.length; i++) {
              if (list[i].value.value === 'use strict') {
                list.splice(i, 1);
                return true;
              }
            }
            return false;
          }

          let useStrict = hasRemoveUseStrict(node.directives);

          const factory = buildFactory({
            GLOBALS: globals || null,
            STATIC_FILE_PATHS: staticFilePathStatements || null,
            REQUIRE_RESOLVE: requireResolveOverwrite || null,
            DYNAMIC_FILE_PATHS: dynamicFilePathStatements || null,
            BODY: node.body
          });

          if (useStrict) {
            let useStrictDirective = t.directive(t.directiveLiteral('use strict'));
            let { directives } = factory.expression.body;
            directives.push(useStrictDirective);
          }

          node.body = [buildTemplate({
            SYSTEM_GLOBAL: systemGlobal,
            MODULE_NAME: moduleName,
            DEPS: deps,
            BODY: factory
          })];
        },
      }
    }
  };
}
