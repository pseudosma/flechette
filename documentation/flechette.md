# Flechette objects and paradigms

Flechette exposes the following interfaces, types, and functions to users:

## configureFlechette

The function used to create or alter a Flechette instance is called ***configureFlechette***. It accepts the ***Flechette*** interface as its parameter. Once it creates a new object, it stores it on the *window* object and returns the object it has created (though this can be discarded in most cases).

```typescript
export const configureFlechette = (i?: Flechette): FlechetteController => {};
```

## Flechette

The Flechette interface used with configureFlechette

```typescript
export interface Flechette {
  successCodes?: Array<number | string>;
  retryActions?: Array<RetryAction>;
  timeout?: number;
  maxTimeoutRetryCount?: number;
  baseUrl?: string;
  headers?: Headers;
  instanceName?: string;
}
```
---
**NOTE**

  * If you do not specify an instanceName, the name "flechette" will be used.
  * successCodes accepts both individual numbers or a range of numbers as a string separated by a hyphen.

---

## FlechetteController

The object stored and returned by configureFlechette is called the FlechetteController.

```typescript
export class FlechetteController {
  public successCodes: Array<number | string> = ["200-399"];
  public retryActions: Array<RetryAction> = defaultRetryActions;
  public timeout: number = 30000;
  public maxTimeoutRetryCount: number = 2;
  public baseUrl: string = "";
  public headers: Headers | string[][] | Record<string, string> | undefined;
  public instanceName: string = "flechette";
  public abortController = new AbortController();

  public abortCurrentFetch() {
    this.abortController.abort();
  }
}
```
---
**NOTE**

  The defaultRetryActions resends the request *once* in case the response has the HTTP status code **408**, **429**, or **504**.

---

## RetryAction

The *retryActions* property of the FlechetteController class are an array of objects that conform to the RetryAction interface.

```typescript
export interface RetryAction {
  code: number;
  action: RetryFunc;
  pathsToIgnore?: Array<string>;
}
```
---
**NOTE**

  The *pathsToIgnore* property is used to indicate any endpoint that should not use this retry action. During retries, Flechette will temporarily put the current path in the RetryAction to prevent infinite looping if the same request has already encountered this same error code. After the successFunc or failureFunc is ran, it will restore the *pathsToIgnore* to its original value.

---

## RetryFunc

The RetryFunc is the action used in a RetryAction.

```typescript
export type RetryFunc = (
  response: FlechetteResponse,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc
) => void;
```

## send

The ***send*** function is Flechette's exported fetch wrapper.

```typescript
export const send = (
  args: SendArgs | Array<SendArgs>,
  successFunc: ResponseFunc,
  failureFunc: ResponseFunc,
  waitingFunc?: ToggleFunc): void => {
```

---
**NOTE**

  Calling ***send*** without configuring Flechette will create or reuse a global instance with the default configuration shown with **FlechetteController**.

---

## SendArgs

```typescript
export interface SendArgs extends RequestInit {
  path: string;
  instanceName?: string;
  retryActions?: Array<RetryAction>;
}
```
---
**NOTE**

* The *instanceName* on **SendArgs** must match a flechette instance. If the value is omitted, the default name "flechette" is assumed.
* The *retryActions* and *headers* associated with the **SendArgs** will override the Flechette instance's retryActions and headers.
* As each SendArg's *retryAction* is executed, it is removed from the object to prevent looping in the case that the same response is received twice.

---

## ResponseFunc

```typescript
export type ResponseFunc = (
  response: FlechetteResponse | Array<FlechetteResponse>
) => void;
```

## ToggleFunc

```typescript
export type ToggleFunc = (isWaiting: boolean) => void;
```

## FlechetteResponse

The FlechetteResponse is passed into both the success and failure callbacks.

```typescript
export interface FlechetteResponse {
  success: boolean;
  statusCode: number;
  response: any;
  sent: SendArgs;
}
```

---

# Using "send"

Flechette's ***send*** allows sending multiple requests together at once. If an array of SendArgs is passed into the function, it'll return (through its callbacks) an array of FlechetteResponses rather than a single FlechetteResponse.

## Order of operations

The events that occur within a ***send*** call are:

1. The base URL from the FlechetteController is added to the request, if it isn't already present.
2. The headers included with the SendArgs are combined with the FlechetteController's headers. If any are duplicates, the version from SendArgs overrides the instance's base headers.
3. The waiting callback is triggered, passing in *true*.
4. Fetch is called for all SendArgs.
5. All responses are evaluated based on the FlechetteController's *successCodes* to determine success or failure.
6. If failure occurs based on the codes, check if any retry actions are applicable
  * RetryActions in the SendArgs are used before RetryActions on the FlechetteController.  
  * Retry any failed actions. If all are successful after all retries, the request ends using the success callback, otherwise the failure callback is used.
7. The waiting callback is triggered, passing in *false*.
8. Run success or failure callback if no retries happened earlier.

* If the requests go past the timeout limit before completing these steps, it'll abort the original requests. It can optionally retry the whole request again, but if there is never a network response, the failure/end waiting callbacks are ran.

# Best Practices

## Do's

* If your RetryAction just needs to resend the data, call ***send*** again from inside your RetryAction, passing the SendArgs, success, and failure callbacks back in. Flechette is designed around this kind of recursion for retries and has mechanisms in place to prevent infinite loops.

* A RetryAction does not need to call ***send*** again, but it must always end by calling either the success or failure callback passed in. Always signal to Flechette that the action is finished by calling success or failure, otherwise it'll appear to be waiting forever to complete.
  
* The optional waiting callback on ***send*** is meant to be used to lock UI elements while the current request is processing. Making an identical request before the results are back from the first can produce unexpected results.
  
* Counting the number of waiting callbacks can be used as a method to keep track of timeouts and the retries associated with those. Each retried timeout with will trigger a new ***send*** operation that'll fire the waiting callback again, passing in *true*.

## Don'ts

* Don't reuse the same SendArgs object for all of the outgoing requests. Flechette will modify the original SendArgs while processing (adding baseUrl to path, removing RetryActions), so it's best to throw them away after use.

* If using local retry actions, don't reuse the same array of RetryActions across multiple copies of SendArgs. Instead create new ones for each call. Global RetryActions use the "pathsToIgnore" prop to prevent looping and enforce the single use but local actions just remove retry actions as they are acted upon to enforce single use. Reusing these on multiple SendArgs without cloning each object can result in some RetryActions being lost across calls.

* Avoid manipulating the window-level FlechetteController objects directly. Instead, always call ***configureFlechette***, even for simple updates to an existing Flechette instance.
  
* Flechette manipulates the FlechetteController during ***send*** in order to track retries. Because it also allows recursion, it doesn't have any built-in mutex locking mechanisms that'd prevent you from calling ***configureFlechette*** in the middle of a ***send*** operation. Reconfiguring in the middle of any pending ***send*** calls can produce unexpected results.

