'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.recursivePatternCapture = recursivePatternCapture;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _doctrine = require('doctrine');

var _doctrine2 = _interopRequireDefault(_doctrine);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _eslint = require('eslint');

var _parse2 = require('eslint-module-utils/parse');

var _parse3 = _interopRequireDefault(_parse2);

var _visit = require('eslint-module-utils/visit');

var _visit2 = _interopRequireDefault(_visit);

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _ignore = require('eslint-module-utils/ignore');

var _ignore2 = _interopRequireDefault(_ignore);

var _hash = require('eslint-module-utils/hash');

var _unambiguous = require('eslint-module-utils/unambiguous');

var unambiguous = _interopRequireWildcard(_unambiguous);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = (0, _debug2.default)('eslint-plugin-import:ExportMap');

const exportCache = new Map();

class ExportMap {
  constructor(path) {
    this.path = path;
    this.namespace = new Map();
    // todo: restructure to key on path, value is resolver + map of names
    this.reexports = new Map();
    /**
     * star-exports
     * @type {Set} of () => ExportMap
     */
    this.dependencies = new Set();
    /**
     * dependencies of this module that are not explicitly re-exported
     * @type {Map} from path = () => ExportMap
     */
    this.imports = new Map();
    this.errors = [];
  }

  get hasDefault() {
    return this.get('default') != null;
  } // stronger than this.has

  get size() {
    let size = this.namespace.size + this.reexports.size;
    this.dependencies.forEach(dep => {
      const d = dep();
      // CJS / ignored dependencies won't exist (#717)
      if (d == null) return;
      size += d.size;
    });
    return size;
  }

  /**
   * Note that this does not check explicitly re-exported names for existence
   * in the base namespace, but it will expand all `export * from '...'` exports
   * if not found in the explicit namespace.
   * @param  {string}  name
   * @return {Boolean} true if `name` is exported by this module.
   */
  has(name) {
    if (this.namespace.has(name)) return true;
    if (this.reexports.has(name)) return true;

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();

        // todo: report as unresolved?
        if (!innerMap) continue;

        if (innerMap.has(name)) return true;
      }
    }

    return false;
  }

  /**
   * ensure that imported name fully resolves.
   * @param  {[type]}  name [description]
   * @return {Boolean}      [description]
   */
  hasDeep(name) {
    if (this.namespace.has(name)) return { found: true, path: [this] };

    if (this.reexports.has(name)) {
      const reexports = this.reexports.get(name),
            imported = reexports.getImport();

      // if import is ignored, return explicit 'null'
      if (imported == null) return { found: true, path: [this]

        // safeguard against cycles, only if name matches
      };if (imported.path === this.path && reexports.local === name) {
        return { found: false, path: [this] };
      }

      const deep = imported.hasDeep(reexports.local);
      deep.path.unshift(this);

      return deep;
    }

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();
        if (innerMap == null) return { found: true, path: [this]
          // todo: report as unresolved?
        };if (!innerMap) continue;

        // safeguard against cycles
        if (innerMap.path === this.path) continue;

        let innerValue = innerMap.hasDeep(name);
        if (innerValue.found) {
          innerValue.path.unshift(this);
          return innerValue;
        }
      }
    }

    return { found: false, path: [this] };
  }

  get(name) {
    if (this.namespace.has(name)) return this.namespace.get(name);

    if (this.reexports.has(name)) {
      const reexports = this.reexports.get(name),
            imported = reexports.getImport();

      // if import is ignored, return explicit 'null'
      if (imported == null) return null;

      // safeguard against cycles, only if name matches
      if (imported.path === this.path && reexports.local === name) return undefined;

      return imported.get(reexports.local);
    }

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();
        // todo: report as unresolved?
        if (!innerMap) continue;

        // safeguard against cycles
        if (innerMap.path === this.path) continue;

        let innerValue = innerMap.get(name);
        if (innerValue !== undefined) return innerValue;
      }
    }

    return undefined;
  }

  forEach(callback, thisArg) {
    this.namespace.forEach((v, n) => callback.call(thisArg, v, n, this));

    this.reexports.forEach((reexports, name) => {
      const reexported = reexports.getImport();
      // can't look up meta for ignored re-exports (#348)
      callback.call(thisArg, reexported && reexported.get(reexports.local), name, this);
    });

    this.dependencies.forEach(dep => {
      const d = dep();
      // CJS / ignored dependencies won't exist (#717)
      if (d == null) return;

      d.forEach((v, n) => n !== 'default' && callback.call(thisArg, v, n, this));
    });
  }

  // todo: keys, values, entries?

  reportErrors(context, declaration) {
    context.report({
      node: declaration.source,
      message: `Parse errors in imported module '${declaration.source.value}': ` + `${this.errors.map(e => `${e.message} (${e.lineNumber}:${e.column})`).join(', ')}`
    });
  }
}

exports.default = ExportMap; /**
                              * parse docs from the first node that has leading comments
                              */

function captureDoc(source, docStyleParsers) {
  const metadata = {};

  // 'some' short-circuits on first 'true'

  for (var _len = arguments.length, nodes = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    nodes[_key - 2] = arguments[_key];
  }

  nodes.some(n => {
    try {

      let leadingComments;

      // n.leadingComments is legacy `attachComments` behavior
      if ('leadingComments' in n) {
        leadingComments = n.leadingComments;
      } else if (n.range) {
        leadingComments = source.getCommentsBefore(n);
      }

      if (!leadingComments || leadingComments.length === 0) return false;

      for (let name in docStyleParsers) {
        const doc = docStyleParsers[name](leadingComments);
        if (doc) {
          metadata.doc = doc;
        }
      }

      return true;
    } catch (err) {
      return false;
    }
  });

  return metadata;
}

const availableDocStyleParsers = {
  jsdoc: captureJsDoc,
  tomdoc: captureTomDoc

  /**
   * parse JSDoc from leading comments
   * @param  {...[type]} comments [description]
   * @return {{doc: object}}
   */
};function captureJsDoc(comments) {
  let doc;

  // capture XSDoc
  comments.forEach(comment => {
    // skip non-block comments
    if (comment.type !== 'Block') return;
    try {
      doc = _doctrine2.default.parse(comment.value, { unwrap: true });
    } catch (err) {
      /* don't care, for now? maybe add to `errors?` */
    }
  });

  return doc;
}

/**
  * parse TomDoc section from comments
  */
function captureTomDoc(comments) {
  // collect lines up to first paragraph break
  const lines = [];
  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    if (comment.value.match(/^\s*$/)) break;
    lines.push(comment.value.trim());
  }

  // return doctrine-like object
  const statusMatch = lines.join(' ').match(/^(Public|Internal|Deprecated):\s*(.+)/);
  if (statusMatch) {
    return {
      description: statusMatch[2],
      tags: [{
        title: statusMatch[1].toLowerCase(),
        description: statusMatch[2]
      }]
    };
  }
}

ExportMap.get = function (source, context) {
  const path = (0, _resolve2.default)(source, context);
  if (path == null) return null;

  return ExportMap.for(childContext(path, context));
};

ExportMap.for = function (context) {
  const path = context.path;


  const cacheKey = (0, _hash.hashObject)(context).digest('hex');
  let exportMap = exportCache.get(cacheKey);

  // return cached ignore
  if (exportMap === null) return null;

  const stats = _fs2.default.statSync(path);
  if (exportMap != null) {
    // date equality check
    if (exportMap.mtime - stats.mtime === 0) {
      return exportMap;
    }
    // future: check content equality?
  }

  // check valid extensions first
  if (!(0, _ignore.hasValidExtension)(path, context)) {
    exportCache.set(cacheKey, null);
    return null;
  }

  // check for and cache ignore
  if ((0, _ignore2.default)(path, context)) {
    log('ignored path due to ignore settings:', path);
    exportCache.set(cacheKey, null);
    return null;
  }

  const content = _fs2.default.readFileSync(path, { encoding: 'utf8' });

  // check for and cache unambiguous modules
  if (!unambiguous.test(content)) {
    log('ignored path due to unambiguous regex:', path);
    exportCache.set(cacheKey, null);
    return null;
  }

  log('cache miss', cacheKey, 'for path', path);
  exportMap = ExportMap.parse(path, content, context);

  // ambiguous modules return null
  if (exportMap == null) return null;

  exportMap.mtime = stats.mtime;

  exportCache.set(cacheKey, exportMap);
  return exportMap;
};

