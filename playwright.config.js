import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'**/*.spec.js',timeout:30000,workers:2,use:{browserName:'chromium',baseURL:process.env.SHAKERRR_URL||'http://127.0.0.1:4173'},webServer:process.env.SHAKERRR_URL?undefined:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:true},reporter:'line'});
