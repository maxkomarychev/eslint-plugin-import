import { test, testFilePath } from '../utils'
import jsxConfig from '../../../config/react'
import typescriptConfig from '../../../config/typescript'

import { RuleTester } from 'eslint'
import fs from 'fs'

const ruleTester = new RuleTester()
    , typescriptRuleTester = new RuleTester(typescriptConfig)
    , jsxRuleTester = new RuleTester(jsxConfig)
    , rule = require('rules/no-unused-modules')

const error = message => ({ ruleId: 'no-unused-modules', message })

const missingExportsOptions = [{
  missingExports: true,
}]

const unusedExportsOptions = [{
  unusedExports: true,
  src: [testFilePath('./no-unused-modules/**/*.js')],
  ignoreExports: [testFilePath('./no-unused-modules/*ignored*.js')],
}]

const unusedExportsTypescriptOptions = [{
  unusedExports: true,
  src: [testFilePath('./no-unused-modules/typescript')],
  ignoreExports: undefined,
}]

const unusedExportsJsxOptions = [{
  unusedExports: true,
  src: [testFilePath('./no-unused-modules/jsx')],
  ignoreExports: undefined,
}]

// // tests for missing exports
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ code: 'export default function noOptions() {}' }),
//     test({ options: missingExportsOptions,
//            code: 'export default () => 1'}),
//     test({ options: missingExportsOptions,
//            code: 'export const a = 1'}),
//     test({ options: missingExportsOptions,
//            code: 'const a = 1; export { a }'}),
//     test({ options: missingExportsOptions,
//            code: 'function a() { return true }; export { a }'}),
//     test({ options: missingExportsOptions,
//            code: 'const a = 1; const b = 2; export { a, b }'}),
//     test({ options: missingExportsOptions,
//            code: 'const a = 1; export default a'}),
//     test({ options: missingExportsOptions,
//            code: 'export class Foo {}'}),
//   ],
//   invalid: [
//     test({
//       options: missingExportsOptions,
//       code: 'const a = 1',
//       errors: [error(`No exports found`)],
//     }),
//     test({
//       options: missingExportsOptions,
//       code: '/* const a = 1 */',
//       errors: [error(`No exports found`)],
//     }),
//   ],
// })


// // tests for  exports
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//           code: 'import { o2 } from "./file-o";export default () => 12',
//           filename: testFilePath('./no-unused-modules/file-a.js'),
//           parser: require.resolve('babel-eslint')}),
//     test({ options: unusedExportsOptions,
//            code: 'export const b = 2',
//            filename: testFilePath('./no-unused-modules/file-b.js'),
//            parser: require.resolve('babel-eslint')}),
//     test({ options: unusedExportsOptions,
//            code: 'const c1 = 3; function c2() { return 3 }; export { c1, c2 }',
//            filename: testFilePath('./no-unused-modules/file-c.js'),
//            parser: require.resolve('babel-eslint')}),
//     test({ options: unusedExportsOptions,
//            code: 'export function d() { return 4 }',
//            filename: testFilePath('./no-unused-modules/file-d.js'),
//            parser: require.resolve('babel-eslint')}),
//     test({ options: unusedExportsOptions,
//            code: 'export class q { q0() {} }',
//            filename: testFilePath('./no-unused-modules/file-q.js'),
//            parser: require.resolve('babel-eslint')}),
//     test({ options: unusedExportsOptions,
//            code: 'const e0 = 5; export { e0 as e }',
//            filename: testFilePath('./no-unused-modules/file-e.js'),
//            parser: require.resolve('babel-eslint')}),
//     test({ options: unusedExportsOptions,
//            code: 'const l0 = 5; const l = 10; export { l0 as l1, l }; export default () => {}',
//            filename: testFilePath('./no-unused-modules/file-l.js'),
//            parser: require.resolve('babel-eslint')}),
//     test({ options: unusedExportsOptions,
//            code: 'const o0 = 0; const o1 = 1; export { o0, o1 as o2 }; export default () => {}',
//            filename: testFilePath('./no-unused-modules/file-o.js'),
//            parser: require.resolve('babel-eslint')}),
//   ],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: `import eslint from 'eslint'
//            import fileA from './file-a'
//            import { b } from './file-b'
//            import { c1, c2 } from './file-c'
//            import { d } from './file-d'
//            import { e } from './file-e'
//            import { e2 } from './file-e'
//            import { h2 } from './file-h'
//            import * as l from './file-l'
//            export * from './file-n'
//            export { default, o0, o3 } from './file-o'
//            export { p } from './file-p'`,
//            filename: testFilePath('./no-unused-modules/file-0.js'),
//            errors: [
//              error(`exported declaration 'default' not used within other modules`),
//              error(`exported declaration 'o0' not used within other modules`),
//              error(`exported declaration 'o3' not used within other modules`),
//              error(`exported declaration 'p' not used within other modules`),
//            ],
//     }),
//     test({ options: unusedExportsOptions,
//            code: `const n0 = 'n0'; const n1 = 42; export { n0, n1 }; export default () => {}`,
//            filename: testFilePath('./no-unused-modules/file-n.js'),
//            errors: [
//              error(`exported declaration 'default' not used within other modules`),
//            ]}),
//   ],
// })

