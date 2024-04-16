/* eslint-disable @typescript-eslint/no-explicit-any */
import { Program, Cmd, Dispatch } from "uilib";

/**
 * Supported http-methods by this module
 */
export type HttpMethod = "get" | "post" | "delete" | "put"

const nativeFetch = fetch;

/**
 * This can either be a message or a function that returns a message
 */
type MsgOrCallback<T, Msg> = Msg | ((result: T) => Msg)
/**
 * This can either be a message or a function that returns a message
 */
type MsgOrResponseCallback<T, Msg> = Msg | ((result: Response) => Msg)

export type ResponseHandler<Msg> = ((response: Response) => Promise<Msg>)
export type Middleware<Msg> = (dispatch: Dispatch<Msg>, requestInfo: RequestInfo, requestInit: RequestInit, responseHandler: ResponseHandler<Msg>) => Promise<Response>
export type Pipeline<Msg> = (dispatch: Dispatch<Msg>, requestInfo: RequestInfo, requestInit: RequestInit, responseHandler: ResponseHandler<Msg>, next: Middleware<Msg>) => Promise<Response>
const base = async (
    _: Dispatch<any>,
    requestInfo: RequestInfo,
    requestInit: RequestInit) => {
    return nativeFetch(requestInfo, requestInit);
}

let middlewares = <Pipeline<unknown>[]>[]

export function withFetch<Model, Msg extends { type: string }, InitProps, View>(middleware: Pipeline<unknown>[], app: Program<Model, Msg, InitProps, View, unknown>): Program<Model, Msg, InitProps, View, unknown> {
    middlewares = middleware ?? [];
    return app;
}
/**
 * This module contains convenience functions to map fetch onto Cmds
 */
export module Fetch {
    /**
     * This function should normally not be used in application code.
     * It creates a new command to fetch data from a remote endpoint.
     * @param method HTTP-Method to use
     * @param target The target URL
     * @param data Body
     * @param responseHandler This functions gets the response object
     * @returns A command promising the massage returned by reponseHandler
     */
    export function raw<Msg extends object>(
        method: HttpMethod,
        target: RequestInfo,
        data: BodyInit | null | undefined | object,
        responseHandler: ((response: Response) => Promise<Msg>)): Cmd<Msg> {
            const isFormData = data instanceof FormData;
            const bodyData = data && !isFormData ? JSON.stringify(data) : data

            const headers: Record<string, string> = isFormData ?
                {
                    "Accept": "application/json"
                } :
                {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }

            const init: RequestInit = {
                method: method,
                headers: headers,
                body: bodyData
            }

            return Cmd.ofSub<Msg>(async (dispatch: Dispatch<Msg>) => {
                let i = 0;
                const id = performance.now();
                
                async function executeNext(dispatch: Dispatch<Msg>, info: RequestInfo, init: RequestInit): Promise<Response> {
                    const current = middlewares[i];
                    i = i + 1;
                    if (current) {
                        return current(<Dispatch<any>>dispatch, info, init, responseHandler, executeNext)
                    }
                    
                    return base(dispatch, info, init);
                }
                const finalResponse = await executeNext(dispatch, target, init);

                const finalMsg = await responseHandler(finalResponse);

                dispatch(finalMsg);
            });
    }

