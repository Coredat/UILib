import { Cmd } from "./cmd";
import { Dispatch } from "./dispatch";
import { Option } from "./option"

export module Message {
  export type Wrapper<TypeName, T, T2> = { type: TypeName, content: T, data?: T2 }
  export function wrap<
    Parent extends { type: TypeName; content: Child; data?: Data },
    Child,
    TypeName,
    Data
  >(
    typeName: TypeName,
    dispatch: Dispatch<Parent>,
    data?: Data
  ): Dispatch<Child> {
    return (msg: Child) => {
      dispatch(<Parent>{ type: typeName, content: msg, data: data });
    };
  }
}

export interface Program<Model, Msg, InitProps, View, ExternalMessage> {
  init(props?: InitProps): [Model, Cmd<Msg>];
  update(msg: Msg, model: Model): [Model, Cmd<Msg>, Option<ExternalMessage>?];
  view(model: Model, dispatch: Dispatch<Msg>): View;
  propsUpdate(model: Model, props?: InitProps): [Model, Cmd<Msg>];
  setState(model: Model, dispatch: Dispatch<Msg>): void;
  subscribe?: (model: Model) => Cmd<Msg>;
  onError?: (model: Model, msg: unknown | Msg | CustomEvent<unknown> | undefined, message: string, error: Error) => Cmd<Msg>;
}

export function mkProgram<Model, Msg, InitProps, ViewResult, ExternalMessage>(
    init: (props?: InitProps) => [Model, Cmd<Msg>],
    update: (msg: Msg, model: Model) => [Model, Cmd<Msg>, Option<ExternalMessage>?],
    view: (model: Model, dispatch: Dispatch<Msg>) => ViewResult,
    propsUpdate?: (model: Model, props?: InitProps) => [Model, Cmd<Msg>])
      : Program<Model, Msg, InitProps, ViewResult, ExternalMessage> {
  return {
    init: init,
    update: update,
    view: view,
    propsUpdate: propsUpdate ?? ((model): [Model, Cmd<Msg>] => [model, Cmd.none]),
    setState: () => 0
  }
}

/**
 * A simple ringbuffer used as a backing store for any unprocessed messages inside of the dispatch-loop
 */
class RingBuffer<T> {
  private size: number;

  private read: number;
  private write: number;
  private data: (T | undefined)[];

  constructor(size: number) {
    this.size = size;
    this.data = new Array(size);

    this.read = 0;
    this.write = 0;
  }

  public push(elem: T) {
    this.data[this.write] = elem;
    this.write++;

    if (this.write >= this.size) {
      this.write = 0;
    }
  }

  public pop() {
    const result = this.data[this.read];
    this.data[this.read] = undefined;

    if (result) {
      this.read++;
    }

    if (this.read >= this.size) {
      this.read = 0;
    }

    return result;
  }
}

/**
 * This class represents the root of your application.
 * It contains the message loop and ties all functionality together.
 */
export class Application<Model, Msg, InitProps, View, ExternalMessage> {
  program: Program<Model, Msg, InitProps, View, ExternalMessage>;

  /**
   * Contains the current application state.
   */
  private state: Model | undefined
  private stop = false;

  get currentState(): Readonly<Model | undefined> {
    return this.state;
  }

  /**
   * This function is being called whenever an unhandled error occurs in the application.
   * By default it only logs to console.
   * @param msg Custom message that provides some context
   * @param ex The error that caused the application to fail
   * @param details Additional data that can be logged. For example, this could be the message that caused the exception.
   * @returns 
   */
  onError = (msg: string, ex: Error, ...details: unknown[]) =>
    console.error(msg, ex, details);

  /**
   * This function handles the rendering.
   * In order to make this framework renderer-agnostic, this function would need to be empty.
   * Currently this directly calls lit-html's render function.
   * @param model The application state to render
   * @param dispatch The dispatch function
   * @param target Html-Element to render the application in
   */
  render = (
    model: Model,
    dispatch: Dispatch<Msg>
  ) => {
    this.program.setState(model, dispatch);
  };

  /**
   * Forces an update of the application state
   * @param callback function that generates the new state
   * @param data any additional data that might need to be pased to the callback
   */
  forceUpdate = (
    callback: (model: Model, data?: InitProps) => [Model, Cmd<Msg>],
    data?: InitProps
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): void => {};

  /**
   * Creates a new instance of an application.
   * Note that just instanciating this class does not yet do anything.
   * In order to start the program-loop you need to call the run function.
   * @param program The program this application should be running.
   */
  constructor(
    program: Program<Model, Msg, InitProps, View, ExternalMessage>,
    model?: Model
  ) {
    this.program = program;
    this.state = model;
  }

  public dispose() {
    this.stop = true;
  }

  /**
   * Runs the program this application represent.s
   * This means that the program's init function is being called and the view is being rendered.
   * This starts the message/update/view-loop
   * @param args Initial properties passed into the program
   */
  public run(args?: InitProps) {
    let initCmd = Cmd.none;

    if (!this.state) {
      [this.state, initCmd] = this.program.init(args);
    }
    
    let reentered = false;

    const ringBuffer = new RingBuffer<Msg>(10);

    const program = this.program;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const application = this;

    if (!application.state) {
      application.onError("Run", new Error("application state is undefined or null"), application)
      return;
    }

    const dispatch: Dispatch<Msg> = function d(msg: Msg) {
      if (application.stop) { return; }

      if (!application.state) {
        application.onError("Dispatch-Loop", new Error("application state is undefined or null"), application)
        return;
      }

      if (reentered) {
        ringBuffer.push(msg);
      } else {
        reentered = true;

        let nextMsg: Msg | undefined = msg;

        while (nextMsg) {
          try {
            const [nextState, cmd] = program.update(
              nextMsg,
              application.state
            );

            Cmd.exec(d, cmd);

            application.state = nextState;
          } catch (ex) {
            if (program.onError) {
              const cmd = program.onError(
                  application.state,
                  msg,
                  `Unable to process message`,
                  <Error>ex
                );
              
              try {
                Cmd.exec(d, cmd);
              } catch (ex: unknown) {
                console.error("Fatal:", ex)
                //todo: add fatal error
              }
            }
          }

          nextMsg = ringBuffer.pop();
        }

        reentered = false;

        try
        {
          application.render(application.state, d);
        } catch(ex) {
          if (program.onError) {
            const cmd = program.onError(
                application.state,
                msg,
                `Unable to render application`,
                <Error>ex
              );

            try {
              Cmd.exec(d, cmd);
            } catch (ex: unknown) {
              console.error("Fatal:", ex)
              //todo: add fatal error
            }
          }
        }

      }
    };

    // todo: tie into/syncronize with dispatch-loop!
    this.forceUpdate = (
      callback: (model: Model, data?: InitProps) => [Model, Cmd<Msg>],
      data?: InitProps
    ) => {
      if (!application.state) {
        application.onError("Force-Update-Loop", new Error("application state is undefined or null"), application)
        return;
      }

      const [model, cmd] = callback(application.state, data);
      application.state = model;

      Cmd.exec(dispatch, cmd);

      application.render(application.state, dispatch);
    };

    application.render(application.state, dispatch);

    const sub = (() => {
      try {
        if (program.subscribe) {
          return program.subscribe(application.state);
        }
      } catch (ex) {
        if (program.onError) {
          const cmd = program.onError(
                  application.state,
                  undefined,
                  "Unable to subscribe:",
                  <Error>ex
                );
          return cmd;
        }
      }
      return Cmd.none;
    })();

    Cmd.exec(dispatch, Cmd.batch([sub, initCmd]));
  }
}