// // test for unused exports
// ruleTester.run('no-unused-modules', rule, {
//   valid: [],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: 'export default () => 13',
//            filename: testFilePath('./no-unused-modules/file-f.js'),
//            errors: [error(`exported declaration 'default' not used within other modules`)]}),
//     test({ options: unusedExportsOptions,
//            code: 'export const g = 2',
//            filename: testFilePath('./no-unused-modules/file-g.js'),
//            errors: [error(`exported declaration 'g' not used within other modules`)]}),
//     test({ options: unusedExportsOptions,
//            code: 'const h1 = 3; function h2() { return 3 }; const h3 = true; export { h1, h2, h3 }',
//            filename: testFilePath('./no-unused-modules/file-h.js'),
//            errors: [error(`exported declaration 'h1' not used within other modules`)]}),
//     test({ options: unusedExportsOptions,
//            code: 'const i1 = 3; function i2() { return 3 }; export { i1, i2 }',
//            filename: testFilePath('./no-unused-modules/file-i.js'),
//            errors: [
//              error(`exported declaration 'i1' not used within other modules`),
//              error(`exported declaration 'i2' not used within other modules`),
//            ]}),
//     test({ options: unusedExportsOptions,
//            code: 'export function j() { return 4 }',
//            filename: testFilePath('./no-unused-modules/file-j.js'),
//            errors: [error(`exported declaration 'j' not used within other modules`)]}),
//     test({ options: unusedExportsOptions,
//            code: 'export class q { q0() {} }',
//            filename: testFilePath('./no-unused-modules/file-q.js'),
//            errors: [error(`exported declaration 'q' not used within other modules`)]}),
//     test({ options: unusedExportsOptions,
//            code: 'const k0 = 5; export { k0 as k }',
//            filename: testFilePath('./no-unused-modules/file-k.js'),
//            errors: [error(`exported declaration 'k' not used within other modules`)]}),
//   ],
// })

// test for unused exports with `import()`
ruleTester.run('no-unused-modules', rule, {
  valid: [
    test({ options: unusedExportsOptions,
           code: `
           export const importMeDynamicallyA = 100;
           const importMeDynamicallyB = 200;
           export default importMeDynamicallyB;
           `,
           parser: require.resolve('babel-eslint'),
           filename: testFilePath('./no-unused-modules/exports-for-dynamic.js')}),
  ],
  invalid: [
    test({ options: unusedExportsOptions,
           code: `
           export const importMeDynamicallyC = 100;
           `,
           parser: require.resolve('babel-eslint'),
           filename: testFilePath('./no-unused-modules/exports-for-dynamic.js'),
           errors: [
             error(
               `exported declaration 'importMeDynamicallyC' not used within other modules`,
             ),
           ]}),
  ],
})

