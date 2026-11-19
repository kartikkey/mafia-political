import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'green' | 'danger' | 'ghost'
  size?: 'md' | 'lg'
}

export default function PixelButton({ variant = 'primary', size = 'md', className = '', ...rest }: Props) {
  return <button className={`px-btn px-btn--${variant} px-btn--${size} ${className}`} {...rest} />
}
