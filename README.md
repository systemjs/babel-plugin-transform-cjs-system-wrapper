# babel-plugin-transform-cjs-system-wrapper

Wraps CommonJS scripts into `System.registerDynamic(...`

## Example

**In**

```js
'use strict';

var lodash = require('foo/');
```

**Options**
module.exports = {
    "name": "foobar",
    "deps": ['bar'],
    "globals": {
      f: foo
    }
 }

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
  "plugins": [
    ["transform-cjs-system-wrapper", {
      "systemGlobal": "SystemJS", // optional
      "path": "/path/to/foobar",
      "name": "foobar", // optional
      "optimize": true, // optional
      "static": true, // optional
      "deps": ['bar'], // optional
      "globals": {
        f: foo
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
  plugins: [
    ["transform-cjs-system-wrapper", {
      systemGlobal: "SystemJS",
      path: "/path/to/foobar",
      name: "foobar",
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
