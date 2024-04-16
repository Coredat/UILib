# Navigation

This module provides navigation features.

In order for your application to respond to url changes, you'll need to create the application with `withNavigation`.
This function takes 3 arguments.
1. the application you wish to add navigation to
2. a function to update the application's model in response to a url change
3. a route - the result of that route is what will be passed to the update function (2)

## Routes
A route is defined as a function that takes the url path and the query string.
The function should return undefined if the given parameters do not match the route.
If the route is a match, anything can be returned.

```type Route<T> = (path: string, query: Record<string, string>) => T | undefined```

### Helpers
The route module defines several helpers to create and combine routes.

#### Route.create
`function create<T>(pattern: RegExp): Route<T>`
#### Route.oneOf
#### Route.map