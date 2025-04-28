import { Effect, Schema } from 'effect'
import { NoSuchElementException } from 'effect/Cause'

export const CircularArraySchema = <Value extends Schema.Schema.Any>(value: Value) => Schema.Struct({
    index: Schema.Number,
    value: Schema.Array(value),
})

export type CircularArray<V> = {
    index: number,
    value: readonly V[]
}

export const makeCircular = <T>(value: T[]): CircularArray<T> => ({ index: 0, value })

export const shift = <T>(circular: CircularArray<T>, amount: number = 1): CircularArray<T> => ({
    value: circular.value,
    index: (circular.index + amount) % circular.value.length
})

export const shiftUntil = <T>(circular: CircularArray<T>, predicate: (p: T) => boolean): Effect.Effect<CircularArray<T>, NoSuchElementException> => {
    const firstAfterCurrent = circular.value.filter((_, index) => index >= circular.index).findIndex(predicate)
    if (firstAfterCurrent !== -1) {
        return Effect.succeed(shift(circular, firstAfterCurrent - circular.index))
    }
    const firstBeforeCurrent = circular.value.filter((_, index) => index < circular.index).findIndex(predicate)
    if (firstBeforeCurrent !== -1) {
        return Effect.succeed(shift(circular, circular.value.length - circular.index + firstBeforeCurrent))
    }
    // TODO: reconsider error message here
    return Effect.fail(new NoSuchElementException('no element passed the predicate in shiftUntil'))
}

export const mapCircular = <T, U>(circular: CircularArray<T>, f: (t: T, index: number) => U): CircularArray<U> => {
    return {
        index: circular.index,
        value: circular.value.map((x, i) => f(x, i))
    }
}
