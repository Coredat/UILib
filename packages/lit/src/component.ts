import { html, render } from "lit-html";
import { Cmd, Option, Dispatch, Program, Application } from "uilib";
import { TemplateResult, RenderTarget } from "./index"; 

function toKebabCase(str: string) { return str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase()) }

export interface PureComponent<Model, Msg, InitProps, ExternalMessage> {
  init(props?: InitProps | undefined): [Model, Cmd<Msg>];
  update(msg: Msg, model: Model): [Model, Cmd<Msg>, Option<ExternalMessage>?];
  view(model: Model, dispatch: Dispatch<Msg>): TemplateResult;
  propsUpdate?(model: Model, props?: InitProps): [Model, Cmd<Msg>];
}

type MakeComponentCallbacks<InitProps> = {
    /**
     * @summary Gets called when the web component's connectedCallback is called.
     * @description
     * 
     * In terms of the ELM-lifecyle, this is being called before the application (in this case the web component) is being run.
     * This allows, among other things, to interact with the DOM-element in question before the init call.
     * 
     * You can return a partial init props from this function.
     * Note, any values set here will be overriden by attributes if they are present
     * 
     * @param element The element that is instantiated in the DOM
     * @returns InitProps to be passed into `.run(...)`
     */
    onConnected: (element: HTMLElement) => Partial<InitProps>
}


/**
 * @summary Turns a module based component into a webcomponent
 * @description
 * 
 * Module based components are just standard es-module which follow a convention.
 * Sometimes you do want to make these components into web components.
 * `makeWebComponent` is made to facility that.
 * 
 * @param tagName HTML-tag name of this component. Must contain a hyphen (-) as per the standard
 * @param module Component to turn into a webcomponent
 * @param observedTags List of tags that when changed should trigger a propsUpdate
 * @param callbacks Provides the ability to react on life-cycle changes. 
 * @returns Returns the web component class. A registration of this class is not necessary as this is handled by `makeWebComponent`
 */
export function makeWebComponent<Model extends Object | number | string, Msg, InitProps, ExternalMessage>(
  tagName: string,
  module: PureComponent<Model, Msg, InitProps, ExternalMessage>,
  observedTags?: (keyof InitProps)[],
  callbacks?: MakeComponentCallbacks<InitProps>
): typeof HTMLElement {

  const tags = observedTags?.map(tag => (typeof(tag) === "string") ? tag.replace(/([a-z0–9])([A-Z])/g, "$1-$2").toLowerCase() : tag) ?? []

  const WebComponentClass = class X extends Component<Model, Msg, InitProps, ExternalMessage> {
      constructor() {
        super()
      }
      init(props?: InitProps | undefined): [Model, Cmd<Msg>] {
        return module.init.bind(this)(props)
      }
      update(msg: Msg, model: Model): [Model, Cmd<Msg>, Option<ExternalMessage>?] {
        const [newModel, cmd, externalMsg] = module.update.bind(this)(msg, model)

        if (Option.isSome(externalMsg) && (<{type: string}><unknown>externalMsg).type) {
          this.dispatchEvent(new CustomEvent(toKebabCase((<{type: string}><unknown>externalMsg).type), {
            composed: true,
            bubbles: true,
            detail: externalMsg
        }))
        }

        return [newModel, cmd]
      }
      view(model: Model, dispatch: Dispatch<Msg>): TemplateResult {
        return module.view.bind(this)(model, dispatch)
      }
      propsUpdate(model: Model, props?: InitProps | undefined): [Model, Cmd<Msg>] {
          if (module.propsUpdate) {
            return module.propsUpdate.bind(this)(model, props)
          }

          return [model, Cmd.none]
      }

      connectedCallback() {
          const props = this.getProps()

          if (callbacks && callbacks.onConnected) {
            this.run({...callbacks.onConnected(this), ...props})
          } else {
            this.run(props)
          }
      }

      static get observedAttributes() {
        return tags;   //Array of all changed properties in "propsUpdate"
      }
    }

    customElements.define(tagName, WebComponentClass);
    return WebComponentClass;
}


/**
 * The base class for custom web-components
 */
