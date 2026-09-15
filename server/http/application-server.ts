import {createServer,type IncomingMessage,type ServerResponse} from 'node:http'
import {readFileSync,statSync} from 'node:fs'
import {extname,isAbsolute,relative,resolve} from 'node:path'
import type {GatewayRequest,GatewayResponse} from '../commerce/gateway'
import {MAX_REQUEST_BODY_BYTES} from '../commerce/gateway'
import {COSOURCE_UCP_AGENT_PROFILE_JSON,COSOURCE_UCP_PROFILE_PATH} from '../commerce/agent-profile'

export type GatewayHandler=(request:GatewayRequest)=>Promise<GatewayResponse>
export interface ApplicationServerOptions{gateway:GatewayHandler;staticRoot:string}
interface RuntimeResponse{status:number;headers:Record<string,string>;body:string|Buffer}
class RequestBodyTooLargeError extends Error{}
class InvalidRequestPathError extends Error{}

const securityHeaders={
 'content-security-policy':"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'",
 'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY',
 'permissions-policy':'camera=(), microphone=(), geolocation=()'
}
const contentTypes:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2'}
const json=(status:number,payload:unknown):RuntimeResponse=>({status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(payload)})
const safeError=(status:number,code:string,message:string)=>json(status,{ok:false,error:{code,message}})

async function readRequestBody(request:IncomingMessage):Promise<string>{
 const declared=Number(request.headers['content-length']);if(Number.isFinite(declared)&&declared>MAX_REQUEST_BODY_BYTES){request.resume();throw new RequestBodyTooLargeError()}
 return await new Promise((resolveBody,reject)=>{const chunks:Buffer[]=[];let size=0,exceeded=false;request.on('data',(chunk:Buffer)=>{size+=chunk.byteLength;if(size>MAX_REQUEST_BODY_BYTES){exceeded=true;return}chunks.push(chunk)});request.on('end',()=>exceeded?reject(new RequestBodyTooLargeError()):resolveBody(Buffer.concat(chunks).toString('utf8')));request.on('error',reject)})
}
function send(response:ServerResponse,result:RuntimeResponse,head=false){response.writeHead(result.status,{...securityHeaders,...result.headers});response.end(head?'':result.body)}
function requestPath(request:IncomingMessage){
 const encoded=new URL(request.url??'/','http://localhost').pathname
 if(/%(?:2f|5c)/i.test(encoded))throw new InvalidRequestPathError()
 let decoded:string
 try{decoded=decodeURIComponent(encoded)}catch{throw new InvalidRequestPathError()}
 if(decoded.includes('%')||decoded.includes('\0')||decoded.includes('\\')||decoded.split('/').includes('..'))throw new InvalidRequestPathError()
 return decoded
}
function safeStaticPath(root:string,pathname:string){const target=resolve(root,pathname.replace(/^\/+/,'')),fromRoot=relative(root,target);if(fromRoot.startsWith('..')||isAbsolute(fromRoot))return;return target}
function staticResponse(root:string,pathname:string):RuntimeResponse{
 const requested=pathname==='/'?resolve(root,'index.html'):safeStaticPath(root,pathname);if(!requested)return safeError(400,'invalid_path','Request path is invalid')
 let target=requested;try{if(!statSync(target).isFile())throw new Error('not a file')}catch{if(extname(pathname))return safeError(404,'not_found','File not found');target=resolve(root,'index.html')}
 try{const body=readFileSync(target);const extension=extname(target).toLowerCase(),html=extension==='.html',immutable=/^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[^/]+$/.test(pathname);return{status:200,headers:{'content-type':contentTypes[extension]??'application/octet-stream','cache-control':html?'no-store':immutable?'public, max-age=31536000, immutable':'public, max-age=3600'},body}}catch{return safeError(500,'internal_error','The request could not be completed')}
}

export function createApplicationServer({gateway,staticRoot}:ApplicationServerOptions){
 const root=resolve(staticRoot);try{if(!statSync(resolve(root,'index.html')).isFile())throw new Error()}catch{throw new Error('Production client build is missing; run npm run build before npm start')}
 return createServer(async(request,response)=>{try{const pathname=requestPath(request),method=request.method??'';if(pathname===COSOURCE_UCP_PROFILE_PATH){if(method!=='GET'&&method!=='HEAD'){send(response,safeError(405,'method_not_allowed','Only GET and HEAD are supported'));return}send(response,{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300'},body:COSOURCE_UCP_AGENT_PROFILE_JSON},method==='HEAD');return}if(pathname==='/health'){if(method!=='GET'&&method!=='HEAD'){send(response,safeError(405,'method_not_allowed','Only GET and HEAD are supported'));return}send(response,json(200,{ok:true,status:'healthy'}),method==='HEAD');return}if(pathname==='/api'||pathname.startsWith('/api/')){const result=await gateway({method,path:pathname,contentType:request.headers['content-type'],body:await readRequestBody(request)});send(response,{...result,headers:{...result.headers,'cache-control':'no-store'}});return}if(method!=='GET'&&method!=='HEAD'){send(response,safeError(405,'method_not_allowed','Only GET and HEAD are supported'));return}send(response,staticResponse(root,pathname),method==='HEAD')}catch(error){const tooLarge=error instanceof RequestBodyTooLargeError,invalidPath=error instanceof InvalidRequestPathError;send(response,safeError(tooLarge?413:invalidPath?400:500,tooLarge?'request_too_large':invalidPath?'invalid_path':'internal_error',tooLarge?'Request body is too large':invalidPath?'Request path is invalid':'The request could not be completed'))}})
}
