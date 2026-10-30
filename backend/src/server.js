import app, { authService } from './app.js'

await authService.ensureSeedUser()
app.listen(3000, () => console.log('API listening on :3000'))
