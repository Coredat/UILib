/* eslint-disable no-prototype-builtins */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TemplateResult, html, ifDefined, nothing, repeat } from "..";

export interface IProfiler {
    Id: string;
    Name: string;
    Started: Date;
    DurationMilliseconds: number;
    MachineName: string;
    CustomLinks: { [id: string]: string };
    Root: ITiming;
    ClientTimings: IClientTimings;
    User: string;
    HasUserViewed: boolean;
    // additive on client side
    CustomTimingStats: { [id: string]: ICustomTimingStat };
    HasCustomTimings: boolean;
    HasDuplicateCustomTimings: boolean;
    HasWarning: boolean;
    HasTrivialTimings: boolean;
    AllCustomTimings: ICustomTiming[];
}

interface IClientTimings {
    Timings: ClientTiming[];
    RedirectCount: number;
}

class ClientTiming {
    public Name: string;
    public Start: number;
    public Duration: number | undefined;
    constructor(name: string, start: number, duration?: number) {
        this.Name = name;
        this.Start = start;
        this.Duration = duration;
    }
}

enum ColorScheme {
    Light = 'Light',
    Dark = 'Dark',
    Auto = 'Auto',
}

interface ITiming {
    Id: string;
    Name: string;
    DurationMilliseconds: number;
    StartMilliseconds: number;
    Children: ITiming[];
    CustomTimings: { [id: string]: ICustomTiming[] };
    // additive on client side
    CustomTimingStats: { [id: string]: ICustomTimingStat };
    DurationWithoutChildrenMilliseconds: number;
    DurationOfChildrenMilliseconds: number;
    Depth: number;
    HasCustomTimings: boolean;
    HasDuplicateCustomTimings: { [id: string]: boolean };
    HasWarnings: { [id: string]: boolean };
    IsTrivial: boolean;
    Parent: ITiming | null;
    // added for gaps (TODO: change all this)
    richTiming: IGapTiming[];
    // In debug mode only
    DebugInfo: ITimingDebugInfo;
}

interface ITimingDebugInfo {
    RichHtmlStack: string;
}

interface ICustomTiming {
    Id: string;
    CommandString: string;
    ExecuteType: string;
    StackTraceSnippet: string;
    StartMilliseconds: number;
    DurationMilliseconds: number;
    FirstFetchDurationMilliseconds?: number;
    Errored: boolean;
    // client side:
    Parent: ITiming;
    CallType: string;
    IsDuplicate: boolean;
    // added for gaps
    PrevGap: IGapInfo;
    NextGap: IGapInfo;
}

interface ICustomTimingStat {
    Count: number;
    Duration: number;
}

interface ITimingInfo {
    name: keyof PerformanceTiming;
    description: string;
    lineDescription: string;
    type: string;
    point: boolean;
}

