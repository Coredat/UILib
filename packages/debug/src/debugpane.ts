// we might want to make this more granular in the future
/* eslint-disable @typescript-eslint/no-explicit-any */
import { classMap, Cmd, Dispatch, html, ifDefined, nothing, repeat, TemplateResult } from "..";
import { None, Option, Program } from "uilib"
import { icons } from "../../components/core/icons";
import { DetailList } from "../../components/core/Lists";
import { renderModal } from "../../components/core/overlay";
import * as jsondiffpatch from "jsondiffpatch";
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { twoColumn } from "../../components/core/Layout";

const differ = jsondiffpatch.create({
    arrays: { detectMove: false },
    propertyFilter: (name: string, context: any) => {
        return !name.startsWith("__")
            && typeof (context.left[name]) !== "function"
            && typeof (context.right[name]) !== "function"
    }
});

export type TraceInfo = {
    data: unknown
    plugin: string
    timing?: number
    correlationId?: number
    causationId?: number
}
export class TraceEvent extends CustomEvent<TraceInfo> {
    constructor(detail: TraceInfo) {
      super("trace-event", { bubbles: true, composed: true, detail: detail })
    }
}

type EventStartInfo = {
    id: string
    event: Event
    startTime: number
}
type EventEndInfo = {
    id: string
    endTime: number
    defaultPrevented: boolean
}

export class CapturedEventStart extends CustomEvent<EventStartInfo> {
    constructor(detail: EventStartInfo) {
      super("event-capture-start", { bubbles: true, composed: true, detail: detail })
    }
}
export class CapturedEventEnd extends CustomEvent<EventEndInfo> {
    constructor(detail: EventEndInfo) {
      super("event-capture-end", { bubbles: true, composed: true, detail: detail })
    }
}

type OpenDebugPane = {
    type: "OpenDebugPane"
}
const OpenDebugPane: OpenDebugPane = { type: "OpenDebugPane" }
type CloseDebugPane = {
    type: "CloseDebugPane"
}
const CloseDebugPane: CloseDebugPane = { type: "CloseDebugPane" }
type ClearHistory = {
    type: "ClearHistory"
}
type GoToModel = {
    type: "GoToModel"
    index: number
}
type CloseMsg = {
    type: "CloseMsg"
}
const CloseMsg: CloseMsg = { type: "CloseMsg" }
type OpenMsg = {
    type: "OpenMsg"
    index: number
}
function OpenMsg<T>(historyEntry: HistoryEntry<T>): OpenMsg {
    return {
        type: "OpenMsg",
        index: historyEntry.id
    }
} 
function GoToModel(index: number): GoToModel {
    return {
        type: "GoToModel",
        index: index
    }
}
enum MessageSource {
    User,
    Cmd,
    Init,
    PropsUpdate,
    Subscription,
    Error,
    Event
}

type InterceptedMsg = {
    type: "InterceptedMsg",
    causationId: number | undefined,
    correlationId: number | undefined,
    timing: number | undefined
    msg: any
    source: MessageSource
}
function InterceptedMsg(source: MessageSource, msg: any, causationId?: number, correlationId?: number, timing?: number): InterceptedMsg {
    return {
        type: "InterceptedMsg",
        causationId: causationId,
        msg: msg,
        source: source,
        correlationId: correlationId,
        timing: timing
    }
}
type TraceMsg = {
    type: "TraceMsg",
    causationId: number | undefined,
    correlationId: number | undefined,
    timing: number | undefined
    msg: any
    source: MessageSource
    plugin: string
}
function TraceMsg(source: MessageSource, plugin: string, msg: any, causationId?: number, correlationId?: number, timing?: number): TraceMsg {
    return {
        type: "TraceMsg",
        causationId: causationId,
        msg: msg,
        source: source,
        correlationId: correlationId,
        timing: timing,
        plugin: plugin
    }
}
type StartEventTrace = {
    type: "StartEventTrace",
    id: string,
    startTime: number,
    event: Event
}
function StartEventTrace(id: string, event: Event, startTime: number): StartEventTrace {
    return {
        type: "StartEventTrace",
        id: id,
        startTime: startTime,
        event: event
    }
}

type EndEventTrace = {
    type: "EndEventTrace",
    id: string,
    endTime: number,
    wasPrevented: boolean
}
function EndEventTrace(id: string, endTime: number, wasPrevented: boolean): EndEventTrace {
    return {
        type: "EndEventTrace",
        id: id,
        endTime: endTime,
        wasPrevented: wasPrevented
        
    }
}

type MouseEntered<T> = {
    type: "MouseEntered"
    entry: HistoryEntry<T>
}
function MouseEntered<T>(entry: HistoryEntry<T>): MouseEntered<T> {
    return {
        type: "MouseEntered",
        entry: entry
    }
}
type MouseLeft<T> = {
    type: "MouseLeft"
    entry: HistoryEntry<T>
}
function MouseLeft<T>(entry: HistoryEntry<T>): MouseLeft<T> {
    return {
        type: "MouseLeft",
        entry: entry
    }
}

type AddException<T> = {
    type: "AddException"
    model: DebugPaneModel<T>
    msg: unknown | CustomEvent<unknown>
    causationId: number | undefined
    correlationId: number | undefined
    ex: Error
    message: string
}
function AddException<T, Msg>(model: DebugPaneModel<T>, msg: Msg | CustomEvent<unknown>, message: string, ex: Error, correlationId?: number, causationId?: number): AddException<T> {
    return {
        type: "AddException",
        model: model,
        msg: msg,
        causationId: causationId,
        correlationId: correlationId,
        ex: ex,
        message: message
    }
}

