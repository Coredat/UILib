import { Middleware, Fetch, ResponseHandler } from "@coredat/fetch";
import { Cmd, Dispatch, html, repeat, TemplateResult } from "uilib";
import { getIcon, icons } from "../../components/core/icons";
import { DetailList } from "../../components/core/Lists";
import { CustomEntry, DebugPaneInfo, DebugPanePlugin, getColorWithAlpha, renderTiming, TraceEvent, DebugPane, DebugPaneMessage } from "@coredat/debug";
import { fetchResults, IProfiler, processJson, renderProfiler, savedJson } from "./miniprofiler";

type FetchEventData = {
    source: "fetch"
    requestInfo: RequestInfo
    requestInit: RequestInit
    response: Response
    body: BodyData
    duration: number
    profilerIds: string[] | undefined
    responseHandler: ResponseHandler<unknown>
    dispatch: Dispatch<unknown>
}

type JsonResponse = {
    type: "json",
    data: object
}
function JsonResponse(data: object): JsonResponse {
    return {
        type: "json",
        data: data
    }
}
type TextResponse = {
    type: "text",
    content: string
}
function TextResponse(content: string): TextResponse {
    return {
        type: "text",
        content: content
    }
}
type BodyData =
| JsonResponse
| TextResponse

async function getBodyFromReponse(response: Response) {
    const contentType = response.headers.has("content-type") ? response.headers.get("content-type") : undefined;

    if (contentType && contentType.startsWith("application/json")) {
        return JsonResponse(await response.json())
    } else {
        return TextResponse(await response.text())
    }
}

export async function fetchToDebugPane<Msg>(dispatch: Dispatch<Msg>, requestInfo: RequestInfo, requestInit: RequestInit, responseHandler: ResponseHandler<Msg>, next: Middleware<Msg>) {
    const [causationId, correlationId] = DebugPane.getMessageIds()

    const start = performance.now();
    const response = await next(dispatch, requestInfo, requestInit, responseHandler);
    const end = performance.now();

    // response can only be read once.
    // in order to be able to read it later (the caller will need it as well)
    // we are using a clone of result.
    const responseClone = response.clone();    
    const body = await getBodyFromReponse(responseClone)

    const profilerIds = handleIds(response.headers.get('X-MiniProfiler-Ids'))

    const eventData: FetchEventData = {
        source: "fetch",
        requestInfo: requestInfo,
        requestInit: requestInit,
        response: response.clone(),
        body: body,
        profilerIds: profilerIds,
        duration: end - start,
        responseHandler: responseHandler,
        dispatch: <Dispatch<unknown>>dispatch
    }

    window.dispatchEvent(new TraceEvent({
        timing: end - start,
        data: eventData,
        plugin: "fetch",
        correlationId: correlationId,
        causationId: causationId
    }))

    return response;
}

type ResendRequest = {
    type: "ResendRequest",
} & FetchEventData
function ResendRequest(data: FetchEventData): ResendRequest {
    return {
        type: "ResendRequest",
        ...data
    }
}

type Msg =
(
ResendRequest
)

function handleIds(jsonIds: string | undefined | null): string[] | undefined {
    if (jsonIds) {
        const ids: string[] = JSON.parse(jsonIds);
        fetchResults(ids);

        return ids
    }

    return;
}

