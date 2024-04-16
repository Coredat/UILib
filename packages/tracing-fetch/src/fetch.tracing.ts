import { Dispatch } from "uilib";
import { Middleware, ResponseHandler } from "@coredat/fetch";
import { getCurrentContext, getCurrentSpan, getTracer, startChild } from "@coredat/tracing";
import { Context, Span, SpanContext, SpanKind, SpanStatusCode, context, propagation, trace } from "@opentelemetry/api"
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

export async function traceFetch<Msg>(dispatch: Dispatch<Msg>, requestInfo: RequestInfo, requestInit: RequestInit, responseHandler: ResponseHandler<Msg>, next: Middleware<Msg>) {
    const parent = getCurrentSpan()

    const method = (requestInit.method || 'GET').toUpperCase();
    const spanName = `HTTP ${method}`;

    const span = startChild("fetch", parent, {
        kind: SpanKind.CLIENT,
        attributes: {
            [SemanticAttributes.HTTP_METHOD]: method
        }
    })
    if (typeof requestInfo === "string") {
        span.setAttributes({
            [SemanticAttributes.HTTP_URL]: requestInfo
        })
    } else {
        span.setAttributes({
            [SemanticAttributes.HTTP_URL]: requestInfo.destination
        })

        addHeaders(requestInfo);
    }
    addHeaders(requestInit);

    const parentContext = context.active()
    const response = await next((msg: Msg) => {
        context.with(parentContext, () => dispatch(msg))
    }, requestInfo, requestInit, responseHandler);

    span.end()

    return response;
}

function addHeaders(options: Request | RequestInit): void {
    if (options instanceof Request) {
      propagation.inject(context.active(), options.headers, {
        set: (h, k, v) => h.set(k, typeof v === 'string' ? v : String(v)),
      });
    } else if (options.headers instanceof Headers) {
      propagation.inject(context.active(), options.headers, {
        set: (h, k, v) => h.set(k, typeof v === 'string' ? v : String(v)),
      });
    } else {
      const headers: Partial<Record<string, unknown>> = {};
      propagation.inject(context.active(), headers);
      options.headers = Object.assign({}, headers, options.headers || {});
    }
  }