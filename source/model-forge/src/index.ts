/** Library entry: the one-model editor's contracts, pure edits, document store and CLI. */
export * from './domain/document.js';
export * from './domain/schemas.js';
export { discoverCatalog } from './domain/catalog.js';
export { errorRemedies } from './domain/errors.js';
export * from './application/document.js';
export * from './application/edit.js';
export * from './application/inspect.js';
export * from './application/import.js';
export * from './infra/store.js';
export * from './infra/importers.js';
export * from './infra/exporters.js';
export { createCli, type CliIdentity } from './commands/create-cli.js';
export { VERSION } from './version.js';
