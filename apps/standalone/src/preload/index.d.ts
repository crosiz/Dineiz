import type { DineizApi } from './index'

declare global {
  interface Window {
    dineiz: DineizApi
  }
}
