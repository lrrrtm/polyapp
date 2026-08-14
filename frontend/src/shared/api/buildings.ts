import { z } from 'zod'
import { apiGet } from './http'

const buildingMapLinkSchema = z.object({
  id: z.string().uuid(),
  building_id: z.number(),
  yandex_maps_id: z.string(),
  yandex_maps_url: z.string().url(),
})

export type BuildingMapLink = z.infer<typeof buildingMapLinkSchema>

export async function getBuildingMapLinks(): Promise<BuildingMapLink[]> {
  return apiGet('/api/v1/buildings/map-links', z.array(buildingMapLinkSchema))
}