ExportMap.parse = function (path, content, context) {
  var m = new ExportMap(path);

  try {
    var _parse = (0, _parse3.default)(path, content, context),
        ast = _parse.ast,
        visitorKeys = _parse.visitorKeys;
  } catch (err) {
    m.errors.push(err);
    return m; // can't continue
  }

  let hasDynamicImports = false;

  (0, _visit2.default)(ast, visitorKeys, {
    CallExpression(node) {
      if (node.callee.type === 'Import') {
        hasDynamicImports = true;
        const firstArgument = node.arguments[0];
        if (firstArgument.type !== 'Literal') {
          return null;
        }
        const p = remotePath(firstArgument.value);
        if (p == null) {
          return null;
        }
        const importedSpecifiers = new Set();
        importedSpecifiers.add('ImportNamespaceSpecifier');
        const getter = thunkFor(p, context);
        m.imports.set(p, {
          getter,
          source: {
            // capturing actual node reference holds full AST in memory!
            value: firstArgument.value,
            loc: firstArgument.loc
          },
          importedSpecifiers
        });
      }
    }
  });

  if (!unambiguous.isModule(ast) && !hasDynamicImports) return null;

  const docstyle = context.settings && context.settings['import/docstyle'] || ['jsdoc'];
  const docStyleParsers = {};
  docstyle.forEach(style => {
    docStyleParsers[style] = availableDocStyleParsers[style];
  });

  // attempt to collect module doc
  if (ast.comments) {
    ast.comments.some(c => {
      if (c.type !== 'Block') return false;
      try {
        const doc = _doctrine2.default.parse(c.value, { unwrap: true });
        if (doc.tags.some(t => t.title === 'module')) {
          m.doc = doc;
          return true;
        }
      } catch (err) {/* ignore */}
      return false;
    });
  }

  const namespaces = new Map();

  function remotePath(value) {
    return _resolve2.default.relative(value, path, context.settings);
  }

  function resolveImport(value) {
    const rp = remotePath(value);
    if (rp == null) return null;
    return ExportMap.for(childContext(rp, context));
  }

  function getNamespace(identifier) {
    if (!namespaces.has(identifier.name)) return;

    return function () {
      return resolveImport(namespaces.get(identifier.name));
    };
  }

  function addNamespace(object, identifier) {
    const nsfn = getNamespace(identifier);
    if (nsfn) {
      Object.defineProperty(object, 'namespace', { get: nsfn });
    }

    return object;
  }

  function captureDependency(declaration) {
    if (declaration.source == null) return null;
    if (declaration.importKind === 'type') return null; // skip Flow type imports
    const importedSpecifiers = new Set();
    const supportedTypes = new Set(['ImportDefaultSpecifier', 'ImportNamespaceSpecifier']);
    let hasImportedType = false;
    if (declaration.specifiers) {
      declaration.specifiers.forEach(specifier => {
        const isType = specifier.importKind === 'type';
        hasImportedType = hasImportedType || isType;

        if (supportedTypes.has(specifier.type) && !isType) {
          importedSpecifiers.add(specifier.type);
        }
        if (specifier.type === 'ImportSpecifier' && !isType) {
          importedSpecifiers.add(specifier.imported.name);
        }
      });
    }

    // only Flow types were imported
    if (hasImportedType && importedSpecifiers.size === 0) return null;

    const p = remotePath(declaration.source.value);
    if (p == null) return null;
    const existing = m.imports.get(p);
    if (existing != null) return existing.getter;

    const getter = thunkFor(p, context);
    m.imports.set(p, {
      getter,
      source: { // capturing actual node reference holds full AST in memory!
        value: declaration.source.value,
        loc: declaration.source.loc
      },
      importedSpecifiers
    });
    return getter;
  }

  const source = makeSourceCode(content, ast);

  ast.body.forEach(function (n) {

    if (n.type === 'ExportDefaultDeclaration') {
      const exportMeta = captureDoc(source, docStyleParsers, n);
      if (n.declaration.type === 'Identifier') {
        addNamespace(exportMeta, n.declaration);
      }
      m.namespace.set('default', exportMeta);
      return;
    }

    if (n.type === 'ExportAllDeclaration') {
      const getter = captureDependency(n);
      if (getter) m.dependencies.add(getter);
      return;
    }

    // capture namespaces in case of later export
    if (n.type === 'ImportDeclaration') {
      captureDependency(n);
      let ns;
      if (n.specifiers.some(s => s.type === 'ImportNamespaceSpecifier' && (ns = s))) {
        namespaces.set(ns.local.name, n.source.value);
      }
      return;
    }

    if (n.type === 'ExportNamedDeclaration') {
      // capture declaration
      if (n.declaration != null) {
        switch (n.declaration.type) {
          case 'FunctionDeclaration':
          case 'ClassDeclaration':
          case 'TypeAlias': // flowtype with babel-eslint parser
          case 'InterfaceDeclaration':
          case 'DeclareFunction':
          case 'TSDeclareFunction':
          case 'TSEnumDeclaration':
          case 'TSTypeAliasDeclaration':
          case 'TSInterfaceDeclaration':
          case 'TSAbstractClassDeclaration':
          case 'TSModuleDeclaration':
            m.namespace.set(n.declaration.id.name, captureDoc(source, docStyleParsers, n));
            break;
          case 'VariableDeclaration':
            n.declaration.declarations.forEach(d => recursivePatternCapture(d.id, id => m.namespace.set(id.name, captureDoc(source, docStyleParsers, d, n))));
            break;
        }
      }

      const nsource = n.source && n.source.value;
      n.specifiers.forEach(s => {
        const exportMeta = {};
        let local;

        switch (s.type) {
          case 'ExportDefaultSpecifier':
            if (!n.source) return;
            local = 'default';
            break;
          case 'ExportNamespaceSpecifier':
            m.namespace.set(s.exported.name, Object.defineProperty(exportMeta, 'namespace', {
              get() {
                return resolveImport(nsource);
              }
            }));
            return;
          case 'ExportSpecifier':
            if (!n.source) {
              m.namespace.set(s.exported.name, addNamespace(exportMeta, s.local));
              return;
            }
          // else falls through
          default:
            local = s.local.name;
            break;
        }

        // todo: JSDoc
        m.reexports.set(s.exported.name, { local, getImport: () => resolveImport(nsource) });
      });
    }

    // This doesn't declare anything, but changes what's being exported.
    if (n.type === 'TSExportAssignment') {
      const moduleDecls = ast.body.filter(bodyNode => bodyNode.type === 'TSModuleDeclaration' && bodyNode.id.name === n.expression.name);
      moduleDecls.forEach(moduleDecl => {
        if (moduleDecl && moduleDecl.body && moduleDecl.body.body) {
          moduleDecl.body.body.forEach(moduleBlockNode => {
            // Export-assignment exports all members in the namespace, explicitly exported or not.
            const exportedDecl = moduleBlockNode.type === 'ExportNamedDeclaration' ? moduleBlockNode.declaration : moduleBlockNode;

            if (exportedDecl.type === 'VariableDeclaration') {
              exportedDecl.declarations.forEach(decl => recursivePatternCapture(decl.id, id => m.namespace.set(id.name, captureDoc(source, docStyleParsers, decl, exportedDecl, moduleBlockNode))));
            } else {
              m.namespace.set(exportedDecl.id.name, captureDoc(source, docStyleParsers, moduleBlockNode));
            }
          });
        }
      });
    }
  });

  return m;
};

/**
 * The creation of this closure is isolated from other scopes
 * to avoid over-retention of unrelated variables, which has
 * caused memory leaks. See #1266.
 */
function thunkFor(p, context) {
  return () => ExportMap.for(childContext(p, context));
}

/**
 * Traverse a pattern/identifier node, calling 'callback'
 * for each leaf identifier.
 * @param  {node}   pattern
 * @param  {Function} callback
 * @return {void}
 */
function recursivePatternCapture(pattern, callback) {
  switch (pattern.type) {
    case 'Identifier':
      // base case
      callback(pattern);
      break;

    case 'ObjectPattern':
      pattern.properties.forEach(p => {
        recursivePatternCapture(p.value, callback);
      });
      break;

    case 'ArrayPattern':
      pattern.elements.forEach(element => {
        if (element == null) return;
        recursivePatternCapture(element, callback);
      });
      break;

    case 'AssignmentPattern':
      callback(pattern.left);
      break;
  }
}

/**
 * don't hold full context object in memory, just grab what we need.
 */
function childContext(path, context) {
  const settings = context.settings,
        parserOptions = context.parserOptions,
        parserPath = context.parserPath;

  return {
    settings,
    parserOptions,
    parserPath,
    path
  };
}

/**
 * sometimes legacy support isn't _that_ hard... right?
 */