export abstract class Component<Model extends Object | number | string , Msg, InitProps, ExternalMessage>
    extends HTMLElement
    implements Program<Model, Msg, InitProps, TemplateResult, ExternalMessage> {

    /**
     * This component's init-function
     * @param props Optional properties. These properties are based on the attributes (eg: <xyz name="123"></xyz> This would result in a { name: "123" } as initprops)
     */
    abstract init(props?: InitProps): [Model, Cmd<Msg>];
    /**
     * This components update-function
     * @param msg The message that triggered the update
     * @param model The current model/state of the component
     */
    abstract update(msg: Msg, model: Model): [Model, Cmd<Msg>, Option<ExternalMessage>?];
    /**
     * This components view
     * @param model The current model/state of the component
     * @param dispatch The dispatch function which can be used to dispatch new messages
     */
    abstract view(model: Model, dispatch: Dispatch<Msg>): TemplateResult;

    /**
     * The program behind this component
     */
    private app: Application<Model, Msg, InitProps, TemplateResult, ExternalMessage>;

    /**
     * Whenever an attribute changes, this function is being called.
     * Here you have the chance to update the model/state based on the new props
     * @param model The current model/state of the component
     * @param props The new attributes on this component
     * @returns The new model/state of this component and a Command to be executed
     */
    propsUpdate(model: Model, props?: InitProps): [Model, Cmd<Msg>] {
        return [model, Cmd.none];
    }

    forceUpdate(updater: (model: Model, data?: InitProps) => [Model, Cmd<Msg>], data?: InitProps) {
        return this.app.forceUpdate(updater, data);
    }

    postInit = (
        model: Model,
        dispatch: Dispatch<Msg>
    ): Cmd<Msg> => Cmd.none;

    /**
     * Overwrite this function if you need to perform some action after this component has been dismounted.
     * That means when it has been removed from the DOM
     * @param renderTarget 
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    destroy(renderTarget: RenderTarget) { }

    /**
     * The dispatch function for this component
     */
    dispatch: Dispatch<Msg>;

    private root: ShadowRoot;

    constructor() {
        super();

        this.root = this.attachShadow({ mode: "open" });

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        this.dispatch = () => { };

        const program = {
            subscribe: (model: Model) => {
                return Cmd.ofSub<Msg>((dispatch: Dispatch<Msg>) => {
                    this.postInit(model, dispatch);

                    this.dispatch = dispatch;
                });
            },
            setState: this.setState.bind(this),
            init: this.init.bind(this),
            update: this.update.bind(this),
            view: this.view.bind(this),
            propsUpdate: this.propsUpdate.bind(this),
        }

        this.app = new Application(program);
    }
  setState(model: Model, dispatch: Dispatch<Msg>): void {
    const content = this.view(model, dispatch);

    render(
        html`<style>
          :host {
            display: block;
          }
        </style>
        <link rel="stylesheet" href="/style.css" />
          ${content}`,
        this.root
    );
  }
  subscribe?: ((model: Model) => Cmd<Msg>) | undefined;
  onError?: ((model: Model, msg: unknown, message: string, error: Error) => Cmd<Msg>) | undefined;


    /**
     * https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#using_the_lifecycle_callbacks=
     * @param attrName 
     * @param oldValue 
     * @param newValue 
     */
    attributeChangedCallback(
        attrName: string,
        oldValue: unknown,
        newValue: unknown
    ) {
        if (newValue !== oldValue) {
            const props = this.getProps();

            this.app.forceUpdate(this.propsUpdate, props);
        }
    }

    protected getProps(): InitProps {
        function clearAndUpper(text: string) {
          return text.replace(/-/, "").toUpperCase();
        }

        const componentAttributeNames = this.getAttributeNames();
        const props = componentAttributeNames.reduce((state, attributeName) => {
            const pascalCasedAttribute = attributeName.replace(/-\w/g, clearAndUpper);

            const attributeValue = this.getAttribute(attributeName);

            state[pascalCasedAttribute] = attributeValue;

            return state;
        }, <Record<string, string | null>>{});

        const properties = Object.getOwnPropertyNames(this).reduce((state, propertyName) => {
          state[propertyName] = this[propertyName as keyof this]

          return state
        }, <Record<string, unknown>>{})

        return <InitProps>{...properties, ...props};
    }

    protected run(model: InitProps) {
      this.app.run(model);
    }

    connectedCallback() {
        const props = this.getProps();
        this.run(props)
    }

    disconnectedCallback() {
        if (this.destroy) {
            this.destroy(this.root);
        }
    }
}


/**
 * Base class for components that don't need to hold state or perfrom updates.
 */
export abstract class SimpleComponent extends Component<
    {},
    undefined,
    undefined,
    undefined
> {
    init(props?: never): [{}, Cmd<undefined>] {
        return [{}, Cmd.none];
    }
    update(msg: undefined, model: {}): [{}, Cmd<undefined>] {
        return [{}, Cmd.none];
    }
}
