// Just some arbitrary code where imprt happens deep
class A {
    method() {
        const b = async () => {
            import("./exports-for-dynamic")
        }
    }
}
