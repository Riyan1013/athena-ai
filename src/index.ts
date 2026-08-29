import { AthenaApp } from './app/AthenaApp.js'

const app = await AthenaApp.create()

await app.start()