type AddCustomEvent = {
    type: "AddCustomEvent"
    timestamp: number
    event: CustomEvent
}
function AddCustomEvent(event: CustomEvent, timestamp: number): AddCustomEvent {
    return {
        type: "AddCustomEvent",
        event: event,
        timestamp: timestamp
    }
}

type LogModel = {
    type: "LogModel",
    model?: unknown
}
function LogModel(model?: unknown): LogModel {
    return {
        type: "LogModel",
        model: model
    }
}

type PluginMessage = {
    type: "PluginMessage",
    content: unknown,
    pluginName: string
}
function PluginMessage(content: unknown, pluginName: string): PluginMessage {
    return {
        type: "PluginMessage",
        content: content,
        pluginName: pluginName
    }
}

export type DebugPaneMessage<T> =
    | LogModel
    | PluginMessage
    | OpenMsg
    | OpenDebugPane
    | CloseDebugPane
    | ClearHistory
    | GoToModel
    | CloseMsg
    | InterceptedMsg
    | MouseEntered<T>
    | MouseLeft<T>
    | AddException<T>
    | AddCustomEvent
    | TraceMsg
    | StartEventTrace
    | EndEventTrace
    
type MessageEntry<T> = {
    type: "MessageEntry"

    path: string[]
    msg: unknown
    updateTime: number
    renderTime: number
    source: MessageSource,
    correlationId: number,
    causationId: number
} & EntryBase<T>

export type EntryBase<T> = {
    model: T
    id: number
    timestamp: number
}

type ExceptionEntry<T> = {
    type: "ExceptionEntry"
    exception: Error,
    timestamp: number,
    id: number,
    correlationId: number,
    causationId: number
} & EntryBase<T>

export type CustomEntry<T> = {
    type: "CustomEntry"
    plugin: string
    entry: unknown
    source: MessageSource
    correlationId: number
    causationId: number
    timing: number | undefined
} & EntryBase<T>
type EventEntry<T> = {
    type: "EventEntry"
    event: Event
    processingDuration?: number
} & EntryBase<T>
type CustomEventEntry<T> = {
    type: "CustomEventEntry"
    event: CustomEvent
} & EntryBase<T>

type HistoryEntry<T> = 
(
| MessageEntry<T>
| ExceptionEntry<T>
| EventEntry<T>
| CustomEventEntry<T>
| CustomEntry<T>
)

type EventStackEntry = {
    startTime: number,
    entryId: number
}

export type DebugPaneInfo<T> = {
    history: (HistoryEntry<T>)[]
    isOpen: boolean
    selectedMessage: Option<HistoryEntry<T>>
    currentModel: [number, T]
    messageCount: number
    highlightedMessageId: ([number, number, number]) | undefined
    eventStack: EventStackEntry[]
}

type DebugPaneModel<T> = {
    __debugPane: DebugPaneInfo<T>
} & T;

export type DebugPanePlugin<M, T> = {
    name: string
    description?: string | undefined
    entryRenderer: (entryId: number, historyEntry: T, dispatch: Dispatch<unknown>) => TemplateResult
    renderPane: (model: DebugPaneInfo<M>, historyEntry: CustomEntry<M>, dispatch: any) => TemplateResult
    highlightColor: string | undefined
    onDispatch: (msg: unknown) => Cmd<unknown>
}

function interceptCmd<Model, Msg>(source: MessageSource, baseCmd: Cmd<Msg>, correlationId?: number, causationId?: number) {
    return (baseCmd.map((original) => {
            return (dispatch: Dispatch<DebugPaneMessage<Model>>) => {
                const start = performance.now()

                contextCausationId = causationId ?? 0;
                contextCorrelationId = correlationId ?? 0;
                original((msg) => {
                    const end = performance.now()
                    dispatch(InterceptedMsg(source, msg, causationId, correlationId, end-start))
                });
            }
        })
    );
}

function withNoCmds<Model, Msg extends { type: string }, InitProps, View, ExternalMessage>(app: Program<Model, Msg, InitProps, View, ExternalMessage>): Program<Model, Msg, InitProps, View, ExternalMessage> {
    return {
        ...app,
        init: (props?: InitProps) => {
            const [newModel, _] = app.init(props);
            return [newModel, Cmd.none];
        },
        propsUpdate: (model: Model, props?: InitProps) => {
            const [newModel, _] = app.propsUpdate(model, props);
            return [newModel, Cmd.none];
        },
        update: (msg: Msg, model: Model): [Model, Cmd<Msg>] => {
            const [newModel, _] = app.update(msg, model);
            return [newModel, Cmd.none];
        }
    };
}
function asStatic<Model, Msg extends { type: string }, InitProps, View, ExternalMessage>(app: Program<Model, Msg, InitProps, View, ExternalMessage>, initModel: Model): Program<Model, Msg, InitProps, View, ExternalMessage> {
    return {
        ...app,
        init: (props?: InitProps) => {
            return [initModel, Cmd.none];
        },
        propsUpdate: (model: Model, props?: InitProps) => {
            return [model, Cmd.none];
        },
        update: (msg: Msg, model: Model): [Model, Cmd<Msg>] => {
            return [model, Cmd.none];
        }
    };
}

const installedPlugins: Record<string, DebugPanePlugin<unknown, unknown>> = {}

function proxyEventTargetSource(source: EventTarget) {
    const emit = source.dispatchEvent;  // obtain reference
    const emitWindow = window.dispatchEvent; // obtain reference to potentially overwritten window.dispatchEvent

    function proxy(this: any, event: Event) {

        switch (event.type) {
            case "trace-event":
                return emit.call(this, event);
            default:
                const eventId = "ZZ"
                const startEvent = new CapturedEventStart({
                    event: event,
                    startTime: performance.now(),
                    id: eventId
                });
                emitWindow.call(this, startEvent);
                const defaultPrevented = emit.call(this, event);
                const endEvent = new CapturedEventEnd({
                    endTime: performance.now(),
                    id: eventId,
                    defaultPrevented: defaultPrevented
                });
                emitWindow.call(this, endEvent)

                return defaultPrevented;
        }
        
        
    }

    if ({ 'dispatchEvent': true }[ emit.name ]) source.dispatchEvent = proxy;  // attempt overwrite only if not already set (avoid rewrapping)
    return (source.dispatchEvent === proxy);  // indicate if its set after we try to
}

