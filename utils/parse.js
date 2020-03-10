'use strict'
exports.__esModule = true

const moduleRequire = require('./module-require').default
const extname = require('path').extname
const fs = require('fs')

const log = require('debug')('eslint-plugin-import:parse')

function getBabelVisitorKeys(path, context) {
  const parserPath = getParserPath(path, context)
  const hypotheticalLocation = parserPath.replace('index.js', 'visitor-keys.js')
  if (fs.existsSync(hypotheticalLocation)) {
    const keys = moduleRequire(parserPath.replace('index.js', 'visitor-keys.js'))
    return keys
  } else {
    return null
  }
  // __visit(ast, keys, visitorSpec)
}

function keysFromParser(path, context, parserInstance, parsedResult) {
  if (/.*estree.*/.test(path)) {
    return parserInstance.VisitorKeys
  } else if (/.*babel-eslint.*/.test(path)) {
    return getBabelVisitorKeys(path, context)
  } else if (/.*@typescript-eslint\/parser/.test(path)) {
    return parsedResult ? parsedResult.visitorKeys : undefined
  }
  return null
}

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

exports.visit = function (ast, path, context, visitorSpec) {
  // const parserPath = getParserPath(path, context)
  // const keys = moduleRequire(parserPath.replace('index.js', 'visitor-keys.js'))
  const keys = getBabelVisitorKeys(path, context)
  __visit(ast, keys, visitorSpec)
}


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
  
  let visitorKeys = null
  // require the parser relative to the main module (i.e., ESLint)
  const parser = moduleRequire(parserPath)
  // if parser is estree
  visitorKeys = parser.VisitorKeys
  // console.log('parser', parserPath, Object.keys(parser))
  // console.log(JSON.stringify(parser))

  if (typeof parser.parseForESLint === 'function') {
    // console.log('has parse for estlint')
    let ast
    try {
      const parserRaw = parser.parseForESLint(content, parserOptions)
      // if parser is @typescript-eslint/parser
      visitorKeys = parserRaw.visitorKeys
      // console.log('parser output', Object.keys(parserRaw))
      // console.log(JSON.stringify(parserRaw))
      ast = parserRaw.ast
      return { ast, visitorKeys: keysFromParser(path, context, parser, parserRaw)}
    } catch (e) {
      //
    }
    if (!ast || typeof ast !== 'object') {
      console.warn(
        '`parseForESLint` from parser `' +
          parserPath +
        '` is invalid and will just be ignored',
        path
      )
    } else {
      return { ast, visitorKeys: keysFromParser(path, context, parser, undefined)}
    }
  }

  return {
    ast: parser.parse(content, parserOptions),
    visitorKeys: getBabelVisitorKeys(path, context, parser, undefined),
  }
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
