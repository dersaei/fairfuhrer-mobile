import { createDirectus, rest, staticToken } from '@directus/sdk'

const directusUrl = process.env.EXPO_PUBLIC_DIRECTUS_URL!
const directusToken = process.env.EXPO_PUBLIC_DIRECTUS_TOKEN!

export const directus = createDirectus(directusUrl)
  .with(staticToken(directusToken))
  .with(rest())