export function withDebugPane<Model, Msg extends { type: string }, InitProps, ExternalMessage>(plugins: DebugPanePlugin<Model, any>[], app: Program<Model, Msg, InitProps, TemplateResult, ExternalMessage>): Program<DebugPaneModel<Model>, DebugPaneMessage<Model>, InitProps, TemplateResult, ExternalMessage> {
    plugins.forEach((plugin) => {
        installedPlugins[plugin.name] = <DebugPanePlugin<unknown, unknown>>plugin;
    })
    
    return {
        ...app,
        setState: (model, dispatch) => {
            return app.setState(model, <Dispatch<Msg>>dispatch)
        },
        init: (props?: InitProps) => {
          const start = performance.now();
          const [model, cmd] = app.init(props);
          const end = performance.now();

          const interceptedCmd = interceptCmd<Model, Msg>(MessageSource.Init, cmd, 0, 0);

          return [{...model, __debugPane: {
              history: [{
                  timestamp: end,
                  path: ["init"],
                  msg: props,
                  model: model,
                  updateTime: end - start,
                  renderTime: -1,
                  id: 0,
                  source: MessageSource.Init,
                  correlationId: 0,
                  causationId: 0,
                  type: "MessageEntry"
              }],
              eventStack: [],
              isOpen: false,
              currentModel: [0, model],
              messageCount: 1,
              selectedMessage: None,
              highlightedMessageId: undefined
          } }, interceptedCmd]
        },
        subscribe: (model: DebugPaneModel<Model>): Cmd<DebugPaneMessage<Model>> => {
            proxyEventTargetSource(window)

            let parentCmd: Cmd<DebugPaneMessage<Model>> = Cmd.none;
            const subCmd: Cmd<DebugPaneMessage<Model>> = Cmd.ofSub((dispatch) => {
                window.addEventListener("error", (event: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => {
                    if (error) {
                        const msg = AddException(model, undefined, `Uncought exception in ${source}:${lineno}`, error, undefined, undefined);
                        dispatch(msg)
                    }
                })

                window.addEventListener("trace-event", (e) => {
                    const msg = <TraceEvent>e;
                    dispatch(TraceMsg(MessageSource.Event, msg.detail.plugin, msg.detail.data, msg.detail.causationId ?? -1, msg.detail.correlationId ?? -1, msg.detail.timing))
                })
                window.addEventListener("event-capture-start", (e) => {
                    const msg = <CapturedEventStart>e;
                    dispatch(StartEventTrace(msg.detail.id, msg.detail.event, msg.detail.startTime))
                })
                window.addEventListener("event-capture-end", (e) => {
                    const msg = <CapturedEventEnd>e;
                    dispatch(EndEventTrace(msg.detail.id, msg.detail.endTime, msg.detail.defaultPrevented))
                })
            });

            if (app.subscribe) {
                const cmd = app.subscribe(model);

                parentCmd = interceptCmd<Model, Msg>(MessageSource.Subscription, cmd)
            }

            return Cmd.batch([parentCmd, subCmd]);
        },
        propsUpdate: (model: DebugPaneModel<Model>, props?: InitProps) => {
          const [newModel, cmd] = app.propsUpdate(model, props);

          const interceptedCmd = interceptCmd<Model, Msg>(MessageSource.PropsUpdate, cmd);
  
          return [<any>newModel, interceptedCmd];
        },
        onError: (model, msg, message: string, ex: any) => {
            const correlationId = <number>(<any>msg).correlationId;
            const causationId = <number>(<any>msg).correlationId;

            if (app.onError) {
                if (msg && !(msg instanceof CustomEvent)) {
                    const typedMessage = <DebugPaneMessage<Msg>>msg;

                    switch (typedMessage.type) {
                        case "InterceptedMsg":
                            const parentCmd = interceptCmd<Model, Msg>(MessageSource.Error, app.onError(model, typedMessage.msg, message, ex), typedMessage.correlationId, typedMessage.causationId);
                            const paneCmd = Cmd.ofMsg(AddException(model, msg, message, ex, typedMessage.correlationId, typedMessage.causationId));

                            return Cmd.batch([parentCmd, paneCmd])
                        default:
                            return Cmd.none;
                    }
                } else if (msg) {
                    const parentCmd = interceptCmd<Model, Msg>(MessageSource.Error, app.onError(model, msg, message, ex), correlationId, causationId);
                    const paneCmd = Cmd.ofMsg(AddException(model, msg, message, ex, correlationId, causationId));

                    return Cmd.batch([parentCmd, paneCmd])
                }
            }

            return Cmd.ofMsg(AddException(model, msg, message, ex, correlationId, causationId));
        },
        update: (msg: DebugPaneMessage<Model>, model: DebugPaneModel<Model>): [DebugPaneModel<Model>, Cmd<DebugPaneMessage<Model>>] => {
            switch(msg.type) {
                case "LogModel":
                    console.log(msg.model ?? model)
                    return [model, Cmd.none]
                case "AddCustomEvent": {
                    const messageId = model.__debugPane.history.length

                    const entry: CustomEventEntry<DebugPaneModel<Model>> = {
                        type: "CustomEventEntry",
                        event: msg.event,
                        timestamp: msg.timestamp,
                        id: messageId,
                        model: model
                    }

                    model.__debugPane.history.unshift(entry)

                    return [{...model, __debugPane: {...model.__debugPane, isOpen: true, selectedMessage: None }}, Cmd.none]
                }
                case "AddException": {
                    const messageId = model.__debugPane.history.length

                    const entry: ExceptionEntry<DebugPaneModel<Model>> = {
                        type: "ExceptionEntry",
                        exception: msg.ex,
                        timestamp: Date.now(),
                        id: messageId,
                        model: msg.model,
                        correlationId: msg.correlationId ?? messageId,
                        causationId: msg.causationId ?? messageId
                    }
                    
                    model.__debugPane.history.unshift(entry)

                    return [{...model, __debugPane: {...model.__debugPane, isOpen: true, selectedMessage: None }}, Cmd.none]
                }
                case "CloseMsg":
                    return [{...model, __debugPane: {...model.__debugPane, isOpen: true, selectedMessage: None }}, Cmd.none]
                case "OpenDebugPane":
                    return [{...model, __debugPane: { ...model.__debugPane, isOpen: true }}, Cmd.none];
                case "CloseDebugPane":
                    return [{...model, __debugPane: { ...model.__debugPane, isOpen: false }}, Cmd.none];
                case "ClearHistory":
                    return [{...model, __debugPane: { ...model.__debugPane, history: [], messageCount: 0 }}, Cmd.none];
                case "GoToModel":
                    const entry = model.__debugPane.history.find((entry) => entry.id === msg.index)
                    
                    if (entry) {
                        return [{...entry.model, __debugPane: model.__debugPane }, Cmd.none]
                    } else {
                        return [model, Cmd.none]
                    }
                case "OpenMsg":
                    const historyEntry = model.__debugPane.history.find((entry) => entry.id === msg.index);
                    
                    if (!historyEntry) {
                        return [model, Cmd.none]
                    }

                    return [{...model, __debugPane: {...model.__debugPane, isOpen: true, selectedMessage: historyEntry }}, Cmd.none]
                case "MouseEntered":
                    switch (msg.entry.type) {
                        case "MessageEntry":
                            return [{...model, __debugPane: {...model.__debugPane, highlightedMessageId: [msg.entry.id, msg.entry.correlationId, msg.entry.causationId] }}, Cmd.none]
                        case "ExceptionEntry":
                            return [model, Cmd.none]
                        case "CustomEntry":
                            return [{...model, __debugPane: {...model.__debugPane, highlightedMessageId: [msg.entry.id, msg.entry.correlationId, msg.entry.causationId] }}, Cmd.none]
                        case "CustomEventEntry":
                            return [model, Cmd.none]
                        case "EventEntry":
                            return [model, Cmd.none]
                    }
                    
                    return [model, Cmd.none]

                case "MouseLeft":
                    switch (msg.entry.type) {
                        case "MessageEntry":
                            return [{...model, __debugPane: {...model.__debugPane, highlightedMessageId: undefined }}, Cmd.none]
                        case "ExceptionEntry":
                            return [{...model, __debugPane: {...model.__debugPane, highlightedMessageId: undefined }}, Cmd.none]
                        case "CustomEntry":
                            return [{...model, __debugPane: {...model.__debugPane, highlightedMessageId: undefined }}, Cmd.none]
                        case "CustomEventEntry":
                            return [{...model, __debugPane: {...model.__debugPane, highlightedMessageId: undefined }}, Cmd.none]
                        case "EventEntry":
                            return [{...model, __debugPane: {...model.__debugPane, highlightedMessageId: undefined }}, Cmd.none]
                    }

                    return [model, Cmd.none]
                case "TraceMsg": {
                    const messageId = model.__debugPane.history.length

                    const messageCount = model.__debugPane.history.unshift({
                        timestamp: Date.now(),
                        id: messageId,
                        entry: msg.msg,
                        source: msg.source,
                        plugin: msg.plugin,
                        causationId: msg.causationId ?? messageId,
                        correlationId: msg.correlationId ?? messageId,
                        type: "CustomEntry",
                        model: model,
                        timing: msg.timing
                    });
  
                    return [ {...model, __debugPane: { ...model.__debugPane, messageCount: messageCount, currentModel: [messageId, model]} }, Cmd.none ]
                }
                case "InterceptedMsg": {
                    const start = performance.now()
                    const [ baseModel, baseCmd ] = app.update(msg.msg, model);
                    const timestamp = performance.now()
                    
                    let innerMsg = msg.msg;
                    const messagePath = [(<Msg>msg.msg).type];
                    while(innerMsg.content) {
                        innerMsg = innerMsg.content
                        messagePath.unshift(innerMsg.type);
                    }

                    const messageId = model.__debugPane.history.length

                    const messageCount = model.__debugPane.history.unshift({
                        timestamp: timestamp,
                        path: messagePath,
                        msg: innerMsg,
                        model: baseModel,
                        updateTime: timestamp - start,
                        renderTime: -1,
                        id: messageId,
                        source: msg.source,
                        causationId: msg.causationId ?? messageId,
                        correlationId: msg.correlationId ?? messageId,
                        type: "MessageEntry"
                    });

                    const newCmd = interceptCmd<Model, Msg>(MessageSource.Cmd, baseCmd, msg.correlationId ?? messageId, messageId);
  
                    return [ {...model, ...baseModel, __debugPane: { ...model.__debugPane, messageCount: messageCount, currentModel: [messageId, baseModel]} }, newCmd ]
                }
                case "StartEventTrace": {
                    const entryId = model.__debugPane.history.length

                    const stack = [...model.__debugPane.eventStack]
                    stack.push({
                        startTime: msg.startTime,
                        entryId: entryId
                    })
                    
                    const historyEntry: EventEntry<Model> = {
                        type: "EventEntry",
                        event: msg.event,
                        timestamp: performance.now(),
                        model: model,
                        id: entryId
                    }

                    const messageCount = model.__debugPane.history.unshift(historyEntry)

                    return [{...model, __debugPane: {
                                ...model.__debugPane,
                                eventStack: stack,
                                messageCount: messageCount
                            }
                    }, Cmd.none]
                }
                case "EndEventTrace": {
                    const eventEntry = model.__debugPane.eventStack.pop()

                    if (!eventEntry) {
                        return [model, Cmd.none]
                    }

                    const time = msg.endTime - eventEntry.startTime

                    const entryIndex = model.__debugPane.history.findIndex((entry) => entry.id === eventEntry.entryId)
                    const historyEntry = <EventEntry<Model>>model.__debugPane.history[entryIndex]
                    historyEntry.processingDuration = time
                    
                    return [model, Cmd.none]
                }
                case "PluginMessage":
                    const handler = installedPlugins[msg.pluginName];
                    if (handler) {
                        // potentially pass either dispatch mapped
                        // or unmapped but then map the resulting cmd
                        return [model, <Cmd<DebugPaneMessage<Model>>>handler.onDispatch(msg.content)]
                    }

                    return [model, Cmd.none]
                default: // todo: This is a fallback, it wont be needed anymore if/when events get properly dispatched and not fed into the dispatch loop
                         // via "wrapped" events
                    const start = performance.now()
                    const [ baseModel, baseCmd ] = app.update(msg, model);
                    const timestamp = performance.now()
                    
                    let innerMsg = <any>msg;
                    const messagePath = [(<Msg>msg).type];
                    while(innerMsg.content) {
                        innerMsg = innerMsg.content
                        messagePath.unshift(innerMsg.type);
                    }

                    const messageId = model.__debugPane.history.length

                    const messageCount = model.__debugPane.history.unshift({
                        timestamp: timestamp,
                        path: messagePath,
                        msg: innerMsg,
                        model: baseModel,
                        updateTime: timestamp - start,
                        renderTime: -1,
                        id: messageId,
                        source: MessageSource.Cmd,
                        causationId: messageId,
                        correlationId: messageId,
                        type: "MessageEntry"
                    });

                    const newCmd = interceptCmd<Model, Msg>(MessageSource.Cmd, baseCmd, messageId, messageId);
  
                    return [ {...model, ...baseModel, __debugPane: { ...model.__debugPane, messageCount: messageCount, currentModel: [messageId, baseModel]} }, newCmd ]
            }
        },
        view: (model: DebugPaneModel<Model>, dispatch: Dispatch<DebugPaneMessage<Model>>) => {
            const start = performance.now()

            const appContent = app.view(model, (msg) => {
                const interceptedMsg = InterceptedMsg(MessageSource.User, msg)
                dispatch(interceptedMsg);
            })

            const end = performance.now()

            // I don't really like this, but it is what it is and this is just for 
            if (model.__debugPane.history.length > 0) {
                const firstEntry = model.__debugPane.history[0];
                if (firstEntry && firstEntry.type === "MessageEntry") {
                    firstEntry.renderTime = end - start;
                }
            }

            return html`
            ${appContent}
            
            ${Option.isSome(model.__debugPane.selectedMessage) ?
                renderDebugPane(model, model.__debugPane.selectedMessage, dispatch) : renderDebugBar(model, dispatch)
            }
            `
        }
    };
}

function renderDebugPane<Model>(model: DebugPaneModel<Model>, selectedMessage: HistoryEntry<Model>, dispatch: Dispatch<DebugPaneMessage<Model>>): TemplateResult {
    const content = twoColumn(renderMessagesList(model, dispatch), renderDebugPaneContent(model.__debugPane, selectedMessage, dispatch))
    return html`
        ${renderModal(html`<div class="h-full">${content}</div>`, () => dispatch(CloseMsg), true)}
    `;
}

function renderMessagesList<Model, Msg>(model: DebugPaneModel<Model>, dispatch: Dispatch<Msg | DebugPaneMessage<Model>>) {
    const dispatchOpenCloseMessageOnEvent = () => dispatch(model.__debugPane.isOpen ? CloseDebugPane : OpenDebugPane)
    return html`<div aria-live="assertive" class="text-xs border-r-2 h-full w-96 mr-4 overflow-y-auto">
                    <div class="bg-white rounded-tr-md pointer-events-auto ring-1 ring-black ring-opacity-5">
                        <div class="flex">
                            <span @click=${dispatchOpenCloseMessageOnEvent} class="flex-1 text-base pt-1 px-2">${model.__debugPane.messageCount} Messages</span>
                            ${clearButton(dispatch)}
                        </div>
                        ${model.__debugPane.isOpen ? renderHistoryEntries(dispatch, model.__debugPane.history, model.__debugPane.currentModel[0], model.__debugPane.highlightedMessageId, model.__debugPane.history.length) : nothing}
                    </div>
                </div>`
}

function renderEventDebugPane<T>(model: DebugPaneInfo<T>, eventEntry: EventEntry<T>) {
    return DetailList.render([
        ["Event Duration", eventEntry.processingDuration],
        ["Timestamp", eventEntry.timestamp],
        ["Event Type", eventEntry.event.type],
        ["Event Type", (<any>eventEntry.event).detail?.type]
        // ["Caused By", causationMessage && causationMessage.id !== historyEntry.id ? renderPath(causationMessage.path) : nothing, () => dispatch(OpenMsg(causationMessage))],
        // ["Root Message", correlationMessage && correlationMessage.id !== historyEntry.id ? renderPath(correlationMessage.path) : nothing, () => dispatch(OpenMsg(correlationMessage))]
    ])
}

function renderDebugPaneContent<Model>(model: DebugPaneInfo<Model>, selectedMessage: HistoryEntry<Model>, dispatch: Dispatch<DebugPaneMessage<Model>>) {
    switch (selectedMessage.type) {
        case "MessageEntry":
            return renderMessageDebugPane(model, selectedMessage, dispatch);
        case "ExceptionEntry":
            return renderExceptionDebugPane(model, selectedMessage, dispatch);
        case "CustomEntry":
            const handler = installedPlugins[selectedMessage.plugin];
            if (handler) {
                return handler.renderPane(model, selectedMessage, Dispatch.map(dispatch, (msg) => PluginMessage(msg, selectedMessage.plugin)));
            }
            return html``;
        case "CustomEventEntry":
            return html``;
        case "EventEntry":
            return renderEventDebugPane(model, selectedMessage);
    }
}

const colors = [
    (opacity: number | undefined) => `rgba(230, 25, 75, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(60, 180, 75, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(255, 225, 25, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(67, 99, 216, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(245, 130, 49, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(145, 30, 180, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(70, 240, 240, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(240, 50, 230, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(188, 246, 12, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(250, 190, 190, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(0, 128, 128, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(230, 190, 255, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(154, 99, 36, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(255, 250, 200, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(128, 0, 0, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(170, 255, 195, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(128, 128, 0, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(255, 216, 177, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(0, 0, 117, ${opacity ?? 1})`,
    (opacity: number | undefined) => `rgba(128, 128, 128, ${opacity ?? 1})`    
]
const colorsCount = colors.length;
function getColor(messageId: number) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const color = colors[messageId % colorsCount] ?? colors[0]!
    return color;
}
export function getColorWithAlpha(messageId: number, opacity?: number) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const color = colors[messageId % colorsCount] ?? colors[0]!
    return color(opacity);
}
function showModel<Model>(dispatch: Dispatch<DebugPaneMessage<Model>>) {
    return html`<button title="Log current model to console" @click=${ () => dispatch(LogModel())
    } class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
        ${icons.outline.interfaceContentNotePadText({})}
    </button>`
}
function clearButton<Model>(dispatch: Dispatch<DebugPaneMessage<Model>>) {
    return html`<button @click=${ () => dispatch({ type: "ClearHistory" })
} class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
    ${icons.outline.interfaceDeleteBin2({})}
</button>`
}

