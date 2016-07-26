import template from 'babel-template';

export default function ({ types: t }) {

  const requireIdentifier = t.identifier('$__require');

  const buildTemplate = template(`
    SYSTEM_GLOBAL.registerDynamic(MODULE_NAME, [DEPS], true, BODY);
  `);

  const buildFactory = template(`
    (function ($__require, exports, module) {
      BODY
      return module.exports;
    })
  `);

  const buildDefineGlobal = template(`
     var define, global = this, GLOBAL = this;
  `);

  const buildStaticFilePaths = template(`
    var __filename = FILENAME, __dirname = DIRNAME;
  `);

  const buildDynamicFilePaths = template(`
    var $__pathVars = SYSTEM_GLOBAL.get('@@cjs-helpers').getPathVars(module.id), __filename = $__pathVars.filename, __dirname = $__pathVars.dirname;
  `);

  const buildRequireResolveFacade = template(`
    $__require.resolve = function(request) {
       return SYSTEM_GLOBAL.get('@@cjs-helpers').requireResolve(request, module.id);
    }
  `);

  return {
    inherits: require('babel-plugin-transform-cjs-system-require'),
    pre() {
      this.usesFilePaths = false;
      this.usesRequireResolve = false;
    },
    visitor: {
      CallExpression({ node }, { opts = {} }) {
        let callee = node.callee;

        // test if require.resolve is present
        if (!this.usesRequireResolve &&
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'require' }) &&
          t.isIdentifier(callee.property, { name: 'resolve' })) {
          this.usesRequireResolve = true;
        }

        if (opts.systemGlobal != 'System' &&
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.property, { name: '_nodeRequire' })) {

          let calleeObjectIdentifier = callee.object.name.replace(/(^|[^_])System/g, function (match, startArg) {
            return startArg + opts.systemGlobal;
          });

          callee.object = t.identifier(calleeObjectIdentifier);
        }
      },
      MemberExpression(path, { opts = {} }) {

        let { node } = path;

        opts.optimize = (opts.optimize === true) || false;

        // optimize process.env.NODE_ENV to 'production'
        if (opts.optimize &&
          t.isIdentifier(node.object.object, { name: 'process' }) &&
          t.isIdentifier(node.object.property, { name: 'env' }) &&
          t.isIdentifier(node.property, { name: 'NODE_ENV' })) {
          path.replaceWith(t.stringLiteral('production'));
        }

      },
      Identifier: function Identifier({ node }) {

        // test if file paths are used
        if (t.isIdentifier(node, { name: '__filename' }) ||
          t.isIdentifier(node, { name: '__dirname' })) {
          this.usesFilePaths = true;
        }
      },
      Program: {
        exit({ node }, { opts = {} }) {

          opts.static = (opts.static === true) || false;

          const systemGlobal = t.identifier(opts.systemGlobal || 'System');

          let moduleName = this.getModuleName();
          moduleName = moduleName ? t.stringLiteral(moduleName) : null;

          let { deps = []} = opts;
          deps = deps.map(d => t.stringLiteral(d));

          if (this.usesRequireResolve && !opts.static) {
            node.body.unshift(buildRequireResolveFacade({
              SYSTEM_GLOBAL: systemGlobal
            }));
          }

          if (this.usesFilePaths && !opts.static) {
            node.body.unshift(buildDynamicFilePaths({
              SYSTEM_GLOBAL: systemGlobal
            }));
          }

          if (this.usesFilePaths && opts.static) {
            let filename = opts.path || '';
            let dirname = filename.split('/').slice(0, -1).join('/');

            node.body.unshift(buildStaticFilePaths({
              FILENAME: t.stringLiteral(filename),
              DIRNAME: t.stringLiteral(dirname)
            }));
          }

          node.body.unshift(buildDefineGlobal());

          let { globals } = opts;
          if (globals && Object.keys(globals).length) {
            let globalAssignments = Object.keys(globals).filter(g => globals[g]).map(g => {
              let globalIdentifier = t.identifier(g);
              let value = t.callExpression(requireIdentifier, [t.stringLiteral(globals[g])]);
              let assignment = t.assignmentPattern(globalIdentifier, value);
              return t.variableDeclarator(assignment);
            });
            globals = t.variableDeclaration('var', globalAssignments);
            node.body.unshift(globals);
          }

          const factory = buildFactory({
            BODY: node.body
          });

          factory.expression.body.directives = node.directives;
          node.directives = [];

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