// can we get more info from webworker if we intercept a fetch?
// eg all request headers?
export function withFetchPlugin<Model>(): DebugPanePlugin<Model, FetchEventData> {
    return {
        onDispatch: (untypedMessage: unknown) => {
            const msg = <Msg>untypedMessage

            switch (msg.type) {
                case "ResendRequest":
                    const start = performance.now()
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    fetch(msg.requestInfo, msg.requestInit)
                        .then(async (response) => {
                            const end = performance.now()
                            const responseClone = response.clone();    
                            const body = await getBodyFromReponse(responseClone)

                            const profilerIds = handleIds(response.headers.get('X-MiniProfiler-Ids'))

                            const eventData: FetchEventData = {
                                source: "fetch",
                                requestInfo: msg.requestInfo,
                                requestInit: msg.requestInit,
                                response: response.clone(),
                                body: body,
                                profilerIds: profilerIds,
                                duration: end - start,
                                responseHandler: msg.responseHandler,
                                dispatch: msg.dispatch
                            }
                        
                            window.dispatchEvent(new TraceEvent({
                                timing: end - start,
                                data: eventData,
                                plugin: "fetch",
                                correlationId: -1,
                                causationId: -1
                            }))

                            return msg.responseHandler(response)
                        })
                        .then(msg.dispatch)
                    return Cmd.none
            }
        },
        renderPane: (model: DebugPaneInfo<Model>, historyEntry: CustomEntry<Model>, dispatch: Dispatch<Msg>) => {
            const entry = <FetchEventData>historyEntry.entry;

            const timings = <IProfiler[]>entry.profilerIds?.map((id) => {
                const json = savedJson.find((json) => json.Id === id)
                if (json) {
                    return processJson(json)
                }
                return;
            }).filter((profiler) => profiler) ?? []
            
            function renderHeaders(): TemplateResult {
                const requestHeaderList: [string, string | undefined][] = [];
                const requestHeaders: string[][] | Record<string, string> | Headers | undefined = entry.requestInit.headers
                if (requestHeaders) {
                    if (requestHeaders instanceof Headers) {
                        requestHeaders.forEach((value, name) => requestHeaderList.push([name, value]))
                        //requestHeaders.forEach((value, name) => requestHeaderList.push(DetailList.nameValue(name, value)))
                    } else if (Array.isArray(requestHeaders)) {
                        requestHeaders.forEach(([value, key]) => key ? requestHeaderList.push([key, value]) : undefined)
                        //requestHeaders.forEach(([key, value]) => key ? requestHeaderList.push(DetailList.nameValue(key, value)) : undefined)
                    } else {
                        for (const key in requestHeaders) {
                            if (Object.prototype.hasOwnProperty.call(requestHeaders, key)) {
                                requestHeaderList.push([key, requestHeaders[key]])
                                //requestHeaderList.push(DetailList.nameValue(key, requestHeaders[key]))
                            }
                        }
                    }
                }

                return html`
                <h3 class="mt-2">Request</h3>
                <div class="ml-2">
                    ${DetailList.render(requestHeaderList)}
                </div>
                <h3 class="mt-2">Response</h3>
                <div class="ml-2">
                    ${DetailList.render([...entry.response.headers])}
                </div>
                `
                
            }
            function renderRequest(): TemplateResult {
                if (entry.requestInit.body) {
                    if (entry.requestInit.body instanceof FormData) {
                        return html`<ul>
                            ${repeat(entry.requestInit.body.entries(), ([key, value]) =>
                                html`<li>${key}: ${value}</li>`)}
                        </ul>`
                    } else {
                        return html`<pre>${entry.requestInit.body.toString()}</pre>`
                    }
                } else {
                    return html`&lt;no content&gt;`
                }
            }
            function renderResponse(): TemplateResult {
                switch (entry.body.type) {
                    case "json":
                        const jsonString = JSON.stringify(entry.body.data, null, 4)
                        const splitString = jsonString.split(/("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g)
                        const formattedString =
                            splitString.reduce((prev, current, i) => {
                                if (!i) return [html`${current}`]
                                if (!current || current === null || current.match(/^ *$/) !== null) return prev
                              
                                let cls = 'text-yellow-400'; // symbol
                                if (/^"/.test(current)) {
                                  if (/:$/.test(current)) {
                                    cls = 'text-sky-400'; // key
                                  } else {
                                    cls = 'text-amber-600'; // string
                                  }
                                } else if (/\d/.test(current)) {
                                    cls = 'text-green-400'; // number
                                } else if (/true|false/.test(current)) {
                                  cls = 'text-sky-600'; // bool
                                } else if (/null/.test(current)) {
                                  cls = 'text-sky-600'; // null
                                }
                                prev.push(html`<span class="${cls}">${current}</span>`);
                                return prev;
                        }, <TemplateResult[]>[]);
                        return html`<pre class="bg-slate-600">${formattedString}</pre>`
                    case "text":
                        return html`<pre>${entry.body.content}</pre>`
                }
            }
            function renderProfilingData(): TemplateResult {
                return html`
                    <tab-control class="h-full">
                        ${repeat(timings, (timing) => timing.Id, (timing) => html`
                            <div title="${timing.Name}">
                                ${renderProfiler(timing, false)}</li>
                            </div>
                        `)}
                    </tab-control>
                `
            }

            function formatStatusCodeAndText() {
                if (entry.response.ok) {
                    return html`<span class="text-green-700">${entry.response.status} ${entry.response.statusText}</span>`
                } else {
                    return html`<span class="text-red-700">${entry.response.status} ${entry.response.statusText}</span>`
                }
            }

            return html`
            <div class="px-4 py-5 sm:px-6">
                <h3 class="text-lg leading-6 font-medium text-gray-900">Request ${formatStatusCodeAndText()}</h3>
                <p class="mt-1 max-w-2xl text-sm text-gray-500">${entry.requestInfo.toString()}</p>
                <button @click=${() => dispatch(ResendRequest(entry))}>Resend</button>
            </div>
            <tab-control class="h-full min-h-0 ">
                <div title="Headers">${renderHeaders()}</div>
                <div title="Request">${renderRequest()}</div>
                <div title="Reponse" active="true">${renderResponse()}</div>
                <div title="Profiler">${renderProfilingData()}</div>
            </tab-control>`
        },
        highlightColor: "rgba(205, 213, 255, 0.8)",
        name: "fetch",
        entryRenderer: (id: number, entry: FetchEventData, dispatch: Dispatch<unknown>): TemplateResult => {
            return html`
                <span>${icons.solid.switchHorizontal({ classes: "h-4 w-4" })}</span>
                <span style=${`border-color: ${getColorWithAlpha(id)}`} class="border-l-4 pl-1 flex-1 truncate" title="${entry.requestInfo}">
                    <span class="w-6" title="Status: ${entry.response.statusText}">
                        ${entry.response.status}
                    </span>
                    ${entry.requestInfo}
                </span>
                <span class="w-8 text-right" title="Request time">
                    ${renderTiming(entry.duration)}
                </span>
                <span class="w-8 text-center align-middle group-hover:visible invisible absolute hover:text-neutral-600 -right-8 border -mt-1 border-l-0" title="Actions">
                    <button class="p-0" @click=${(e: Event) => {
                            dispatch(ResendRequest(entry))
                            // don't trigger opening of panel (handled by parent @click)
                            e.stopImmediatePropagation();
                    }}>
                        ${icons.outline.interfaceUploadButton1({})}
                    </button>
                </span>
                `
        }
    }
}