const clientPerfTimings: ITimingInfo[] = [
    // { name: 'navigationStart', description: 'Navigation Start' },
    // { name: 'unloadEventStart', description: 'Unload Start' },
    // { name: 'unloadEventEnd', description: 'Unload End' },
    // { name: 'redirectStart', description: 'Redirect Start' },
    // { name: 'redirectEnd', description: 'Redirect End' },
    ({ name: 'fetchStart', description: 'Fetch Start', lineDescription: 'Fetch', point: true }) as ITimingInfo,
    ({ name: 'domainLookupStart', description: 'Domain Lookup Start', lineDescription: 'DNS Lookup', type: 'dns' }) as ITimingInfo,
    ({ name: 'domainLookupEnd', description: 'Domain Lookup End', type: 'dns' }) as ITimingInfo,
    ({ name: 'connectStart', description: 'Connect Start', lineDescription: 'Connect', type: 'connect' }) as ITimingInfo,
    ({ name: 'secureConnectionStart', description: 'Secure Connection Start', lineDescription: 'SSL/TLS Connect', type: 'ssl' }) as ITimingInfo,
    ({ name: 'connectEnd', description: 'Connect End', type: 'connect' }) as ITimingInfo,
    ({ name: 'requestStart', description: 'Request Start', lineDescription: 'Request', type: 'request' }) as ITimingInfo,
    ({ name: 'responseStart', description: 'Response Start', lineDescription: 'Response', type: 'response' }) as ITimingInfo,
    ({ name: 'responseEnd', description: 'Response End', type: 'response' }) as ITimingInfo,
    ({ name: 'domLoading', description: 'DOM Loading', lineDescription: 'DOM Loading', type: 'dom' }) as ITimingInfo,
    ({ name: 'domInteractive', description: 'DOM Interactive', lineDescription: 'DOM Interactive', type: 'dom', point: true }) as ITimingInfo,
    ({ name: 'domContentLoadedEventStart', description: 'DOM Content Loaded Event Start', lineDescription: 'DOM Content Loaded', type: 'domcontent' }) as ITimingInfo,
    ({ name: 'domContentLoadedEventEnd', description: 'DOM Content Loaded Event End', type: 'domcontent' }) as ITimingInfo,
    ({ name: 'domComplete', description: 'DOM Complete', lineDescription: 'DOM Complete', type: 'dom', point: true }) as ITimingInfo,
    ({ name: 'loadEventStart', description: 'Load Event Start', lineDescription: 'Load Event', type: 'load' }) as ITimingInfo,
    ({ name: 'loadEventEnd', description: 'Load Event End', type: 'load' }) as ITimingInfo,
    // ({ name: 'firstPaintTime', description: 'First Paint', lineDescription: 'First Paint', type: 'paint', point: true }) as ITimingInfo,
    // ({ name: 'firstContentfulPaintTime', description: 'First Content Paint', lineDescription: 'First Content Paint', type: 'paint', point: true }) as ITimingInfo,
];

class ResultRequest {
    public Id: string;
    public Performance?: ClientTiming[];
    public Probes?: ClientTiming[];
    public RedirectCount?: number;
    constructor(id: string, perfTimings: ITimingInfo[]) {
        this.Id = id;
        if (perfTimings && window.performance && window.performance.timing) {
            const resource = window.performance.timing;
            const start = resource.fetchStart;

            this.Performance = perfTimings
                .filter((current) => resource[current.name]!)
                .map((current, i) => ({ item: current, index: i }))
                .sort((a, b) => (<number>resource[a.item.name]) - (<number>resource[b.item.name]) || a.index - b.index)
                .map((x, i, sorted) => {
                    const current = x.item;
                    const next = i + 1 < sorted.length ? sorted[i + 1]!.item : null;

                    return {
                        ...current,
                        ...{
                            startTime: (<number>resource[current.name]) - start,
                            timeTaken: !next ? 0 : (<number>resource[next.name] - <number>resource[current.name]),
                        },
                    };
                })
                .map((item, i) => ({
                    Name: item.name,
                    Start: item.startTime,
                    Duration: item.point ? undefined : item.timeTaken,
                }));

            if (window.performance.navigation) {
                this.RedirectCount = window.performance.navigation.redirectCount;
            }

            if ((<any>window).mPt) {
                const pResults = (<any>window).mPt.results();
                this.Probes = <ClientTiming[]>Object.keys(pResults).map((k) => pResults[k].start && pResults[k].end
                    ? {
                        Name: k,
                        Start: pResults[k].start - start,
                        Duration: pResults[k].end - pResults[k].start,
                    } : null).filter((v) => v);
                (<any>window).mPt.flush();
            }

            if (window.performance.getEntriesByType && window.PerformancePaintTiming) {
                const entries = window.performance.getEntriesByType('paint');
                let firstPaint;
                let firstContentPaint;

                for (const entry of entries) {
                    switch (entry.name) {
                        case 'first-paint':
                            firstPaint = new ClientTiming('firstPaintTime', Math.round(entry.startTime));
                            this.Performance.push(firstPaint);
                            break;
                        case 'first-contentful-paint':
                            firstContentPaint = new ClientTiming('firstContentfulPaintTime', Math.round(entry.startTime));
                            break;
                    }
                }
                if (firstPaint && firstContentPaint && firstContentPaint.Start > firstPaint.Start) {
                    this.Performance.push(firstContentPaint);
                }

            } else if ((<any>window).chrome && (<any>window).chrome.loadTimes) {
                // fallback to Chrome timings
                const chromeTimes = (<any>window).chrome.loadTimes();
                if (chromeTimes.firstPaintTime) {
                    this.Performance.push(new ClientTiming('firstPaintTime', Math.round(chromeTimes.firstPaintTime * 1000 - start)));
                }
                if (chromeTimes.firstPaintAfterLoadTime && chromeTimes.firstPaintAfterLoadTime > chromeTimes.firstPaintTime) {
                    this.Performance.push(new ClientTiming('firstPaintAfterLoadTime', Math.round(chromeTimes.firstPaintAfterLoadTime * 1000 - start)));
                }
            }
        }
    }
}

