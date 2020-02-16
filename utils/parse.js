'use strict'
exports.__esModule = true

const moduleRequire = require('./module-require').default
const extname = require('path').extname

const log = require('debug')('eslint-plugin-import:parse')

exports.default = function parse(path, content, context) {

  if (context == null) throw new Error('need context to parse properly')

  let parserOptions = context.parserOptions
  const parserPath = getParserPath(path, context)

  if (!parserPath) throw new Error('parserPath is required!')

  // hack: espree blows up with frozen options
  parserOptions = Object.assign({}, parserOptions)
  parserOptions.ecmaFeatures = Object.assign({}, parserOptions.ecmaFeatures)

  // always include comments and tokens (for doc parsing)
  parserOptions.comment = true
  parserOptions.attachComment = true  // keeping this for backward-compat with  older parsers
  parserOptions.tokens = true

  // attach node locations
  parserOptions.loc = true
  parserOptions.range = true

  // provide the `filePath` like eslint itself does, in `parserOptions`
  // https://github.com/eslint/eslint/blob/3ec436ee/lib/linter.js#L637
  parserOptions.filePath = path
  
  // @typescript-eslint/parser will parse the entire project with typechecking if you provide
  // "project" or "projects" in parserOptions. Removing these options means the parser will
  // only parse one file in isolate mode, which is much, much faster.
  // https://github.com/benmosher/eslint-plugin-import/issues/1408#issuecomment-509298962
  delete parserOptions.project
  delete parserOptions.projects
  
  // require the parser relative to the main module (i.e., ESLint)
  const parser = moduleRequire(parserPath)

  if (typeof parser.parseForESLint === 'function') {
    let ast
    try {
      ast = parser.parseForESLint(content, parserOptions).ast
    } catch (e) {
      //
    }
    if (!ast || typeof ast !== 'object') {
      console.warn(
        '`parseForESLint` from parser `' +
          parserPath +
          '` is invalid and will just be ignored'
      )
    } else {
      return ast
    }
  }

  return parser.parse(content, parserOptions)
}

function __visit(node, keys, visitorSpec) {
  if (!node) {
    // console.log('no node!', node)
    return
  }
  // try {
    // console.log("VISIT 05")
    // console.log('node type', node.type)
    const type = node.type
    // console.log('visiting', type)
    if (typeof visitorSpec[type] === 'function') {
      // console.log('has visitor!')
      visitorSpec[type](node)
    } else {
      // console.log('no visitor!')
    }
    const childFields = keys[type]
  if (!childFields) {
      return
    }
    // console.log('child fields', childFields)
    for (const fieldName of childFields) {
      // console.log("fieldName", fieldName)
      const field = node[fieldName]
      // console.log("field", field)
      if (Array.isArray(field)) {
        for (const item of field) {
          // console.log('item', item.type)
          __visit(item, keys, visitorSpec)
        }
      } else {
        __visit(field, keys, visitorSpec)
      }
    }
    // console.log('children', keys[type])
    // for (const childName of keys[type]) {
    //   const child = node[childName]
    //   console.log('child type', childName, typeof child, Array.isArray(child))
    //   console.log("child", child)
    //   if (Array.isArray(child)) {
    //     for (const item of child) {
    //       __visit(item, keys, visitorSpec)
    //     }
    //   } else {
    //     __visit(node[childName][0], keys, visitorSpec)
    //   }
    // }
  // } catch (error) {
  //   console.log("WTF????", JSON.stringify(error))
  // }
}

exports.visit = function (ast, path, context, visitorSpec) {
  // console.log("VISIT 01")
  const parserPath = getParserPath(path, context)
  // console.log("VISIT 02")
  const parser = moduleRequire(parserPath)
  // console.log("VISIT 03", Object.keys(parser), Object.keys(parser).map(k => typeof k))
  // const keys = parser.VisitorKeys
  const keys = moduleRequire(parserPath.replace('index.js', 'visitor-keys.js'))
  // console.log("VISIT 04", keys)
  __visit(ast, keys, visitorSpec)
}

function getParserPath(path, context) {
  const parsers = context.settings['import/parsers']
  if (parsers != null) {
    const extension = extname(path)
    for (let parserPath in parsers) {
      if (parsers[parserPath].indexOf(extension) > -1) {
        // use this alternate parser
        log('using alt parser:', parserPath)
        return parserPath
      }
    }
  }
  // default to use ESLint parser
  return context.parserPath
}
