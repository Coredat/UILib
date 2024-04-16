import { nothing, render, TemplateResult } from "lit-html";
import { Program, Dispatch } from "uilib";

export type RenderTarget = undefined | string |  HTMLElement | DocumentFragment;

export function withLit<Model, Msg, InitProps, ExternalMessage>(target: RenderTarget, program: Program<Model, Msg, InitProps, TemplateResult, ExternalMessage>): Program<Model, Msg, InitProps, TemplateResult, ExternalMessage> {
    if (!target) {
        throw new Error(`Target element ${target} not found`);
    }
    
    if (typeof target === "string") {
        const domTarget = document.getElementById(target)
        
        if (!domTarget) {
            throw new Error(`render target ${target} could not be found`)
        }

        target = domTarget;
    }

    const safeTarget = target

    return {
        ...program,
        setState: (model: Model, dispatch: Dispatch<Msg>) => {
            render(program.view(model, dispatch), safeTarget);
        }
    }
}


export { repeat } from 'lit-html/directives/repeat.js'
export { ifDefined } from 'lit-html/directives/if-defined.js';
export { classMap } from 'lit-html/directives/class-map.js';
export { styleMap } from 'lit-html/directives/style-map.js';
export { live } from 'lit-html/directives/live.js';
export { guard } from 'lit-html/directives/guard.js';
export { html, svg, nothing, noChange } from 'lit-html';
export { directive, Directive, PartType } from "lit-html/directive.js";
export type { PartInfo, AttributePart } from "lit-html/directive.js";
type TemplateResultOrNothing = TemplateResult | typeof nothing;
export type { TemplateResultOrNothing as TemplateResult }