// Gaps
interface IGapTiming {
    start: number;
    finish: number;
    duration: number;
}

interface IGapInfo {
    start: number;
    finish: number;
    duration: string;
    Reason: IGapReason;
}

interface IGapReason {
    name: string;
    duration: number;
}

const path = "/mini-profiler-resources/"
export const savedJson: IProfiler[] = [];
const trivialMilliseconds = 2
const ignoredDuplicateExecuteTypes = [
    "Open", "OpenAsync", "Close", "CloseAsync"
]
const options = {
    decimalPlaces: 2
}
const showChildrenTime = true
const showTrivial = false

const fetchStatus: Record<string, "Starting fetch" | "Fetch succeeded" | "Fetch complete"> = {}

export function fetchResults(ids: string[]) {
    for (let i = 0; ids && i < ids.length; i++) {
        const id = ids[i];
        const request = new ResultRequest(id!, []);

        if (!id || fetchStatus.hasOwnProperty(id)) {
            continue; // empty id or already fetching
        }

        const isoDate = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)(?:Z|(\+|-)([\d|:]*))?$/;
        const parseDates = (key: string, value: any) =>
            key === 'Started' && typeof value === 'string' && isoDate.exec(value) ? new Date(value) : value;

        fetchStatus[id] = 'Starting fetch';

        fetch(path + 'results', {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .then(data => data.text())
            .then(text => JSON.parse(text, parseDates))
            .then(json => {
                fetchStatus[id] = 'Fetch succeeded';
                if (json instanceof String) {
                    // hidden
                } else {
                    const profiler = json as IProfiler
                    if (profiler.Name !== "/traces HTTP: POST") {
                        savedJson.push(json as IProfiler);
                    }
                }
                fetchStatus[id] = 'Fetch complete';
            })
            .catch(function (error) {
                fetchStatus[id] = 'Fetch complete';
            });
    }
}

export function processJson(profiler: IProfiler) {
    const result: IProfiler = { ...profiler };

    result.CustomTimingStats = {};
    result.CustomLinks = result.CustomLinks || {};
    result.AllCustomTimings = [];

    function processTiming(timing: ITiming, parent: ITiming | null, depth: number) {
        timing.DurationWithoutChildrenMilliseconds = timing.DurationMilliseconds;
        timing.DurationOfChildrenMilliseconds = 0;
        timing.Parent = parent;
        timing.Depth = depth;
        timing.HasDuplicateCustomTimings = {};
        timing.HasWarnings = {};

        for (const child of timing.Children || []) {
            processTiming(child, timing, depth + 1);
            timing.DurationWithoutChildrenMilliseconds -= child.DurationMilliseconds;
            timing.DurationOfChildrenMilliseconds += child.DurationMilliseconds;
        }

        // do this after subtracting child durations
        if (timing.DurationWithoutChildrenMilliseconds < trivialMilliseconds) {
            timing.IsTrivial = true;
            result.HasTrivialTimings = true;
        }

        function ignoreDuplicateCustomTiming(customTiming: ICustomTiming) {
            return customTiming.ExecuteType && ignoredDuplicateExecuteTypes.indexOf(customTiming.ExecuteType) > -1;
        }

        if (timing.CustomTimings) {
            timing.CustomTimingStats = {};
            timing.HasCustomTimings = true;
            result.HasCustomTimings = true;
            for (const customType of Object.keys(timing.CustomTimings)) {
                const customTimings = timing.CustomTimings[customType] || [] as ICustomTiming[];
                const customStat = {
                    Duration: 0,
                    Count: 0,
                };
                const duplicates: { [id: string]: boolean } = {};
                for (const customTiming of customTimings) {
                    // Add to the overall list for the queries view
                    result.AllCustomTimings.push(customTiming);
                    customTiming.Parent = timing;
                    customTiming.CallType = customType;

                    customStat.Duration += customTiming.DurationMilliseconds;

                    const ignored = ignoreDuplicateCustomTiming(customTiming);
                    if (!ignored) {
                        customStat.Count++;
                    }
                    if (customTiming.Errored) {
                        timing.HasWarnings[customType] = true;
                        result.HasWarning = true;
                    }

                    if (customTiming.CommandString && duplicates[customTiming.CommandString]) {
                        customTiming.IsDuplicate = true;
                        timing.HasDuplicateCustomTimings[customType] = true;
                        result.HasDuplicateCustomTimings = true;
                    } else if (!ignored) {
                        duplicates[customTiming.CommandString] = true;
                    }
                }
                timing.CustomTimingStats[customType] = customStat;
                if (!result.CustomTimingStats[customType]) {
                    result.CustomTimingStats[customType] = {
                        Duration: 0,
                        Count: 0,
                    };
                }
                result.CustomTimingStats[customType]!.Duration += customStat.Duration;
                result.CustomTimingStats[customType]!.Count += customStat.Count;
            }
        } else {
            timing.CustomTimings = {};
        }
    }

    processTiming(result.Root, null, 0);
    processCustomTimings(result);

    return result;
}

function processCustomTimings(profiler: IProfiler) {
    const result = profiler.AllCustomTimings;

    result.sort((a, b) => a.StartMilliseconds - b.StartMilliseconds);

    function removeDuration(list: IGapTiming[], duration: IGapTiming) {

        const newList: IGapTiming[] = [];
        for (const item of list) {
            if (duration.start > item.start) {
                if (duration.start > item.finish) {
                    newList.push(item);
                    continue;
                }
                newList.push(({ start: item.start, finish: duration.start }) as IGapTiming);
            }

            if (duration.finish < item.finish) {
                if (duration.finish < item.start) {
                    newList.push(item);
                    continue;
                }
                newList.push(({ start: duration.finish, finish: item.finish }) as IGapTiming);
            }
        }

        return newList;
    }

    function processTimes(elem: ITiming) {
        const duration = ({ start: elem.StartMilliseconds, finish: (elem.StartMilliseconds + elem.DurationMilliseconds) }) as IGapTiming;
        elem.richTiming = [duration];
        if (elem.Parent != null) {
            elem.Parent.richTiming = removeDuration(elem.Parent.richTiming, duration);
        }

        for (const child of elem.Children || []) {
            processTimes(child);
        }
    }

    processTimes(profiler.Root);
    // sort results by time
    result.sort((a, b) => a.StartMilliseconds - b.StartMilliseconds);

    function determineOverlap(gap: IGapInfo, node: ITiming) {
        let overlap = 0;
        for (const current of node.richTiming) {
            if (current.start > gap.finish) {
                break;
            }
            if (current.finish < gap.start) {
                continue;
            }

            overlap += Math.min(gap.finish, current.finish) - Math.max(gap.start, current.start);
        }
        return overlap;
    }

    function determineGap(gap: IGapInfo, node: ITiming, match?: IGapReason | null): IGapReason {
        const overlap = determineOverlap(gap, node);
        if (match == null || overlap > match.duration) {
            match = { name: node.Name, duration: overlap };
        } else if (match.name === node.Name) {
            match.duration += overlap;
        }

        for (const child of node.Children || []) {
            match = determineGap(gap, child, match);
        }
        return match;
    }

    let time = 0;
    result.forEach((elem) => {
        elem.PrevGap = {
            duration: (elem.StartMilliseconds - time).toFixed(2),
            start: time,
            finish: elem.StartMilliseconds,
        } as IGapInfo;

        elem.PrevGap.Reason = determineGap(elem.PrevGap, profiler.Root, null);

        time = elem.StartMilliseconds + elem.DurationMilliseconds;
    });


    if (result.length > 0) {
        const me = result[result.length - 1]!;
        me.NextGap = {
            duration: (profiler.Root.DurationMilliseconds - time).toFixed(2),
            start: time,
            finish: profiler.Root.DurationMilliseconds,
        } as IGapInfo;
        me.NextGap.Reason = determineGap(me.NextGap, profiler.Root, null);
    }

    return result;
}

export function renderProfiler(json: IProfiler, isNew: boolean): TemplateResult {
            const p = processJson(json);
            const duration = (milliseconds: number | undefined, decimalPlaces?: number) => {
                if (milliseconds === undefined) {
                    return '';
                }
                return (milliseconds || 0).toFixed(decimalPlaces === undefined ? options.decimalPlaces : decimalPlaces);
            };

            const renderDebugInfo = (timing: ITiming): TemplateResult => {
                if (timing.DebugInfo) {
                    const customTimings = repeat(p.CustomTimingStats ? Object.keys(p.CustomTimingStats) : [], (tk) => tk, (tk) => timing.CustomTimings[tk] ? html`
                <div class="mp-nested-timing">
                    <span class="mp-duration">${timing.CustomTimingStats[tk]!.Count}</span> ${tk} call${timing.CustomTimingStats[tk]!.Count == 1 ? '' : 's'} 
                    totalling <span class="mp-duration">${duration(timing.CustomTimingStats[tk]!.Duration)}</span> <span class="mp-unit">ms</span>
                    ${((timing.HasDuplicateCustomTimings[tk] || timing.HasWarnings[tk]) ? '<span class="mp-warning">(duplicates deletected)</span>' : '')}
                </div>` : nothing);

                    return html`
          <div class="mp-debug-tooltip">
            <div class="mp-name">Detailed info for ${timing.Name}</div>
            <div>Starts at: <span class="mp-duration">${duration(timing.StartMilliseconds)}</span> <span class="mp-unit">ms</span></div>
            <div>
                Overall duration (with children): <span class="mp-duration">${duration(timing.DurationMilliseconds)}</span> <span class="mp-unit">ms</span>
                <div class="mp-nested-timing">
                  Self duration: <span class="mp-duration">${duration(timing.DurationWithoutChildrenMilliseconds)}</span> <span class="mp-unit">ms</span>
                  ${customTimings}
                </div>
                <div class="mp-nested-timing">
                  Children (${timing.Children ? timing.Children.length : '0'}) duration: <span class="mp-duration">${duration(timing.DurationOfChildrenMilliseconds)}</span> <span class="mp-unit">ms</span>
                </div>
            </div>
            <div>Stack:</div>
            <pre class="mp-stack-trace">${timing.DebugInfo.RichHtmlStack}</pre>
          </div>
          <span title="Debug Info">🔍</span>`;
                }
                return nothing;
            };

            const renderTiming = (timing: ITiming): TemplateResult => {
                const customTimingTypes = p.CustomTimingStats ? Object.keys(p.CustomTimingStats) : [];
                return html`
  <tr class="${timing.IsTrivial ? 'mp-trivial' : ''}${timing.DebugInfo ? ' mp-debug' : ''}" data-timing-id="${timing.Id}">
    <td>${renderDebugInfo(timing)}</td>
    <td class="mp-label" title="${timing.Name}" data-padding-left=${ifDefined(timing.Depth > 0 ?  `${timing.Depth * 11}px` : undefined)}>
      ${timing.Name}
    </td>
    <td class="mp-duration" title="duration of this step without any children's durations">
      ${duration(timing.DurationWithoutChildrenMilliseconds)}
    </td>
    <td class="mp-duration mp-more-columns" title="duration of this step and its children">
      ${duration(timing.DurationMilliseconds)}
    </td>
    <td class="mp-duration mp-more-columns time-from-start" title="time elapsed since profiling started">
      <span class="mp-unit">+</span>${duration(timing.StartMilliseconds)}
    </td>
    ${repeat(customTimingTypes, (tk) => tk, (tk) => timing.CustomTimings[tk] ? html`
    <td class="mp-duration">
      <a class="mp-queries-show${(timing.HasWarnings[tk] ? ' mp-queries-warning' : '')}" title="${duration(timing.CustomTimingStats[tk]!.Duration)} ms in ${timing.CustomTimingStats[tk]!.Count} ${tk} call(s)${timing.HasDuplicateCustomTimings[tk] ? '; duplicate calls detected!' : ''}">
        ${duration(timing.CustomTimingStats[tk]!.Duration)}
        (${timing.CustomTimingStats[tk]!.Count}${((timing.HasDuplicateCustomTimings[tk] || timing.HasWarnings[tk]) ? '<span class="mp-warning">!</span>' : '')})
      </a>
    </td>` : html`<td></td>`)}
  </tr>
                ${repeat(timing.Children ?? <ITiming[]>[], (timing) => timing.Id, renderTiming)}
  `;
            };

            const timingsTable = html`
        <table class="mp-timings">
          <thead>
            <tr>
              <th colspan="2"></th>
              <th>duration (ms)</th>
              <th class="mp-more-columns">with children (ms)</th>
              <th class="time-from-start mp-more-columns">from start (ms)</th>
              ${repeat(Object.keys(p.CustomTimingStats), (k) => k, (k) => html`<th title="call count">${k} (ms)</th>`)}
            </tr>
          </thead>
          <tbody>
            ${renderTiming(p.Root)}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3"></td>
              <td class="mp-more-columns" colspan="2"></td>
            </tr>
          </tfoot>
        </table>`;

            const customTimings = (): TemplateResult => {
                if (!p.HasCustomTimings) {
                    return nothing;
                }
                return html`
        <table class="mp-custom-timing-overview">
            ${Object.getOwnPropertyNames(p.CustomTimingStats).map((key) => html`
          <tr title="${p.CustomTimingStats[key]!.Count} ${key.toLowerCase()} calls spent ${duration(p.CustomTimingStats[key]!.Duration)} ms of total request time">
            <td class="mp-number">
              ${key}:
            </td>
            <td class="mp-number">
              ${duration(p.CustomTimingStats[key]!.Duration / p.DurationMilliseconds * 100)} <span class="mp-unit">%</span>
            </td>
          </tr>`)}
        </table>`;
            };

            const clientTimings = (): TemplateResult => {
                if (!p.ClientTimings) {
                    return nothing;
                }

                let end = 0;
                const list = p.ClientTimings.Timings.map((t) => {
                    const results = clientPerfTimings ? clientPerfTimings.filter((pt: ITimingInfo) => pt.name === t.Name) : [];
                    const info: ITimingInfo | null | undefined = results.length > 0 ? results[0] : null;
                    end = Math.max(end, t.Start + t.Duration!);

                    return {
                        isTrivial: t.Start === 0 || t.Duration! < 2, // all points are considered trivial
                        name: info && info.lineDescription || t.Name,
                        duration: info && info.point ? undefined : t.Duration,
                        type: info && info.type || 'unknown',
                        point: info && info.point,
                        start: t.Start,
                        left: "",
                        width: "",
                    };
                });
                p.HasTrivialTimings = p.HasTrivialTimings || list.some((t) => t.isTrivial);

                list.sort((a, b) => a.start - b.start);
                list.forEach((l) => {
                    const percent = (100 * l.start / end) + '%';
                    l.left = l.point ? `calc(${percent} - 2px)` : percent;
                    l.width = l.point ? `4px` : (100 * l.duration! / end + '%');
                });

                return html`
        <table class="mp-timings mp-client-timings">
          <thead>
            <tr>
              <th>client event</th>
              <th></th>
              <th>duration (ms)</th>
              <th class="mp-more-columns">from start (ms)</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((t) => html`
            <tr class="${(t.isTrivial ? 'mp-trivial' : '')}">
              <td class="mp-label">${t.name}</td>
              <td class="t-${t.type}${t.point ? ' t-point' : ''}"><div data-margin-left="${t.left}" data-width="${t.width}"></div></td>
              <td class="mp-duration">
                ${(t.duration! >= 0 ? `<span class="mp-unit"></span>${duration(t.duration, 0)}` : '')}
              </td>
              <td class="mp-duration time-from-start mp-more-columns">
                <span class="mp-unit">+</span>${duration(t.start, 0)}
              </td>
            </tr>`)}
          </tbody>
        </table>`;
            }

            const profilerQueries = (): TemplateResult => {
                if (!p.HasCustomTimings) {
                    return nothing;
                }

                const renderGap = (gap: IGapInfo) => gap && gap.Reason.duration > 0.02 ? html`
  <tr class="mp-gap-info ${(gap.Reason.duration < 4 ? 'mp-trivial-gap' : '')}">
    <td class="mp-info">
      ${gap.duration} <span class="mp-unit">ms</span>
    </td>
    <td class="query">
      <div>${gap.Reason.name} &mdash; ${gap.Reason.duration.toFixed(2)} <span class="mp-unit">ms</span></div>
    </td>
  </tr>` : nothing;

                return html`
    <div class="mp-queries">
      <table>
        <thead>
          <tr>
            <th>
              <div class="mp-call-type">Call Type</div>
              <div>Step</div>
              <div>Duration <span class="mp-unit">(from start)</span></div>
            </th>
            <th>
              <div class="mp-stack-trace">Call Stack</div>
              <div>Command</div>
            </th>
          </tr>
        </thead>
        <tbody>
          ${repeat(p.AllCustomTimings, (ct, index) => html`
            ${renderGap(ct.PrevGap)}
            <tr class="${(index % 2 === 1 ? 'mp-odd' : '')}" data-timing-id="${ct.Parent.Id}">
              <td>
                <div class="mp-call-type${(ct.Errored ? ' mp-warning' : '')}">${ct.CallType}${!ct.ExecuteType || ct.CallType === ct.ExecuteType ? '' : ' - ' + ct.ExecuteType}${((ct.IsDuplicate || ct.Errored) ? ' <span class="mp-warning" title="Duplicate">!</span>' : '')}</div>
                <div>${ct.Parent.Name}</div>
                <div class="mp-number">
                  ${duration(ct.DurationMilliseconds)} <span class="mp-unit">ms (T+${duration(ct.StartMilliseconds)} ms)</span>
                </div>
                ${(ct.FirstFetchDurationMilliseconds ? html`<div>First Result: ${duration(ct.FirstFetchDurationMilliseconds)} <span class="mp-unit">ms</span></div>` : nothing)}
              </td>
              <td>
                <div class="query">
                  <div class="mp-stack-trace">${ct.StackTraceSnippet}</div>
                  <pre><code>${ct.CommandString}</code></pre>
                </div>
              </td>
            </tr>
            ${renderGap(ct.NextGap)}`)}
        </tbody>
      </table>
      <p class="mp-trivial-gap-container">
        <a class="mp-toggle-trivial-gaps" href="#">toggle trivial gaps</a>
      </p>
    </div>`;
            }

            return html`
  <div class="mp-result${(showTrivial ? ' show-trivial' : '')}${(showChildrenTime ? ' show-columns' : '')}${(isNew ? ' new' : '')}">
    <div class="mp-button${(p.HasWarning ? ' mp-button-warning' : '')}" title="${p.Name}">
      <span class="mp-number">${duration(p.DurationMilliseconds)} <span class="mp-unit">ms</span></span>
      ${((p.HasDuplicateCustomTimings || p.HasWarning) ? '<span class="mp-warning">!</span>' : '')}
    </div>
    <div class="mp-popup">
      <div class="mp-info">
        <div>
          <div class="mp-name">${p.Name}</div>
          <div class="mp-machine-name">${p.MachineName}</div>
        </div>
        <div>
          <div class="mp-overall-duration">(${duration(p.DurationMilliseconds)} ms)</div>
          <div class="mp-started">${p.Started ? p.Started.toUTCString() : ''}</div>
        </div>
      </div>
      <div class="mp-output">
        ${timingsTable}
		${customTimings()}
        ${clientTimings()}
        <div class="mp-links">
          <a href="${path}results?id=${p.Id}" class="mp-share-mp-results" target="_blank">share</a>
          ${Object.keys(p.CustomLinks).map((k) => html`<a href="${p.CustomLinks[k]}" class="mp-custom-link" target="_blank">${k}</a>`)}
  		  <span>
            <a class="mp-toggle-columns" title="shows additional columns">more columns</a>
            <a class="mp-toggle-columns mp-more-columns" title="hides additional columns">fewer columns</a>
            ${(p.HasTrivialTimings ? html`
            <a class="mp-toggle-trivial" title="shows any rows with &lt; ${trivialMilliseconds} ms duration">show trivial</a>
            <a class="mp-toggle-trivial mp-trivial" title="hides any rows with &lt; ${trivialMilliseconds} ms duration">hide trivial</a>` : nothing)}
          </span>
        </div>
      </div>
    </div>
    ${profilerQueries()}
  </div>`;
}