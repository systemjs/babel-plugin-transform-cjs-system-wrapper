# babel-plugin-transform-system-register

Transforms CommonJS modules into SystemJS modules using `System.registerDynamic(...)`

## Example

**In**

```js
let lodash = require('lodash/');
```

**Out**

```js
System.registerDynamic('myModule', true, function ($__require, export, module) {
  'use strict';

  let lodash = $__require('lodash');

  return module.exports;
});
```

## Installation

```sh
$ npm install babel-plugin-transform-cjs-to-systemjs
```

## Usage

### Via `.babelrc`

**.babelrc**

```json
{
  "plugins": [
    ["transform-cjs-to-systemjs", {
      "systemGlobal": "SystemJS",
      "path": "/path/to/file",
      "name": "myModule",
      "optimize": true,
      "static": true,
      "deps": {},
      "globals": {}
    }]
  ]
}
```

### Via CLI

```sh
$ babel --plugins transform-cjs-to-systemjs script.js
```

### Via Node API (Recommended)

```javascript
require("babel-core").transform("code", {
  plugins: [
    ["transform-system-register", {
      systemGlobal: "SystemJS",
      path: "/path/to/file",
      name: "moduleName",
      optimize: true,
      static: true,
      deps: {},
      globals: {}
    }]
  ]
});
```