// // // test for export from
// ruleTester.run('no-unused-modules', rule, {
//   valid: [],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: `export { k } from '${testFilePath('./no-unused-modules/file-k.js')}'`,
//            filename: testFilePath('./no-unused-modules/file-j.js'),
//            errors: [error(`exported declaration 'k' not used within other modules`)]}),
//   ],
// })

// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: 'const k0 = 5; export { k0 as k }',
//            filename: testFilePath('./no-unused-modules/file-k.js')}),
//   ],
//   invalid: [],
// })

// // test for ignored files
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//       code: 'export default () => 14',
//       filename: testFilePath('./no-unused-modules/file-ignored-a.js')}),
//     test({ options: unusedExportsOptions,
//       code: 'export const b = 2',
//       filename: testFilePath('./no-unused-modules/file-ignored-b.js')}),
//     test({ options: unusedExportsOptions,
//       code: 'const c1 = 3; function c2() { return 3 }; export { c1, c2 }',
//       filename: testFilePath('./no-unused-modules/file-ignored-c.js')}),
//     test({ options: unusedExportsOptions,
//       code: 'export function d() { return 4 }',
//       filename: testFilePath('./no-unused-modules/file-ignored-d.js')}),
//     test({ options: unusedExportsOptions,
//       code: 'const f = 5; export { f as e }',
//       filename: testFilePath('./no-unused-modules/file-ignored-e.js')}),
//     test({ options: unusedExportsOptions,
//       code: 'const l0 = 5; const l = 10; export { l0 as l1, l }; export default () => {}',
//       filename: testFilePath('./no-unused-modules/file-ignored-l.js')}),
//     ],
//   invalid: [],
// })

// // add named import for file with default export
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//       code: `import { f } from '${testFilePath('./no-unused-modules/file-f.js')}'`,
//       filename: testFilePath('./no-unused-modules/file-0.js')}),
//     ],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: 'export default () => 15',
//            filename: testFilePath('./no-unused-modules/file-f.js'),
//            errors: [error(`exported declaration 'default' not used within other modules`)]}),
//     ],
// })

// // add default import for file with default export
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `import f from '${testFilePath('./no-unused-modules/file-f.js')}'`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//     test({ options: unusedExportsOptions,
//            code: 'export default () => 16',
//            filename: testFilePath('./no-unused-modules/file-f.js')}),
//     ],
//   invalid: [],
// })

// // add default import for file with named export
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `import g from '${testFilePath('./no-unused-modules/file-g.js')}';import {h} from '${testFilePath('./no-unused-modules/file-gg.js')}'`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//     ],
//   invalid: [
//     test({ options: unusedExportsOptions,
//             code: 'export const g = 2',
//             filename: testFilePath('./no-unused-modules/file-g.js'),
//             errors: [error(`exported declaration 'g' not used within other modules`)]})],
// })

// // add named import for file with named export
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `import { g } from '${testFilePath('./no-unused-modules/file-g.js')}'; import eslint from 'eslint'`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//     test({ options: unusedExportsOptions,
//             code: 'export const g = 2',
//             filename: testFilePath('./no-unused-modules/file-g.js')}),
//     ],
//   invalid: [],
// })

// // add different named import for file with named export
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `import { c } from '${testFilePath('./no-unused-modules/file-b.js')}'`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//   ],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: 'export const b = 2',
//            filename: testFilePath('./no-unused-modules/file-b.js'),
//            errors: [error(`exported declaration 'b' not used within other modules`)]}),
//   ],
// })

// // add renamed named import for file with named export
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `import { g as g1 } from '${testFilePath('./no-unused-modules/file-g.js')}'; import eslint from 'eslint'`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//     test({ options: unusedExportsOptions,
//             code: 'export const g = 2',
//             filename: testFilePath('./no-unused-modules/file-g.js')}),
//     ],
//   invalid: [],
// })

