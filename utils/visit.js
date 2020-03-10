
function __visit(node, keys, visitorSpec) {
  if (!node) {
    return
  }
    const type = node.type
    if (typeof visitorSpec[type] === 'function') {
      visitorSpec[type](node)
    }
    const childFields = keys[type]
    if (!childFields) {
      return
    }
    for (const fieldName of childFields) {
      const field = node[fieldName]
      if (Array.isArray(field)) {
        for (const item of field) {
          __visit(item, keys, visitorSpec)
        }
      } else {
        __visit(field, keys, visitorSpec)
      }
    }
    if (typeof visitorSpec[`${type}:Exit`] === 'function') {
      visitorSpec[`${type}:Exit`](node)
    }
}

// exports.visit = function (ast, path, context, visitorSpec) {
exports.visit = __visit
// function (ast, keys, visitorSpec) {
//   // const parserPath = getParserPath(path, context)
//   // const keys = moduleRequire(parserPath.replace('index.js', 'visitor-keys.js'))
//   // const keys = getBabelVisitorKeys(path, context)
//   // const keys = keysFromParser(path, context, undefined, undefined)
//   __visit(ast, keys, visitorSpec)
// }
