// Search links to distributor sites, built from the part number. No API or account needed.
// Fixed https hosts + encodeURIComponent, so user-entered text can't change where the link goes.
export interface DistributorLink {
  name: string
  url: string
}

export function distributorLinks(mpn: string): DistributorLink[] {
  const q = encodeURIComponent(mpn.trim())
  if (!q) return []
  return [
    { name: 'DigiKey', url: `https://www.digikey.com/en/products/result?keywords=${q}` },
    { name: 'LCSC', url: `https://www.lcsc.com/search?q=${q}` },
    { name: 'Mouser', url: `https://www.mouser.com/c/?q=${q}` },
  ]
}
