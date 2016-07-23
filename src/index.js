let parse = require('babylon').parse;

export default function ({ types: t }) {

  return {
    visitor: {
      CallExpression: function CallExpression(path, state) {
        let opts = state.opts === undefined ? {} : state.opts;

        let callee = path.node.callee;

        // test require.resolve
        if (!opts.usesRequireResolve &&
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'require' }) &&
          t.isIdentifier(callee.property, { name: 'resolve' })) {
          state.set('usesRequireResolve', true);
        }
      },
      MemberExpression: function Identifier(path, state) {
        let opts = state.opts === undefined ? {} : state.opts;

        // optimize process.env.NODE_ENV to 'production'
        if (opts.optimize &&
          t.isIdentifier(path.node.object.object, { name: 'process' }) &&
          t.isIdentifier(path.node.object.property, { name: 'env' }) &&
          t.isIdentifier(path.node.property, { name: 'NODE_ENV' })) {
          path.replaceWith(t.stringLiteral('production'));
        }

      },
      Identifier: function Identifier(path, state) {
        let opts = state.opts === undefined ? {} : state.opts;

        // test if file paths are used
        if (t.isIdentifier(path.node, { name: '__filename' }) ||
          t.isIdentifier(path.node, { name: '__dirname' })) {
          state.set('usesFilePaths', true);
        }
      },
      Program: {
        exit: function (path, state) {
          let opts = state.opts === undefined ? {} : state.opts;

          if (state.get('usesFilePaths') && opts.static) {

            let filenameIdentifier = t.Identifier('__filename');
            let dirnameIdentifier = t.Identifier('__dirname');

            let filename = t.stringLiteral(opts.path);
            let dirname = t.stringLiteral(opts.path.split('/').slice(0, -1).join('/'));

            let filenameAssignment = t.assignmentPattern(filenameIdentifier, filename);
            let dirnameAssignment = t.assignmentPattern(dirnameIdentifier, dirname);

            let filenameInit = t.variableDeclarator(filenameAssignment);
            let dirnameInit = t.variableDeclarator(dirnameAssignment);

            let filePaths = t.variableDeclaration('var', [filenameInit, dirnameInit]);

            path.node.body.unshift(filePaths);
          }

          if (state.get('usesRequireResolve') && !opts.static) {
            // "$__require.resolve = function(request) { return SystemJS.get('@@cjs-helpers').requireResolve(request, module.id); };"

            let callGetCJSHelpers = t.callExpression(t.MemberExpression(t.identifier(opts.systemGlobal), t.identifier('get')), [t.stringLiteral('@@cjs-helpers')]),
              callRequireResolve = t.callExpression(t.MemberExpression(callGetCJSHelpers, t.identifier('requireResolve')), [t.identifier('request'), t.identifier('module.id')]),
              fn = t.functionExpression(null, [t.identifier('request')], t.blockStatement([t.returnStatement(callRequireResolve)])),
              overrideRequireResolve = t.assignmentExpression('=', t.memberExpression(t.identifier('$__require'), t.identifier('resolve')), fn);

            // let script = `$__require.resolve = function(request) { return ${opts.systemGlobal}.get('@@cjs-helpers').requireResolve(request, module.id); };`;

            path.node.body.unshift(t.expressionStatement(overrideRequireResolve));
          }

          if (state.get('usesFilePaths') && !opts.static) {
            let script = `var $__pathVars = ${opts.systemGlobal}.get('@@cjs-helpers').getPathVars(module.id), __filename = $__pathVars.filename, __dirname = $__pathVars.dirname;`;

            path.node.body.unshift(parse(script).program.body[0]);
          }

          let useStrict = true;

          // *** Prepend globals ***
          let globalExpression = '';
          if (opts.globals) {
            globalExpression = 'var ';
            let first = true;
            for (var g in this.globals) {
              globalExpression += (first ? '' : ', ') + g + `= $__require('${opts.globals[g]}')`;
              first = false;
            }
            if (first == true) {
              globalExpression = '';
            }
            globalExpression += ';';
          }

          let nl = '\n    ';
          let globals = `${(globalExpression ? globalExpression + nl : '')} var define, global = this, GLOBAL = this;`;
          path.node.body.unshift(parse(globals).program.body[0]);

          // *** wrap everything in System.register ***
          let directives = useStrict ? [t.directive(t.directiveLiteral('use strict'))] : [];

          let modules = `${(this.name ? `'${opts.name}', ` : '') + JSON.stringify(opts.deps)}`;
          
          let registerCallback = t.functionExpression(null, [t.identifier('$__require'), t.identifier('exports'), t.identifier('module')], t.blockStatement([...path.node.body], directives));
          
          // Append `return module.exports` to System.registerDynamic callback fn
          let modulesExportExpression = t.memberExpression(t.identifier('module'), t.identifier('exports'));
          registerCallback.body.body.push(t.returnStatement(modulesExportExpression));

          // args for System.registerDynamic
          let registerArgs = [t.stringLiteral(modules), t.booleanLiteral(true), registerCallback];

          let registerCallee = t.memberExpression(t.identifier(opts.systemGlobal), t.identifier('registerDynamic'));
          let registerCallExpression = t.callExpression(registerCallee, registerArgs);

          // Empty body statements
          path.node.body.length = 0;
          // Refill body statements with wrapped System.register
          path.node.body.push(t.expressionStatement(registerCallExpression));
        },
      }
    }
  };
}
