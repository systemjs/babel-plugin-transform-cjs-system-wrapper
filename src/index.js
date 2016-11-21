import template from 'babel-template';

export default function ({ types: t }) {

  const requireIdentifier = t.identifier('require');

  const buildTemplate = template(`
    SYSTEM_GLOBAL.registerDynamic(MODULE_NAME, [DEPS], true, BODY);
  `);

  const buildFactory = template(`
    (function (require, exports, module) {
      BODY
    })
  `);

  const buildDefineGlobal = template(`
     var global = this || self, GLOBAL = global;
  `);

  const buildStaticFilePaths = template(`
    var __filename = FILENAME, __dirname = DIRNAME;
  `);

  const buildDynamicFilePaths = template(`
    var $__pathVars = SYSTEM_GLOBAL.get('@@cjs-helpers').getPathVars(module.id), __filename = $__pathVars.filename, __dirname = $__pathVars.dirname;
  `);

  const buildRequireResolveFacade = template(`
    require.resolve = function(request) {
       return SYSTEM_GLOBAL.get('@@cjs-helpers').requireResolve(request, module.id);
    }
  `);

  return {
    pre() {
      this.usesFilePaths = false;
      this.usesRequireResolve = false;
    },
    visitor: {
      CallExpression(path, { opts = {} }) {
        const callee = path.node.callee;
        const args = path.node.arguments;

        const {
          requireName = 'require',
          map
        } = opts;

        // test if require.resolve is present
        if (!this.usesRequireResolve &&
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: requireName }) &&
          t.isIdentifier(callee.property, { name: 'resolve' })) {
          this.usesRequireResolve = true;
        }

        // found a require
        if (t.isIdentifier(callee, { name: requireName }) &&
          args.length == 1) {

          // require('x');
          if (t.isStringLiteral(args[0])) {

            let requiredModuleName = args[0].value;

            // mirror behaviour at https://github.com/systemjs/systemjs/blob/0.19.8/lib/cjs.js#L50 to remove trailing slash
            if (requiredModuleName[requiredModuleName.length - 1] == '/') {
              requiredModuleName = requiredModuleName.substr(0, requiredModuleName.length - 1);
            }

            if (typeof map === 'function') {
              requiredModuleName = map(requiredModuleName) || requiredModuleName;
            }

            args[0].value = requiredModuleName;
          }
        }
      },
      MemberExpression(path, { opts = {} }) {
        let { node } = path;

        // optimize process.env.NODE_ENV to 'production'
        if (opts.optimize &&
          t.isIdentifier(node.object.object, { name: 'process' }) &&
          t.isIdentifier(node.object.property, { name: 'env' }) &&
          t.isIdentifier(node.property, { name: 'NODE_ENV' })) {
          path.replaceWith(t.stringLiteral('production'));
        }

        if (opts.systemGlobal != 'System' &&
          t.isIdentifier(node.object, { name: 'System' }) &&
          t.isIdentifier(node.property, { name: '_nodeRequire' })) {
          node.object = t.identifier(opts.systemGlobal);
        }
      },
      ReferencedIdentifier(path, state) {
        if (path.node.name == 'define' &&
          !path.scope.hasBinding('define') &&
          (!t.isExpression(path.parentPath) ||
            (t.isUnaryExpression(path.parentPath) && path.parentPath.node.operator === 'typeof'))) {
          path.replaceWith(t.identifier('undefined'));
        }
      },
      Identifier(path) {
        let { node } = path;
        // test if file paths are used
        if (t.isIdentifier(node, { name: '__filename' }) ||
          t.isIdentifier(node, { name: '__dirname' })) {
          this.usesFilePaths = true;
        }
      },
      Program: {
        exit(path, { opts = {} }) {
          const {
            requireName = 'require',
            mappedRequireName = '$__require',
          } = opts;

          opts.static = (opts.static === true) || false;

          const systemGlobal = t.identifier(opts.systemGlobal || 'System');

          let moduleName = this.getModuleName();
          moduleName = moduleName ? t.stringLiteral(moduleName) : null;

          let { deps = []} = opts;
          deps = deps.map(d => t.stringLiteral(d));

          if (this.usesRequireResolve && !opts.static) {
            path.node.body.unshift(buildRequireResolveFacade({
              SYSTEM_GLOBAL: systemGlobal
            }));
          }

          if (this.usesFilePaths && !opts.static) {
            path.node.body.unshift(buildDynamicFilePaths({
              SYSTEM_GLOBAL: systemGlobal
            }));
          }

          if (this.usesFilePaths && opts.static) {
            let filename = opts.path || '';
            let dirname = filename.split('/').slice(0, -1).join('/');

            path.node.body.unshift(buildStaticFilePaths({
              FILENAME: t.stringLiteral(filename),
              DIRNAME: t.stringLiteral(dirname)
            }));
          }

          path.node.body.unshift(buildDefineGlobal());

          let { globals } = opts;
          if (globals && Object.keys(globals).length) {
            let globalAssignments = Object.keys(globals).filter(g => globals[g]).map(g => {
              let globalIdentifier = t.identifier(g);
              let value = t.callExpression(requireIdentifier, [t.stringLiteral(globals[g])]);
              let assignment = t.assignmentPattern(globalIdentifier, value);
              return t.variableDeclarator(assignment);
            });
            globals = t.variableDeclaration('var', globalAssignments);
            path.node.body.unshift(globals);
          }

          const factory = buildFactory({
            BODY: path.node.body
          });

          factory.expression.body.directives = path.node.directives;
          path.node.directives = [];

          path.node.body = [buildTemplate({
            SYSTEM_GLOBAL: systemGlobal,
            MODULE_NAME: moduleName,
            DEPS: deps,
            BODY: factory
          })];

          const remapFactoryScopedRequire = {
            FunctionExpression(path) {
              if (path.node == factory.expression) {
                path.scope.rename(this.requireName, this.mappedRequireName);
              }
            }
          };

          path.traverse(remapFactoryScopedRequire, {
            requireName: requireName,
            mappedRequireName: mappedRequireName
          });
        },
      }
    }
  };
}
