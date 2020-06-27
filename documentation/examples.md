## Examples

### Basics

#### A basic request

```typescript
    import { FlechetteResponse, ResponseFunc, send, SendArgs } from "flechette"

    const args: SendArgs = { path: "https://www.google.com", method: "GET" };
    const onSuccessOrFailure: ResponseFunc = (res: FlechetteResponse|FlechetteResponse[]) => {
        console.log((res as FlechetteResponse).response);
    };

    send(args, onSuccessOrFailure, onSuccessOrFailure);
```

#### A basic request with headers

```typescript
    import { FlechetteResponse, send, SendArgs } from "flechette"

    const args: SendArgs = { 
        path: "https://www.google.com", 
        method: "GET" ,
        headers: new Headers({ "Content-Type" : "text/html; charset=UTF-8"});
    };

    send(
        args, 
        (res) => {
            console.log((res as FlechetteResponse).response);
        }, 
        (res) => {
            console.log("failure");
        }
    );
```

#### A multi-request

```typescript
    import { FlechetteResponse, send, SendArgs } from "flechette"

    const args: SendArgs[] = [{ 
        path: "https://www.w3schools.com/", 
        method: "GET" 
    },{
        path: "https://developer.mozilla.org/en-US/", 
        method: "GET" 
    }];

    send(
        args, 
        (res) => {
            (res as FlechetteResponse[]).forEach((r) => {
                if (r.sent.path === "https://www.w3schools.com/") {
                    console.log("W3Schools response: " + r.response);
                } else {
                    console.log("MDN response: " + r.response);
                }
            })
        }, 
        (res) => {
            console.log("failure");
        },
        (bool) => {
            if (bool) {
                console.log("begin waiting");
            } else {
                console.log("end waiting");
            };
        }
    );
```

---

### Customizing Flechette

#### Initializing a new Flechette instance

```typescript
    import { configureFlechette } from "flechette"

    configureFlechette({
        baseUrl: "https://www.google.com",
        headers: new Headers({ "Authorization" : "Basic YWxhZGRpbjpvcGVuc2VzYW1l"})
    });
```

#### Working with more than one Flechette instance

```typescript
    import { configureFlechette, send, SendArgs } from "flechette"

    configureFlechette({
        instanceName: "google",
        baseUrl: "https://www.google.com/",
        headers: new Headers({ "Authorization" : "Basic xyz"})
    });
    configureFlechette({
        instanceName: "W3",
        baseUrl: "https://www.w3schools.com/",
        headers: new Headers({ "Authorization" : "Basic 1234567890"})
    });

    const googleArgs: SendArgs = { instanceName: "google", path: "privacy?fg=1" };
    const w3Args: SendArgs = { instanceName: "W3", path: "js/default.asp" };

    send(
        [googleArgs,w3Args], 
        (res) => { console.log("success") },
        (res) => { console.log("failure") }
    );
```

#### Changing the default timeout

```typescript
    import { configureFlechette } from "flechette"

    configureFlechette({
        defaultTimeout: 20000,
        defaultTimeoutRetryCount = 1;
    });
```

#### Setting success status codes

```typescript
    import { configureFlechette } from "flechette"

    configureFlechette({
        instanceName: "flechette",
        defaultSuccessCodes: ["200-299", "301-399", 418, "103"]
    });
```

### Advanced

#### Creating retry actions

```typescript
    import { 
        configureFlechette,
        FlehetteResponse,
        ResponseFunc, 
        RetryAction, 
        RetryFunc 
    } from "flechette"

    // this illustrates a retry action for a token refresh and 
    // resend of the original request if a 401 was returned

    const rf: RetryFunc = (res, success: ResponseFunc, failure: ResponseFunc) => {
        send(
            { path: "/tokenRefresh", method: "POST", body: "secret" },
            (resp) => {
                const newAuthTokenValue = "Bearer " + (resp as FlechetteResponse).response;
                send(
                    { 
                        path: (res as FlechetteResponse).sent.path,
                        method: (res as FlechetteResponse).sent.method,
                        body: (res as FlechetteResponse).sent.body,
                        headers: new Headers({ "Authorization" : newAuthTokenValue })
                    },
                    success, 
                    failure
                );
            },
            failure
        );
    }
    const ra: RetryAction = {code: 401, action: rf}

    configureFlechette({
        retryActions: [ra]
    });
```