function renderPath(path: string[]) {
    return <TemplateResult>repeat(path, (pathPart, i) => html`<span class=${classMap({"path-part": true, "font-bold": i === 0, "text-gray-700": i !== 0})}>${pathPart}</span>`);
}

function renderExceptionDebugPane<Model, Msg>(model: DebugPaneInfo<Model>, historyEntry: ExceptionEntry<Model>, dispatch: Dispatch<Msg | DebugPaneMessage<Model>>): TemplateResult {
    function renderDetails(model: DebugPaneInfo<Model>, historyEntry: ExceptionEntry<Model>): TemplateResult {   
        const causationMessage = <MessageEntry<Model>>model.history.find((x) => x.id === historyEntry.causationId)
        const correlationMessage = <MessageEntry<Model>>model.history.find((x) => x.id === historyEntry.correlationId)

        return DetailList.render([
            ["Message", historyEntry.exception.message],
            ["Callstack", html`<pre>${historyEntry.exception.stack}</pre>`],
            ["Caused By", causationMessage && causationMessage.id !== historyEntry.id ? renderPath(causationMessage.path) : nothing, () => dispatch(OpenMsg(causationMessage))],
            ["Root Message", correlationMessage && correlationMessage.id !== historyEntry.id ? renderPath(correlationMessage.path) : nothing, () => dispatch(OpenMsg(correlationMessage))]
        ])
    }
   
    return html`
        <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">Exception Info</h3>
            <p class="mt-1 max-w-2xl text-sm text-gray-500">${historyEntry.exception.name}</p>
        </div>
        <tab-control id="exception-tabs" class="h-full">
            <div title="Details" active=true>
                ${renderDetails(model, historyEntry) }
            </div>
        </tab-control>`
}

