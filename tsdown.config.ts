import { defineConfig } from 'tsdown'

/** The browser module id must equal the package name (client-modules contract). */
const PACKAGE_ID = 'dsh-deepblue-hud'

/**
 * Envelope expected by `window.__ModuleLoader__` for an installed Client half:
 * a lazy factory that returns the plugin's module exports. The generated
 * CommonJS body already uses `require(...)` and assigns to `exports`, so the
 * wrapper only has to supply both names and return the exports object.
 */
const loaderBanner = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(PACKAGE_ID)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  '\t\t//#region dbh-bundle-body',
  '',
].join('\n')

const loaderFooter = ['', '\t\treturn module.exports;', '\t}', '});', ''].join('\n')

export default defineConfig([
  {
    // Host half: an ESM module the Loader imports when it mounts the row.
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    dts: true,
    sourcemap: true,
    clean: true,
    outExtensions: () => ({ js: '.js' }),
  },
  {
    // Client half: CommonJS body wrapped in the module-loader envelope.
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2020',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: { neverBundle: ['react', 'react/jsx-runtime'] },
    outExtensions: () => ({ js: '.js' }),
    banner: { js: loaderBanner },
    footer: { js: loaderFooter },
  },
])