// // add different renamed named import for file with named export
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `import { g1 as g } from '${testFilePath('./no-unused-modules/file-g.js')}'`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//   ],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: 'export const g = 2',
//            filename: testFilePath('./no-unused-modules/file-g.js'),
//            errors: [error(`exported declaration 'g' not used within other modules`)]}),
//   ],
// })

// // remove default import for file with default export
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `import { a1, a2 } from '${testFilePath('./no-unused-modules/file-a.js')}'`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//   ],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: 'export default () => 17',
//            filename: testFilePath('./no-unused-modules/file-a.js'),
//            errors: [error(`exported declaration 'default' not used within other modules`)]}),
//   ],
// })

// // add namespace import for file with unused exports
// ruleTester.run('no-unused-modules', rule, {
//   valid: [],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: 'const m0 = 5; const m = 10; export { m0 as m1, m }; export default () => {}',
//            filename: testFilePath('./no-unused-modules/file-m.js'),
//            errors: [
//              error(`exported declaration 'm1' not used within other modules`),
//              error(`exported declaration 'm' not used within other modules`),
//              error(`exported declaration 'default' not used within other modules`),
//           ]}),
//   ],
// })
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `import * as m from '${testFilePath('./no-unused-modules/file-m.js')}'; import unknown from 'unknown-module'`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//     test({ options: unusedExportsOptions,
//            code: 'const m0 = 5; const m = 10; export { m0 as m1, m }; export default () => {}',
//            filename: testFilePath('./no-unused-modules/file-m.js')}),
//   ],
//   invalid: [],
// })

// // remove all exports
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `/* import * as m from '${testFilePath('./no-unused-modules/file-m.js')}' */`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//   ],
//   invalid: [
//     test({ options: unusedExportsOptions,
//       code: 'const m0 = 5; const m = 10; export { m0 as m1, m }; export default () => {}',
//       filename: testFilePath('./no-unused-modules/file-m.js'),
//       errors: [
//         error(`exported declaration 'm1' not used within other modules`),
//         error(`exported declaration 'm' not used within other modules`),
//         error(`exported declaration 'default' not used within other modules`),
//      ]}),
//   ],
// })

// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//            code: `export * from '${testFilePath('./no-unused-modules/file-m.js')}';`,
//            filename: testFilePath('./no-unused-modules/file-0.js')}),
//   ],
//   invalid: [],
// })
// ruleTester.run('no-unused-modules', rule, {
//   valid: [],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: 'const m0 = 5; const m = 10; export { m0 as m1, m }; export default () => {}',
//            filename: testFilePath('./no-unused-modules/file-m.js'),
//            errors: [error(`exported declaration 'default' not used within other modules`)]}),
//   ],
// })

// ruleTester.run('no-unused-modules', rule, {
//   valid: [],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: `export { m1, m} from '${testFilePath('./no-unused-modules/file-m.js')}';`,
//            filename: testFilePath('./no-unused-modules/file-0.js'),
//            errors: [
//              error(`exported declaration 'm1' not used within other modules`),
//              error(`exported declaration 'm' not used within other modules`),
//            ]}),
//     test({ options: unusedExportsOptions,
//            code: 'const m0 = 5; const m = 10; export { m0 as m1, m }; export default () => {}',
//            filename: testFilePath('./no-unused-modules/file-m.js'),
//            errors: [error(`exported declaration 'default' not used within other modules`)]}),
//   ],
// })

// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     // test({ options: unusedExportsOptions,
//     //        code: `export { default, m1 } from '${testFilePath('./no-unused-modules/file-m.js')}';`,
//     //        filename: testFilePath('./no-unused-modules/file-0.js')}),
//   ],
//   invalid: [
//     test({ options: unusedExportsOptions,
//            code: `export { default, m1 } from '${testFilePath('./no-unused-modules/file-m.js')}';`,
//            filename: testFilePath('./no-unused-modules/file-0.js'),
//            errors: [
//              error(`exported declaration 'default' not used within other modules`),
//              error(`exported declaration 'm1' not used within other modules`),
//            ]}),
//     test({ options: unusedExportsOptions,
//            code: 'const m0 = 5; const m = 10; export { m0 as m1, m }; export default () => {}',
//            filename: testFilePath('./no-unused-modules/file-m.js'),
//            errors: [error(`exported declaration 'm' not used within other modules`)]}),
//   ],
// })

