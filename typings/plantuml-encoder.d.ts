declare module 'plantuml-encoder' {
  export function encode(input: string): string;
  export function decode(input: string): string;
  const plantumlEncoder: {
    encode: (input: string) => string;
    decode: (input: string) => string;
  };
  export default plantumlEncoder;
}
