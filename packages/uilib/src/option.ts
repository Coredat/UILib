export type Option<T> =
    | typeof None
    | NonNullable<T>

export module Option {
    export function isSome<T>(opt: Option<T> | undefined | null): opt is NonNullable<T> {
        return opt !== undefined && opt !== null && opt !== None;
    }
    export function defaultValue<T>(opt: Option<T>, defaultValue: T): T {
        if (isSome(opt)) {
            return <T>opt;
        } else {
            return defaultValue
        }
    }
    export function map<T, T2>(opt: Option<T>, map: (value: T) => NonNullable<T2>): Option<T2> {
        if (isSome(opt)) {
            const mappedValue = map(<T>opt);
            return mappedValue
        } else {
            return None;
        }
    }

    export function fold<T, T2>(opt: Option<T>, fold: (initialValue: T2, value: T) => T2, initialValue: T2): T2 {
        if (isSome(opt)) {
            return fold(initialValue, <T>opt);
        } else {
            return initialValue;
        }
    }
    
    export function bind<T, T2>(opt: Option<T>, f: (value: T) => Option<T2>): Option<T2> {
        if (isSome(opt)) {
            return f(<T>opt);
        } else {
            return None;
        }
    }
}

// I'd love to get rid of any here.
// But the fact is, if it's not any None would not be assignable to any(ha) Some<T>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const None = Symbol.for("option-none")