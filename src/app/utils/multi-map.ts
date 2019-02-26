import { nullOrUndef } from './utils'

export class MultiMap<K, V> {
  map = new Map<K, V[]>()

  add(key: K, val: V) {
    this.checkKey(key)
    let coll = this.map.get(key)
    if ( ! coll ) {
      coll = []
      this.map.set(key, coll)
    }
    if ( ! coll.includes(val) /* TODO: performance: this check has O(n) complexity,
        therefore this function's usage could explode complexity to e.g O(n^2) or O(n*m) */ ) {
      coll.push(val)
    }
  }

  private checkKey(key: K) {
    if (nullOrUndef(key)) {
      throw new Error('Invalid key ' + key)
    }
  }

  get(key: K) {
    return this.map.get(key);
  }

  get keyCount() {
    return this.map.size
  }
}