function renderMessageDebugPane<Model, Msg>(model: DebugPaneInfo<Model>, historyEntry: MessageEntry<Model>, dispatch: Dispatch<Msg | DebugPaneMessage<Model>>): TemplateResult {
    function renderDetails(model: DebugPaneInfo<Model>, historyEntry: MessageEntry<Model>): TemplateResult {   
        const causationMessage = <HistoryEntry<Model>>model.history.find((x) => x.id === historyEntry.causationId)
        const correlationMessage = <HistoryEntry<Model>>model.history.find((x) => x.id === historyEntry.correlationId)

        const childMessages = <HistoryEntry<Model>[]>model.history.filter((x) => {
            if (Object.prototype.hasOwnProperty.call(x, "causationId")) {
                return (<HistoryEntry<Model> & {causationId: number}>x).causationId === historyEntry.id
            }
            return false;
        })

        const descendantMessages = <HistoryEntry<Model>[]>model.history.filter((x) => {
            if (Object.prototype.hasOwnProperty.call(x, "correlationId")) {
                return (<HistoryEntry<Model> & {correlationId: number}>x).correlationId === historyEntry.id && ((<HistoryEntry<Model> & {causationId: number}>x).causationId) !== historyEntry.id
            }
            return false;
        })

        let messageSource = "unknown";
        switch (historyEntry.source) {
            case MessageSource.Cmd: messageSource = "Cmd"; break;
            case MessageSource.Init: messageSource = "Init"; break;
            case MessageSource.PropsUpdate: messageSource = "Props Update"; break;
            case MessageSource.Subscription: messageSource = "Subscription"; break;
            case MessageSource.User: messageSource = "User initiated"; break;
        }

        function getName(entry: HistoryEntry<Model>) {
            switch (entry.type) {
                case "CustomEntry":
                    // todo: get name from plugin
                    return entry.plugin
                case "CustomEventEntry":
                    return entry.event.type
                case "EventEntry":
                    return entry.event.type
                case "ExceptionEntry":
                    return entry.exception.name
                case "MessageEntry":
                    return renderPath(entry.path)
            }
        }

        return DetailList.render([
            ["Source", messageSource],
            ["Timestamp", historyEntry.timestamp],
            ["Caused By", causationMessage && causationMessage.id !== historyEntry.id ? getName(causationMessage) : nothing, () => dispatch(OpenMsg(causationMessage))],
            ["Root Message", correlationMessage && correlationMessage.id !== historyEntry.id ? getName(correlationMessage) : nothing, () => dispatch(OpenMsg(correlationMessage))],
            ["Child Messages", html`<ul>${repeat(childMessages, (msg) => html`<li @click=${() => dispatch(OpenMsg(msg))}>${getName(msg)}</li>`)}</ul>`],
            ["Descendant Messages", html`<ul>${repeat(descendantMessages, (msg) => html`<li @click=${() => dispatch(OpenMsg(msg))}>${getName(msg)}</li>`)}</ul>`],
        ])
    }
    function renderModelDiff(model: DebugPaneInfo<Model>, historyEntry: MessageEntry<Model>): TemplateResult {   
        function findCausationEntry(causationId: number) {
            return model.history.find((entry) => entry.id === causationId)?.model || {}
        }
        function findPreviousEntryOrDefault(currentEntryId: number) {
            const entryIndex = model.history.findIndex((entry) => entry.id === currentEntryId)

            if (entryIndex < 0) {
                return {}
            }

            // Entry is first entry (remeber, latest entry is always index 0)
            if (entryIndex >= model.history.length - 1) {
                return {}
            }

            const historyEntry = model.history[entryIndex + 1]?.model
            
            return historyEntry ?? {}
        }

        const previousEntry = historyEntry.causationId === historyEntry.id ? findPreviousEntryOrDefault(historyEntry.id) : findCausationEntry(historyEntry.causationId)

        const delta = differ.diff(previousEntry, historyEntry.model)

        if (delta) {
            const htmlDiff = jsondiffpatch.formatters.html.format(delta, undefined);
            return html`${unsafeHTML(htmlDiff)}`
        } else {
            return html`<p>no change detected</p><p>Either nothing was changed or previous model was mutated</p>`
        }
    }
    function renderMessageContent(model: DebugPaneInfo<Model>, historyEntry: MessageEntry<Model>): TemplateResult {   
        return html`<pre>${JSON.stringify(historyEntry.msg, null, 4)}</pre>`
    }

    return html`
        <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900">Message Info</h3>
            <p class="mt-1 max-w-2xl text-sm text-gray-500">${renderPath(historyEntry.path)}</p>
            <button @click=${() => dispatch(GoToModel(historyEntry.id))}>Go to State</button>
            <button @click=${() => dispatch(LogModel(historyEntry.model))}>Log model</button>
        </div>
        <tab-control id="message-tabs" class="h-full">
            <div title="Details" active="true">${renderDetails(model, historyEntry)}</div>
            <div title="Message Content">${renderMessageContent(model, historyEntry)}</div>
            <div title="Model-Changes">${renderModelDiff(model, historyEntry)}</div>
        </tab-control>`
}

