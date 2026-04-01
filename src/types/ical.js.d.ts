declare module 'ical.js' {
  export function parse(input: string): unknown[];

  export class Component {
    constructor(jCal: unknown[] | string);
    getAllSubcomponents(name: string): Component[];
    getFirstPropertyValue(name: string): unknown;
  }

  export class Event {
    constructor(component: Component);
    uid: string;
    summary: string;
    location: string;
    description: string;
    startDate: Time;
    endDate: Time;
    duration: Duration;
    isRecurring(): boolean;
    iterator(startTime?: Time): RecurExpansion;
  }

  export class Time {
    isDate: boolean;
    constructor(data?: Record<string, unknown>);
    static fromJSDate(date: Date, useUTC?: boolean): Time;
    static fromDateTimeString(str: string): Time;
    toJSDate(): Date;
    toICALString(): string;
    compare(other: Time): number;
    clone(): Time;
    addDuration(duration: Duration): void;
  }

  export class Duration {
    constructor(data?: Record<string, unknown>);
    toSeconds(): number;
  }

  export class RecurExpansion {
    next(): Time;
    complete: boolean;
  }
}
