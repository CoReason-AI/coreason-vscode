declare const acquireVsCodeApi: () => any;

let api: any = null;

export const getVsCodeApi = () => {
    if (!api) {
        api = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => {} };
    }
    return api;
};

export const vscodeApi = getVsCodeApi();
