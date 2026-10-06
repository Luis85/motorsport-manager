export const $ = (id: string) => document.getElementById(id)!;
export const field = (id: string) => $(id) as HTMLInputElement;
export const button = (id: string) => $(id) as HTMLButtonElement;
