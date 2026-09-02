import {defineConfig} from 'vite'

export default defineConfig({
 build:{ssr:'server/http/node-server.ts',outDir:'dist-server',emptyOutDir:true,target:'node20',rollupOptions:{output:{entryFileNames:'node-server.js'}}},
})