function highlightHistoryEntry<T extends { id: number, correlationId: number, causationId: number}>(selectedMessageId: [number, number, number] | undefined, messageEntry: T) {
    if (!selectedMessageId) {
        return undefined;
    }

    const [messageId, correlationId, causationId] = selectedMessageId;

    const highlightColor = getColor(causationId);

    //self
    if (messageId === messageEntry.id) {
        return `background-color: ${highlightColor(0.8)}`
    }

    //children
    if (messageId === messageEntry.causationId) {
        return `background-color: ${highlightColor(0.5)}`
    }

    //descendants
    if (messageId === messageEntry.correlationId) {
        return `background-color: ${highlightColor(0.3)}`
    }

    const highlightColorCorrelation = getColor(correlationId);

    // direct parent
    if (causationId === messageEntry.id) {
        return `background-color: ${highlightColorCorrelation(0.5)}`
    }

    // root
    if (correlationId === messageEntry.id) {
        return `background-color: ${highlightColorCorrelation(0.3)}`
    }          
    
    return undefined;
}

function highlightEntry<T>(messageId: [number, number, number] | undefined, entry: HistoryEntry<T>) {
    switch (entry.type) {
        case "MessageEntry":
            return highlightHistoryEntry(messageId, entry)
        case "ExceptionEntry":
            return highlightHistoryEntry(messageId, entry) ?? "background-color: rgb(248, 113, 113);"
        case "CustomEntry":
            const calculatedHighlight = highlightHistoryEntry(messageId, entry)

            if (calculatedHighlight) {
                return calculatedHighlight;
            }

            const plugin = installedPlugins[entry.plugin];
            if (!plugin) {
                return undefined;
            }

            return plugin.highlightColor
        default:
            return undefined;
    }
}

