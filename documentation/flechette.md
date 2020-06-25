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

  If you do not specify an instanceName, the name "flechette" will be used.

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

  The ***pathsToIgnore*** property is used to indicate any endpoint that should not use this retry action. During retries, Flechette will temporarily put the current path in the RetryAction to prevent infinite looping if the same request has already encountered this same error code. After the successFunc or failureFunc is ran, it will restore the ***pathsToIgnore*** to its original value.

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

* The **instanceName** on *SendArgs* must match a flechette instance. If the value is omitted, the default name "flechette" is assumed.
* The *retryActions* and *headers* associated with the *SendArgs* will override the Flechette instance's retryActions and headers.
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

* send will return an array of responses if you pass in an array of requests

## Order of operations

* add base url to the request
* combine or override headers
* toggle waiting on
* fetch all requests
* evaluate the response(s) to determine if success or failure
* If failure, check if any retry actions are applicable
  * Local retries override global ones
  * Retry any failed actions. If all are successful after all retries , the request uses success callback, otherwise use failure callback.
* toggle waiting off
* run success or failure callback

# Best Practices

## Do's

* always call the success or failure callback when done with a retry action, otherwise it'll appear to be waiting forever to complete

* if your retry action just needs to retry, pass the vars into a new send call. It's designed to allow recursion w/o looping

## Don'ts

* Don't reuse the same sendArgs for multiple calls. Flechette will modify the original sendArgs while processing (adding baseUrl to path, removing retryActions), so it's best to throw them away after use.

* if using local retry actions, don't reuse the same array of RetryActions across multiple sendArgs. Instead create new ones for each call. Global retryActions use the "pathsToIgnore" prop to prevent looping and enforce the "one time use" but local actions just remove retry actions as they are acted upon to enforce "one time use". Reusing these on multiple sendArgs without shallow cloning each can result in some retry actions being

* It is possible to change values by inspecting the window-level objects but doing so in the middle of network calls (like in a retry action) can produce unexpected results. Instead, if you need to change a Flechette instance's config settings, use configureFlechette with the old instance name as if you're creating a new config. 

