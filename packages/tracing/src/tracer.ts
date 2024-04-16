import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { trace, context, Span, SpanOptions, Context } from '@opentelemetry/api';
import { BasicTracerProvider, BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { StackContextManager } from "./contextManager";


export function getTracer() {
    return trace.getTracer('default');
}

export function startChild(name: string, parent: Span | undefined, options: SpanOptions | undefined =  undefined) {
    const ctx = parent ? setParent(parent) : context.active();

    const tracer = getTracer();
    return tracer.startSpan(name, options, ctx)
}
export function setParent(span: Span) {
    return trace.setSpan(
        context.active(),
        span
    )
}
export function getCurrentSpan(): Span | undefined {
    return trace.getSpan(context.active())
}
export function getCurrentContext(): Context {
    return context.active()
}