import { Router } from 'express'
import { checkParentPassword, signIn } from '../repository.js'

export const authRouter = Router()

// Placeholder grown-up checks: they answer yes/no and do not start a session yet.

authRouter.post('/sign-in', async (req, res) => {
  const adult = await signIn(req.body?.username, req.body?.password)
  if (!adult) {
    res.status(401).json({ error: 'That username or password is not right.' })
    return
  }
  res.json({ username: adult.username, role: adult.role, childIds: adult.childIds })
})

authRouter.post('/check-password', async (req, res) => {
  const ok = await checkParentPassword(req.body?.childId, req.body?.password)
  res.status(ok ? 200 : 401).json({ ok })
})
