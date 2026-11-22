/** The parts of @echogarden/espeak-ng-emscripten (no bundled types) the Kokoro worker uses. */
declare module '@echogarden/espeak-ng-emscripten' {
  export interface EspeakNgWorker {
    /** espeak-ng voice name, e.g. 'pt-br'. Returns 0 on success. */
    set_voice(name: string): number
    /** Text → IPA phonemes (code 0 on success). */
    synthesize_ipa(text: string): { code: number; ipa: string }
  }
  interface EspeakNgModule {
    eSpeakNGWorker: new () => EspeakNgWorker
  }
  /** Loads espeak-ng.data from next to the package's script (its own locateFile wins over any passed in). */
  const initEspeak: () => Promise<EspeakNgModule>
  export default initEspeak
}