    /**
     * Function to fetch or send data from/to an endpoint.
     * Normally you'd want to use one of the convenience functions get, post, put, delete.
     * 
     * The result of this function is a command which contains a message.
     * The content of this message depends on the response-code and the parameters success and error.
     * If the reponse-code is in the ok range, either the success parameter will be returned directly if it's an obejct
     * or if it's a function, this function will be 
     * @param method HTTP-Method to use
     * @param target The endpoint to call
     * @param data (optional) body to send - does not apply to GET
     * @param success The object to return after a successful request or the function to call which returns the result
     * @param error The object to return after an unsuccessful request or the function to call which returns the result
     * @param responseMapper The result of this function is the object that's going to be passed into success before returning. If this is undefined, Response.json() will be passed into success
     * @returns Either success or error
     */
    export function fetch<T, Msg extends Object>(
        method: HttpMethod,
        target: RequestInfo,
        data: BodyInit | null | undefined | Object,
        success: MsgOrCallback<T, Msg>,
        error: MsgOrResponseCallback<T, Msg>, 
        responseMapper?: (response: Response) => Promise<T>): Cmd<Msg> {
            function callError(response: Response) {
                if (typeof error === "object") {
                    return error;
                } else {
                    return error(response);
                }
            }
            return raw(method, target, data, async (response) => {
                if (response.ok) {
                    if (typeof success === "object") {
                        return success;
                    } else {
                        try {
                            const result: T = responseMapper ? await responseMapper(response) : await response.json()

                            return success(result);
                        } catch (e) {
                            return callError(response)
                        }
                    }
                } else {
                    return callError(response)
                }
            })
    }
    /**
     * Convenient wrapper around fetch
     * @param target The endpoint to call
     * @param success The object to return after a successful request or the function to call which returns the result
     * @param error The object to return after an unsuccessful request or the function to call which returns the result
     * @param responseMapper The result of this function is the object that's going to be passed into success before returning. If this is undefined, Response.json() will be passed into success
     * @returns Either success or error
     */
    export function get<T, Msg extends Object>(target: RequestInfo, success: MsgOrCallback<T, Msg>, error: MsgOrResponseCallback<T, Msg>, 
        responseMapper?: (response: Response) => Promise<T>) : Cmd<Msg> {
        return fetch("get", target, undefined, success, error, responseMapper);
    }
    /**
     * Convenient wrapper around fetch
     * @param method HTTP-Method to use
     * @param data (optional) body to send - does not apply to GET
     * @param target The endpoint to call
     * @param data (optional) body to send - does not apply to GET
     * @param success The object to return after a successful request or the function to call which returns the result
     * @param error The object to return after an unsuccessful request or the function to call which returns the result
     * @param responseMapper The result of this function is the object that's going to be passed into success before returning. If this is undefined, Response.json() will be passed into success
     * @returns Either success or error
     */
    export function post<T, Msg extends Object>(target: RequestInfo, data: BodyInit | null | undefined | Object, success: MsgOrCallback<T, Msg>, error: MsgOrResponseCallback<T, Msg>, 
        responseMapper?: (response: Response) => Promise<T>) : Cmd<Msg>{
        return fetch("post", target, data, success, error, responseMapper);
    }
    /**
     * Convenient wrapper around fetch
     * @param method HTTP-Method to use
     * @param data (optional) body to send - does not apply to GET
     * @param target The endpoint to call
     * @param data (optional) body to send - does not apply to GET
     * @param success The object to return after a successful request or the function to call which returns the result
     * @param error The object to return after an unsuccessful request or the function to call which returns the result
     * @param responseMapper The result of this function is the object that's going to be passed into success before returning. If this is undefined, Response.json() will be passed into success
     * @returns Either success or error
     */
    export function del<T, Msg extends Object>(target: RequestInfo, data: BodyInit | null | undefined | Object, success: MsgOrCallback<T, Msg>, error: MsgOrResponseCallback<T, Msg>, 
        responseMapper?: (response: Response) => Promise<T>) : Cmd<Msg> {
        return fetch("delete", target, data, success, error, responseMapper);
    }
    /**
     * Convenient wrapper around fetch
     * @param method HTTP-Method to use
     * @param data (optional) body to send - does not apply to GET
     * @param target The endpoint to call
     * @param data (optional) body to send - does not apply to GET
     * @param success The object to return after a successful request or the function to call which returns the result
     * @param error The object to return after an unsuccessful request or the function to call which returns the result
     * @param responseMapper The result of this function is the object that's going to be passed into success before returning. If this is undefined, Response.json() will be passed into success
     * @returns Either success or error
     */
    export function put<T, Msg extends Object>(target: RequestInfo, data: BodyInit | null | undefined | Object, success: MsgOrCallback<T, Msg>, error: MsgOrResponseCallback<T, Msg>, 
        responseMapper?: (response: Response) => Promise<T>) : Cmd<Msg> {
        return fetch("put", target, data, success, error, responseMapper);
    }
}