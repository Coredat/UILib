/* eslint-disable @typescript-eslint/no-explicit-any */

import { Cmd, Dispatch, Program } from "uilib";

type NavigateTo = {
  type: "NavigateTo";
  target: string;
  query?: URLSearchParams;
  state: unknown;
  shouldUpdate: boolean;
};
type Msg = NavigateTo;

type NavigationEventInfo = {
  target: string;
  query?: URLSearchParams;
  state?: unknown;
  shouldUpdate: boolean;
};

export class NavigationEvent extends CustomEvent<Msg> {
  constructor(msg: Msg) {
    super("navigation-event", { detail: msg, bubbles: true, composed: true });
  }
}

export module Navigation {
  /**
   * Cmd that causes navigation to {@link target}
   * @param target url to navigate to
   * @param params query parameters to apped to url
   * @param state state to be saved and pushed onto history
   * @returns Navigation Cmd
   */
  export function newUrl<T> (
    target: string | undefined,
    params?: URLSearchParams,
    state?: unknown
  ): Cmd<T> {
    if (!target) {
      target = window.location.pathname;
    }
    const event = createNavigationEvent(target, params, state);

    return [
      (dispatch: Dispatch<T>) => {
        window.dispatchEvent(event)
      }
    ];
  }
}

export type Route<T> = (path: string, query: Record<string, string>) => T | undefined
export module Route {
  /**
   * Creates a static route that needs to be matched (case insensitive).
   * 
   * @param path path to match exactly (case insensitive)
   * @returns Query parameter as Record<string, string>
   */
   export function fromStatic<T>(path: string): Route<T> {
    return (target: string, query: Record<string, string>): T | undefined => {
      if (target.toLowerCase() === path.toLowerCase()) {
        return <T>query;
      } else {
        return undefined;
      }
    };
  }

  /**
   * Creates a default/fallback route that always matches
   * 
   * @returns Query parameter as Record<string, string>
   */
  export function fallback<T>(data?: T): Route<T> {
    return (target: string, query: Record<string, string>): T | undefined => {
      if (Array.isArray(data)) {

        if (Array.isArray(query)) {
          return <T>[...data, ...query];
        } else {
          return <T>[...data, query];
        }
      }
      return <T>{...query, ...data };
    };
  }

  /**
   * Creates route with a prefix
   * 
   * @param prefix prefix to match
   * @returns Result of the child route if the prefix matches
   */
   export function withPrefix<T>(prefix: string, child: Route<T>): Route<T> {
      return (target: string, query: Record<string, string>): T | undefined => {
        if (target.toLowerCase().startsWith(prefix.toLowerCase())) {
          const urlWithoutPrefix = target.substring(prefix.length);
          return <T>child(urlWithoutPrefix, query);
        } else {
          return undefined;
        }
      };
    }
  

  /**
   * Creates a route from a regular expression.
   * 
   * @param pattern - the regex the url path should be matched against
   * @returns - undefined if {@link pattern} does not match the given target path.
   * - If the regex does match, an object will be returned.
   * The properties of this object will correspond to the regex's named groups,
   * combined with the query.
   * 
   * Example:
   *  Given the following URL: foo/test?x=y
   *  this pattern: /\/foo/(?<bar>[a-z])/g
   *  The resulting object would look like this: 
   *  {
   *    "bar": "test",
   *    "x": "y"
   *  }
   */
  export function fromRegExp<T>(pattern: RegExp): Route<T> {
    return (target: string, query: Record<string, string>): T | undefined => {
      return <T>tryParseRoute(pattern, target, query)
    };
  }

  function tryParseRoute(
    pattern: RegExp,
    target: string,
    queryProps?: object
  ) {
    const match = [...target.matchAll(pattern)];

    if (match && match.length > 0 && match[0]) {
      const matchData = match[0];

      if (!queryProps) {
        queryProps = {};
      }

      return Object.assign(queryProps, matchData.groups);
    } else {
      return undefined;
    }
  }

  /**
   * Applies {@link mapper} on the output of {@link route} and returns its result.
   * @param route Existing route
   * @param mapper function to map output of existing route to a new output
   * @returns New route returning the result of {@link mapper}
   */
  export function map<T, T2>(route: Route<T>, mapper: (route: T) => T2): Route<T2> {
    return (target: string, query: Record<string, string>) => {
      const parsedRoute = route(target, query);

      if (parsedRoute) {
        return mapper(parsedRoute);
      }
      
      return undefined;
    }
  }

