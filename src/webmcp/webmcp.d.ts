declare global {
interface WebMCPToolDefinition {
  name:string; title?:string; description:string; inputSchema:Record<string,unknown>
  execute:(input:unknown,context?:{signal:AbortSignal})=>unknown|Promise<unknown>
  annotations?:{readOnlyHint?:boolean;untrustedContentHint?:boolean}
}
interface WebMCPModelContext extends EventTarget {
  registerTool(tool:WebMCPToolDefinition,options?:{signal?:AbortSignal}):Promise<void>
  getTools?():Promise<Array<{name:string}>>
}
interface Document { readonly modelContext?:WebMCPModelContext }
}
export {}
