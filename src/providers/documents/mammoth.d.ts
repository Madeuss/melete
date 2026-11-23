/** The part of mammoth's standalone browser build the CV reader uses (the package has no types). */
declare module 'mammoth/mammoth.browser.js' {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
}
