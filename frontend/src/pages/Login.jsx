import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { EyeIcon, EyeSlashIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import { api } from '../api.js'
import { Button, ErrorBanner, inputClass, labelClass } from '../ui.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.currentTarget)) })
      // Only same-site paths, so a crafted ?fra= cannot send the user to another site
      const fra = params.get('fra')
      navigate(fra?.startsWith('/') && !fra.startsWith('//') ? fra : '/', { replace: true })
    } catch (err) {
      setError(err)
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4">
      <form onSubmit={onSubmit} className="w-full max-w-[400px] space-y-5">
        <div>
          <p className="text-xl font-semibold tracking-[-0.02em]">Kong Arthur</p>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">Log ind</h1>
        </div>
        <ErrorBanner error={error} />
        <div>
          <label htmlFor="username" className={labelClass}>
            Brugernavn
          </label>
          <input id="username" name="username" required autoComplete="username" autoFocus className={inputClass} />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Adgangskode
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              className={inputClass + ' pr-11'}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1.5 right-1.5 px-2"
              aria-label={showPassword ? 'Skjul adgangskode' : 'Vis adgangskode'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? <EyeSlashIcon size={17} /> : <EyeIcon size={17} />}
            </Button>
          </div>
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <SpinnerGapIcon size={16} className="animate-spin" />
              Logger ind…
            </>
          ) : (
            'Log ind'
          )}
        </Button>
      </form>
    </div>
  )
}
