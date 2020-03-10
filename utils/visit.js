
exports.__esModule = true
exports.default = function __visit(node, keys, visitorSpec) {
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