// describe('test behaviour for new file', () => {
//   before(() => {
//     fs.writeFileSync(testFilePath('./no-unused-modules/file-added-0.js'), '', {encoding: 'utf8'})
//   })

//   // add import in newly created file
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//              code: `import * as m from '${testFilePath('./no-unused-modules/file-m.js')}'`,
//              filename: testFilePath('./no-unused-modules/file-added-0.js')}),
//       test({ options: unusedExportsOptions,
//              code: 'const m0 = 5; const m = 10; export { m0 as m1, m }; export default () => {}',
//              filename: testFilePath('./no-unused-modules/file-m.js')}),
//     ],
//     invalid: [],
//   })

//   // add export for newly created file
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [],
//     invalid: [
//       test({ options: unusedExportsOptions,
//              code: `export default () => {2}`,
//              filename: testFilePath('./no-unused-modules/file-added-0.js'),
//              errors: [error(`exported declaration 'default' not used within other modules`)]}),
//       ],
//   })

//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//              code: `import def from '${testFilePath('./no-unused-modules/file-added-0.js')}'`,
//              filename: testFilePath('./no-unused-modules/file-0.js')}),
//       test({ options: unusedExportsOptions,
//              code: `export default () => {}`,
//              filename: testFilePath('./no-unused-modules/file-added-0.js')}),
//     ],
//     invalid: [],
//   })

//   // export * only considers named imports. default imports still need to be reported
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//              code: `export * from '${testFilePath('./no-unused-modules/file-added-0.js')}'`,
//              filename: testFilePath('./no-unused-modules/file-0.js')}),
//       // Test export * from 'external-compiled-library'
//       test({ options: unusedExportsOptions,
//         code: `export * from 'external-compiled-library'`,
//         filename: testFilePath('./no-unused-modules/file-r.js'),
//       }),
//     ],
//     invalid: [
//       test({ options: unusedExportsOptions,
//              code: `export const z = 'z';export default () => {}`,
//              filename: testFilePath('./no-unused-modules/file-added-0.js'),
//              errors: [error(`exported declaration 'default' not used within other modules`)]}),
//     ],
//   })
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//              code: `export const a = 2`,
//              filename: testFilePath('./no-unused-modules/file-added-0.js')}),
//     ],
//     invalid: [],
//   })

//   // remove export *. all exports need to be reported
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [],
//     invalid: [
//       test({ options: unusedExportsOptions,
//              code: `export { a } from '${testFilePath('./no-unused-modules/file-added-0.js')}'`,
//              filename: testFilePath('./no-unused-modules/file-0.js'),
//              errors: [error(`exported declaration 'a' not used within other modules`)]}),
//       test({ options: unusedExportsOptions,
//              code: `export const z = 'z';export default () => {}`,
//              filename: testFilePath('./no-unused-modules/file-added-0.js'),
//              errors: [
//                error(`exported declaration 'z' not used within other modules`),
//                error(`exported declaration 'default' not used within other modules`),
//             ]}),
//     ],
//   })


//   describe('test behaviour for new file', () => {
//     before(() => {
//       fs.writeFileSync(testFilePath('./no-unused-modules/file-added-1.js'), '', {encoding: 'utf8'})
//     })
//     ruleTester.run('no-unused-modules', rule, {
//       valid: [
//         test({ options: unusedExportsOptions,
//                code: `export * from '${testFilePath('./no-unused-modules/file-added-1.js')}'`,
//                filename: testFilePath('./no-unused-modules/file-0.js')}),
//       ],
//       invalid: [
//         test({ options: unusedExportsOptions,
//                code: `export const z = 'z';export default () => {}`,
//                filename: testFilePath('./no-unused-modules/file-added-1.js'),
//                errors: [error(`exported declaration 'default' not used within other modules`)]}),
//       ],
//     })
//     after(() => {
//       if (fs.existsSync(testFilePath('./no-unused-modules/file-added-1.js'))) {
//         fs.unlinkSync(testFilePath('./no-unused-modules/file-added-1.js'))
//       }
//     })
//   })

