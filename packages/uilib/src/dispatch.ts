export type Dispatch<T> = (msg: T) => void

export module Dispatch {
    export function map<Msg, Child>(dispatch: Dispatch<Msg>, f: (msg: Child) => Msg): Dispatch<Child> {
        return (msg: Child) => {
            dispatch(f(msg));
        }
    }
}