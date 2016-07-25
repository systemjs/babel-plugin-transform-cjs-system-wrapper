# babel-plugin-transform-cjs-system-wrapper

Wraps CommonJS scripts into `System.registerDynamic(...`

## Example

**In**

```js
'use strict';

var lodash = require('foo/');
```

**Babel Options**
```js
{
  moduleId: 'foobar'
  plugins: [
    ['transform-cjs-system-wrapper', {
    name: 'foobar',
    deps: ['bar'],
    globals: {
      f: foo
    }
  }]
  ]
}
```

**Out**

```js
System.registerDynamic('foobar', ['bar'], true, function ($__require, exports, module) {
  'use strict';

  var f = $__require('foo');
  var define,
      global = this,
      GLOBAL = this;
  var lodash = $__require('foo');
  return module.exports;
});
```

## Installation

```sh
$ npm install babel-plugin-transform-cjs-system-wrapper
```

## Usage

### Via `.babelrc`

**.babelrc**

```json
{
  "moduleId": "foobar", // optional
  "plugins": [
    ["transform-cjs-system-wrapper", {
      "systemGlobal": "SystemJS", // optional
      "path": "/path/to/foobar",
      "optimize": true, // optional
      "static": true, // optional
      "deps": ["bar"], // optional
      "globals": {
        "f": "foo"
      } // optional
    }]
  ]
}
```

### Via CLI

```sh
$ babel --plugins transform-cjs-system-wrapper script.js
```

### Via Node API (Recommended)

```javascript
require("babel-core").transform("code", {
  moduleId: 'foobar',
  plugins: [
    ["transform-cjs-system-wrapper", {
      systemGlobal: "SystemJS",
      path: "/path/to/foobar",
      optimize: true,
      static: true,
      deps: ['bar'],
      globals: {
        f: foo
      }
    }]
  ]
});
```
