import { Cmd, Dispatch, Program } from "uilib";
import { Context, Span, SpanContext, SpanStatusCode, context, propagation, trace } from "@opentelemetry/api"
import { getTracer,startChild } from "./tracer"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";
import { BasicTracerProvider, BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { StackContextManager } from "./contextManager";

type Msg<Parent> = Parent & {
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMessageFQN(msg: { type: string, content?: any }): string[] {
    const messagePath = [msg.type];
    let innerMsg = msg;
    while(innerMsg.content) {
        innerMsg = innerMsg.content
        messagePath.unshift(innerMsg.type);
    }
    return messagePath || "";
}

function traceCmd<P>(cmd: Cmd<P>, parent: Span): Cmd<Msg<P>> {
    return cmd.map((cmd) => {
        return context.with(trace.setSpan(context.active(), parent), () => {                        
            return (dispatch: Dispatch<Msg<P>>) => {
                const cmdSpan = startChild("cmd", parent)

                if (!cmd) {
                    return;
                }

                const activeContext = trace.setSpan(context.active(), cmdSpan)

                context.with(activeContext, () => {

                    const subContext = context.active()
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    cmd((msg: any) => {
                        cmdSpan.end();

                        context.with(subContext, () => {
                            dispatch(msg)
                        })
                    })

                })
            }
        })
    })
}

export function withTracing<Model, ParentMsg extends { type: string }, InitProps, View, ExternalMessage>(
    serviceName: string,
    app: Program<Model, ParentMsg, InitProps, View, ExternalMessage>
    ): Program<Model, ParentMsg, InitProps, View, ExternalMessage> {

    const resource =
        Resource.default().merge(
            new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
                [SemanticResourceAttributes.SERVICE_VERSION]: "0.1.0",
            })
        );
    
    const provider = new BasicTracerProvider({
        resource: resource
    });
    context.setGlobalContextManager(new StackContextManager().enable())
    
    const collectorOptions = {
        url: '/traces',
        concurrencyLimit: 10
    };
    const exporter = new OTLPTraceExporter(collectorOptions);
    
    // provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()))
    provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
        // The maximum queue size. After the size is reached spans are dropped.
        maxQueueSize: 100,
        // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
        maxExportBatchSize: 10,
        // The interval between two consecutive exports
        scheduledDelayMillis: 500,
        // How long the export can run before it is cancelled
        exportTimeoutMillis: 30000,
    }))
    provider.register()

    let viewParent: Span | undefined;
    
    return {
        ...app,
        init: (props) => {
            const tracer = getTracer()
            const span = tracer.startSpan("init")
            
            const [model, cmd] = app.init(props)
            
            span.end()
            viewParent = span
            const tracedCmd = traceCmd(cmd, span)
            return [model, tracedCmd];
        },
        update: (msg: Msg<ParentMsg>, model: Model): [Model, Cmd<Msg<ParentMsg>>] => {
            return context.with(context.active(), (): [Model, Cmd<Msg<ParentMsg>>] => {
                const tracer = getTracer()
                const fqn = getMessageFQN(msg)
                const span = tracer.startSpan(fqn[0] ?? "update", {}, context.active())
                span.setAttribute("msg", fqn)
                
                let newModel: Model | undefined
                let cmd: Cmd<Msg<ParentMsg>> | undefined

                try {
                    const [m, c] = app.update(msg, model)
                    newModel = m
                    cmd = c
                } catch(ex) {
                    span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: "Unable to process message"
                    });
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    span.recordException(<any>ex)

                    throw ex
                } finally {
                    span.end()
                }

                if (!viewParent) {
                    viewParent = span
                }
                
                const tracedCmd = traceCmd(cmd, span)
                return [newModel, tracedCmd]
            })
        },
        view: (model, dispatch) => {
            const span = startChild("view", viewParent)
            viewParent = undefined
                
            try {
                const view = app.view(model, (msg) => {
                    const tracer = getTracer()
    
                    const fqn = getMessageFQN(msg)
                    const span = tracer.startSpan(fqn[0] ?? "dispatch", {
                        attributes: { fqn: fqn }
                    })
    
                    dispatch(msg)
                    span.end()
                })

                return view
            } catch(ex) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: "Unable to create view"
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                span.recordException(<any>ex)

                throw ex
            } finally {
                span.end()
            }
        },
        onError: (model, msg, message, error) => {
            const span = (trace.getSpan(context.active()) ?? getTracer().startSpan("OnError"))
                    .setStatus({
                        code: SpanStatusCode.ERROR,
                        message: message
                    });
                span.recordException(error)
                span.end();
            
            if (app.onError) {
                return app.onError(model, msg, message, error)
            }

            return Cmd.none
        },
        subscribe: (model) => {
            if (app.subscribe) {
                const tracer = getTracer()
                const span = tracer.startSpan("subscribe", {}, context.active())
                const cmd = app.subscribe(model)
                span.end()
                return traceCmd(cmd, span);
            } else {
                return Cmd.none
            }
        },
        propsUpdate: (model: Model, props?: InitProps) => {
            const span = getTracer().startSpan("propsUpdate", { attributes: { props: JSON.stringify(props) } })
            
            const [newModel, cmd] = app.propsUpdate(model, props);
      
            span.end()
            return [newModel, traceCmd(cmd, span)];
        }
    }
}