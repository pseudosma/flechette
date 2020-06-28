# Flechette  ![build](https://img.shields.io/travis/com/pseudosma/flechette) ![coverage](https://img.shields.io/coveralls/github/pseudosma/flechette) ![license](https://img.shields.io/npm/l/flechette)

## Features

Flechette is a highly configurable wrapper for Fetch API designed to facilitate centralizing and standardizing an app's network interaction into a convenient, globally accessible area.

### Highly configurable

Flechette can be configured to handle:

* Adding a default base URL for all web calls
* Adding default headers for all web calls
* Specifying which HTTP status codes should be considered failure or success
* Specifying retry actions on a per status code basis
* Set a timeout for the overall network call, as well as specify the number of retries for it

Flechette also allows multiple configurations to be used at the same time, all distinguished by a name.

On top of having a global set of configurations, users can override or append to some of these values on a per request basis.

### No need to work with promises directly

Flechette completely obfuscates the need to handle promises directly returned from Fetch API. Instead, it operates under a very simple paradigm - users provide a success and failure callback function (and optionally a waiting callback function) which are fired depending on the outcome of the fetch call.

### Perform multiple fetch calls together

Often times a web app will need to make several interdependent API calls, all of which will need to be successful, to perform a single operation. Flechette's ***send*** function allows you to pass in a single set of arguments or an array of arguments all at once to be evaluated together.

If this is the option you choose, Flechette will intelligently handle any retries on individual failures and combine those with the final results, choosing to flow down the success or failure path based on the cumulative results of all calls.

### Opportunistic JSON parsing

If the response was parsable as a JSON object, Flechette will automatically convert it to an object, otherwise it'll leave it as a string.

## Usage

### Who should use Flechette?

Single-page web apps benefit the most from using the framework. Flechette's configurations are saved as a window-level object so they are globally accessible but they do not persist beyond the current page. Multi-page apps with needs beyond the default configuration would need to reconfigure it upon a new page load.

### Basic Example

Use Flechette's ***send*** method instead of fetch:

```typescript
  import * as flechette from "flechette"

  flechette.send(
    { path: "https://www.google.com", method: "GET" },
    (response: FlechetteResponse) => { console.log("success") },
    (response: FlechetteResponse) => { console.log("failure") },
    (isWaiting: boolean) => {
      if (isWaiting) {
        console.log("began waiting on response") 
      } else {
        console.log("no longer waiting on response") 
      }
    },
  );
```

Send takes 3 arguments and an optional fourth:

1. A SendArgs object derived from Fetch API's RequestInit
2. The success callback
3. The failure callback
4. An optional waiting callback

The interfaces and types for those params are detailed below:

```typescript
export interface SendArgs extends RequestInit {
  path: string; // target endpoint
  instanceName?: string; // the name of the Flechette configuration to use
  retryActions?: Array<RetryAction>; // single use retry action based on HTTP status code
}
```

Because SendArgs extends RequestInit, it has all the same fields available. More details on the different options can be found here: https://developer.mozilla.org/en-US/docs/Web/API/Request/Request


The success and failure callback must both be of the ResponseFunc type.

```typescript
export type ResponseFunc = (
  response: FlechetteResponse | Array<FlechetteResponse>
) => void;
```

The final argument, the waiting callback must be of the ToggleFunc type.

```typescript
export type ToggleFunc = (isWaiting: boolean) => void;
```

The response is handed to the callback functions as a FlechetteResponse.

```typescript
export interface FlechetteResponse {
  success: boolean;
  statusCode: number;
  response: any;
  sent: SendArgs;
}
```

For more examples, please review the [documentation](https://github.com/pseudosma/flechette/tree/master/documentation).

### Default configuration

If you don't specify a configuration or Flechette instance, like the example above shows, Flechette will automatically create a new instance of itself tagged with the name "flechette" on a window-level object called "appConfig".

This instance has the following configuration:

* Responses that come back with HTTP status codes between 200-399 are considered successful.
* It will retry once on any response that has 408, 429, or 504 status code.
* The default timeout limit is set at 30 seconds. Flechette will abort the original request and retry the request(s) 2 additional times in case it does not get a response within that timeout.


## Install with [npm](https://www.npmjs.com/)

```bash
npm i flechette --save
```
This package is provided in the ES2017 module format.

## Contributing

Pull requests are always welcome. For bugs and feature requests, [please create an issue](https://github.com/pseudosma/flechette/issues).

## License

Copyright (c) 2020 David Paige.  
Released under the MIT license.

