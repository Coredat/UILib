import { Dispatch } from "./dispatch";

export type Cmd<M> = ((dispatch: Dispatch<M>) => void)[]

export module Cmd {
    // this needs to be any so it can map to any Cmd
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const none: Cmd<any> = [];

    /**
     * Combines multiple commands into a single command
     * @param cmds Commands to combine
     * @returns The new command with combined data.
     */
    export function batch<M>(cmds: Cmd<M>[]): Cmd<M> {
        let result: Cmd<M> = [];

        cmds.forEach((cmd) => {
            if (cmd) {
                result = cmd.concat(result);
            }
        })
        
        return result;
    }

    /**
     * Executes the given command
     * @param dispatch the dispatch function to use
     * @param cmd the command to execute
     */
    export function exec<M>(dispatch: Dispatch<M>, cmd: Cmd<M>) {
        cmd.forEach(cmd => {
            if (cmd) {
                cmd(dispatch);
            }
        });
    }

    /**
     * Maps a given command to a new command
     * Mapping happens inside of the mapping function f
     * @param cmd the original command
     * @param f the function that produces the new message. The first argument of this function is the original message
     * @returns
     */
    export function map<M, G>(cmd: Cmd<M>, f: (msg: M) => G): Cmd<G> {
        return cmd.map((cmd) => {
            const bind = ((dispatch: Dispatch<G>) => {
                if (cmd) {
                    return cmd((arg: unknown) => {
                        dispatch(f(<M>arg));
                    });
                } else {
                    return cmd;
                }
                
            })

            return bind;
        }, cmd);
    }

    /**
     * Creats a new command based on an event
     * @param event the event inside of the command
     * @returns a command
     */
    export function ofEvent<M>(event: CustomEvent): Cmd<M> {
        const bind = (dispatch: Dispatch<Event>) => {
            dispatch(event);
        };

        return <Cmd<M>>[ bind ];
    }

    /**
     * Creates a command that allows the caller to continously dispatch messages
     * @param sub The function that can potentially continously dispatch messages
     * @returns 
     */
    export function ofSub<M>(sub: (dispatch: Dispatch<M>) => void) {
        return [ sub ];
    }

    /**
     * 
     * @param task 
     * @param arg 
     * @param success 
     * @param failure 
     * @returns 
     */
    export function either<U, V, W> (task: (arg: U) => Promise<V>, arg: U, success: (result: V) => W, failure: (error: Error) => W) {
        const bind = (dispatch: Dispatch<W>) => {
            const value_1 = task(arg).then((taskResult) => dispatch(success(taskResult))).catch((error) => dispatch(failure(error)));
            void value_1;
        };
        return [ bind ];
    }

    export function perform<U, V, Msg> (task: (arg: U) => Promise<V>, arg: U, success: (result: V) => Msg) {
        const bind = (dispatch: Dispatch<Msg>) => {
            const value_1 = task(arg).then((taskResult) => dispatch(success(taskResult)));
            void value_1;
        };
        return [ bind ];
    }

    export function attempt<U, Msg> (task: (arg: U) => Promise<Msg>, arg: U, failure: (error: Error) => Msg) {
        const bind = (dispatch: Dispatch<Msg>) => {
            const value_1 = task(arg).then((successMessage) => dispatch(successMessage)).catch((error) => dispatch(failure(error)));
            void value_1;
        };
        return [ bind ];
    }

    export function ofAsync<W>(task: () => Promise<W>): Cmd<W>;
    export function ofAsync<W, U>(task: (arg:U) => Promise<W>, arg: U): Cmd<W>;
    export function ofAsync<W, U> (task: (arg?: U) => Promise<W>, arg?: U) {
        const bind = (dispatch: Dispatch<W>) => {
            void task(arg).then(dispatch);
        };

        return [ bind ];
    }

    export function ofMsg<W> (msg: W): Cmd<W> {
        const bind = (dispatch: Dispatch<W>) => {
            dispatch(msg);
        };

        return [ bind ];
    }
}