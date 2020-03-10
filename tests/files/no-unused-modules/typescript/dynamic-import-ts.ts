// empty. should fail the test!
class A {
    method() {
        const c = import('./exports-for-dynamic-ts')
    }
}