export function renderMsInS(ms: number) {
    return html`<span title="${ms}ms">${Math.round(ms/100) / 10}s</span>`
}
export function renderTiming(ms: number) {
    if (ms < 200) {
        return html`${ms}ms`
    }

    if (ms < 500) {
        return html`<span class="text-amber-400">${ms}ms</span>`
    }

    if (ms < 1000) {
        return html`<span class="text-amber-700">${ms}ms</span>`
    }


    return html`<span class="text-red-700">${renderMsInS(ms)}</span>`
}

function renderHistoryEntry<T>(historyEntry: HistoryEntry<T>, dispatch: Dispatch<DebugPaneMessage<T>>) {
    switch (historyEntry.type) {
        case "MessageEntry": {
            let icon = icons.solid.annotation({ classes: "h-4 w-4" });

            switch (historyEntry.source) {
                case MessageSource.User:
                    icon = icons.solid.cursorClick({ classes: "h-4 w-4" });
                    break;
                case MessageSource.Cmd:
                    // default
                    break;
                case MessageSource.Error:
                    icon = icons.solid.interfaceAlertWarningTriangle({ classes: "h-4 w-4" });
                    break;
            }

            return html`
                <span>${icon}</span>
                <span style=${`border-color: ${getColorWithAlpha(historyEntry.correlationId ?? historyEntry.id)}`} class="border-l-4 pl-1 flex-1 truncate" title=${historyEntry.path.join("/")}>
                    ${renderPath(historyEntry.path)}
                </span>
                <span class="w-8 text-right" title="Update time">
                    ${renderTiming(historyEntry.updateTime)}
                </span>
                <span class="w-8 text-right" title="Render time">
                    ${renderTiming(historyEntry.renderTime)}
                </span>`;
        }
        case "ExceptionEntry":
            return html`
                <span>${icons.solid.interfaceAlertWarningTriangle({ classes: "h-4 w-4" })}</span>
                <span  style=${`border-color: ${getColorWithAlpha(historyEntry.correlationId ?? historyEntry.id)}`} class="border-l-4 pl-1 flex-1 truncate" title=${historyEntry.exception.name}>
                    ${historyEntry.exception.message}
                </span>
                <span class="w-8 text-right" title="Update time">
                </span>
                <span class="w-8 text-right" title="Render time">
                </span>`;
        case "EventEntry":
            return html`
                <span>${icons.solid.interfaceEditAttachment1({ classes: "h-4 w-4" })}</span>
                <span style=${`border-color: ${getColorWithAlpha(historyEntry.id)}`} class="border-l-4 pl-1 flex-1 truncate" title=${historyEntry.event.type}>
                    ${historyEntry.event.type}
                </span>
                <span class="w-8 text-right" title="Update time">
                    ${renderTiming(historyEntry.processingDuration ?? -1)}
                </span>`
        case "CustomEventEntry":
            return html`
            <span style=${`border-color: ${getColorWithAlpha(historyEntry.id)}`} class="border-l-4 bg-green-400 pl-1 flex-1 truncate" title=${historyEntry.event.type}>
                ${historyEntry.event.type}
            </span>
            `
        case "CustomEntry":
            const handler = installedPlugins[historyEntry.plugin]

            if (handler) {
                return html`${handler.entryRenderer(historyEntry.id, historyEntry.entry, Dispatch.map(dispatch, (msg) => PluginMessage(msg, historyEntry.plugin)))}`
            }
            return html``
    }
}

