// Node 26 defines globalThis.localStorage as a configurable getter returning
// undefined (experimental Web Storage — requires --localstorage-file flag).
// happy-dom may fail to override it via plain assignment (setter-less getter
// throws in strict mode). This runs after happy-dom init and installs a
// proper in-memory Storage if localStorage is still absent.
//
// The implementation exposes keys as own enumerable properties so that
// Object.keys(localStorage) returns stored keys, matching real Storage behaviour.
if (typeof localStorage === 'undefined' || localStorage === null) {
  class InMemoryStorage implements Storage {
    [key: string]: unknown

    get length(): number {
      return Object.keys(this).filter(k => !['length', 'clear', 'getItem', 'key', 'removeItem', 'setItem'].includes(k)).length
    }

    clear(): void {
      const proto = Object.getPrototypeOf(this) as Record<string, unknown>
      const methodKeys = new Set(Object.getOwnPropertyNames(proto))
      Object.keys(this).forEach(k => { if (!methodKeys.has(k)) delete this[k] })
    }

    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(this, key) ? String(this[key]) : null
    }

    key(index: number): string | null {
      const proto = Object.getPrototypeOf(this) as Record<string, unknown>
      const methodKeys = new Set(Object.getOwnPropertyNames(proto))
      return Object.keys(this).filter(k => !methodKeys.has(k))[index] ?? null
    }

    removeItem(key: string): void {
      delete this[key]
    }

    setItem(key: string, value: string): void {
      this[key] = String(value)
    }
  }

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: new InMemoryStorage(),
  })
}