//   after(() => {
//     if (fs.existsSync(testFilePath('./no-unused-modules/file-added-0.js'))) {
//       fs.unlinkSync(testFilePath('./no-unused-modules/file-added-0.js'))
//     }
//   })
// })

// describe('test behaviour for new file', () => {
//   before(() => {
//     fs.writeFileSync(testFilePath('./no-unused-modules/file-added-2.js'), '', {encoding: 'utf8'})
//   })
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//              code: `import added from '${testFilePath('./no-unused-modules/file-added-2.js')}'`,
//              filename: testFilePath('./no-unused-modules/file-added-1.js')}),
//       test({ options: unusedExportsOptions,
//              code: `export default () => {}`,
//              filename: testFilePath('./no-unused-modules/file-added-2.js')}),
//     ],
//     invalid: [],
//   })
//   after(() => {
//     if (fs.existsSync(testFilePath('./no-unused-modules/file-added-2.js'))) {
//       fs.unlinkSync(testFilePath('./no-unused-modules/file-added-2.js'))
//     }
//   })
// })

// describe('test behaviour for new file', () => {
//   before(() => {
//     fs.writeFileSync(testFilePath('./no-unused-modules/file-added-3.js'), '', {encoding: 'utf8'})
//   })
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//              code: `import { added } from '${testFilePath('./no-unused-modules/file-added-3.js')}'`,
//              filename: testFilePath('./no-unused-modules/file-added-1.js')}),
//       test({ options: unusedExportsOptions,
//              code: `export const added = () => {}`,
//              filename: testFilePath('./no-unused-modules/file-added-3.js')}),
//     ],
//     invalid: [],
//   })
//   after(() => {
//     if (fs.existsSync(testFilePath('./no-unused-modules/file-added-3.js'))) {
//       fs.unlinkSync(testFilePath('./no-unused-modules/file-added-3.js'))
//     }
//   })
// })

// describe('test behaviour for new file', () => {
//   before(() => {
//     fs.writeFileSync(testFilePath('./no-unused-modules/file-added-4.js.js'), '', {encoding: 'utf8'})
//   })
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//              code: `import * as added from '${testFilePath('./no-unused-modules/file-added-4.js.js')}'`,
//              filename: testFilePath('./no-unused-modules/file-added-1.js')}),
//       test({ options: unusedExportsOptions,
//              code: `export const added = () => {}; export default () => {}`,
//              filename: testFilePath('./no-unused-modules/file-added-4.js.js')}),
//     ],
//     invalid: [],
//   })
//   after(() => {
//     if (fs.existsSync(testFilePath('./no-unused-modules/file-added-4.js.js'))) {
//       fs.unlinkSync(testFilePath('./no-unused-modules/file-added-4.js.js'))
//     }
//   })
// })