function renderChevron(isDown: boolean) {
    return isDown ? icons.outline.interfaceArrowsButtonDown({}) : icons.outline.interfaceArrowsButtonUp({});
}
const keyframeOptions = {
    duration: 500,
    easing: 'ease-in-out',
    fill: <FillMode>"both"
  };
function renderHistoryEntries<Model>(dispatch: Dispatch<DebugPaneMessage<Model>>, historyEntries: HistoryEntry<Model>[], currentModelId: number, highlightedMessageId: [number, number, number] | undefined, count: number) {
    return html`<ul class="divide-y divide-gray-200" style="font-family: Consolas,monospace,serif;">
    ${repeat(historyEntries.slice(0, count),
        (historyEntry, i) => historyEntry.id,
        (historyEntry, i) => html`
            <li
                style=${ifDefined(highlightEntry(highlightedMessageId, historyEntry))}
                class=${classMap({
                    "cursor-pointer": true,
                    "gap-x-1": true,
                    "flex": true,
                    "py-1": true,
                    "px-2": true,
                    "group": true,
                    "bg-gray-300": currentModelId === historyEntry.id
                })}
                @mouseover=${(e: Event) =>  {
                    dispatch(MouseEntered(historyEntry))
                }}
                @mouseout =${(e: Event) =>  {
                    dispatch(MouseLeft(historyEntry))
                }}
                @click=${() => dispatch(OpenMsg(historyEntry))}>
                    ${renderHistoryEntry(historyEntry, dispatch)}
            </li>
        `)}
</ul>`
}

function renderDebugBar<Model, Msg>(model: DebugPaneModel<Model>, dispatch: Dispatch<Msg | DebugPaneMessage<Model>>) {
    const dispatchOpenCloseMessageOnEvent = () => dispatch(model.__debugPane.isOpen ? CloseDebugPane : OpenDebugPane)
    return html`<div aria-live="assertive" class="fixed bottom-0 left-0 text-xs w-60 z-50">
                    <div class="bg-white rounded-tr-md pointer-events-auto ring-1 ring-black ring-opacity-5">
                        <div class="flex">
                            <span @click=${dispatchOpenCloseMessageOnEvent} class="flex-1 text-base pt-1 px-2">${model.__debugPane.messageCount} Messages</span>
                            ${showModel(dispatch)}
                            ${clearButton(dispatch)}
                            <button @click=${dispatchOpenCloseMessageOnEvent} class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
                                    ${renderChevron(model.__debugPane.isOpen)}
                            </button>
                        </div>
                        ${model.__debugPane.isOpen ? renderHistoryEntries(dispatch, model.__debugPane.history, model.__debugPane.currentModel[0], model.__debugPane.highlightedMessageId, 20) : nothing}
                    </div>
                </div>`
}

let contextCorrelationId = 0
let contextCausationId = 0
export const DebugPane = {
    getMessageIds: () => {
        return [contextCorrelationId, contextCausationId]
    }
}