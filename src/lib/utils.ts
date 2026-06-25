import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Unambiguous alphabet (no 0/O/1/I/L) for human-friendly class codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateJoinCode(): string {
  let s = ''
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return `${s.slice(0, 3)}-${s.slice(3)}`
}

export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