// describe('do not report missing export for ignored file', () => {
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: [{
//                src: [testFilePath('./no-unused-modules/**/*.js')],
//                ignoreExports: [testFilePath('./no-unused-modules/*ignored*.js')],
//                missingExports: true,
//               }],
//              code: 'export const test = true',
//              filename: testFilePath('./no-unused-modules/file-ignored-a.js')}),
//     ],
//     invalid: [],
//   })
// })

// // lint file not available in `src`
// ruleTester.run('no-unused-modules', rule, {
//   valid: [
//     test({ options: unusedExportsOptions,
//             code: `export const jsxFoo = 'foo'; export const jsxBar = 'bar'`,
//             filename: testFilePath('../jsx/named.jsx')}),
//   ],
//   invalid: [],
// })

// describe('do not report unused export for files mentioned in package.json', () => {
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//              code: 'export const bin = "bin"',
//              filename: testFilePath('./no-unused-modules/bin.js')}),
//       test({ options: unusedExportsOptions,
//              code: 'export const binObject = "binObject"',
//              filename: testFilePath('./no-unused-modules/binObject/index.js')}),
//       test({ options: unusedExportsOptions,
//              code: 'export const browser = "browser"',
//              filename: testFilePath('./no-unused-modules/browser.js')}),
//       test({ options: unusedExportsOptions,
//              code: 'export const browserObject = "browserObject"',
//              filename: testFilePath('./no-unused-modules/browserObject/index.js')}),
//       test({ options: unusedExportsOptions,
//              code: 'export const main = "main"',
//              filename: testFilePath('./no-unused-modules/main/index.js')}),
//     ],
//     invalid: [
//       test({ options: unusedExportsOptions,
//              code: 'export const privatePkg = "privatePkg"',
//              filename: testFilePath('./no-unused-modules/privatePkg/index.js'),
//              errors: [error(`exported declaration 'privatePkg' not used within other modules`)]}),
//     ],
//   })
// })

// describe('correctly report flow types', () => {
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({
//         options: unusedExportsOptions,
//         code: 'import { type FooType } from "./flow-2";',
//         parser: require.resolve('babel-eslint'),
//         filename: testFilePath('./no-unused-modules/flow-0.js'),
//       }),
//       test({
//         options: unusedExportsOptions,
//         code: `// @flow strict
//                export type FooType = string;`,
//         parser: require.resolve('babel-eslint'),
//         filename: testFilePath('./no-unused-modules/flow-2.js'),
//       }),
//     ],
//     invalid: [
//       test({
//         options: unusedExportsOptions,
//         code: `// @flow strict
//                export type Bar = string;`,
//         parser: require.resolve('babel-eslint'),
//         filename: testFilePath('./no-unused-modules/flow-1.js'),
//         errors: [
//           error(`exported declaration 'Bar' not used within other modules`),
//         ],
//       }),
//     ],
//   })
// })

// describe('Avoid errors if re-export all from umd compiled library', () => {
//   ruleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({ options: unusedExportsOptions,
//         code: `export * from '${testFilePath('./no-unused-modules/bin.js')}'`,
//         filename: testFilePath('./no-unused-modules/main/index.js')}),
//     ],
//     invalid: [],
//   })
// })

// describe('correctly work with Typescript only files', () => {
//   typescriptRuleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({
//         options: unusedExportsTypescriptOptions,
//         code: 'import a from "file-ts-a";',
//         parser: require.resolve('babel-eslint'),
//         filename: testFilePath('./no-unused-modules/typescript/file-ts-a.ts'),
//       }),
//     ],
//     invalid: [
//       test({
//         options: unusedExportsTypescriptOptions,
//         code: `export const b = 2;`,
//         parser: require.resolve('babel-eslint'),
//         filename: testFilePath('./no-unused-modules/typescript/file-ts-b.ts'),
//         errors: [
//           error(`exported declaration 'b' not used within other modules`),
//         ],
//       }),
//     ],
//   })
// })

// describe('correctly work with JSX only files', () => {
//   jsxRuleTester.run('no-unused-modules', rule, {
//     valid: [
//       test({
//         options: unusedExportsJsxOptions,
//         code: 'import a from "file-jsx-a";',
//         parser: require.resolve('babel-eslint'),
//         filename: testFilePath('./no-unused-modules/jsx/file-jsx-a.jsx'),
//       }),
//     ],
//     invalid: [
//       test({
//         options: unusedExportsJsxOptions,
//         code: `export const b = 2;`,
//         parser: require.resolve('babel-eslint'),
//         filename: testFilePath('./no-unused-modules/jsx/file-jsx-b.jsx'),
//         errors: [
//           error(`exported declaration 'b' not used within other modules`),
//         ],
//       }),
//     ],
//   })
// })
