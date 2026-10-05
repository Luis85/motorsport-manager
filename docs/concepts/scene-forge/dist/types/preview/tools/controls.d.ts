export declare function input(parent: HTMLElement, label: string, type?: string, value?: string, attributes?: Record<string, string>): HTMLInputElement;
export declare function select(parent: HTMLElement, label: string, options: [string, string][]): HTMLSelectElement;
export declare function action(parent: HTMLElement, label: string, click: () => void, signal: AbortSignal): HTMLButtonElement;
export declare function note(parent: HTMLElement, text: string): HTMLParagraphElement;
