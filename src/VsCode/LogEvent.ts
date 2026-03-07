export interface LogEvent {
    createdAt: Date;
    event: unknown;
}

export function createLogEvent(event: unknown): LogEvent {
    return { createdAt: new Date(), event };
}
