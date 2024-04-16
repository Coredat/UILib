import { ModuleRegistry, NotificationCallback } from './moduleRegistry';
import { HotModule, ModuleUpdater } from './hotModule';

export const enum MessageType {
    CHANGE = 'change'
}

export interface Message {
    type: MessageType.CHANGE;
    url: string;
    mtime: number;
}

const registry = new ModuleRegistry({
    fullReload: () => window.location.reload(),
    moduleLoader: path => {
        const url = new URL(path)

        return import(path)
    },
    moduleFactory: (url: string, exportNames: string[], updateExports?: ModuleUpdater) => {
        return new HotModule(url, exportNames, updateExports);
    }
});

const websocket = new WebSocket("__WEBSOCKET_URL__");
websocket.addEventListener('message', async event => {
    const parsed = JSON.parse(event.data);
    switch (parsed.type) {
        case MessageType.CHANGE:
            await registry.update(parsed.url, parsed.mtime);
            break;
    }
});

function hot(moduleUrl: string) {
    const originalModuleUrl = getOriginalUrl(moduleUrl);
    return {
        accept(dependecies: string[], callback: NotificationCallback) {
            for (const dependecy of dependecies) {
                registry.accept(new URL(dependecy, originalModuleUrl).href, callback);
            }
            return this;
        },

        dispose(callback: NotificationCallback) {
            registry.dispose(originalModuleUrl, callback);
            return this;
        },

        selfAccept() {
            // tslint:disable-next-line:no-empty
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            registry.accept(originalModuleUrl, () => { });
            return this;
        }
    };
}

function getOriginalUrl(url: string): string {
    const urlObject = new URL(url);
    urlObject.searchParams.delete('mtime');
    return urlObject.href;
}

registry.registerModule(
    "https://localhost:5001/style.css",
    [],
    []
)

console.log("test")

export { registry, hot };