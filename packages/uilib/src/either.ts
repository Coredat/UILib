type Left<T> = {
    type: "left"
} & T
type Right<T> = {
    type: "right"
} & T
export type Either<L, R> = (
    | Left<L>
    | Right<R>
)

function isLeft(either: Either<unknown, unknown>) {
    return either.type === "left";
}
function isRight(either: Either<unknown, unknown>) {
    return either.type === "left";
}

function either<L, R, C>(left: (value: L) => C, right: (value: R) => C, either: Either<L, R>): C {
    if (either.type === "left") {
        return left(either)
    }
    if (either.type === "right") {
        return right(either)
    }

    throw new Error(`either is neither left nor right: ${either}`);
}

function map<L, R>(left: (value: L) => L, right: (value: R) => R, either: Either<L, R>): Either<L, R> {
    if (either.type === "left") {
        return makeLeft(left(either))
    }
    if (either.type === "right") {
        return makeRight(right(either))
    }

    throw new Error(`either is neither left nor right: ${either}`);
}

// this needs to make the callers type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeLeft<L>(value: L): Either<L, any> {
    return { ...value,
        type: "left",
    }
}
// this needs to make the callers type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRight<R>(value: R): Either<any, R> {
    return { ...value,
        type: "right",
    }
}

export const Either = {
    either: either,
    isLeft: isLeft,
    isRight: isRight,
    left: makeLeft,
    right: makeRight
}