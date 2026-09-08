"use client"

import { Loader2Icon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"

type Mode = "sign-in" | "sign-up"

// Minimal email + password auth for the operator console. First registered
// user becomes the admin (see context/thought-process.md D-022).
export const LoginForm = () => {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (mode === "sign-up") {
        const { error } = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0]!,
          email,
          password,
        })
        if (error) throw new Error(error.message)
      } else {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) throw new Error(error.message)
      }
      router.replace("/admin")
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Something went wrong"
      )
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/bankgpt-mark.svg"
          alt="BankGPT"
          width={44}
          height={44}
          priority
        />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            BankGPT Automation Console
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "sign-in"
              ? "Sign in to operate capabilities and runs."
              : "Create the first operator account — it becomes the admin."}
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/6 bg-card/60 p-6"
      >
        {mode === "sign-up" && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-emerald-300/80 uppercase">
              Name
            </span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Ada Lovelace"
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-emerald-300/80 uppercase">
            Email
          </span>
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="operator@example.com"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-emerald-300/80 uppercase">
            Password
          </span>
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            placeholder="At least 8 characters"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="rounded-full">
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in")
            setError(null)
          }}
          className="text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === "sign-in"
            ? "No account yet? Create one"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  )
}
