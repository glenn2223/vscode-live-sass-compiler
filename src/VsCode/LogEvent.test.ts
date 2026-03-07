import * as assert from "assert";
import { LogEvent, createLogEvent } from "./LogEvent";

suite("LogEvent", function () {
    test("createLogEvent returns object with createdAt and event", () => {
        const before = new Date();
        const logEvent = createLogEvent({ test: true });
        const after = new Date();

        assert.ok(logEvent.createdAt >= before);
        assert.ok(logEvent.createdAt <= after);
        assert.deepStrictEqual(logEvent.event, { test: true });
    });

    test("createLogEvent with string event", () => {
        const logEvent = createLogEvent("error message");

        assert.equal(logEvent.event, "error message");
        assert.ok(logEvent.createdAt instanceof Date);
    });

    test("createLogEvent with null event", () => {
        const logEvent = createLogEvent(null);

        assert.equal(logEvent.event, null);
    });

    test("createLogEvent with complex object", () => {
        const detail = {
            error: new Error("test"),
            stack: "stack trace",
            files: ["/a.scss", "/b.scss"],
        };
        const logEvent = createLogEvent(detail);

        assert.deepStrictEqual(logEvent.event, detail);
    });

    test("LogEvent interface shape is correct", () => {
        const event: LogEvent = {
            createdAt: new Date(),
            event: "some data",
        };

        assert.ok("createdAt" in event);
        assert.ok("event" in event);
    });
});
