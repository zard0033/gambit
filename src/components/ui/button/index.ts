import { cva, type VariantProps } from 'class-variance-authority'

export { default as Button } from './button.vue'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn font-semibold leading-none select-none transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:pointer-events-none disabled:opacity-40 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0',
  {
    // Gambit 風：深青瓷 jade 為主、山吹金 gold 為 reward/CTA；純色/漸層非 RPG 貼圖
    variants: {
      variant: {
        default: 'bg-primary text-primary-fg shadow-button hover:bg-primary-dark',
        gold: 'bg-linear-to-b from-gold-light to-gold text-gold-ink shadow-[0_1px_2px_rgba(61,34,16,0.12),0_0_14px_rgba(248,181,0,0.3)] hover:brightness-105',
        secondary: 'bg-surface-card text-ink border border-line hover:bg-surface-hover',
        ghost: 'bg-transparent text-primary-dark border-[1.5px] border-line-strong hover:bg-surface-hover',
        hint: 'bg-hint-light text-hint border-[1.5px] border-hint-ring hover:brightness-[0.98]',
        danger: 'bg-danger text-danger-fg shadow-button hover:bg-danger-dark',
        outline: 'border border-line bg-transparent text-ink hover:bg-surface-hover',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-[49px] px-6',
        sm: 'min-h-[44px] px-4 text-sm',
        lg: 'min-h-[52px] px-8 text-lg',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