function makeSourceCode(text, ast) {
  if (_eslint.SourceCode.length > 1) {
    // ESLint 3
    return new _eslint.SourceCode(text, ast);
  } else {
    // ESLint 4, 5
    return new _eslint.SourceCode({ text, ast });
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9FeHBvcnRNYXAuanMiXSwibmFtZXMiOlsicmVjdXJzaXZlUGF0dGVybkNhcHR1cmUiLCJ1bmFtYmlndW91cyIsImxvZyIsImV4cG9ydENhY2hlIiwiTWFwIiwiRXhwb3J0TWFwIiwiY29uc3RydWN0b3IiLCJwYXRoIiwibmFtZXNwYWNlIiwicmVleHBvcnRzIiwiZGVwZW5kZW5jaWVzIiwiU2V0IiwiaW1wb3J0cyIsImVycm9ycyIsImhhc0RlZmF1bHQiLCJnZXQiLCJzaXplIiwiZm9yRWFjaCIsImRlcCIsImQiLCJoYXMiLCJuYW1lIiwiaW5uZXJNYXAiLCJoYXNEZWVwIiwiZm91bmQiLCJpbXBvcnRlZCIsImdldEltcG9ydCIsImxvY2FsIiwiZGVlcCIsInVuc2hpZnQiLCJpbm5lclZhbHVlIiwidW5kZWZpbmVkIiwiY2FsbGJhY2siLCJ0aGlzQXJnIiwidiIsIm4iLCJjYWxsIiwicmVleHBvcnRlZCIsInJlcG9ydEVycm9ycyIsImNvbnRleHQiLCJkZWNsYXJhdGlvbiIsInJlcG9ydCIsIm5vZGUiLCJzb3VyY2UiLCJtZXNzYWdlIiwidmFsdWUiLCJtYXAiLCJlIiwibGluZU51bWJlciIsImNvbHVtbiIsImpvaW4iLCJjYXB0dXJlRG9jIiwiZG9jU3R5bGVQYXJzZXJzIiwibWV0YWRhdGEiLCJub2RlcyIsInNvbWUiLCJsZWFkaW5nQ29tbWVudHMiLCJyYW5nZSIsImdldENvbW1lbnRzQmVmb3JlIiwibGVuZ3RoIiwiZG9jIiwiZXJyIiwiYXZhaWxhYmxlRG9jU3R5bGVQYXJzZXJzIiwianNkb2MiLCJjYXB0dXJlSnNEb2MiLCJ0b21kb2MiLCJjYXB0dXJlVG9tRG9jIiwiY29tbWVudHMiLCJjb21tZW50IiwidHlwZSIsImRvY3RyaW5lIiwicGFyc2UiLCJ1bndyYXAiLCJsaW5lcyIsImkiLCJtYXRjaCIsInB1c2giLCJ0cmltIiwic3RhdHVzTWF0Y2giLCJkZXNjcmlwdGlvbiIsInRhZ3MiLCJ0aXRsZSIsInRvTG93ZXJDYXNlIiwiZm9yIiwiY2hpbGRDb250ZXh0IiwiY2FjaGVLZXkiLCJkaWdlc3QiLCJleHBvcnRNYXAiLCJzdGF0cyIsImZzIiwic3RhdFN5bmMiLCJtdGltZSIsInNldCIsImNvbnRlbnQiLCJyZWFkRmlsZVN5bmMiLCJlbmNvZGluZyIsInRlc3QiLCJtIiwiYXN0IiwidmlzaXRvcktleXMiLCJoYXNEeW5hbWljSW1wb3J0cyIsIkNhbGxFeHByZXNzaW9uIiwiY2FsbGVlIiwiZmlyc3RBcmd1bWVudCIsImFyZ3VtZW50cyIsInAiLCJyZW1vdGVQYXRoIiwiaW1wb3J0ZWRTcGVjaWZpZXJzIiwiYWRkIiwiZ2V0dGVyIiwidGh1bmtGb3IiLCJsb2MiLCJpc01vZHVsZSIsImRvY3N0eWxlIiwic2V0dGluZ3MiLCJzdHlsZSIsImMiLCJ0IiwibmFtZXNwYWNlcyIsInJlc29sdmUiLCJyZWxhdGl2ZSIsInJlc29sdmVJbXBvcnQiLCJycCIsImdldE5hbWVzcGFjZSIsImlkZW50aWZpZXIiLCJhZGROYW1lc3BhY2UiLCJvYmplY3QiLCJuc2ZuIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJjYXB0dXJlRGVwZW5kZW5jeSIsImltcG9ydEtpbmQiLCJzdXBwb3J0ZWRUeXBlcyIsImhhc0ltcG9ydGVkVHlwZSIsInNwZWNpZmllcnMiLCJzcGVjaWZpZXIiLCJpc1R5cGUiLCJleGlzdGluZyIsIm1ha2VTb3VyY2VDb2RlIiwiYm9keSIsImV4cG9ydE1ldGEiLCJucyIsInMiLCJpZCIsImRlY2xhcmF0aW9ucyIsIm5zb3VyY2UiLCJleHBvcnRlZCIsIm1vZHVsZURlY2xzIiwiZmlsdGVyIiwiYm9keU5vZGUiLCJleHByZXNzaW9uIiwibW9kdWxlRGVjbCIsIm1vZHVsZUJsb2NrTm9kZSIsImV4cG9ydGVkRGVjbCIsImRlY2wiLCJwYXR0ZXJuIiwicHJvcGVydGllcyIsImVsZW1lbnRzIiwiZWxlbWVudCIsImxlZnQiLCJwYXJzZXJPcHRpb25zIiwicGFyc2VyUGF0aCIsInRleHQiLCJTb3VyY2VDb2RlIl0sIm1hcHBpbmdzIjoi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Q0UySCxjQUFRRSxRQUFSLENBQWlCNUksT0FBakIsQ0FBMEI2SSxPQUFELElBQWE7QUFDcEMsWUFBSUEsV0FBVyxJQUFmLEVBQXFCO0FBQ3JCOUosZ0NBQXdCOEosT0FBeEIsRUFBaUM5SCxRQUFqQztBQUNELE9BSEQ7QUFJQTs7QUFFRixTQUFLLG1CQUFMO0FBQ0VBLGVBQVMySCxRQUFRSSxJQUFqQjtBQUNBO0FBcEJKO0FBc0JEOztBQUVEOzs7QUFHQSxTQUFTM0UsWUFBVCxDQUFzQjdFLElBQXRCLEVBQTRCZ0MsT0FBNUIsRUFBcUM7QUFBQSxRQUMzQjJFLFFBRDJCLEdBQ2EzRSxPQURiLENBQzNCMkUsUUFEMkI7QUFBQSxRQUNqQjhDLGFBRGlCLEdBQ2F6SCxPQURiLENBQ2pCeUgsYUFEaUI7QUFBQSxRQUNGQyxVQURFLEdBQ2ExSCxPQURiLENBQ0YwSCxVQURFOztBQUVuQyxTQUFPO0FBQ0wvQyxZQURLO0FBRUw4QyxpQkFGSztBQUdMQyxjQUhLO0FBSUwxSjtBQUpLLEdBQVA7QUFNRDs7QUFHRDs7O0FBR0EsU0FBU21JLGNBQVQsQ0FBd0J3QixJQUF4QixFQUE4QmhFLEdBQTlCLEVBQW1DO0FBQ2pDLE1BQUlpRSxtQkFBV3hHLE1BQVgsR0FBb0IsQ0FBeEIsRUFBMkI7QUFDekI7QUFDQSxXQUFPLElBQUl3RyxrQkFBSixDQUFlRCxJQUFmLEVBQXFCaEUsR0FBckIsQ0FBUDtBQUNELEdBSEQsTUFHTztBQUNMO0FBQ0EsV0FBTyxJQUFJaUUsa0JBQUosQ0FBZSxFQUFFRCxJQUFGLEVBQVFoRSxHQUFSLEVBQWYsQ0FBUDtBQUNEO0FBQ0YiLCJmaWxlIjoiRXhwb3J0TWFwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuXG5pbXBvcnQgZG9jdHJpbmUgZnJvbSAnZG9jdHJpbmUnXG5cbmltcG9ydCBkZWJ1ZyBmcm9tICdkZWJ1ZydcblxuaW1wb3J0IHsgU291cmNlQ29kZSB9IGZyb20gJ2VzbGludCdcblxuaW1wb3J0IHBhcnNlIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcGFyc2UnXG5pbXBvcnQgdmlzaXQgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy92aXNpdCdcbmltcG9ydCByZXNvbHZlIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcmVzb2x2ZSdcbmltcG9ydCBpc0lnbm9yZWQsIHsgaGFzVmFsaWRFeHRlbnNpb24gfSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL2lnbm9yZSdcblxuaW1wb3J0IHsgaGFzaE9iamVjdCB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvaGFzaCdcbmltcG9ydCAqIGFzIHVuYW1iaWd1b3VzIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvdW5hbWJpZ3VvdXMnXG5cbmNvbnN0IGxvZyA9IGRlYnVnKCdlc2xpbnQtcGx1Z2luLWltcG9ydDpFeHBvcnRNYXAnKVxuXG5jb25zdCBleHBvcnRDYWNoZSA9IG5ldyBNYXAoKVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFeHBvcnRNYXAge1xuICBjb25zdHJ1Y3RvcihwYXRoKSB7XG4gICAgdGhpcy5wYXRoID0gcGF0aFxuICAgIHRoaXMubmFtZXNwYWNlID0gbmV3IE1hcCgpXG4gICAgLy8gdG9kbzogcmVzdHJ1Y3R1cmUgdG8ga2V5IG9uIHBhdGgsIHZhbHVlIGlzIHJlc29sdmVyICsgbWFwIG9mIG5hbWVzXG4gICAgdGhpcy5yZWV4cG9ydHMgPSBuZXcgTWFwKClcbiAgICAvKipcbiAgICAgKiBzdGFyLWV4cG9ydHNcbiAgICAgKiBAdHlwZSB7U2V0fSBvZiAoKSA9PiBFeHBvcnRNYXBcbiAgICAgKi9cbiAgICB0aGlzLmRlcGVuZGVuY2llcyA9IG5ldyBTZXQoKVxuICAgIC8qKlxuICAgICAqIGRlcGVuZGVuY2llcyBvZiB0aGlzIG1vZHVsZSB0aGF0IGFyZSBub3QgZXhwbGljaXRseSByZS1leHBvcnRlZFxuICAgICAqIEB0eXBlIHtNYXB9IGZyb20gcGF0aCA9ICgpID0+IEV4cG9ydE1hcFxuICAgICAqL1xuICAgIHRoaXMuaW1wb3J0cyA9IG5ldyBNYXAoKVxuICAgIHRoaXMuZXJyb3JzID0gW11cbiAgfVxuXG4gIGdldCBoYXNEZWZhdWx0KCkgeyByZXR1cm4gdGhpcy5nZXQoJ2RlZmF1bHQnKSAhPSBudWxsIH0gLy8gc3Ryb25nZXIgdGhhbiB0aGlzLmhhc1xuXG4gIGdldCBzaXplKCkge1xuICAgIGxldCBzaXplID0gdGhpcy5uYW1lc3BhY2Uuc2l6ZSArIHRoaXMucmVleHBvcnRzLnNpemVcbiAgICB0aGlzLmRlcGVuZGVuY2llcy5mb3JFYWNoKGRlcCA9PiB7XG4gICAgICBjb25zdCBkID0gZGVwKClcbiAgICAgIC8vIENKUyAvIGlnbm9yZWQgZGVwZW5kZW5jaWVzIHdvbid0IGV4aXN0ICgjNzE3KVxuICAgICAgaWYgKGQgPT0gbnVsbCkgcmV0dXJuXG4gICAgICBzaXplICs9IGQuc2l6ZVxuICAgIH0pXG4gICAgcmV0dXJuIHNpemVcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBkb2VzIG5vdCBjaGVjayBleHBsaWNpdGx5IHJlLWV4cG9ydGVkIG5hbWVzIGZvciBleGlzdGVuY2VcbiAgICogaW4gdGhlIGJhc2UgbmFtZXNwYWNlLCBidXQgaXQgd2lsbCBleHBhbmQgYWxsIGBleHBvcnQgKiBmcm9tICcuLi4nYCBleHBvcnRzXG4gICAqIGlmIG5vdCBmb3VuZCBpbiB0aGUgZXhwbGljaXQgbmFtZXNwYWNlLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICBuYW1lXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IHRydWUgaWYgYG5hbWVgIGlzIGV4cG9ydGVkIGJ5IHRoaXMgbW9kdWxlLlxuICAgKi9cbiAgaGFzKG5hbWUpIHtcbiAgICBpZiAodGhpcy5uYW1lc3BhY2UuaGFzKG5hbWUpKSByZXR1cm4gdHJ1ZVxuICAgIGlmICh0aGlzLnJlZXhwb3J0cy5oYXMobmFtZSkpIHJldHVybiB0cnVlXG5cbiAgICAvLyBkZWZhdWx0IGV4cG9ydHMgbXVzdCBiZSBleHBsaWNpdGx5IHJlLWV4cG9ydGVkICgjMzI4KVxuICAgIGlmIChuYW1lICE9PSAnZGVmYXVsdCcpIHtcbiAgICAgIGZvciAobGV0IGRlcCBvZiB0aGlzLmRlcGVuZGVuY2llcykge1xuICAgICAgICBsZXQgaW5uZXJNYXAgPSBkZXAoKVxuXG4gICAgICAgIC8vIHRvZG86IHJlcG9ydCBhcyB1bnJlc29sdmVkP1xuICAgICAgICBpZiAoIWlubmVyTWFwKSBjb250aW51ZVxuXG4gICAgICAgIGlmIChpbm5lck1hcC5oYXMobmFtZSkpIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICAvKipcbiAgICogZW5zdXJlIHRoYXQgaW1wb3J0ZWQgbmFtZSBmdWxseSByZXNvbHZlcy5cbiAgICogQHBhcmFtICB7W3R5cGVdfSAgbmFtZSBbZGVzY3JpcHRpb25dXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgW2Rlc2NyaXB0aW9uXVxuICAgKi9cbiAgaGFzRGVlcChuYW1lKSB7XG4gICAgaWYgKHRoaXMubmFtZXNwYWNlLmhhcyhuYW1lKSkgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHBhdGg6IFt0aGlzXSB9XG5cbiAgICBpZiAodGhpcy5yZWV4cG9ydHMuaGFzKG5hbWUpKSB7XG4gICAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLnJlZXhwb3J0cy5nZXQobmFtZSlcbiAgICAgICAgICAsIGltcG9ydGVkID0gcmVleHBvcnRzLmdldEltcG9ydCgpXG5cbiAgICAgIC8vIGlmIGltcG9ydCBpcyBpZ25vcmVkLCByZXR1cm4gZXhwbGljaXQgJ251bGwnXG4gICAgICBpZiAoaW1wb3J0ZWQgPT0gbnVsbCkgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHBhdGg6IFt0aGlzXSB9XG5cbiAgICAgIC8vIHNhZmVndWFyZCBhZ2FpbnN0IGN5Y2xlcywgb25seSBpZiBuYW1lIG1hdGNoZXNcbiAgICAgIGlmIChpbXBvcnRlZC5wYXRoID09PSB0aGlzLnBhdGggJiYgcmVleHBvcnRzLmxvY2FsID09PSBuYW1lKSB7XG4gICAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgcGF0aDogW3RoaXNdIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgZGVlcCA9IGltcG9ydGVkLmhhc0RlZXAocmVleHBvcnRzLmxvY2FsKVxuICAgICAgZGVlcC5wYXRoLnVuc2hpZnQodGhpcylcblxuICAgICAgcmV0dXJuIGRlZXBcbiAgICB9XG5cblxuICAgIC8vIGRlZmF1bHQgZXhwb3J0cyBtdXN0IGJlIGV4cGxpY2l0bHkgcmUtZXhwb3J0ZWQgKCMzMjgpXG4gICAgaWYgKG5hbWUgIT09ICdkZWZhdWx0Jykge1xuICAgICAgZm9yIChsZXQgZGVwIG9mIHRoaXMuZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIGxldCBpbm5lck1hcCA9IGRlcCgpXG4gICAgICAgIGlmIChpbm5lck1hcCA9PSBudWxsKSByZXR1cm4geyBmb3VuZDogdHJ1ZSwgcGF0aDogW3RoaXNdIH1cbiAgICAgICAgLy8gdG9kbzogcmVwb3J0IGFzIHVucmVzb2x2ZWQ/XG4gICAgICAgIGlmICghaW5uZXJNYXApIGNvbnRpbnVlXG5cbiAgICAgICAgLy8gc2FmZWd1YXJkIGFnYWluc3QgY3ljbGVzXG4gICAgICAgIGlmIChpbm5lck1hcC5wYXRoID09PSB0aGlzLnBhdGgpIGNvbnRpbnVlXG5cbiAgICAgICAgbGV0IGlubmVyVmFsdWUgPSBpbm5lck1hcC5oYXNEZWVwKG5hbWUpXG4gICAgICAgIGlmIChpbm5lclZhbHVlLmZvdW5kKSB7XG4gICAgICAgICAgaW5uZXJWYWx1ZS5wYXRoLnVuc2hpZnQodGhpcylcbiAgICAgICAgICByZXR1cm4gaW5uZXJWYWx1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCBwYXRoOiBbdGhpc10gfVxuICB9XG5cbiAgZ2V0KG5hbWUpIHtcbiAgICBpZiAodGhpcy5uYW1lc3BhY2UuaGFzKG5hbWUpKSByZXR1cm4gdGhpcy5uYW1lc3BhY2UuZ2V0KG5hbWUpXG5cbiAgICBpZiAodGhpcy5yZWV4cG9ydHMuaGFzKG5hbWUpKSB7XG4gICAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLnJlZXhwb3J0cy5nZXQobmFtZSlcbiAgICAgICAgICAsIGltcG9ydGVkID0gcmVleHBvcnRzLmdldEltcG9ydCgpXG5cbiAgICAgIC8vIGlmIGltcG9ydCBpcyBpZ25vcmVkLCByZXR1cm4gZXhwbGljaXQgJ251bGwnXG4gICAgICBpZiAoaW1wb3J0ZWQgPT0gbnVsbCkgcmV0dXJuIG51bGxcblxuICAgICAgLy8gc2FmZWd1YXJkIGFnYWluc3QgY3ljbGVzLCBvbmx5IGlmIG5hbWUgbWF0Y2hlc1xuICAgICAgaWYgKGltcG9ydGVkLnBhdGggPT09IHRoaXMucGF0aCAmJiByZWV4cG9ydHMubG9jYWwgPT09IG5hbWUpIHJldHVybiB1bmRlZmluZWRcblxuICAgICAgcmV0dXJuIGltcG9ydGVkLmdldChyZWV4cG9ydHMubG9jYWwpXG4gICAgfVxuXG4gICAgLy8gZGVmYXVsdCBleHBvcnRzIG11c3QgYmUgZXhwbGljaXRseSByZS1leHBvcnRlZCAoIzMyOClcbiAgICBpZiAobmFtZSAhPT0gJ2RlZmF1bHQnKSB7XG4gICAgICBmb3IgKGxldCBkZXAgb2YgdGhpcy5kZXBlbmRlbmNpZXMpIHtcbiAgICAgICAgbGV0IGlubmVyTWFwID0gZGVwKClcbiAgICAgICAgLy8gdG9kbzogcmVwb3J0IGFzIHVucmVzb2x2ZWQ/XG4gICAgICAgIGlmICghaW5uZXJNYXApIGNvbnRpbnVlXG5cbiAgICAgICAgLy8gc2FmZWd1YXJkIGFnYWluc3QgY3ljbGVzXG4gICAgICAgIGlmIChpbm5lck1hcC5wYXRoID09PSB0aGlzLnBhdGgpIGNvbnRpbnVlXG5cbiAgICAgICAgbGV0IGlubmVyVmFsdWUgPSBpbm5lck1hcC5nZXQobmFtZSlcbiAgICAgICAgaWYgKGlubmVyVmFsdWUgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGlubmVyVmFsdWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cblxuICBmb3JFYWNoKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdGhpcy5uYW1lc3BhY2UuZm9yRWFjaCgodiwgbikgPT5cbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdiwgbiwgdGhpcykpXG5cbiAgICB0aGlzLnJlZXhwb3J0cy5mb3JFYWNoKChyZWV4cG9ydHMsIG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IHJlZXhwb3J0ZWQgPSByZWV4cG9ydHMuZ2V0SW1wb3J0KClcbiAgICAgIC8vIGNhbid0IGxvb2sgdXAgbWV0YSBmb3IgaWdub3JlZCByZS1leHBvcnRzICgjMzQ4KVxuICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCByZWV4cG9ydGVkICYmIHJlZXhwb3J0ZWQuZ2V0KHJlZXhwb3J0cy5sb2NhbCksIG5hbWUsIHRoaXMpXG4gICAgfSlcblxuICAgIHRoaXMuZGVwZW5kZW5jaWVzLmZvckVhY2goZGVwID0+IHtcbiAgICAgIGNvbnN0IGQgPSBkZXAoKVxuICAgICAgLy8gQ0pTIC8gaWdub3JlZCBkZXBlbmRlbmNpZXMgd29uJ3QgZXhpc3QgKCM3MTcpXG4gICAgICBpZiAoZCA9PSBudWxsKSByZXR1cm5cblxuICAgICAgZC5mb3JFYWNoKCh2LCBuKSA9PlxuICAgICAgICBuICE9PSAnZGVmYXVsdCcgJiYgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB2LCBuLCB0aGlzKSlcbiAgICB9KVxuICB9XG5cbiAgLy8gdG9kbzoga2V5cywgdmFsdWVzLCBlbnRyaWVzP1xuXG4gIHJlcG9ydEVycm9ycyhjb250ZXh0LCBkZWNsYXJhdGlvbikge1xuICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgIG5vZGU6IGRlY2xhcmF0aW9uLnNvdXJjZSxcbiAgICAgIG1lc3NhZ2U6IGBQYXJzZSBlcnJvcnMgaW4gaW1wb3J0ZWQgbW9kdWxlICcke2RlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZX0nOiBgICtcbiAgICAgICAgICAgICAgICAgIGAke3RoaXMuZXJyb3JzXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGUgPT4gYCR7ZS5tZXNzYWdlfSAoJHtlLmxpbmVOdW1iZXJ9OiR7ZS5jb2x1bW59KWApXG4gICAgICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKX1gLFxuICAgIH0pXG4gIH1cbn1cblxuLyoqXG4gKiBwYXJzZSBkb2NzIGZyb20gdGhlIGZpcnN0IG5vZGUgdGhhdCBoYXMgbGVhZGluZyBjb21tZW50c1xuICovXG5mdW5jdGlvbiBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCAuLi5ub2Rlcykge1xuICBjb25zdCBtZXRhZGF0YSA9IHt9XG5cbiAgLy8gJ3NvbWUnIHNob3J0LWNpcmN1aXRzIG9uIGZpcnN0ICd0cnVlJ1xuICBub2Rlcy5zb21lKG4gPT4ge1xuICAgIHRyeSB7XG5cbiAgICAgIGxldCBsZWFkaW5nQ29tbWVudHNcblxuICAgICAgLy8gbi5sZWFkaW5nQ29tbWVudHMgaXMgbGVnYWN5IGBhdHRhY2hDb21tZW50c2AgYmVoYXZpb3JcbiAgICAgIGlmICgnbGVhZGluZ0NvbW1lbnRzJyBpbiBuKSB7XG4gICAgICAgIGxlYWRpbmdDb21tZW50cyA9IG4ubGVhZGluZ0NvbW1lbnRzXG4gICAgICB9IGVsc2UgaWYgKG4ucmFuZ2UpIHtcbiAgICAgICAgbGVhZGluZ0NvbW1lbnRzID0gc291cmNlLmdldENvbW1lbnRzQmVmb3JlKG4pXG4gICAgICB9XG5cbiAgICAgIGlmICghbGVhZGluZ0NvbW1lbnRzIHx8IGxlYWRpbmdDb21tZW50cy5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZVxuXG4gICAgICBmb3IgKGxldCBuYW1lIGluIGRvY1N0eWxlUGFyc2Vycykge1xuICAgICAgICBjb25zdCBkb2MgPSBkb2NTdHlsZVBhcnNlcnNbbmFtZV0obGVhZGluZ0NvbW1lbnRzKVxuICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgbWV0YWRhdGEuZG9jID0gZG9jXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gbWV0YWRhdGFcbn1cblxuY29uc3QgYXZhaWxhYmxlRG9jU3R5bGVQYXJzZXJzID0ge1xuICBqc2RvYzogY2FwdHVyZUpzRG9jLFxuICB0b21kb2M6IGNhcHR1cmVUb21Eb2MsXG59XG5cbi8qKlxuICogcGFyc2UgSlNEb2MgZnJvbSBsZWFkaW5nIGNvbW1lbnRzXG4gKiBAcGFyYW0gIHsuLi5bdHlwZV19IGNvbW1lbnRzIFtkZXNjcmlwdGlvbl1cbiAqIEByZXR1cm4ge3tkb2M6IG9iamVjdH19XG4gKi9cbmZ1bmN0aW9uIGNhcHR1cmVKc0RvYyhjb21tZW50cykge1xuICBsZXQgZG9jXG5cbiAgLy8gY2FwdHVyZSBYU0RvY1xuICBjb21tZW50cy5mb3JFYWNoKGNvbW1lbnQgPT4ge1xuICAgIC8vIHNraXAgbm9uLWJsb2NrIGNvbW1lbnRzXG4gICAgaWYgKGNvbW1lbnQudHlwZSAhPT0gJ0Jsb2NrJykgcmV0dXJuXG4gICAgdHJ5IHtcbiAgICAgIGRvYyA9IGRvY3RyaW5lLnBhcnNlKGNvbW1lbnQudmFsdWUsIHsgdW53cmFwOiB0cnVlIH0pXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvKiBkb24ndCBjYXJlLCBmb3Igbm93PyBtYXliZSBhZGQgdG8gYGVycm9ycz9gICovXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBkb2Ncbn1cblxuLyoqXG4gICogcGFyc2UgVG9tRG9jIHNlY3Rpb24gZnJvbSBjb21tZW50c1xuICAqL1xuZnVuY3Rpb24gY2FwdHVyZVRvbURvYyhjb21tZW50cykge1xuICAvLyBjb2xsZWN0IGxpbmVzIHVwIHRvIGZpcnN0IHBhcmFncmFwaCBicmVha1xuICBjb25zdCBsaW5lcyA9IFtdXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY29tbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjb21tZW50ID0gY29tbWVudHNbaV1cbiAgICBpZiAoY29tbWVudC52YWx1ZS5tYXRjaCgvXlxccyokLykpIGJyZWFrXG4gICAgbGluZXMucHVzaChjb21tZW50LnZhbHVlLnRyaW0oKSlcbiAgfVxuXG4gIC8vIHJldHVybiBkb2N0cmluZS1saWtlIG9iamVjdFxuICBjb25zdCBzdGF0dXNNYXRjaCA9IGxpbmVzLmpvaW4oJyAnKS5tYXRjaCgvXihQdWJsaWN8SW50ZXJuYWx8RGVwcmVjYXRlZCk6XFxzKiguKykvKVxuICBpZiAoc3RhdHVzTWF0Y2gpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGVzY3JpcHRpb246IHN0YXR1c01hdGNoWzJdLFxuICAgICAgdGFnczogW3tcbiAgICAgICAgdGl0bGU6IHN0YXR1c01hdGNoWzFdLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBzdGF0dXNNYXRjaFsyXSxcbiAgICAgIH1dLFxuICAgIH1cbiAgfVxufVxuXG5FeHBvcnRNYXAuZ2V0ID0gZnVuY3Rpb24gKHNvdXJjZSwgY29udGV4dCkge1xuICBjb25zdCBwYXRoID0gcmVzb2x2ZShzb3VyY2UsIGNvbnRleHQpXG4gIGlmIChwYXRoID09IG51bGwpIHJldHVybiBudWxsXG5cbiAgcmV0dXJuIEV4cG9ydE1hcC5mb3IoY2hpbGRDb250ZXh0KHBhdGgsIGNvbnRleHQpKVxufVxuXG5FeHBvcnRNYXAuZm9yID0gZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgY29uc3QgeyBwYXRoIH0gPSBjb250ZXh0XG5cbiAgY29uc3QgY2FjaGVLZXkgPSBoYXNoT2JqZWN0KGNvbnRleHQpLmRpZ2VzdCgnaGV4JylcbiAgbGV0IGV4cG9ydE1hcCA9IGV4cG9ydENhY2hlLmdldChjYWNoZUtleSlcblxuICAvLyByZXR1cm4gY2FjaGVkIGlnbm9yZVxuICBpZiAoZXhwb3J0TWFwID09PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMocGF0aClcbiAgaWYgKGV4cG9ydE1hcCAhPSBudWxsKSB7XG4gICAgLy8gZGF0ZSBlcXVhbGl0eSBjaGVja1xuICAgIGlmIChleHBvcnRNYXAubXRpbWUgLSBzdGF0cy5tdGltZSA9PT0gMCkge1xuICAgICAgcmV0dXJuIGV4cG9ydE1hcFxuICAgIH1cbiAgICAvLyBmdXR1cmU6IGNoZWNrIGNvbnRlbnQgZXF1YWxpdHk/XG4gIH1cblxuICAvLyBjaGVjayB2YWxpZCBleHRlbnNpb25zIGZpcnN0XG4gIGlmICghaGFzVmFsaWRFeHRlbnNpb24ocGF0aCwgY29udGV4dCkpIHtcbiAgICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIG51bGwpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIC8vIGNoZWNrIGZvciBhbmQgY2FjaGUgaWdub3JlXG4gIGlmIChpc0lnbm9yZWQocGF0aCwgY29udGV4dCkpIHtcbiAgICBsb2coJ2lnbm9yZWQgcGF0aCBkdWUgdG8gaWdub3JlIHNldHRpbmdzOicsIHBhdGgpXG4gICAgZXhwb3J0Q2FjaGUuc2V0KGNhY2hlS2V5LCBudWxsKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHBhdGgsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuXG4gIC8vIGNoZWNrIGZvciBhbmQgY2FjaGUgdW5hbWJpZ3VvdXMgbW9kdWxlc1xuICBpZiAoIXVuYW1iaWd1b3VzLnRlc3QoY29udGVudCkpIHtcbiAgICBsb2coJ2lnbm9yZWQgcGF0aCBkdWUgdG8gdW5hbWJpZ3VvdXMgcmVnZXg6JywgcGF0aClcbiAgICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIG51bGwpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGxvZygnY2FjaGUgbWlzcycsIGNhY2hlS2V5LCAnZm9yIHBhdGgnLCBwYXRoKVxuICBleHBvcnRNYXAgPSBFeHBvcnRNYXAucGFyc2UocGF0aCwgY29udGVudCwgY29udGV4dClcblxuICAvLyBhbWJpZ3VvdXMgbW9kdWxlcyByZXR1cm4gbnVsbFxuICBpZiAoZXhwb3J0TWFwID09IG51bGwpIHJldHVybiBudWxsXG5cbiAgZXhwb3J0TWFwLm10aW1lID0gc3RhdHMubXRpbWVcblxuICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIGV4cG9ydE1hcClcbiAgcmV0dXJuIGV4cG9ydE1hcFxufVxuXG5cbkV4cG9ydE1hcC5wYXJzZSA9IGZ1bmN0aW9uIChwYXRoLCBjb250ZW50LCBjb250ZXh0KSB7XG4gIHZhciBtID0gbmV3IEV4cG9ydE1hcChwYXRoKVxuXG4gIHRyeSB7XG4gICAgdmFyIHsgYXN0LCB2aXNpdG9yS2V5cyB9ID0gcGFyc2UocGF0aCwgY29udGVudCwgY29udGV4dClcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgbS5lcnJvcnMucHVzaChlcnIpXG4gICAgcmV0dXJuIG0gLy8gY2FuJ3QgY29udGludWVcbiAgfVxuXG4gIGxldCBoYXNEeW5hbWljSW1wb3J0cyA9IGZhbHNlXG5cbiAgdmlzaXQoYXN0LCB2aXNpdG9yS2V5cywge1xuICAgIENhbGxFeHByZXNzaW9uKG5vZGUpIHtcbiAgICAgIGlmIChub2RlLmNhbGxlZS50eXBlID09PSAnSW1wb3J0Jykge1xuICAgICAgICBoYXNEeW5hbWljSW1wb3J0cyA9IHRydWVcbiAgICAgICAgY29uc3QgZmlyc3RBcmd1bWVudCA9IG5vZGUuYXJndW1lbnRzWzBdXG4gICAgICAgIGlmIChmaXJzdEFyZ3VtZW50LnR5cGUgIT09ICdMaXRlcmFsJykge1xuICAgICAgICAgIHJldHVybiBudWxsXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcCA9IHJlbW90ZVBhdGgoZmlyc3RBcmd1bWVudC52YWx1ZSlcbiAgICAgICAgaWYgKHAgPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBudWxsXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaW1wb3J0ZWRTcGVjaWZpZXJzID0gbmV3IFNldCgpXG4gICAgICAgIGltcG9ydGVkU3BlY2lmaWVycy5hZGQoJ0ltcG9ydE5hbWVzcGFjZVNwZWNpZmllcicpXG4gICAgICAgIGNvbnN0IGdldHRlciA9IHRodW5rRm9yKHAsIGNvbnRleHQpXG4gICAgICAgIG0uaW1wb3J0cy5zZXQocCwge1xuICAgICAgICAgIGdldHRlcixcbiAgICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAgIC8vIGNhcHR1cmluZyBhY3R1YWwgbm9kZSByZWZlcmVuY2UgaG9sZHMgZnVsbCBBU1QgaW4gbWVtb3J5IVxuICAgICAgICAgICAgdmFsdWU6IGZpcnN0QXJndW1lbnQudmFsdWUsXG4gICAgICAgICAgICBsb2M6IGZpcnN0QXJndW1lbnQubG9jLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW1wb3J0ZWRTcGVjaWZpZXJzLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0sXG4gIH0pXG5cbiAgaWYgKCF1bmFtYmlndW91cy5pc01vZHVsZShhc3QpICYmICFoYXNEeW5hbWljSW1wb3J0cykgcmV0dXJuIG51bGxcblxuICBjb25zdCBkb2NzdHlsZSA9IChjb250ZXh0LnNldHRpbmdzICYmIGNvbnRleHQuc2V0dGluZ3NbJ2ltcG9ydC9kb2NzdHlsZSddKSB8fCBbJ2pzZG9jJ11cbiAgY29uc3QgZG9jU3R5bGVQYXJzZXJzID0ge31cbiAgZG9jc3R5bGUuZm9yRWFjaChzdHlsZSA9PiB7XG4gICAgZG9jU3R5bGVQYXJzZXJzW3N0eWxlXSA9IGF2YWlsYWJsZURvY1N0eWxlUGFyc2Vyc1tzdHlsZV1cbiAgfSlcblxuICAvLyBhdHRlbXB0IHRvIGNvbGxlY3QgbW9kdWxlIGRvY1xuICBpZiAoYXN0LmNvbW1lbnRzKSB7XG4gICAgYXN0LmNvbW1lbnRzLnNvbWUoYyA9PiB7XG4gICAgICBpZiAoYy50eXBlICE9PSAnQmxvY2snKSByZXR1cm4gZmFsc2VcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGRvYyA9IGRvY3RyaW5lLnBhcnNlKGMudmFsdWUsIHsgdW53cmFwOiB0cnVlIH0pXG4gICAgICAgIGlmIChkb2MudGFncy5zb21lKHQgPT4gdC50aXRsZSA9PT0gJ21vZHVsZScpKSB7XG4gICAgICAgICAgbS5kb2MgPSBkb2NcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHsgLyogaWdub3JlICovIH1cbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH0pXG4gIH1cblxuICBjb25zdCBuYW1lc3BhY2VzID0gbmV3IE1hcCgpXG5cbiAgZnVuY3Rpb24gcmVtb3RlUGF0aCh2YWx1ZSkge1xuICAgIHJldHVybiByZXNvbHZlLnJlbGF0aXZlKHZhbHVlLCBwYXRoLCBjb250ZXh0LnNldHRpbmdzKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVzb2x2ZUltcG9ydCh2YWx1ZSkge1xuICAgIGNvbnN0IHJwID0gcmVtb3RlUGF0aCh2YWx1ZSlcbiAgICBpZiAocnAgPT0gbnVsbCkgcmV0dXJuIG51bGxcbiAgICByZXR1cm4gRXhwb3J0TWFwLmZvcihjaGlsZENvbnRleHQocnAsIGNvbnRleHQpKVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TmFtZXNwYWNlKGlkZW50aWZpZXIpIHtcbiAgICBpZiAoIW5hbWVzcGFjZXMuaGFzKGlkZW50aWZpZXIubmFtZSkpIHJldHVyblxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiByZXNvbHZlSW1wb3J0KG5hbWVzcGFjZXMuZ2V0KGlkZW50aWZpZXIubmFtZSkpXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYWRkTmFtZXNwYWNlKG9iamVjdCwgaWRlbnRpZmllcikge1xuICAgIGNvbnN0IG5zZm4gPSBnZXROYW1lc3BhY2UoaWRlbnRpZmllcilcbiAgICBpZiAobnNmbikge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdCwgJ25hbWVzcGFjZScsIHsgZ2V0OiBuc2ZuIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIG9iamVjdFxuICB9XG5cbiAgZnVuY3Rpb24gY2FwdHVyZURlcGVuZGVuY3koZGVjbGFyYXRpb24pIHtcbiAgICBpZiAoZGVjbGFyYXRpb24uc291cmNlID09IG51bGwpIHJldHVybiBudWxsXG4gICAgaWYgKGRlY2xhcmF0aW9uLmltcG9ydEtpbmQgPT09ICd0eXBlJykgcmV0dXJuIG51bGwgLy8gc2tpcCBGbG93IHR5cGUgaW1wb3J0c1xuICAgIGNvbnN0IGltcG9ydGVkU3BlY2lmaWVycyA9IG5ldyBTZXQoKVxuICAgIGNvbnN0IHN1cHBvcnRlZFR5cGVzID0gbmV3IFNldChbJ0ltcG9ydERlZmF1bHRTcGVjaWZpZXInLCAnSW1wb3J0TmFtZXNwYWNlU3BlY2lmaWVyJ10pXG4gICAgbGV0IGhhc0ltcG9ydGVkVHlwZSA9IGZhbHNlXG4gICAgaWYgKGRlY2xhcmF0aW9uLnNwZWNpZmllcnMpIHtcbiAgICAgIGRlY2xhcmF0aW9uLnNwZWNpZmllcnMuZm9yRWFjaChzcGVjaWZpZXIgPT4ge1xuICAgICAgICBjb25zdCBpc1R5cGUgPSBzcGVjaWZpZXIuaW1wb3J0S2luZCA9PT0gJ3R5cGUnXG4gICAgICAgIGhhc0ltcG9ydGVkVHlwZSA9IGhhc0ltcG9ydGVkVHlwZSB8fCBpc1R5cGVcblxuICAgICAgICBpZiAoc3VwcG9ydGVkVHlwZXMuaGFzKHNwZWNpZmllci50eXBlKSAmJiAhaXNUeXBlKSB7XG4gICAgICAgICAgaW1wb3J0ZWRTcGVjaWZpZXJzLmFkZChzcGVjaWZpZXIudHlwZSlcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3BlY2lmaWVyLnR5cGUgPT09ICdJbXBvcnRTcGVjaWZpZXInICYmICFpc1R5cGUpIHtcbiAgICAgICAgICBpbXBvcnRlZFNwZWNpZmllcnMuYWRkKHNwZWNpZmllci5pbXBvcnRlZC5uYW1lKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cblxuICAgIC8vIG9ubHkgRmxvdyB0eXBlcyB3ZXJlIGltcG9ydGVkXG4gICAgaWYgKGhhc0ltcG9ydGVkVHlwZSAmJiBpbXBvcnRlZFNwZWNpZmllcnMuc2l6ZSA9PT0gMCkgcmV0dXJuIG51bGxcblxuICAgIGNvbnN0IHAgPSByZW1vdGVQYXRoKGRlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZSlcbiAgICBpZiAocCA9PSBudWxsKSByZXR1cm4gbnVsbFxuICAgIGNvbnN0IGV4aXN0aW5nID0gbS5pbXBvcnRzLmdldChwKVxuICAgIGlmIChleGlzdGluZyAhPSBudWxsKSByZXR1cm4gZXhpc3RpbmcuZ2V0dGVyXG5cbiAgICBjb25zdCBnZXR0ZXIgPSB0aHVua0ZvcihwLCBjb250ZXh0KVxuICAgIG0uaW1wb3J0cy5zZXQocCwge1xuICAgICAgZ2V0dGVyLFxuICAgICAgc291cmNlOiB7ICAvLyBjYXB0dXJpbmcgYWN0dWFsIG5vZGUgcmVmZXJlbmNlIGhvbGRzIGZ1bGwgQVNUIGluIG1lbW9yeSFcbiAgICAgICAgdmFsdWU6IGRlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZSxcbiAgICAgICAgbG9jOiBkZWNsYXJhdGlvbi5zb3VyY2UubG9jLFxuICAgICAgfSxcbiAgICAgIGltcG9ydGVkU3BlY2lmaWVycyxcbiAgICB9KVxuICAgIHJldHVybiBnZXR0ZXJcbiAgfVxuXG4gIGNvbnN0IHNvdXJjZSA9IG1ha2VTb3VyY2VDb2RlKGNvbnRlbnQsIGFzdClcblxuICBhc3QuYm9keS5mb3JFYWNoKGZ1bmN0aW9uIChuKSB7XG5cbiAgICBpZiAobi50eXBlID09PSAnRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uJykge1xuICAgICAgY29uc3QgZXhwb3J0TWV0YSA9IGNhcHR1cmVEb2Moc291cmNlLCBkb2NTdHlsZVBhcnNlcnMsIG4pXG4gICAgICBpZiAobi5kZWNsYXJhdGlvbi50eXBlID09PSAnSWRlbnRpZmllcicpIHtcbiAgICAgICAgYWRkTmFtZXNwYWNlKGV4cG9ydE1ldGEsIG4uZGVjbGFyYXRpb24pXG4gICAgICB9XG4gICAgICBtLm5hbWVzcGFjZS5zZXQoJ2RlZmF1bHQnLCBleHBvcnRNZXRhKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKG4udHlwZSA9PT0gJ0V4cG9ydEFsbERlY2xhcmF0aW9uJykge1xuICAgICAgY29uc3QgZ2V0dGVyID0gY2FwdHVyZURlcGVuZGVuY3kobilcbiAgICAgIGlmIChnZXR0ZXIpIG0uZGVwZW5kZW5jaWVzLmFkZChnZXR0ZXIpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBjYXB0dXJlIG5hbWVzcGFjZXMgaW4gY2FzZSBvZiBsYXRlciBleHBvcnRcbiAgICBpZiAobi50eXBlID09PSAnSW1wb3J0RGVjbGFyYXRpb24nKSB7XG4gICAgICBjYXB0dXJlRGVwZW5kZW5jeShuKVxuICAgICAgbGV0IG5zXG4gICAgICBpZiAobi5zcGVjaWZpZXJzLnNvbWUocyA9PiBzLnR5cGUgPT09ICdJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXInICYmIChucyA9IHMpKSkge1xuICAgICAgICBuYW1lc3BhY2VzLnNldChucy5sb2NhbC5uYW1lLCBuLnNvdXJjZS52YWx1ZSlcbiAgICAgIH1cbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChuLnR5cGUgPT09ICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJykge1xuICAgICAgLy8gY2FwdHVyZSBkZWNsYXJhdGlvblxuICAgICAgaWYgKG4uZGVjbGFyYXRpb24gIT0gbnVsbCkge1xuICAgICAgICBzd2l0Y2ggKG4uZGVjbGFyYXRpb24udHlwZSkge1xuICAgICAgICAgIGNhc2UgJ0Z1bmN0aW9uRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ0NsYXNzRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ1R5cGVBbGlhcyc6IC8vIGZsb3d0eXBlIHdpdGggYmFiZWwtZXNsaW50IHBhcnNlclxuICAgICAgICAgIGNhc2UgJ0ludGVyZmFjZURlY2xhcmF0aW9uJzpcbiAgICAgICAgICBjYXNlICdEZWNsYXJlRnVuY3Rpb24nOlxuICAgICAgICAgIGNhc2UgJ1RTRGVjbGFyZUZ1bmN0aW9uJzpcbiAgICAgICAgICBjYXNlICdUU0VudW1EZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnVFNUeXBlQWxpYXNEZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnVFNJbnRlcmZhY2VEZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnVFNBYnN0cmFjdENsYXNzRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ1RTTW9kdWxlRGVjbGFyYXRpb24nOlxuICAgICAgICAgICAgbS5uYW1lc3BhY2Uuc2V0KG4uZGVjbGFyYXRpb24uaWQubmFtZSwgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgbikpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ1ZhcmlhYmxlRGVjbGFyYXRpb24nOlxuICAgICAgICAgICAgbi5kZWNsYXJhdGlvbi5kZWNsYXJhdGlvbnMuZm9yRWFjaCgoZCkgPT5cbiAgICAgICAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoZC5pZCxcbiAgICAgICAgICAgICAgICBpZCA9PiBtLm5hbWVzcGFjZS5zZXQoaWQubmFtZSwgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgZCwgbikpKSlcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgbnNvdXJjZSA9IG4uc291cmNlICYmIG4uc291cmNlLnZhbHVlXG4gICAgICBuLnNwZWNpZmllcnMuZm9yRWFjaCgocykgPT4ge1xuICAgICAgICBjb25zdCBleHBvcnRNZXRhID0ge31cbiAgICAgICAgbGV0IGxvY2FsXG5cbiAgICAgICAgc3dpdGNoIChzLnR5cGUpIHtcbiAgICAgICAgICBjYXNlICdFeHBvcnREZWZhdWx0U3BlY2lmaWVyJzpcbiAgICAgICAgICAgIGlmICghbi5zb3VyY2UpIHJldHVyblxuICAgICAgICAgICAgbG9jYWwgPSAnZGVmYXVsdCdcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgY2FzZSAnRXhwb3J0TmFtZXNwYWNlU3BlY2lmaWVyJzpcbiAgICAgICAgICAgIG0ubmFtZXNwYWNlLnNldChzLmV4cG9ydGVkLm5hbWUsIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRNZXRhLCAnbmFtZXNwYWNlJywge1xuICAgICAgICAgICAgICBnZXQoKSB7IHJldHVybiByZXNvbHZlSW1wb3J0KG5zb3VyY2UpIH0sXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIGNhc2UgJ0V4cG9ydFNwZWNpZmllcic6XG4gICAgICAgICAgICBpZiAoIW4uc291cmNlKSB7XG4gICAgICAgICAgICAgIG0ubmFtZXNwYWNlLnNldChzLmV4cG9ydGVkLm5hbWUsIGFkZE5hbWVzcGFjZShleHBvcnRNZXRhLCBzLmxvY2FsKSlcbiAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBlbHNlIGZhbGxzIHRocm91Z2hcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgbG9jYWwgPSBzLmxvY2FsLm5hbWVcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cblxuICAgICAgICAvLyB0b2RvOiBKU0RvY1xuICAgICAgICBtLnJlZXhwb3J0cy5zZXQocy5leHBvcnRlZC5uYW1lLCB7IGxvY2FsLCBnZXRJbXBvcnQ6ICgpID0+IHJlc29sdmVJbXBvcnQobnNvdXJjZSkgfSlcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gVGhpcyBkb2Vzbid0IGRlY2xhcmUgYW55dGhpbmcsIGJ1dCBjaGFuZ2VzIHdoYXQncyBiZWluZyBleHBvcnRlZC5cbiAgICBpZiAobi50eXBlID09PSAnVFNFeHBvcnRBc3NpZ25tZW50Jykge1xuICAgICAgY29uc3QgbW9kdWxlRGVjbHMgPSBhc3QuYm9keS5maWx0ZXIoKGJvZHlOb2RlKSA9PlxuICAgICAgICBib2R5Tm9kZS50eXBlID09PSAnVFNNb2R1bGVEZWNsYXJhdGlvbicgJiYgYm9keU5vZGUuaWQubmFtZSA9PT0gbi5leHByZXNzaW9uLm5hbWVcbiAgICAgIClcbiAgICAgIG1vZHVsZURlY2xzLmZvckVhY2goKG1vZHVsZURlY2wpID0+IHtcbiAgICAgICAgaWYgKG1vZHVsZURlY2wgJiYgbW9kdWxlRGVjbC5ib2R5ICYmIG1vZHVsZURlY2wuYm9keS5ib2R5KSB7XG4gICAgICAgICAgbW9kdWxlRGVjbC5ib2R5LmJvZHkuZm9yRWFjaCgobW9kdWxlQmxvY2tOb2RlKSA9PiB7XG4gICAgICAgICAgICAvLyBFeHBvcnQtYXNzaWdubWVudCBleHBvcnRzIGFsbCBtZW1iZXJzIGluIHRoZSBuYW1lc3BhY2UsIGV4cGxpY2l0bHkgZXhwb3J0ZWQgb3Igbm90LlxuICAgICAgICAgICAgY29uc3QgZXhwb3J0ZWREZWNsID0gbW9kdWxlQmxvY2tOb2RlLnR5cGUgPT09ICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJyA/XG4gICAgICAgICAgICAgIG1vZHVsZUJsb2NrTm9kZS5kZWNsYXJhdGlvbiA6XG4gICAgICAgICAgICAgIG1vZHVsZUJsb2NrTm9kZVxuXG4gICAgICAgICAgICBpZiAoZXhwb3J0ZWREZWNsLnR5cGUgPT09ICdWYXJpYWJsZURlY2xhcmF0aW9uJykge1xuICAgICAgICAgICAgICBleHBvcnRlZERlY2wuZGVjbGFyYXRpb25zLmZvckVhY2goKGRlY2wpID0+XG4gICAgICAgICAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoZGVjbC5pZCwoaWQpID0+IG0ubmFtZXNwYWNlLnNldChcbiAgICAgICAgICAgICAgICAgIGlkLm5hbWUsXG4gICAgICAgICAgICAgICAgICBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBkZWNsLCBleHBvcnRlZERlY2wsIG1vZHVsZUJsb2NrTm9kZSkpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQoXG4gICAgICAgICAgICAgICAgZXhwb3J0ZWREZWNsLmlkLm5hbWUsXG4gICAgICAgICAgICAgICAgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgbW9kdWxlQmxvY2tOb2RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gbVxufVxuXG4vKipcbiAqIFRoZSBjcmVhdGlvbiBvZiB0aGlzIGNsb3N1cmUgaXMgaXNvbGF0ZWQgZnJvbSBvdGhlciBzY29wZXNcbiAqIHRvIGF2b2lkIG92ZXItcmV0ZW50aW9uIG9mIHVucmVsYXRlZCB2YXJpYWJsZXMsIHdoaWNoIGhhc1xuICogY2F1c2VkIG1lbW9yeSBsZWFrcy4gU2VlICMxMjY2LlxuICovXG5mdW5jdGlvbiB0aHVua0ZvcihwLCBjb250ZXh0KSB7XG4gIHJldHVybiAoKSA9PiBFeHBvcnRNYXAuZm9yKGNoaWxkQ29udGV4dChwLCBjb250ZXh0KSlcbn1cblxuXG4vKipcbiAqIFRyYXZlcnNlIGEgcGF0dGVybi9pZGVudGlmaWVyIG5vZGUsIGNhbGxpbmcgJ2NhbGxiYWNrJ1xuICogZm9yIGVhY2ggbGVhZiBpZGVudGlmaWVyLlxuICogQHBhcmFtICB7bm9kZX0gICBwYXR0ZXJuXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZShwYXR0ZXJuLCBjYWxsYmFjaykge1xuICBzd2l0Y2ggKHBhdHRlcm4udHlwZSkge1xuICAgIGNhc2UgJ0lkZW50aWZpZXInOiAvLyBiYXNlIGNhc2VcbiAgICAgIGNhbGxiYWNrKHBhdHRlcm4pXG4gICAgICBicmVha1xuXG4gICAgY2FzZSAnT2JqZWN0UGF0dGVybic6XG4gICAgICBwYXR0ZXJuLnByb3BlcnRpZXMuZm9yRWFjaChwID0+IHtcbiAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUocC52YWx1ZSwgY2FsbGJhY2spXG4gICAgICB9KVxuICAgICAgYnJlYWtcblxuICAgIGNhc2UgJ0FycmF5UGF0dGVybic6XG4gICAgICBwYXR0ZXJuLmVsZW1lbnRzLmZvckVhY2goKGVsZW1lbnQpID0+IHtcbiAgICAgICAgaWYgKGVsZW1lbnQgPT0gbnVsbCkgcmV0dXJuXG4gICAgICAgIHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlKGVsZW1lbnQsIGNhbGxiYWNrKVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlICdBc3NpZ25tZW50UGF0dGVybic6XG4gICAgICBjYWxsYmFjayhwYXR0ZXJuLmxlZnQpXG4gICAgICBicmVha1xuICB9XG59XG5cbi8qKlxuICogZG9uJ3QgaG9sZCBmdWxsIGNvbnRleHQgb2JqZWN0IGluIG1lbW9yeSwganVzdCBncmFiIHdoYXQgd2UgbmVlZC5cbiAqL1xuZnVuY3Rpb24gY2hpbGRDb250ZXh0KHBhdGgsIGNvbnRleHQpIHtcbiAgY29uc3QgeyBzZXR0aW5ncywgcGFyc2VyT3B0aW9ucywgcGFyc2VyUGF0aCB9ID0gY29udGV4dFxuICByZXR1cm4ge1xuICAgIHNldHRpbmdzLFxuICAgIHBhcnNlck9wdGlvbnMsXG4gICAgcGFyc2VyUGF0aCxcbiAgICBwYXRoLFxuICB9XG59XG5cblxuLyoqXG4gKiBzb21ldGltZXMgbGVnYWN5IHN1cHBvcnQgaXNuJ3QgX3RoYXRfIGhhcmQuLi4gcmlnaHQ/XG4gKi9cbmZ1bmN0aW9uIG1ha2VTb3VyY2VDb2RlKHRleHQsIGFzdCkge1xuICBpZiAoU291cmNlQ29kZS5sZW5ndGggPiAxKSB7XG4gICAgLy8gRVNMaW50IDNcbiAgICByZXR1cm4gbmV3IFNvdXJjZUNvZGUodGV4dCwgYXN0KVxuICB9IGVsc2Uge1xuICAgIC8vIEVTTGludCA0LCA1XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VDb2RlKHsgdGV4dCwgYXN0IH0pXG4gIH1cbn1cbiJdfQ==