  /**
   * Combines multiple routes into one route.
   * 
   * Checks each route for a match until one is found and returns its result.
   * @param routes routes to check
   * @returns result of matched route or undefined if no route matches.
   */
  export function oneOf<T>(routes: Route<T>[]): Route<T> {
    return (target: string, query: Record<string, string>) => {
      for (const route of routes) {
        const parsedRoute = route(target, query);

        if (parsedRoute !== undefined && parsedRoute !== null) {
          return <T>parsedRoute;
        }
      }

      return undefined;
    }
  }
}

function withNavigation<Model, ParentMsg extends { type: string }, InitProps, RouteProps, View>(
  app: Program<Model, ParentMsg, InitProps, View, undefined>,
  routeUpdate: (model: Model, route?: RouteProps) => [Model, Cmd<ParentMsg>],
  route: Route<RouteProps>
): Program<Model, ParentMsg | Msg, InitProps, View, undefined> {
  const update = (msg: ParentMsg | Msg, model: Model): [Model, Cmd<ParentMsg>] => {
    switch (msg.type) {
      case "NavigateTo":
        const typedMessage = <Msg>msg;
        window.history.pushState(
          typedMessage.state ?? {},
          "",
          `${typedMessage.target}${
            typedMessage.query ? typedMessage.query.toString() : ""
          }`
        );

        if (typedMessage.shouldUpdate) {
          // question: do we need this?
          // can we just do Object.assign() with this?
          const queryProps: { [key: string]: string } = {};
          if (typedMessage.query) {
            for (const [key, value] of typedMessage.query.entries()) {
              queryProps[key] = value;
            }
          }
          const routeData = route(typedMessage.target, queryProps);

          const [newModel, cmd] = routeUpdate(model, routeData);

          return [newModel, cmd];
        } else {
          return [model, Cmd.none];
        }
      default:
        const [baseModel, baseCmd] = app.update(<any>msg, model);
        return [baseModel, baseCmd];
    }
  };

  return {
    ...app,
    subscribe: (model: Model) => {
      const subscription = Cmd.ofSub<ParentMsg | Msg>((dispatch) => {
        window.addEventListener("navigation-event", (e: any) => {
          const msg: NavigationEventInfo = e.detail;

          dispatch({ ...e.detail,
            target: decodeURI(e.detail.target),
            type: "NavigateTo" });
        });
      });

      if (app.subscribe) {
        const parentSubscriptions = app.subscribe(model)

        return Cmd.batch([parentSubscriptions, subscription])
      }

      return subscription
    },
    init: (props?: InitProps) => {
      const [model, cmd] = app.init(props);

      const target = decodeURI(window.location.pathname);
      const query = new URLSearchParams(window.location.search);

      // question: do we need this?
      // can we just do Object.assign()?
      const queryProps: { [key: string]: string } = {};
      if (query) {
        for (const [key, value] of query.entries()) {
          queryProps[key] = value;
        }
      }
      const routeData = route(target, queryProps);

      if (routeData) {
        return routeUpdate(model, routeData);
      } else {
        return [model, cmd];
      }
    },
    propsUpdate: (model: Model, props?: InitProps) => {
      const [newModel, cmd] = app.propsUpdate(model, props);

      return [newModel, cmd];
    },
    update: update
  };
}

export interface LinkOptions<T> {
  callback: () => boolean;
  state: any;
  updateRoute: boolean;
}

function createNavigationEvent(
  target: string | undefined,
  params?: URLSearchParams,
  state?: any,
  shouldUpdate?: boolean
) {
  if (!target) {
    target = window.location.pathname;
  }

  const event = new CustomEvent<NavigationEventInfo>("navigation-event", {
    detail: {
      target: target,
      query: params,
      state: state,
      shouldUpdate: shouldUpdate ?? true,
    },
    bubbles: true,
    composed: true,
  });

  return event;
}

function handleSingleClick<T>(e: MouseEvent, shouldDispatchEventCallback: undefined | (() => boolean), event: CustomEvent<NavigationEventInfo>) {
    let shouldDispatchEvent = true;
      
    if (shouldDispatchEventCallback) {
      shouldDispatchEvent = shouldDispatchEventCallback();
    }

    if (shouldDispatchEvent) {
      window.dispatchEvent(event);
    }
}

export function dispatchNavigationEvent<T>(
  target: string | undefined,
  params: URLSearchParams | undefined,
  options: Partial<LinkOptions<T>>
) {
  const event = createNavigationEvent(target, params, options.state, options.updateRoute);

  return (e: MouseEvent) => {
      if (e.ctrlKey) {
        e.stopPropagation();
        return;
      }
      
      handleSingleClick(e, options.callback, event)
      e.preventDefault();
      e.stopPropagation();
      return false;
  }
  
}

export { Navigation as default, withNavigation };
